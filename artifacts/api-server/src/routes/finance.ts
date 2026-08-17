import { Router, type IRouter } from "express";
import { db, expensesTable, incomeTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// ==========================================
// EXPENSES CRUD
// ==========================================

router.get("/finance/expenses", async (req, res): Promise<void> => {
  try {
    const list = await db.select().from(expensesTable).orderBy(desc(expensesTable.date));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to load expenses" });
  }
});

router.post("/finance/expenses", async (req, res): Promise<void> => {
  const { title, category, amount, date, status } = req.body;
  if (!title || !category || amount == null || !date) {
    res.status(400).json({ error: "Title, category, amount, and date are required" });
    return;
  }

  try {
    const [expense] = await db
      .insert(expensesTable)
      .values({
        title,
        category,
        amount: String(amount),
        date,
        status: status || "approved",
      })
      .returning();
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to create expense" });
  }
});

router.patch("/finance/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { title, category, amount, date, status } = req.body;

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (category !== undefined) updates.category = category;
  if (amount !== undefined) updates.amount = String(amount);
  if (date !== undefined) updates.date = date;
  if (status !== undefined) updates.status = status;

  try {
    const [expense] = await db
      .update(expensesTable)
      .set(updates)
      .where(eq(expensesTable.id, id))
      .returning();
    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to update expense" });
  }
});

router.delete("/finance/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.delete(expensesTable).where(eq(expensesTable.id, id));
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// ==========================================
// INCOME CRUD
// ==========================================

router.get("/finance/income", async (req, res): Promise<void> => {
  try {
    const list = await db.select().from(incomeTable).orderBy(desc(incomeTable.date));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to load income" });
  }
});

router.post("/finance/income", async (req, res): Promise<void> => {
  const { title, category, amount, date, status } = req.body;
  if (!title || !category || amount == null || !date) {
    res.status(400).json({ error: "Title, category, amount, and date are required" });
    return;
  }

  try {
    const [inc] = await db
      .insert(incomeTable)
      .values({
        title,
        category,
        amount: String(amount),
        date,
        status: status || "approved",
      })
      .returning();
    res.status(201).json(inc);
  } catch (error) {
    res.status(500).json({ error: "Failed to create income" });
  }
});

router.patch("/finance/income/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { title, category, amount, date, status } = req.body;

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (category !== undefined) updates.category = category;
  if (amount !== undefined) updates.amount = String(amount);
  if (date !== undefined) updates.date = date;
  if (status !== undefined) updates.status = status;

  try {
    const [inc] = await db
      .update(incomeTable)
      .set(updates)
      .where(eq(incomeTable.id, id))
      .returning();
    if (!inc) {
      res.status(404).json({ error: "Income not found" });
      return;
    }
    res.json(inc);
  } catch (error) {
    res.status(500).json({ error: "Failed to update income" });
  }
});

router.delete("/finance/income/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.delete(incomeTable).where(eq(incomeTable.id, id));
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete income" });
  }
});

export default router;
