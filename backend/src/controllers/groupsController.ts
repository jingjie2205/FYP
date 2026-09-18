import { sql } from "../config/db.js"
import { Request, Response } from "express";

export async function getGroups(req : Request, res : Response) {
    try {
        const { userId } = req.params

        const groups = await sql`
            SELECT * FROM category_groups
            WHERE user_id = ${ userId }
            ORDER BY created_at DESC
        `

        res.status(200).json(groups)
    } catch (e) {
        console.error("Error fetching category groups:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createGroup(req : Request, res : Response) {
    try {
        const { user_id, name } = req.body;

        if (!user_id || !name) {
            return res.status(400).json({
                error: "Missing required fields - user_id and name",
            });
        }

        const group = await sql`
            INSERT INTO category_groups (user_id, name)
            VALUES (${user_id}, ${name})
            RETURNING *
        `;

        console.log(group);
        res.status(201).json(group[0]);
    } catch (e) {
        console.error("Error creating category group:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteGroup(req : Request, res : Response) {
    try {
        const { id } = req.params

        const result = await sql`
            DELETE FROM category_groups
            WHERE id = ${ id } RETURNING *
        `

        if (result.length === 0) {
            return res.status(404).json({ message: "Category group not found!" })
        }

        res.status(200).json({ message: "Category group deleted successfully" })
    } catch (e) {
        console.error("Error deleting category group:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateGroup(req : Request, res : Response){
    try {
        const { id } = req.params
        const { name } = req.body

        if (!id) {
            return res.status(400).json({ error: "Group ID is required" })
        }

        const result = await sql`
            UPDATE category_groups
            SET 
                name = COALESCE(${name}, name)
            WHERE id = ${id}
            RETURNING *
        `

        if (result.length === 0) {
            return res.status(404).json({ error: "Category group not found" })
        }

        res.status(200).json(result[0])
    } catch (e) {
        console.error("Error updating category group:", e)
        res.status(500).json({ error: "Internal server error" })
    }
}