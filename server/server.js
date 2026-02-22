import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { detectFoodFromImage } from "./services/geminiService.js";
import { estimateNutritionWithGroq, analyzeNutritionFromText } from "./services/groqService.js";
import { getNutrition } from "./services/fatsecretService.js";
import multer from "multer";
import { createGzip } from "zlib";

dotenv.config();
const app = express();
app.use(cors());

// Lightweight compression middleware (no extra dependency)
app.use((req, res, next) => {
  if (!req.headers["accept-encoding"]?.includes("gzip")) return next();
  const origJson = res.json.bind(res);
  res.json = (body) => {
    const data = Buffer.from(JSON.stringify(body));
    if (data.length < 1024) return origJson(body); // skip small responses
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Type", "application/json");
    const gz = createGzip();
    gz.pipe(res);
    gz.end(data);
  };
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'), false)
});

app.post("/analyze-food", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") return res.status(400).json({ error: "No text provided" });
    if (text.length > 1000) return res.status(400).json({ error: "Text too long (max 1000 chars)" });

    // Single Groq call: detects food items + calculates nutrition together
    const nutrition = await analyzeNutritionFromText(text);
    res.json(nutrition);
  } catch (e) {
    const msg = e.message || '';
    res.json({ items: [], total_calories: 0, total_protein: 0, note: /429|quota|rate.limit/i.test(msg) ? "API quota exceeded. Please wait a minute and try again." : "Service temporarily unavailable" });
  }
});

app.post("/analyze-food-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file provided" });
    const detected = await detectFoodFromImage(req.file.buffer.toString('base64'), req.file.mimetype);
    if (!detected.items?.length) return res.json({ items: [], total_calories: 0, total_protein: 0, note: "No food items detected" });
    const items = detected.items.map(i => ({ name: i.name, quantity: `${i.grams}g`, grams: i.grams, calories: 0, protein: 0 }));
    res.json({ items, total_calories: 0, total_protein: 0, needsNutritionCalculation: true });
  } catch (e) {
    const status = e.isQuotaError ? 429 : 500;
    res.status(status).json({ error: e.isQuotaError ? e.message : "Failed to analyze food image", details: e.message });
  }
});

app.post("/calculate-nutrition", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: "No food items provided" });

    // Parallel lookups — all items fetched concurrently
    const lookupResults = await Promise.allSettled(
      items.map(async (item) => {
        const grams = item.grams || Number.parseInt(item.quantity) || 100;
        const nutrition = await getNutrition(item.name, grams);
        return nutrition ? { ...nutrition, _found: true } : { name: item.name, grams, _found: false };
      })
    );

    const results = lookupResults.map((r) =>
      r.status === "fulfilled" ? r.value : { name: "unknown", grams: 100, _found: false }
    );

    // Batch-send failed items to Groq in one call
    const failedItems = results
      .map((r, i) => (!r._found ? { name: r.name, grams: r.grams, index: i } : null))
      .filter(Boolean);

    if (failedItems.length) {
      const groqResult = await estimateNutritionWithGroq(failedItems);
      for (const fi of failedItems) {
        const gi = groqResult?.items?.[failedItems.indexOf(fi)] || groqResult?.items?.find(g => g.name.toLowerCase().includes(fi.name.toLowerCase().split(' ')[0]));
        results[fi.index] = { name: fi.name, grams: fi.grams, calories: gi?.calories || 0, protein: gi?.protein || 0, source: gi ? 'groq' : 'unknown' };
      }
    }

    const finalItems = results.map(i => ({ name: i.name, quantity: `${i.grams}g`, grams: i.grams, calories: i.calories || 0, protein: i.protein || 0, source: i.source || 'unknown' }));
    res.json({ items: finalItems, total_calories: finalItems.reduce((s, i) => s + i.calories, 0), total_protein: finalItems.reduce((s, i) => s + i.protein, 0) });
  } catch (e) { res.status(500).json({ error: "Failed to calculate nutrition", details: e.message }); }
});

app.post("/lookup-food", async (req, res) => {
  try {
    const { name, quantity } = req.body;
    if (!name) return res.status(400).json({ error: "Food name is required" });
    let grams = 100;
    if (quantity) { const m = quantity.match(/(\d+(?:\.\d+)?)\s*g/i); if (m) grams = Number.parseFloat(m[1]); }
    const result = await getNutrition(name, grams);
    if (result) return res.json({ name: result.name, quantity: `${grams}g`, grams, calories: result.calories, protein: result.protein });
    res.status(404).json({ error: "Food not found" });
  } catch (e) { res.status(500).json({ error: "Failed to lookup food", details: e.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
