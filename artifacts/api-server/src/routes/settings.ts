import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";

const router: IRouter = Router();

function formatSettings(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    companyName: s.companyName,
    companyEmail: s.companyEmail,
    companyPhone: s.companyPhone,
    companyAddress: s.companyAddress,
    overtimeRatePerHour: Number(s.overtimeRatePerHour),
    continueDutyRate: Number(s.continueDutyRate),
    lateDeductionPerMinute: Number(s.lateDeductionPerMinute),
    gracePeriodMinutes: s.gracePeriodMinutes,
    workingHoursPerDay: Number(s.workingHoursPerDay),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/settings", async (req, res): Promise<void> => {
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    // Create default settings
    const [created] = await db.insert(settingsTable).values({}).returning();
    settings = created;
  }
  res.json(formatSettings(settings));
});

router.patch("/settings", async (req, res): Promise<void> => {
  let [existing] = await db.select().from(settingsTable).limit(1);

  const updates: Record<string, unknown> = {};
  if (req.body.companyName !== undefined) updates.companyName = req.body.companyName;
  if (req.body.companyEmail !== undefined) updates.companyEmail = req.body.companyEmail;
  if (req.body.companyPhone !== undefined) updates.companyPhone = req.body.companyPhone;
  if (req.body.companyAddress !== undefined) updates.companyAddress = req.body.companyAddress;
  if (req.body.overtimeRatePerHour !== undefined) updates.overtimeRatePerHour = String(req.body.overtimeRatePerHour);
  if (req.body.continueDutyRate !== undefined) updates.continueDutyRate = String(req.body.continueDutyRate);
  if (req.body.lateDeductionPerMinute !== undefined) updates.lateDeductionPerMinute = String(req.body.lateDeductionPerMinute);
  if (req.body.gracePeriodMinutes !== undefined) updates.gracePeriodMinutes = Number(req.body.gracePeriodMinutes);
  if (req.body.workingHoursPerDay !== undefined) updates.workingHoursPerDay = String(req.body.workingHoursPerDay);

  if (!existing) {
    const [created] = await db.insert(settingsTable).values({}).returning();
    existing = created;
  }

  const [settings] = await db
    .update(settingsTable)
    .set(updates)
    .returning();

  res.json(formatSettings(settings));
});

export default router;
