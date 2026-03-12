import express from "express"
import { getAccounts, createAccount } from "../controllers/accountsController.js"

const router = express.Router()

// GET account by user_id
router.get("/:userId", getAccounts)

// DELETE account by id
// router.delete("/:id", deleteAccount)

// Create account by user_id
router.post("/:userId", createAccount);

// Update account by id
// router.put("/:id", updateAccount)

export default router