import express from "express"
import { createTransaction, deleteTransaction, getSummary, getTransactionsByUserId } from "../controllers/transactionsController.ts"

const router = express.Router()

// GET transactions by user_id
router.get("/:userId", getTransactionsByUserId)

// DELETE transactions by user_id
router.delete("/:id", deleteTransaction)

// GET Summary 
router.get("/summary/:userId", getSummary)

router.post("/", createTransaction);

export default router