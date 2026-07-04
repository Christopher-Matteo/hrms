import { Router, type IRouter } from "express";
import { db, holidaysTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/holidays", async (req, res): Promise<void> => {
  const { year } = req.query;

  let query = db.select().from(holidaysTable).$dynamic();
  if (year) {
    query = query.where(sql`extract(year from ${holidaysTable.date}::date) = ${Number(year)}`);
  }
  const holidays = await query.orderBy(holidaysTable.date);

  res.json(holidays.map(h => ({
    id: h.id,
    name: h.name,
    date: h.date,
    createdAt: h.createdAt.toISOString(),
  })));
});

router.post("/holidays", async (req, res): Promise<void> => {
  const { name, date } = req.body;
  if (!name || !date) {
    res.status(400).json({ error: "Name and date required" });
    return;
  }

  const [holiday] = await db.insert(holidaysTable).values({ name, date }).returning();
  res.status(201).json({
    id: holiday.id,
    name: holiday.name,
    date: holiday.date,
    createdAt: holiday.createdAt.toISOString(),
  });
});

router.delete("/holidays/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(holidaysTable).where(eq(holidaysTable.id, id));
  res.sendStatus(204);
});

export default router;
