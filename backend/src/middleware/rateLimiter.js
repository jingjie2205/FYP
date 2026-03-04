import ratelimiter from "../config/upstash.js"

const rateLimiter = async(req, res , next) => {
    try {
        // Placeholder - use user_id or ip address in future
        const { success } = await ratelimiter.limit("my-rate-limit")

        if (!success) {
            return res.status(429).json({ message: "Too many requests, try again later." })
        }

        next()
    } catch (e) {
        console.log("Rate Limit Error", e)
        next(error)
    }
}

export default rateLimiter