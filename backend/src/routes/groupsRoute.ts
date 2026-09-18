import express from "express";
import { getGroups, createGroup, deleteGroup, updateGroup } from "../controllers/groupsController.ts";

const router = express.Router();

// GET category groups by user_id
router.get("/:userId", getGroups);

// DELETE category group by id
router.delete("/:id", deleteGroup);

// Create category group by user_id
router.post("/:userId", createGroup);

// Update category group by id
router.put("/:id", updateGroup);

export default router;