import express from "express";
import { rolloverBudgets } from "../controllers/budgetsController.js";

const router = express.Router();

// Roll envelopes forward to the month reported by the user's phone (idempotent)
router.post("/rollover/:userId", rolloverBudgets);

export default router;
