import express from "express"
import { getBudgets, createBudget, deleteBudget, updateBudget } from "../controllers/budgetsController.js"

const router = express.Router()

// GET budget by user_id
router.get("/:userId", getBudgets)

// DELETE budget by id
router.delete("/:id", deleteBudget)

// Create budget by user_id
router.post("/:userId", createBudget);

// Update budget by id
router.put("/:id", updateBudget)

export default router