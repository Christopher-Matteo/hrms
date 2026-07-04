import { Router, type IRouter } from "express";
import { db, weeklyOffPoliciesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function formatPolicy(p: typeof weeklyOffPoliciesTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    policyType: p.policyType,
    offDays: p.offDays,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/weekly-off-policies", async (req, res): Promise<void> => {
  const policies = await db.select().from(weeklyOffPoliciesTable).orderBy(weeklyOffPoliciesTable.name);
  res.json(policies.map(formatPolicy));
});

router.post("/weekly-off-policies", async (req, res): Promise<void> => {
  const { name, policyType, offDays } = req.body;
  if (!name || !policyType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [policy] = await db
    .insert(weeklyOffPoliciesTable)
    .values({ name, policyType, offDays: offDays ?? null })
    .returning();

  res.status(201).json(formatPolicy(policy));
});

router.get("/weekly-off-policies/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [policy] = await db.select().from(weeklyOffPoliciesTable).where(eq(weeklyOffPoliciesTable.id, id));
  if (!policy) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(formatPolicy(policy));
});

router.patch("/weekly-off-policies/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.policyType !== undefined) updates.policyType = req.body.policyType;
  if (req.body.offDays !== undefined) updates.offDays = req.body.offDays;

  const [policy] = await db
    .update(weeklyOffPoliciesTable)
    .set(updates)
    .where(eq(weeklyOffPoliciesTable.id, id))
    .returning();

  if (!policy) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(formatPolicy(policy));
});

router.delete("/weekly-off-policies/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(weeklyOffPoliciesTable).where(eq(weeklyOffPoliciesTable.id, id));
  res.sendStatus(204);
});

export default router;
