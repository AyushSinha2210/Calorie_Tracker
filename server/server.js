import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { detectFoodFromImage, analyzeFoodText, estimateNutritionFallback } from "./services/geminiService.js";
import { getNutrition } from "./services/fatsecretService.js";
import multer from "multer";
import foodRoutes from "./routes/food.js";
import workoutRoutes from "./routes/workout.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/api/food", foodRoutes);
app.use("/api/workout", workoutRoutes);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'), false)
});

app.post("/analyze-food", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    res.json(await analyzeFoodText(text));
  } catch (e) {
    const msg = e.message || '';
    res.json({ items: [], total_calories: 0, total_protein: 0, note: /429|quota|Rate limit/.test(msg) ? "Gemini API quota exceeded. Wait and retry." : "Service temporarily unavailable" });
  }
});

app.post("/analyze-food-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file provided" });
    const detected = await detectFoodFromImage(req.file.buffer.toString('base64'), req.file.mimetype);
    if (!detected.items?.length) return res.json({ items: [], total_calories: 0, total_protein: 0, note: "No food items detected" });
    const items = detected.items.map(i => ({ name: i.name, quantity: `${i.grams}g`, grams: i.grams, calories: 0, protein: 0 }));
    res.json({ items, total_calories: 0, total_protein: 0, needsNutritionCalculation: true });
  } catch (e) { res.status(500).json({ error: "Failed to analyze food image", details: e.message }); }
});

app.post("/calculate-nutrition", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: "No food items provided" });

    const results = [], failedItems = [];
    for (const item of items) {
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
    res.json({ items: finalItems, total_calories: finalItems.reduce((s, i) => s + i.calories, 0), total_protein: finalItems.reduce((s, i) => s + i.protein, 0) });
  } catch (e) { res.status(500).json({ error: "Failed to calculate nutrition", details: e.message }); }
});

app.post("/lookup-food", async (req, res) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
