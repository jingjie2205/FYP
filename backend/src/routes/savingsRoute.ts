import express from "express";
import { getSavingsPlans, createSavingsPlan, updateSavingsPlan, deleteSavingsPlan } from "../controllers/savingsController.js";

const router = express.Router();

// GET all savings plans by user_id
router.get("/:userId", getSavingsPlans);

// POST create savings plan by user_id
router.post("/:userId", createSavingsPlan);

// PUT update savings plan by plan id
router.put("/plan/:id", updateSavingsPlan);

// DELETE savings plan by plan id
router.delete("/plan/:id", deleteSavingsPlan);

export default router;