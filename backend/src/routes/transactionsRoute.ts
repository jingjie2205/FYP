import express from "express"
import { createTransaction, deleteTransaction, updateTransaction, getSummary, getTransactionsByUserId } from "../controllers/transactionsController.js"

const router = express.Router()

// GET transactions by user_id
router.get("/:userId", getTransactionsByUserId)

// UPDATE transaction by id (body must include user_id)
router.put("/:id", updateTransaction)

// DELETE transactions by user_id
router.delete("/:id", deleteTransaction)

// GET Summary 
router.get("/summary/:userId", getSummary)

router.post("/", createTransaction);

export default router