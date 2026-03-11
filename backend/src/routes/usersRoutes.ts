import express from "express"
import { createUser } from "../controllers/usersController.ts"

const router = express.Router()

router.post("/", createUser)

export default router