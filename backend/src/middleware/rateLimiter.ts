import ratelimiter from "../config/upstash.js"
import { Request, Response, NextFunction } from "express";

const rateLimiter = async(req : Request, res : Response , next : NextFunction) => {
    try {
        // Placeholder - use user_id or ip address in future
        const { success } = await ratelimiter.limit("my-rate-limit")

        if (!success) {
            return res.status(429).json({ message: "Too many requests, try again later." })
        }

        next()
    } catch (e) {
        console.log("Rate Limit Error", e)
        next(e)
    }
}

export default rateLimiter