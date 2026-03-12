import express from "express"
import { getCategories, createCategory, deleteCategory } from "../controllers/categoriesController.js"

const router = express.Router()

// GET categories by user_id
router.get("/:userId", getCategories)

// DELETE category by id
router.delete("/:id", deleteCategory)

router.post("/", createCategory);

export default router