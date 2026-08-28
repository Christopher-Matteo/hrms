import { Router, type IRouter } from "express";
import { db, leavesTable, employeesTable, attendanceTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

async function formatLeave(
  l: typeof leavesTable.$inferSelect,
  preFetchedEmp?: { firstName: string; lastName: string; employeeId: string } | null
) {
  let emp = preFetchedEmp;
  if (emp === undefined) {
    const [dbEmp] = await db
      .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName, employeeId: employeesTable.employeeId })
      .from(employeesTable)
      .where(eq(employeesTable.id, l.employeeId));
    emp = dbEmp ?? null;
  }

  return {
    id: l.id,
    employeeId: l.employeeId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeCode: emp?.employeeId ?? null,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    days: l.days,
    status: l.status,
    reason: l.reason,
    managerComment: l.managerComment,
    approvedById: l.approvedById,
    informed: l.informed,
    salaryCalculate: l.salaryCalculate,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/leaves", async (req, res): Promise<void> => {
  const { employeeId, status } = req.query;

  const conditions = [];
  if (employeeId) conditions.push(eq(leavesTable.employeeId, Number(employeeId)));
  if (status) conditions.push(eq(leavesTable.status, String(status)));

  let query = db
    .select({
      leave: leavesTable,
      employeeFirstName: employeesTable.firstName,
      employeeLastName: employeesTable.lastName,
      employeeCode: employeesTable.employeeId,
    })
    .from(leavesTable)
    .leftJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
    .$dynamic();

  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(leavesTable.createdAt);

  const result = await Promise.all(
    rows.map((r) =>
      formatLeave(
        r.leave,
        r.employeeFirstName && r.employeeLastName && r.employeeCode
          ? {
              firstName: r.employeeFirstName,
              lastName: r.employeeLastName,
              employeeId: r.employeeCode,
            }
          : null
      )
    )
  );
  res.json(result);
});

router.post("/leaves", async (req, res): Promise<void> => {
  const { employeeId, leaveType, startDate, endDate, reason, informed, salaryCalculate } = req.body;
  if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Calculate days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const [leave] = await db
    .insert(leavesTable)
    .values({
      employeeId: Number(employeeId),
      leaveType,
      startDate,
      endDate,
      days,
      status: "approved", // Automatically approved when created by HR
      reason,
      managerComment: "Created manually by HR",
      approvedById: null,
      informed: informed || "informed",
      salaryCalculate: salaryCalculate || "calculate",
    })
    .returning();

  // Create manual attendance records for this approved leave immediately
  try {
    const startD = new Date(startDate);
    const endD = new Date(endDate);
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId)));
    const homeBranchId = emp?.branchId ?? null;

    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      
      const [existing] = await db.select().from(attendanceTable)
        .where(and(eq(attendanceTable.employeeId, Number(employeeId)), eq(attendanceTable.date, dateStr)));
        
      let leaveStatus = "paid_leave";
      if ((salaryCalculate || "calculate") === "no_calculate") {
        leaveStatus = "absent";
      } else if (leaveType === "sick") {
        leaveStatus = "sick_leave";
      }
      
      const remarks = `Leave (${leaveType}, ${informed || 'informed'}, ${salaryCalculate || 'calculate'}): ${reason}`;

      if (existing) {
        await db.update(attendanceTable)
          .set({ status: leaveStatus, homeBranchId, source: "MANUAL", remarks })
          .where(eq(attendanceTable.id, existing.id));
      } else {
        await db.insert(attendanceTable)
          .values({
            employeeId: Number(employeeId),
            date: dateStr,
            status: leaveStatus,
            homeBranchId,
            source: "MANUAL",
            remarks,
          });
      }
    }
  } catch (err) {
    console.error("Failed to populate attendance logs for created leave:", err);
  }

  res.status(201).json(await formatLeave(leave));
});

router.get("/leaves/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [leave] = await db.select().from(leavesTable).where(eq(leavesTable.id, id));
  if (!leave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(await formatLeave(leave));
});

