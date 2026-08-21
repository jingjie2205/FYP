import express from "express";
import { 
    getAccounts, 
    createAccount, 
    updateAccount, 
    deleteAccount 
} from "../controllers/accountsController.js";

const router = express.Router();

// GET accounts by user_id
router.get("/:userId", getAccounts);

// CREATE account 
router.post("/:userId", createAccount);

// UPDATE account by id
router.patch("/:id", updateAccount);

// DELETE account by id
router.delete("/:id", deleteAccount);

export default router;