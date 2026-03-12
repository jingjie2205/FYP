import { sql } from "../config/db.js"
import express, { Request, Response } from "express";

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
        const { user_id, name, type } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const category = await sql`
            INSERT INTO categories (user_id, name, type)
            VALUES (${user_id}, ${name}, ${type})
            RETURNING *
        `;

        console.log(category);
        res.status(201).json(category[0]);
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