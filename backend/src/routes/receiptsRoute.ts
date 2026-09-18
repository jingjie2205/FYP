import { Router } from "express";
import { parseReceiptWithGemini } from "../services/geminiService.js";

const router = Router();

router.post("/scan", async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    // Pass the base64 string directly to Gemini
    const data = await parseReceiptWithGemini(image, mimeType || "image/jpeg");
    return res.json(data);
  } catch (err: any) {
    console.error("OCR Scan Error:", err);
    return res.status(500).json({ error: err.message || "Failed to scan receipt" });
  }
});

export default router;