import "dotenv/config";
import dns from "node:dns";
// Force ALL DNS lookups to IPv4 — Render free tier has no IPv6 connectivity
dns.setDefaultResultOrder("ipv4first");
const _origLookup = dns.lookup;
dns.lookup = function (hostname, options, cb) {
  if (typeof options === "function") { cb = options; options = { family: 4 }; }
  else if (typeof options === "number") { options = { family: 4 }; }
  else { options = Object.assign({}, options || {}, { family: 4 }); }
  return _origLookup.call(dns, hostname, options, cb);
};
import express from "express";
import cors from "cors";
import { detectFoodFromImage, getGeminiModelStatus } from "./services/geminiService.js";
import { estimateNutritionWithGroq, analyzeNutritionFromText, getGroqModelStatus } from "./services/groqService.js";
import { getNutrition } from "./services/fatsecretService.js";
import { scheduleUserCleanup, deleteInactiveUsers } from "./services/userCleanupService.js";
import { sendOnDemandReport, sendOnDemandReportWithData, scheduleEmailReports } from "./services/emailReportService.js";
import { searchExercises, getCategories, getExerciseInfo, calculateCaloriesBurned } from "./services/workoutService.js";
import { generateCoachComment, buildPrompt, getPromptTemplates } from "./services/aiCoachService.js";
import multer from "multer";
import { createGzip } from "node:zlib";

const app = express();
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
  credentials: true,
}));

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

app.post("/analyze-food-image", (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: "File too large (max 10MB)" });
      return res.status(400).json({ error: err.message || "Invalid file upload" });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file provided" });
    const detected = await detectFoodFromImage(req.file.buffer.toString('base64'), req.file.mimetype);
    if (!detected.items?.length) return res.json({ items: [], total_calories: 0, total_protein: 0, note: "No food items detected" });
    const items = detected.items.map(i => ({ name: i.name, quantity: `${i.grams}g`, grams: i.grams, calories: 0, protein: 0 }));
    res.json({ items, total_calories: 0, total_protein: 0, needsNutritionCalculation: true });
  } catch (e) {
    if (e.isQuotaError) return res.status(429).json({ error: e.message });
    if (/not valid JSON|Unexpected token/i.test(e.message)) return res.json({ items: [], total_calories: 0, total_protein: 0, note: "Could not detect food items in this image. Try a clearer photo." });
    res.status(500).json({ error: "Failed to analyze food image", details: e.message });
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

// ── Model RPD status endpoint ──
// GET /model-status — shows current RPD usage for all Gemini & Groq models
app.get("/model-status", (req, res) => {
  res.json({
    gemini: getGeminiModelStatus(),
    groq: getGroqModelStatus(),
  });
});

// ── Email report endpoints ──

// POST /email-report/send — send an on-demand report right now
app.post("/email-report/send", async (req, res) => {
  try {
    const { uid, email, displayName, frequency } = req.body;
    if (!uid || !email) return res.status(400).json({ error: "uid and email are required" });
    await sendOnDemandReport(uid, email, displayName || "", frequency || "weekly");
    res.json({ message: `Report sent to ${email}` });
  } catch (e) {
    console.error("[EMAIL] On-demand send failed:", e.message);
    res.status(500).json({ error: "Failed to send report", details: e.message });
  }
});

// POST /email-report/send-with-data — send report using data from frontend (no Firebase Admin needed)
app.post("/email-report/send-with-data", async (req, res) => {
  try {
    const { email, displayName, frequency, foodLogs, weightLogs, workoutLogs, maintenanceCalories } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });
    await sendOnDemandReportWithData({ email, displayName, frequency, foodLogs, weightLogs, workoutLogs, maintenanceCalories });
    res.json({ message: `Report sent to ${email}` });
  } catch (e) {
    console.error("[EMAIL] On-demand send-with-data failed:", e.message);
    res.status(500).json({ error: "Failed to send report", details: e.message });
  }
});

// ── Workout endpoints ──

