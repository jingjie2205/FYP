import express from "express"
import { 
    getCategories, 
    createCategory, 
    updateCategory, 
    deleteCategory 
} from "../controllers/categoriesController.js"

const router = express.Router()

// GET categories by user_id
router.get("/:userId", getCategories)

// CREATE category
router.post("/:userId", createCategory);

// UPDATE category by id (updating name, target_amount, and current_amount)
router.patch("/:id", updateCategory);

// DELETE category by id
router.delete("/:id", deleteCategory)

export default router