import "dotenv/config";
import express from "express";
import cors from "cors";
import { detectFoodFromImage, getGeminiModelStatus, scanMealFromImage, normalizeScanResult } from "./services/geminiService.js";
import { estimateNutritionWithGroq, analyzeNutritionFromText, getGroqModelStatus } from "./services/groqService.js";
import { getNutrition } from "./services/fatsecretService.js";
import { scheduleUserCleanup, deleteInactiveUsers } from "./services/userCleanupService.js";
import { sendOnDemandReport, sendOnDemandReportWithData, scheduleEmailReports } from "./services/emailReportService.js";
import { searchExercises, getCategories, getExerciseInfo, calculateCaloriesBurned } from "./services/workoutService.js";
import { generateCoachComment, generateHeuristicCoachComment, buildPrompt, getPromptTemplates } from "./services/aiCoachService.js";
import { getStravaAuthUrl, exchangeStravaCode, refreshStravaToken, fetchStravaActivities, mapStravaActivityToWorkout } from "./services/stravaService.js";
import multer from "multer";
import { createGzip } from "node:zlib";

const app = express();
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
  credentials: true,
}));

// Security Headers Layer (Defense-in-depth protection)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
});

// In-Memory Rate Limiting Layer (Prevents brute-force, scraping & quota exhaustion)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_GENERAL_REQUESTS = 120;
const MAX_AI_SCAN_REQUESTS = 25;

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 30 * 1000); // Clean up every 30s

app.use((req, res, next) => {
  // Allow health checks unconditionally
  if (req.path === "/" || req.path === "/health") return next();

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now - entry.startTime > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, scanCount: 0, startTime: now };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;
  if (req.path.includes("scan") || req.path.includes("analyze")) {
    entry.scanCount++;
    if (entry.scanCount > MAX_AI_SCAN_REQUESTS) {
      return res.status(429).json({ error: "Too many scanning requests. Please wait a minute before scanning again." });
    }
  }

  if (entry.count > MAX_GENERAL_REQUESTS) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait a minute and try again." });
  }

  next();
});

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

// Health check endpoint for uptime monitors and hosting platforms (UptimeRobot, Render, Koyeb, Railway)
app.get(["/", "/health"], (req, res) => {
  res.json({
    status: "ok",
    service: "FoodCal Backend API",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
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

// POST /scan-meal — Cal AI-style one-shot scan: items + calories/protein/carbs/fat + health score
app.post("/scan-meal", (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: "File too large (max 10MB)" });
      return res.status(400).json({ error: err.message || "Invalid file upload" });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });
  const b64 = req.file.buffer.toString('base64');
  try {
    const result = await scanMealFromImage(b64, req.file.mimetype);
    if (!result.items.length) return res.json({ ...result, note: "No food detected. Try a clearer, closer photo." });
    res.json(result);
  } catch (e) {
    if (e.isQuotaError) return res.status(429).json({ error: e.message });
    // Fallback: legacy detect → FatSecret/Groq pipeline (calories + protein only)
    try {
      const detected = await detectFoodFromImage(b64, req.file.mimetype);
      if (!detected.items?.length) return res.json(normalizeScanResult({ items: [] }));
      const items = await calculateItemsNutrition(detected.items.map(i => ({ name: i.name, grams: i.grams })));
      res.json({ ...normalizeScanResult({ items }), healthScore: 0, fallback: true });
    } catch (e2) {
      if (e2.isQuotaError) return res.status(429).json({ error: e2.message });
      res.status(500).json({ error: "Failed to scan meal", details: e2.message });
    }
  }
});

async function calculateItemsNutrition(items) {
  const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const lookupResults = await Promise.allSettled(
    items.map(async (item) => {
      const grams = item.grams || Number.parseInt(item.quantity) || 100;
      const nutrition = await getNutrition(item.name, grams);
      return nutrition ? { ...nutrition, _found: true } : { name: item.name, grams, _found: false };
    })
  );
  const results = lookupResults.map((r) => r.status === "fulfilled" ? r.value : { name: "unknown", grams: 100, _found: false });
  const failedItems = results.map((r, i) => (!r._found ? { name: r.name, grams: r.grams, index: i } : null)).filter(Boolean);
  if (failedItems.length) {
    const groqResult = await estimateNutritionWithGroq(failedItems);
    failedItems.forEach((fi, idx) => {
      const gi = groqResult?.items?.[idx] || groqResult?.items?.find(g => g.name.toLowerCase().includes(fi.name.toLowerCase().split(' ')[0]));
      results[fi.index] = {
        name: fi.name,
        grams: fi.grams,
        calories: gi?.calories || 0,
        protein: round1(gi?.protein),
        carbs: round1(gi?.carbs),
        fat: round1(gi?.fat),
        source: gi ? 'groq' : 'unknown'
      };
    });
  }
  return results.map(i => ({
    name: i.name,
    quantity: `${i.grams}g`,
    grams: i.grams,
    calories: i.calories || 0,
    protein: round1(i.protein),
    carbs: round1(i.carbs),
    fat: round1(i.fat),
    source: i.source || 'unknown'
  }));
}

