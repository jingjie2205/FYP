import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimiter from "./middleware/rateLimiter.ts";
import transactionsRoute from "./routes/transactionsRoute.ts"
import job from "./config/cron.ts"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CRON JOB
if (process.env.NODE_ENV === "production") {
  job.start();
}

// middleware
app.use(cors());
app.use(express.json());
app.use(rateLimiter)

app.get("/api/health", (req : Request, res : Response) => {
    res.status(200).json({ message: "OK" });
})

app.use((req : Request, res : Response, next : NextFunction) => {
    console.log("Hit a request: ", req.method, req.url);
    next();
});

app.get("/", ( req : Request, res : Response) => {
    res.send("test!");
});

app.use("/api/transactions", transactionsRoute)