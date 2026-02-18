import express from "express";
import multer from "multer";
import { detectFoodFromImage, analyzeFoodText, estimateNutritionFallback } from "../services/geminiService.js";
import { getNutrition } from "../services/fatsecretService.js";
import { db } from "../config/firebase.js";
import { collection, doc, addDoc } from "firebase/firestore";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'), false)
});

router.post("/detect", upload.single('image'), async (req, res) => {
  try {
    let imageBase64, mimeType;
    if (req.file) { imageBase64 = req.file.buffer.toString('base64'); mimeType = req.file.mimetype; }
    else if (req.body.imageBase64) { imageBase64 = req.body.imageBase64; mimeType = req.body.mimeType || "image/jpeg"; }
    else return res.status(400).json({ error: "No image provided" });

    const detected = await detectFoodFromImage(imageBase64, mimeType);
    if (!detected.items?.length) return res.json({ items: [], total_calories: 0, total_protein: 0, note: "No food items detected" });

    const items = detected.items.map(i => ({ name: i.name, quantity: `${i.grams}g`, grams: i.grams, calories: 0, protein: 0 }));
    res.json({ items, total_calories: 0, total_protein: 0, needsNutritionCalculation: true });
  } catch (e) { res.status(500).json({ error: "Failed to detect food", details: e.message }); }
});

router.post("/confirm", async (req, res) => {
  try {
    const { userId, foods } = req.body;
    if (!foods?.length) return res.status(400).json({ error: "No food items provided" });

    const results = [], failedItems = [];
    for (const item of foods) {
      const grams = item.grams || parseInt(item.quantity) || 100;
      const nutrition = await getNutrition(item.name, grams);
      if (nutrition) results.push(nutrition);
      else { failedItems.push({ name: item.name, grams, index: results.length }); results.push(null); }
    }

    if (failedItems.length) {
      const gemini = await estimateNutritionFallback(failedItems);
      for (const fi of failedItems) {
        const gi = gemini?.items?.[failedItems.indexOf(fi)] || gemini?.items?.find(g => g.name.toLowerCase().includes(fi.name.toLowerCase().split(' ')[0]));
        results[fi.index] = { name: fi.name, grams: fi.grams, calories: gi?.calories || 0, protein: gi?.protein || 0, source: gi ? 'gemini' : 'unknown' };
      }
    }

    const finalItems = results.map(i => ({ name: i.name, quantity: `${i.grams}g`, grams: i.grams, calories: i.calories, protein: i.protein, source: i.source }));
    const total_calories = finalItems.reduce((s, i) => s + i.calories, 0);
    const total_protein = finalItems.reduce((s, i) => s + i.protein, 0);

    if (userId) {
      await addDoc(collection(doc(collection(db, "users"), userId), "meals"), { date: new Date(), items: finalItems, total_calories, total_protein });
    }
    res.json({ items: finalItems, total_calories, total_protein });
  } catch (e) { res.status(500).json({ error: "Failed to calculate nutrition", details: e.message }); }
});

router.post("/analyze-text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    res.json(await analyzeFoodText(text));
  } catch (e) { res.json({ items: [], total_calories: 0, total_protein: 0, note: "Service temporarily unavailable" }); }
});

router.post("/lookup", async (req, res) => {
  try {
    const { name, quantity } = req.body;
    if (!name) return res.status(400).json({ error: "Food name is required" });
    let grams = 100;
    if (quantity) { const m = quantity.match(/(\d+(?:\.\d+)?)\s*g/i); if (m) grams = parseFloat(m[1]); }
    const result = await getNutrition(name, grams);
    if (result) return res.json({ name: result.name, quantity: `${grams}g`, grams, calories: result.calories, protein: result.protein });
    res.status(404).json({ error: "Food not found" });
  } catch (e) { res.status(500).json({ error: "Failed to lookup food", details: e.message }); }
});

export default router;
