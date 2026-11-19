import { sql } from "../config/db.js"
import { Request, Response } from "express";
import { addMonths, getActiveMonth, parseMonth, setMonthAssigned } from "../services/budgetService.js";

// Returns one category shaped for a given month:
// target_amount = amount assigned for that month, rollover = always 0 (no carryover between months), default_amount = monthly default
async function getCategoryForMonth(categoryId: string, month: string) {
  const [row] = await sql`
    SELECT
      c.id, c.user_id, c.group_id, c.name, c.current_amount, c.created_at,
      c.target_amount AS default_amount,
      COALESCE(b.assigned, 0) AS target_amount,
      0 AS rollover,
      to_char(${month}::date, 'YYYY-MM') AS month
    FROM categories c
    LEFT JOIN category_budgets b ON b.category_id = c.id AND b.month = ${month}::date
    WHERE c.id = ${categoryId}
  `;
  return row;
}

async function findUserCategory(userId: string, inputName: string) {
  const cleanInput = inputName.trim();
  if (!cleanInput) return null;

  // Exact case-insensitive match
  const [exactMatch] = await sql`
    SELECT id, name, current_amount, target_amount 
    FROM categories 
    WHERE user_id = ${userId} AND LOWER(TRIM(name)) = LOWER(${cleanInput})
    LIMIT 1
  `;
  if (exactMatch) return exactMatch;

  // Partial / substring match
  const [partialMatch] = await sql`
    SELECT id, name, current_amount, target_amount 
    FROM categories 
    WHERE user_id = ${userId} 
      AND (
        name ILIKE ${`%${cleanInput}%`} 
        OR ${cleanInput} ILIKE '%' || name || '%'
      )
    LIMIT 1
  `;
  return partialMatch || null;
}

