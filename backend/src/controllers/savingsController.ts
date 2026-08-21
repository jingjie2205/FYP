import { Request, Response } from "express";
import { sql } from "../config/db.js";

// GET all savings plans for a specific user
export async function getSavingsPlans(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        const plans = await sql`
            SELECT 
                id,
                user_id,
                name,
                target_amount,
                saved_amount,
                deadline,
                created_at
            FROM savings_plans
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        res.status(200).json(plans);
    } catch (e) {
        console.error("Error fetching savings plans:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

// CREATE a new savings plan
export async function createSavingsPlan(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        const { name, target_amount, saved_amount, deadline } = req.body;

        if (!name || target_amount === undefined) {
            return res.status(400).json({ error: "Missing required fields - name and target_amount" });
        }

        // Ensure the user exists in the database to prevent foreign key violations
        await sql`
            INSERT INTO users (id) 
            VALUES (${userId}) 
            ON CONFLICT (id) DO NOTHING
        `;

        const [newPlan] = await sql`
            INSERT INTO savings_plans (user_id, name, target_amount, saved_amount, deadline)
            VALUES (${userId}, ${name}, ${target_amount || 0}, ${saved_amount || 0}, ${deadline || null})
            RETURNING *;
        `;

        res.status(201).json(newPlan);
    } catch (e) {
        console.error("Error creating savings plan:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

// UPDATE an existing savings plan
export async function updateSavingsPlan(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, target_amount, saved_amount, deadline } = req.body;

        const [updatedPlan] = await sql`
            UPDATE savings_plans
            SET 
                name = COALESCE(${name}, name),
                target_amount = COALESCE(${target_amount}, target_amount),
                saved_amount = COALESCE(${saved_amount}, saved_amount),
                deadline = COALESCE(${deadline}, deadline)
            WHERE id = ${id}
            RETURNING *;
        `;

        if (!updatedPlan) {
            return res.status(404).json({ error: "Savings plan not found" });
        }

        res.status(200).json(updatedPlan);
    } catch (e) {
        console.error("Error updating savings plan:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteSavingsPlan(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const [deletedPlan] = await sql`
            DELETE FROM savings_plans
            WHERE id = ${id}
            RETURNING *;
        `;

        if (!deletedPlan) {
            return res.status(404).json({ error: "Savings plan not found" });
        }

        res.status(200).json({ message: "Savings plan deleted successfully", deletedPlan });
    } catch (e) {
        console.error("Error deleting savings plan:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}