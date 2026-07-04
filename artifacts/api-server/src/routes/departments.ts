import { Router, type IRouter } from "express";
import { db, departmentsTable, employeesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/departments", async (req, res): Promise<void> => {
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);

  const result = await Promise.all(
    departments.map(async (d) => {
      const [empCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(employeesTable)
        .where(eq(employeesTable.department, d.name));

      return {
        id: d.id,
        name: d.name,
        employeeCount: Number(empCount?.count ?? 0),
        createdAt: d.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/departments", async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name required" });
    return;
  }

  const [dept] = await db.insert(departmentsTable).values({ name }).returning();
  res.status(201).json({
    id: dept.id,
    name: dept.name,
    employeeCount: 0,
    createdAt: dept.createdAt.toISOString(),
  });
});

router.get("/departments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  const [empCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(employeesTable)
    .where(eq(employeesTable.department, dept.name));

  res.json({
    id: dept.id,
    name: dept.name,
    employeeCount: Number(empCount?.count ?? 0),
    createdAt: dept.createdAt.toISOString(),
  });
});

router.patch("/departments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [dept] = await db
    .update(departmentsTable)
    .set({ name: req.body.name })
    .where(eq(departmentsTable.id, id))
    .returning();

  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  res.json({
    id: dept.id,
    name: dept.name,
    employeeCount: 0,
    createdAt: dept.createdAt.toISOString(),
  });
});

router.delete("/departments/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  res.sendStatus(204);
});

export default router;