// GET /workout/search?term=push+up — search wger exercises
app.get("/workout/search", async (req, res) => {
  try {
    const { term } = req.query;
    if (!term || term.trim().length < 2) return res.json([]);
    const results = await searchExercises(term);
    res.json(results);
  } catch (e) {
    console.error("[WORKOUT] Search failed:", e.message);
    res.status(500).json({ error: "Exercise search failed", details: e.message });
  }
});

// GET /workout/categories — list all exercise categories
app.get("/workout/categories", async (req, res) => {
  try {
    const cats = await getCategories();
    res.json(cats);
  } catch (e) {
    console.error("[WORKOUT] Categories failed:", e.message);
    res.status(500).json({ error: "Failed to load categories", details: e.message });
  }
});

// GET /workout/exercise-info/:id — get exercise details (equipment, muscles, inputType)
app.get("/workout/exercise-info/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid exercise ID" });
    const info = await getExerciseInfo(id);
    res.json(info);
  } catch (e) {
    console.error("[WORKOUT] Exercise info failed:", e.message);
    res.status(500).json({ error: "Failed to load exercise info", details: e.message });
  }
});

// POST /workout/calculate — calculate calories burned (supports all input types)
app.post("/workout/calculate", (req, res) => {
  try {
    const { exerciseName, categoryId, inputType, durationMin, sets, reps, liftedWeight, holdSeconds, weightKg } = req.body;
    if (!exerciseName || !weightKg) {
      return res.status(400).json({ error: "exerciseName and weightKg are required" });
    }
    const result = calculateCaloriesBurned({
      exerciseName,
      categoryId: categoryId || null,
      inputType: inputType || "cardio",
      durationMin: Number(durationMin) || 0,
      sets: Number(sets) || 0,
      reps: Number(reps) || 0,
      liftedWeight: Number(liftedWeight) || 0,
      holdSeconds: Number(holdSeconds) || 0,
      weightKg: Number(weightKg),
    });
    res.json({ ...result, exerciseName, inputType: inputType || "cardio", weightKg });
  } catch (e) {
    console.error("[WORKOUT] Calc failed:", e.message);
    res.status(500).json({ error: "Calorie calculation failed", details: e.message });
  }
});

// ── AI Coach endpoints ──

// POST /ai-coach/comment — get an AI comment on a food/workout entry
app.post("/ai-coach/comment", async (req, res) => {
  try {
    const { tone, activityType, entry, dayStats, userProfile } = req.body;
    if (!entry) return res.status(400).json({ error: "entry is required" });
    const result = await generateCoachComment({ tone, activityType, entry, dayStats, userProfile });
    res.json(result);
  } catch (e) {
    console.error("[AI COACH] Comment failed:", e.message);
    res.json({ comment: "Coach is taking a break! Try again in a moment. 💪", error: true });
  }
});

// GET /ai-coach/templates — list available prompt templates
app.get("/ai-coach/templates", (req, res) => {
  res.json(getPromptTemplates());
});

// POST /ai-coach/prompt — build a ready-to-paste prompt from template + profile
app.post("/ai-coach/prompt", (req, res) => {
  try {
    const { templateKey, profile } = req.body;
    if (!templateKey) return res.status(400).json({ error: "templateKey is required" });
    const result = buildPrompt(templateKey, profile || {});
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error("[AI COACH] Prompt build failed:", e.message);
    res.status(500).json({ error: "Failed to build prompt", details: e.message });
  }
});

// Manual trigger for inactive-user cleanup (protect with a secret in production)
app.post("/admin/cleanup-inactive-users", async (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const deleted = await deleteInactiveUsers();
    res.json({ message: `Deleted ${deleted} inactive user(s).` });
  } catch (e) {
    res.status(500).json({ error: "Cleanup failed", details: e.message });
  }
});

// Global error handler — catches multer & other middleware errors
app.use((err, req, res, _next) => {
  console.error("[SERVER ERROR]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the daily cleanup scheduler (requires Firebase service-account credentials)
  if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    scheduleUserCleanup();
    scheduleEmailReports();
  } else {
    console.log("[Cleanup] Skipped — no Firebase Admin credentials configured.");
  }
});
