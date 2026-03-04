import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimiter from "./middleware/rateLimiter.js";
import { initDB } from "./config/db.js";

import transactionsRoute from "./routes/transactionsRoute.js"

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// middleware
app.use(cors());
app.use(express.json());
app.use(rateLimiter)

app.use((req, res, next) => {
    console.log("Hit a request: ", req.method, req.url);
    next();
});

app.get("/", (req, res) => {
    res.send("test!");
});

app.use("/api/transactions", transactionsRoute)

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});