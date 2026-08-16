import { Router, type IRouter } from "express";
import { db, shiftsTable, shiftScheduleTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

function formatShift(s: typeof shiftsTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    gracePeriodMinutes: s.gracePeriodMinutes,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/shifts", async (req, res): Promise<void> => {
  const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.name);
  res.json(shifts.map(formatShift));
});

router.post("/shifts", async (req, res): Promise<void> => {
  const { name, startTime, endTime, gracePeriodMinutes } = req.body;
  if (!name || !startTime || !endTime) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [shift] = await db
    .insert(shiftsTable)
    .values({ name, startTime, endTime, gracePeriodMinutes: gracePeriodMinutes ?? 15 })
    .returning();

  res.status(201).json(formatShift(shift));
});

router.get("/shifts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }
  res.json(formatShift(shift));
});

router.patch("/shifts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
  if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
  if (req.body.gracePeriodMinutes !== undefined) updates.gracePeriodMinutes = req.body.gracePeriodMinutes;

  const [shift] = await db
    .update(shiftsTable)
    .set(updates)
    .where(eq(shiftsTable.id, id))
    .returning();

  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }
  res.json(formatShift(shift));
});

router.delete("/shifts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.sendStatus(204);
});

router.get("/shifts/schedules", async (req, res): Promise<void> => {
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

  let query = db
    .select({
      id: shiftScheduleTable.id,
      employeeId: shiftScheduleTable.employeeId,
      date: shiftScheduleTable.date,
      shiftId: shiftScheduleTable.shiftId,
      shiftName: shiftsTable.name,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      createdAt: shiftScheduleTable.createdAt,
    })
    .from(shiftScheduleTable)
    .innerJoin(shiftsTable, eq(shiftScheduleTable.shiftId, shiftsTable.id));

  const conditions = [];
  if (employeeId) {
    conditions.push(eq(shiftScheduleTable.employeeId, employeeId));
  }
  if (startDate) {
    conditions.push(gte(shiftScheduleTable.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(shiftScheduleTable.date, endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const list = await query.orderBy(shiftScheduleTable.date);
  res.json(list.map(s => ({ ...s, createdAt: s.createdAt.toISOString() })));
});

router.post("/shifts/schedules", async (req, res): Promise<void> => {
  const { employeeId, shiftId, date, dates } = req.body;
  if (!employeeId || !shiftId) {
    res.status(400).json({ error: "employeeId and shiftId are required" });
    return;
  }

  const targetDates: string[] = [];
  if (date) targetDates.push(date);
  if (dates && Array.isArray(dates)) targetDates.push(...dates);

  if (targetDates.length === 0) {
    res.status(400).json({ error: "At least one date is required" });
    return;
  }

  const results = [];
  for (const d of targetDates) {
    // Check if already scheduled
    const [existing] = await db
      .select()
      .from(shiftScheduleTable)
      .where(and(eq(shiftScheduleTable.employeeId, Number(employeeId)), eq(shiftScheduleTable.date, d)));

    if (existing) {
      const [updated] = await db
        .update(shiftScheduleTable)
        .set({ shiftId: Number(shiftId) })
        .where(eq(shiftScheduleTable.id, existing.id))
        .returning();
      results.push(updated);
    } else {
      const [inserted] = await db
        .insert(shiftScheduleTable)
        .values({ employeeId: Number(employeeId), shiftId: Number(shiftId), date: d })
        .returning();
      results.push(inserted);
    }
  }

  // Format the returned values to match ShiftSchedule schema by joining shift properties
  const formattedResults = [];
  for (const r of results) {
    const [sh] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, r.shiftId));
    formattedResults.push({
      id: r.id,
      employeeId: r.employeeId,
      date: r.date,
      shiftId: r.shiftId,
      shiftName: sh?.name ?? null,
      startTime: sh?.startTime ?? null,
      endTime: sh?.endTime ?? null,
      createdAt: r.createdAt.toISOString(),
    });
  }

  res.status(201).json(formattedResults);
});

export default router;