app.post("/calculate-nutrition", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: "No food items provided" });

    const finalItems = await calculateItemsNutrition(items);
    const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

    res.json({
      items: finalItems,
      total_calories: Math.round(finalItems.reduce((s, i) => s + (i.calories || 0), 0)),
      total_protein: round1(finalItems.reduce((s, i) => s + (i.protein || 0), 0)),
      total_carbs: round1(finalItems.reduce((s, i) => s + (i.carbs || 0), 0)),
      total_fat: round1(finalItems.reduce((s, i) => s + (i.fat || 0), 0)),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to calculate nutrition", details: e.message });
  }
});

app.post("/lookup-food", async (req, res) => {
  try {
    const { name, quantity } = req.body;
    if (!name) return res.status(400).json({ error: "Food name is required" });
    let grams = 100;
    if (quantity) {
      const m = quantity.match(/(\d+(?:\.\d+)?)\s*g/i);
      if (m) grams = Number.parseFloat(m[1]);
    }
    const result = await getNutrition(name, grams);
    if (result) {
      return res.json({
        name: result.name,
        quantity: `${grams}g`,
        grams,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs ?? 0,
        fat: result.fat ?? 0,
        source: result.source || "unknown",
      });
    }
    res.status(404).json({ error: "Food not found" });
  } catch (e) {
    res.status(500).json({ error: "Failed to lookup food", details: e.message });
  }
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

// ── Strava Integration endpoints ──

// GET /strava/auth-url — generate Strava OAuth authorization URL
app.get("/strava/auth-url", (req, res) => {
  try {
    const { redirectUri, state } = req.query;
    const url = getStravaAuthUrl({ redirectUri, state });
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate Strava auth URL", details: e.message });
  }
});

// POST /strava/token — exchange authorization code or refresh token
app.post("/strava/token", async (req, res) => {
  try {
    const { code, refreshToken, clientId, clientSecret } = req.body;
    if (code) {
      const data = await exchangeStravaCode({ code, clientId, clientSecret });
      return res.json(data);
    }
    if (refreshToken) {
      const data = await refreshStravaToken({ refreshToken, clientId, clientSecret });
      return res.json(data);
    }
    res.status(400).json({ error: "Either 'code' or 'refreshToken' is required" });
  } catch (e) {
    console.error("[STRAVA] Token error:", e.message);
    res.status(500).json({ error: "Failed to exchange Strava token", details: e.message });
  }
});

// POST /strava/sync — fetch recent activities and format as FoodCal workouts
app.post("/strava/sync", async (req, res) => {
  try {
    const { accessToken, weightKg, perPage, after } = req.body;
    if (!accessToken) return res.status(400).json({ error: "accessToken is required" });
    const rawActivities = await fetchStravaActivities({ accessToken, perPage: perPage || 30, after });
    const workouts = rawActivities.map((act) => mapStravaActivityToWorkout(act, Number(weightKg) || 70));
    res.json({ count: workouts.length, workouts });
  } catch (e) {
    console.error("[STRAVA] Sync error:", e.message);
    res.status(500).json({ error: "Failed to sync Strava activities", details: e.message });
  }
});

// ── AI Coach endpoints ──

// POST /ai-coach/comment — get an AI comment on a food/workout/daily summary entry
app.post("/ai-coach/comment", async (req, res) => {
  try {
    const { tone, activityType, entry, dayStats, userProfile } = req.body;
    const result = await generateCoachComment({ tone, activityType: activityType || "daily", entry: entry || {}, dayStats, userProfile });
    res.json(result);
  } catch (e) {
    console.error("[AI COACH] Comment failed:", e.message);
    const fallback = generateHeuristicCoachComment({
      tone: req.body?.tone,
      activityType: req.body?.activityType || "daily",
      entry: req.body?.entry || {},
      dayStats: req.body?.dayStats || {},
    });
    res.json({ comment: fallback, fallback: true });
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
