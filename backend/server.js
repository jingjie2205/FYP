import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { sql } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// middleware
app.use(express.json());
app.use(rateLimiter)

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

// GET transactions by user_id
app.get("/api/transactions/:userId", async (req, res) => {
    try {
        const { userId } = req.params

        const transactions = await sql`
            SELECT * FROM transactions 
            WHERE user_id = ${ userId } 
            ORDER BY created_at DESC
        `

        res.status(200).json(transactions)
    } catch (e) {
        console.error("Error creating transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
})

// DELETE transactions by user_id
app.delete("/api/transactions/:id", async (req, res) => {
    try {
        const { id } = req.params

        // Validate id before hitting sql query
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ message:"Invalid transaction ID" })
        }

        const result = await sql`
            DELETE FROM transactions
            WHERE id = ${ id } RETURNING *
        `

        if (result.length === 0) {
            return res.status(404).json({ message:"Transaction not found!" })
        }

        res.status(200).json({ message:"Transactions deleted successfully" })
    } catch (e) {
        console.error("Error creating transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
})

// GET Summary 
app.get("/api/transactions/summary/:userId", async (req, res) => {
    try {
        const { userId } = req.params

        const balanceResult = await sql `
            SELECT COALESCE(SUM(amount), 0) as balance FROM transactions WHERE user_id = ${ userId }
        `

        const incomeResult = await sql `
            SELECT COALESCE(SUM(amount), 0) as income FROM transactions
        `

        const expensesResult = await sql `
            SELECT COALESCE(SUM(amount), 0) as expenses FROM transactions 
            WHERE user_id = ${ userId } AND amount < 0
        `

        res.status(200).json({
            balance: balanceResult[0].balance,
            income: incomeResult[0].income,
            expenses: expensesResult[0].expenses,
        })
    } catch (e) {
        console.error("Error getting summary:", e);
        res.status(500).json({ error: "Internal server error" });
    }
})

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