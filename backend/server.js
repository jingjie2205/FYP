import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { sql } from "./config/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// middleware
app.use(express.json());

app.use((req, res, next) => {
    console.log("Hit a request: ", req.method, req.url);
    next();
});

async function initDB() {
    try {
        await sql`CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            category VARCHAR(255) NOT NULL,
            created_at DATE NOT NULL DEFAULT CURRENT_DATE 
            )`;

            console.log("Transactions database initialized successfully.");
    } catch (e){
        console.error("Error initializing transactions database:", e);
        process.exit(1);
    }
}

app.get("/", (req, res) => {
    res.send("test!");
});

app.post("/api/transactions", async (req, res) => {
    try {
        const { title, amount, category, user_id } = req.body;

        if (!title || !amount || category === undefined || !user_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const transaction = await sql`
            INSERT INTO transactions (user_id, title, amount, category)
            VALUES (${user_id}, ${title}, ${amount}, ${category})
            RETURNING *
        `;

        console.log(transaction);
        res.status(201).json(transaction[0]);
    } catch (e) {
        console.error("Error creating transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});