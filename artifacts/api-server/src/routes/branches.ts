import { Router, type IRouter } from "express";
import { db, branchesTable, employeesTable, payrollTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/branches", async (req, res): Promise<void> => {
  const branches = await db.select().from(branchesTable).orderBy(branchesTable.name);

  const result = await Promise.all(
    branches.map(async (b) => {
      const [empCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(employeesTable)
        .where(eq(employeesTable.branchId, b.id));

      const [payrollSum] = await db
        .select({ total: sql<number>`coalesce(sum(net_salary), 0)` })
        .from(payrollTable)
        .where(eq(payrollTable.employeeId, b.id)); // simplified

      return {
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        email: b.email,
        managerId: b.managerId,
        managerName: null as string | null,
        employeeCount: Number(empCount?.count ?? 0),
        payrollCost: 0,
        createdAt: b.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/branches", async (req, res): Promise<void> => {
  const { name, address, phone, email, managerId } = req.body;
  if (!name || !address || !phone || !email) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [branch] = await db
    .insert(branchesTable)
    .values({ name, address, phone, email, managerId: managerId ?? null })
    .returning();

  res.status(201).json({
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    email: branch.email,
    managerId: branch.managerId,
    managerName: null,
    employeeCount: 0,
    payrollCost: 0,
    createdAt: branch.createdAt.toISOString(),
  });
});

router.get("/branches/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, id));
  if (!branch) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }

  const [empCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(employeesTable)
    .where(eq(employeesTable.branchId, id));

  res.json({
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    email: branch.email,
    managerId: branch.managerId,
    managerName: null,
    employeeCount: Number(empCount?.count ?? 0),
    payrollCost: 0,
    createdAt: branch.createdAt.toISOString(),
  });
});

router.patch("/branches/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.address !== undefined) updates.address = req.body.address;
  if (req.body.phone !== undefined) updates.phone = req.body.phone;
  if (req.body.email !== undefined) updates.email = req.body.email;
  if (req.body.managerId !== undefined) updates.managerId = req.body.managerId;

  const [branch] = await db
    .update(branchesTable)
    .set(updates)
    .where(eq(branchesTable.id, id))
    .returning();

  if (!branch) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }

  res.json({
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    email: branch.email,
    managerId: branch.managerId,
    managerName: null,
    employeeCount: 0,
    payrollCost: 0,
    createdAt: branch.createdAt.toISOString(),
  });
});

router.delete("/branches/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(branchesTable).where(eq(branchesTable.id, id));
  res.sendStatus(204);
});

export default router;
