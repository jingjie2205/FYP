import { sql } from "../config/db.js"
import { Request, Response } from "express";

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
        const { userId } = req.params

        const categories = await sql`
            SELECT * FROM categories
            WHERE user_id = ${ userId }
            ORDER BY created_at DESC
        `

        res.status(200).json(categories)
    } catch (e) {
        console.error("Error fetching categories:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createCategory (req : Request, res : Response) {
    try {
        const { user_id, group_id, name, target_amount } = req.body;

        if (!user_id || !group_id || !name) {
            return res.status(400).json({ error: "Missing required fields - user_id, group_id, and name" });
        }

        const assignedAmount = target_amount !== undefined ? Number(target_amount) : 0;

        const [category] = await sql`
            INSERT INTO categories (user_id, group_id, name, target_amount, current_amount)
            VALUES (${user_id}, ${group_id}, ${name}, ${assignedAmount}, ${assignedAmount})
            RETURNING *
        `;

        console.log(category);
        res.status(201).json(category);
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
        const { group_id, name, target_amount, current_amount } = req.body;

        if (!id) {
            return res.status(400).json({ error: "Category ID is required" });
        }

        const [updatedCategory] = await sql`
            UPDATE categories
            SET 
                group_id = COALESCE(${group_id}, group_id),
                name = COALESCE(${name}, name),
                target_amount = COALESCE(${target_amount}, target_amount),
                current_amount = COALESCE(${current_amount}, current_amount)
            WHERE id = ${id}
            RETURNING *;
        `;

        if (!updatedCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        res.status(200).json(updatedCategory);
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
    const { sourceName, destName, amount } = req.body;

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

    // Validate available funds in source envelope
    const availableBalance = Number(sourceBudget.current_amount);

    if (transferAmount > availableBalance) {
      return res.status(400).json({
        error: `Insufficient funds. Cannot transfer $${transferAmount.toFixed(
          2
        )} from "${sourceBudget.name}" because it only has $${availableBalance.toFixed(
          2
        )} available.`,
      });
    }

    // Execute updates and return updated rows
    const [updatedSource] = await sql`
      UPDATE categories 
      SET current_amount = current_amount - ${transferAmount}
      WHERE id = ${sourceBudget.id}
      RETURNING *
    `;

    const [updatedDest] = await sql`
      UPDATE categories 
      SET current_amount = current_amount + ${transferAmount}
      WHERE id = ${destBudget.id}
      RETURNING *
    `;

    return res.status(200).json({
      message: "Budget successfully reallocated",
      transfer: {
        source: updatedSource.name,
        destination: updatedDest.name,
        amount: transferAmount,
        newSourceBalance: Number(updatedSource.current_amount),
        newDestBalance: Number(updatedDest.current_amount),
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