router.patch("/leaves/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existingLeave] = await db
    .select()
    .from(leavesTable)
    .where(eq(leavesTable.id, id));

  if (!existingLeave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }

  const [leave] = await db
    .update(leavesTable)
    .set({ status: "approved", managerComment: req.body.comment ?? null })
    .where(eq(leavesTable.id, id))
    .returning();

  // Create manual attendance records for approved leaves
  try {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const employeeId = leave.employeeId;

    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId));
    const homeBranchId = emp?.branchId ?? null;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      
      const [existing] = await db.select().from(attendanceTable)
        .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, dateStr)));
        
      let leaveStatus = "paid_leave";
      if (leave.salaryCalculate === "no_calculate") {
        leaveStatus = "absent";
      } else if (leave.leaveType === "sick") {
        leaveStatus = "sick_leave";
      }
      
      const remarks = `Approved leave (${leave.leaveType}, ${leave.informed}, ${leave.salaryCalculate}): ${leave.reason}`;
      
      if (existing) {
        await db.update(attendanceTable)
          .set({ status: leaveStatus, homeBranchId, source: "MANUAL", remarks })
          .where(eq(attendanceTable.id, existing.id));
      } else {
        await db.insert(attendanceTable)
          .values({
            employeeId,
            date: dateStr,
            status: leaveStatus,
            homeBranchId,
            source: "MANUAL",
            remarks,
          });
      }
    }
  } catch (err) {
    console.error("Failed to populate attendance logs for approved leave:", err);
  }

  res.json(await formatLeave(leave));
});

router.patch("/leaves/:id/reject", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [leave] = await db
    .update(leavesTable)
    .set({ status: "rejected", managerComment: req.body.comment ?? null })
    .where(eq(leavesTable.id, id))
    .returning();

  if (!leave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(await formatLeave(leave));
});

router.put("/leaves/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  
  const { employeeId, leaveType, startDate, endDate, reason, informed, salaryCalculate } = req.body;
  if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // 1. Get existing leave request to clean up previous attendance logs if date/info changes
  const [existingLeave] = await db.select().from(leavesTable).where(eq(leavesTable.id, id));
  if (!existingLeave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }

  // Calculate days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // 2. Clean up old attendance records created by the old leave request
  try {
    const oldStart = new Date(existingLeave.startDate);
    const oldEnd = new Date(existingLeave.endDate);
    for (let d = new Date(oldStart); d <= oldEnd; d.setDate(d.getDate() + 1)) {
      const oldDateStr = d.toISOString().split("T")[0];
      await db.delete(attendanceTable)
        .where(
          and(
            eq(attendanceTable.employeeId, existingLeave.employeeId),
            eq(attendanceTable.date, oldDateStr),
            eq(attendanceTable.source, "MANUAL")
          )
        );
    }
  } catch (err) {
    console.error("Failed to clean up old attendance records during leave edit:", err);
  }

  // 3. Update leave request in DB
  const [updatedLeave] = await db
    .update(leavesTable)
    .set({
      employeeId: Number(employeeId),
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      informed: informed || "informed",
      salaryCalculate: salaryCalculate || "calculate",
    })
    .where(eq(leavesTable.id, id))
    .returning();

  // 4. Create new attendance logs immediately if it is already approved
  if (updatedLeave.status === "approved") {
    try {
      const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId)));
      const homeBranchId = emp?.branchId ?? null;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        
        let leaveStatus = "paid_leave";
        if (updatedLeave.salaryCalculate === "no_calculate") {
          leaveStatus = "absent";
        } else if (updatedLeave.leaveType === "sick") {
          leaveStatus = "sick_leave";
        }
        
        const remarks = `Leave (${updatedLeave.leaveType}, ${updatedLeave.informed}, ${updatedLeave.salaryCalculate}): ${updatedLeave.reason}`;
        
        await db.insert(attendanceTable)
          .values({
            employeeId: Number(employeeId),
            date: dateStr,
            status: leaveStatus,
            homeBranchId,
            source: "MANUAL",
            remarks,
          });
      }
    } catch (err) {
      console.error("Failed to populate attendance logs for updated leave:", err);
    }
  }

  res.json(await formatLeave(updatedLeave));
});

router.delete("/leaves/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existingLeave] = await db.select().from(leavesTable).where(eq(leavesTable.id, id));
  if (!existingLeave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }

  // 1. Delete the leave request from DB
  await db.delete(leavesTable).where(eq(leavesTable.id, id));

  // 2. Clean up all manual attendance records that were generated for this leave range
  try {
    const start = new Date(existingLeave.startDate);
    const end = new Date(existingLeave.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      await db.delete(attendanceTable)
        .where(
          and(
            eq(attendanceTable.employeeId, existingLeave.employeeId),
            eq(attendanceTable.date, dateStr),
            eq(attendanceTable.source, "MANUAL")
          )
        );
    }
  } catch (err) {
    console.error("Failed to delete attendance logs for deleted leave:", err);
  }

  res.json({ success: true });
});

export default router;
