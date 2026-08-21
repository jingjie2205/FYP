import { sql } from "../config/db.js"
import { Request, Response } from "express";

export async function getCategories(req : Request, res : Response) {
    try {
        const { userId } = req.params

        const categories = await sql`
            SELECT * FROM categories
            WHERE user_id = ${ userId } OR is_system = TRUE
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
        const { user_id, name, target_amount } = req.body;

        if (!user_id || !name) {
            return res.status(400).json({ error: "Missing required fields - user_id and name" });
        }

        const assignedAmount = target_amount !== undefined ? Number(target_amount) : 0;

        // In YNAB model, initial current_amount (available) matches the initial target_amount (assigned)
        const [category] = await sql`
            INSERT INTO categories (user_id, name, target_amount, current_amount)
            VALUES (${user_id}, ${name}, ${assignedAmount}, ${assignedAmount})
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
        const { name, target_amount, current_amount } = req.body;

        if (!id) {
            return res.status(400).json({ error: "Category ID is required" });
        }

        const [updatedCategory] = await sql`
            UPDATE categories
            SET 
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