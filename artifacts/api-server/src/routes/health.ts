import { Router, type IRouter } from "express";
import { db, usersTable, employeesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    const [result] = await db.select({ count: sql`count(*)` }).from(usersTable);
    const [empResult] = await db.select({ count: sql`count(*)` }).from(employeesTable);
    res.json({
      status: "ok",
      database: "connected",
      usersCount: Number(result?.count || 0),
      employeesCount: Number(empResult?.count || 0),
      dbUrlExists: !!process.env.DATABASE_URL,
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: err.message,
      dbUrlExists: !!process.env.DATABASE_URL,
    });
  }
});

export default router;
