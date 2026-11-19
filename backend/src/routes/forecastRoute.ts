import { Router } from "express";
import { getForecastForUser, postForecast } from "../controllers/forecastController.js";

const router = Router();

// Proxies to the Python ML service (per-envelope forecast + unusual spending alerts)
router.post("/", postForecast);
router.get("/:userId", getForecastForUser);

export default router;