export async function getCategories(req : Request, res : Response) {
    try {
        const userId = String(req.params.userId)
        const month = parseMonth(req.query.month)

        // Without ?month= keep the original behaviour (used by chat / other callers)
        if (!month) {
            const categories = await sql`
                SELECT * FROM categories
                WHERE user_id = ${ userId }
                ORDER BY created_at DESC
            `
            return res.status(200).json(categories)
        }

        const nextMonth = addMonths(month, 1)

        // Month view: assigned comes from category_budgets (nothing is carried over).
        // Categories created after that month (and with no budget row) are hidden.
        const categories = await sql`
            SELECT
                c.id, c.user_id, c.group_id, c.name, c.current_amount, c.created_at,
                c.target_amount AS default_amount,
                COALESCE(b.assigned, 0) AS target_amount,
                0 AS rollover,
                (b.id IS NOT NULL) AS has_budget,
                to_char(${month}::date, 'YYYY-MM') AS month
            FROM categories c
            LEFT JOIN category_budgets b
                ON b.category_id = c.id AND b.month = ${month}::date
            WHERE c.user_id = ${ userId }
              AND (b.id IS NOT NULL OR c.created_at < ${nextMonth}::date)
            ORDER BY c.created_at DESC
        `

        res.status(200).json(categories)
    } catch (e) {
        console.error("Error fetching categories:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createCategory (req : Request, res : Response) {
    try {
        const { user_id, group_id, name, target_amount, month: monthInput } = req.body;

        if (!user_id || !group_id || !name) {
            return res.status(400).json({ error: "Missing required fields - user_id, group_id, and name" });
        }

        const assignedAmount = target_amount !== undefined ? Number(target_amount) : 0;

        const [category] = await sql`
            INSERT INTO categories (user_id, group_id, name, target_amount, current_amount)
            VALUES (${user_id}, ${group_id}, ${name}, ${assignedAmount}, ${assignedAmount})
            RETURNING *
        `;

        // Seed the budget row for the month being viewed (or the user's active month)
        const month = parseMonth(monthInput) || await getActiveMonth(user_id);
        await setMonthAssigned(user_id, category.id, month, assignedAmount);

        res.status(201).json(await getCategoryForMonth(category.id, month));
    } catch (e) {
        console.error("Error creating category:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteCategory(req : Request, res : Response) {
    try {
        const { id } = req.params

        const result = await sql`
            DELETE FROM categories
            WHERE id = ${ id } RETURNING *
        `

        if (result.length === 0) {
            return res.status(404).json({ message:"Category not found!" })
        }

        res.status(200).json({ message:"Category deleted successfully" })
    } catch (e) {
        console.error("Error deleting category:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateCategory(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const categoryId = String(id);
        // month: which month's assigned amount to change (defaults to the user's active month)
        // apply_to_default: false = one-off change for this month only (e.g. covering overspending)
        const { group_id, name, current_amount, month: monthInput, apply_to_default } = req.body;
        // The amount may arrive as target_amount (original), assigned or budget
        const target_amount = req.body.target_amount ?? req.body.assigned ?? req.body.budget;
        const requesterId = req.body.userId ?? req.body.user_id;

        if (!categoryId) {
            return res.status(400).json({ error: "Category ID is required" });
        }

        const hasTarget = target_amount !== undefined && target_amount !== null;
        if (hasTarget && (!Number.isFinite(Number(target_amount)) || Number(target_amount) < 0)) {
            return res.status(400).json({ error: "Budget amount must be a number of 0 or more" });
        }

        // If the caller says who they are, make sure the category is theirs before changing it
        if (requesterId) {
            const [owned] = await sql`SELECT id FROM categories WHERE id = ${categoryId} AND user_id = ${String(requesterId)}`;
            if (!owned) {
                return res.status(404).json({ error: "Category not found" });
            }
        }

        const newDefault = hasTarget && apply_to_default !== false ? Number(target_amount) : null;

        const [updatedCategory] = await sql`
            UPDATE categories
            SET 
                group_id = COALESCE(${group_id ?? null}, group_id),
                name = COALESCE(${name ?? null}, name),
                target_amount = COALESCE(${newDefault}, target_amount),
                current_amount = COALESCE(${current_amount ?? null}, current_amount)
            WHERE id = ${categoryId}
            RETURNING *;
        `;

        if (!updatedCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        const month = parseMonth(monthInput) || await getActiveMonth(updatedCategory.user_id);
        if (hasTarget) {
            // Seeds the month's other envelopes if needed, then guarantees this envelope's (category, month) row holds the new amount
            await setMonthAssigned(updatedCategory.user_id, categoryId, month, Number(target_amount));
            await sql`
                INSERT INTO category_budgets (user_id, category_id, month, assigned, rollover)
                VALUES (${updatedCategory.user_id}, ${categoryId}, ${month}::date, ${Number(target_amount)}, 0)
                ON CONFLICT (category_id, month) DO UPDATE
                SET assigned = EXCLUDED.assigned, updated_at = CURRENT_TIMESTAMP
            `;
        }

        res.status(200).json(await getCategoryForMonth(categoryId, month));
    } catch (e) {
        console.error("Error updating category:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function reallocateBudget(req: Request, res: Response) {
  try {
    const userId = Array.isArray(req.body.userId)
      ? req.body.userId[0]
      : req.body.userId;
    const { sourceName, destName, amount, month: monthInput } = req.body;

    // Input validation
    if (!userId || !sourceName || !destName || amount === undefined) {
      return res.status(400).json({
        error: "Missing required fields: userId, sourceName, destName, amount",
      });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        error: "Transfer amount must be a positive number",
      });
    }

    // Lookup source and destination categories
    const sourceBudget = await findUserCategory(userId, String(sourceName));
    const destBudget = await findUserCategory(userId, String(destName));

    if (!sourceBudget) {
      return res.status(404).json({
        error: `Source budget "${sourceName}" not found`,
      });
    }

    if (!destBudget) {
      return res.status(404).json({
        error: `Destination budget "${destName}" not found`,
      });
    }

    if (sourceBudget.id === destBudget.id) {
      return res.status(400).json({
        error: "Source and destination budgets cannot be the same",
      });
    }

    // Reallocation only affects the active month's envelopes
    const month = parseMonth(monthInput) || await getActiveMonth(userId);
    const sourceMonth = await getCategoryForMonth(sourceBudget.id, month);
    const destMonth = await getCategoryForMonth(destBudget.id, month);

    // Validate against the source's allocated budget for this month
    const sourceAllocated = Number(sourceMonth?.target_amount ?? 0);

    if (transferAmount > sourceAllocated) {
      return res.status(400).json({
        error: `Insufficient allocated budget. Cannot transfer $${transferAmount.toFixed(
          2
        )} from "${sourceBudget.name}" because its total allocated budget is only $${sourceAllocated.toFixed(
          2
        )}.`,
      });
    }

    // Move the assigned amount between the two envelopes for this month only
    await setMonthAssigned(userId, sourceBudget.id, month, -transferAmount, "delta");
    await setMonthAssigned(userId, destBudget.id, month, transferAmount, "delta");

    const updatedSource = await getCategoryForMonth(sourceBudget.id, month);
    const updatedDest = await getCategoryForMonth(destBudget.id, month);

    return res.status(200).json({
      message: "Budget successfully reallocated",
      transfer: {
        source: updatedSource.name,
        destination: updatedDest.name,
        amount: transferAmount,
        previousSourceAllocated: sourceAllocated,
        newSourceBalance: Number(updatedSource.target_amount),
        previousDestAllocated: Number(destMonth?.target_amount ?? 0),
        newDestBalance: Number(updatedDest.target_amount),
        month: updatedSource.month,
      },
    });
  } catch (e: any) {
    console.error("Error executing budget reallocation:", e);
    return res.status(500).json({
      error: "Internal server error during reallocation",
      details: e.message,
    });
  }
}