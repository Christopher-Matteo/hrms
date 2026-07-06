import { Router, type IRouter } from "express";
import { db, branchesTable, employeesTable, attendanceTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/kiosk/branches", async (req, res): Promise<void> => {
  const branches = await db
    .select({
      id: branchesTable.id,
      name: branchesTable.name,
      address: branchesTable.address,
      latitude: branchesTable.latitude,
      longitude: branchesTable.longitude,
    })
    .from(branchesTable)
    .orderBy(branchesTable.name);

  res.json(
    branches.map((b) => ({
      ...b,
      latitude: b.latitude ? Number(b.latitude) : null,
      longitude: b.longitude ? Number(b.longitude) : null,
    }))
  );
});

router.post("/kiosk/lookup", async (req, res): Promise<void> => {
  const { employeeCode } = req.body;

  if (!employeeCode || typeof employeeCode !== "string") {
    res.status(400).json({ error: "employeeCode is required" });
    return;
  }

  const [employee] = await db
    .select({
      id: employeesTable.id,
      employeeId: employeesTable.employeeId,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      designation: employeesTable.designation,
      department: employeesTable.department,
      branchId: employeesTable.branchId,
      status: employeesTable.status,
      photoUrl: employeesTable.photoUrl,
    })
    .from(employeesTable)
    .where(
      sql`LOWER(${employeesTable.employeeId}) = LOWER(${employeeCode.trim()})`
    );

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  if (employee.status !== "active") {
    res.status(403).json({ error: "Employee is not active" });
    return;
  }

  const [branch] = await db
    .select({ id: branchesTable.id, name: branchesTable.name })
    .from(branchesTable)
    .where(eq(branchesTable.id, employee.branchId));

  const today = new Date().toISOString().split("T")[0];
  const [todayAttendance] = await db
    .select({
      id: attendanceTable.id,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      status: attendanceTable.status,
    })
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, employee.id),
        eq(attendanceTable.date, today!)
      )
    );

  res.json({
    employee: {
      id: employee.id,
      employeeId: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`,
      designation: employee.designation,
      department: employee.department,
      branchId: employee.branchId,
      branchName: branch?.name ?? "Unknown Branch",
      photoUrl: employee.photoUrl,
    },
    todayAttendance: todayAttendance
      ? {
          id: todayAttendance.id,
          checkIn: todayAttendance.checkIn,
          checkOut: todayAttendance.checkOut,
          status: todayAttendance.status,
        }
      : null,
  });
});

router.post("/kiosk/submit", async (req, res): Promise<void> => {
  const { employeeId, type, latitude, longitude, branchId } = req.body;

  if (!employeeId || typeof employeeId !== "number") {
    res.status(400).json({ error: "employeeId (number) is required" });
    return;
  }
  if (type !== "checkin" && type !== "checkout") {
    res.status(400).json({ error: "type must be 'checkin' or 'checkout'" });
    return;
  }

  const [employee] = await db
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      branchId: employeesTable.branchId,
    })
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0]!;
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, employee.id),
        eq(attendanceTable.date, today)
      )
    );

  if (type === "checkin") {
    if (existing) {
      if (existing.checkIn) {
        res.status(409).json({
          error: "Already checked in today",
          checkIn: existing.checkIn,
        });
        return;
      }
      const [updated] = await db
        .update(attendanceTable)
        .set({ checkIn: nowTime, status: "present" })
        .where(eq(attendanceTable.id, existing.id))
        .returning();
      res.json({ success: true, type: "checkin", time: nowTime, record: updated });
    } else {
      const [created] = await db
        .insert(attendanceTable)
        .values({
          employeeId: employee.id,
          date: today,
          status: "present",
          checkIn: nowTime,
          remarks: latitude && longitude ? `GPS: ${latitude},${longitude}` : null,
        })
        .returning();
      res.json({ success: true, type: "checkin", time: nowTime, record: created });
    }
  } else {
    if (!existing || !existing.checkIn) {
      res.status(400).json({ error: "Cannot check out without checking in first" });
      return;
    }
    if (existing.checkOut) {
      res.status(409).json({
        error: "Already checked out today",
        checkOut: existing.checkOut,
      });
      return;
    }

    const [inH, inM] = existing.checkIn.split(":").map(Number) as [number, number];
    const [outH, outM] = nowTime.split(":").map(Number) as [number, number];
    const workingMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    const workingHours = Math.max(0, workingMinutes / 60).toFixed(2);

    const [updated] = await db
      .update(attendanceTable)
      .set({
        checkOut: nowTime,
        workingHours: workingHours,
        remarks: latitude && longitude ? `GPS: ${latitude},${longitude}` : null,
      })
      .where(eq(attendanceTable.id, existing.id))
      .returning();

    res.json({ success: true, type: "checkout", time: nowTime, workingHours: Number(workingHours), record: updated });
  }
});

export default router;
