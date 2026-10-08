import { getCached, setCache } from "../utils/nutritionCache.js";
import { getVerifiedNutrition } from "../utils/verifiedNutrition.js";

// ── Model definitions with known RPD (Requests Per Day) limits ──
// Free-tier Gemini: most models get ~1,500 RPD; some flash-lite get more.
// We set a conservative threshold at 90% of the limit to switch proactively.
// Models ordered fastest-first: 2.0 lite/flash are ~1-3s, 3.0 lite ~2-4s, 2.5/3.0 "thinking" models are slow (10-30s)
const MODEL_CONFIG = [
  { name: "gemini-2.5-flash", rpd: 1500 },
  { name: "gemini-2.5-flash-lite", rpd: 1500 },
  { name: "gemini-3.5-flash-lite", rpd: 1500 },
  { name: "gemini-3.8-flash", rpd: 1500 },
  { name: "gemini-2.5-pro", rpd: 50 },
];

const MODELS = MODEL_CONFIG.map(m => m.name);
const RPD_LIMITS = Object.fromEntries(MODEL_CONFIG.map(m => [m.name, m.rpd]));
const RPD_THRESHOLD = 0.90; // switch model after 90 % of daily quota used

const cleanJson = (t) => t.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const REQUEST_TIMEOUT_MS = 10_000; // 10s hard timeout per API call

const isQuotaOrRateLimit = (e) => /429|Too Many Requests|quota|RESOURCE_EXHAUSTED|503|overloaded/i.test(e.message || '');
const isDailyQuotaExhausted = (e) => /limit: 0|exceeded your current quota/i.test(e.message || '');
const isTransientRateLimit = (e) => isQuotaOrRateLimit(e) && !isDailyQuotaExhausted(e);

// ── RPD (Requests Per Day) tracker ──
// Counts successful + failed requests per model per calendar day.
// Resets automatically when the date rolls over.
const rpdTracker = {
  date: new Date().toDateString(),        // current tracking day
  counts: {},                             // { modelName: number }
};

function getTodayKey() { return new Date().toDateString(); }

function resetIfNewDay() {
  const today = getTodayKey();
  if (rpdTracker.date !== today) {
    console.log(`[RPD] New day detected (${today}) — resetting all counters`);
    rpdTracker.date = today;
    rpdTracker.counts = {};
    // Also clear exhaustion flags since daily quotas have reset
    for (const key of Object.keys(modelStatus)) {
      if (modelStatus[key].exhausted) delete modelStatus[key];
    }
  }
}

function recordRequest(name) {
  resetIfNewDay();
  rpdTracker.counts[name] = (rpdTracker.counts[name] || 0) + 1;
}

function getRpdUsage(name) {
  resetIfNewDay();
  return rpdTracker.counts[name] || 0;
}

function isUnderRpdLimit(name) {
  const limit = RPD_LIMITS[name];
  if (!limit) return true; // unknown model — let it try
  const used = getRpdUsage(name);
  const threshold = Math.floor(limit * RPD_THRESHOLD);
  return used < threshold;
}

/** Get RPD stats for all models (used by /model-status endpoint) */
export function getGeminiModelStatus() {
  resetIfNewDay();
  return MODEL_CONFIG.map(({ name, rpd }) => ({
    model: name,
    rpdLimit: rpd,
    rpdUsed: getRpdUsage(name),
    rpdRemaining: Math.max(0, rpd - getRpdUsage(name)),
    pctUsed: rpd ? Math.round((getRpdUsage(name) / rpd) * 100) : 0,
    status: modelStatus[name]?.exhausted
      ? "exhausted"
      : !isUnderRpdLimit(name)
        ? "threshold-reached"
        : modelStatus[name]?.rateLimited
          ? "rate-limited"
          : "available",
  }));
}

// ── Persistent model health tracker ──
// Remembers which models are exhausted so we skip them instantly on subsequent calls.
// Entries expire after COOLDOWN_MS so we re-check periodically.
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const modelStatus = {}; // { modelName: { exhausted: boolean, rateLimited: boolean, failedAt: timestamp } }

function markExhausted(name) {
  modelStatus[name] = { exhausted: true, rateLimited: false, failedAt: Date.now() };
  const used = getRpdUsage(name);
  const limit = RPD_LIMITS[name] || '?';
  console.log(`[EXHAUSTED] ${name} (${used}/${limit} RPD) — will skip for ${COOLDOWN_MS / 1000}s`);
}

function markRateLimited(name) {
  modelStatus[name] = { exhausted: false, rateLimited: true, failedAt: Date.now() };
}

function isAvailable(name) {
  const s = modelStatus[name];
  // Check RPD threshold first — proactively skip overused models
  if (!isUnderRpdLimit(name)) {
    const used = getRpdUsage(name);
    const limit = RPD_LIMITS[name] || '?';
    console.log(`[RPD SKIP] ${name} — ${used}/${limit} requests today (≥${RPD_THRESHOLD * 100}% used), switching model`);
    return false;
  }
  if (!s) return true;
  // Expired — give it another chance
  if (Date.now() - s.failedAt > COOLDOWN_MS) {
    delete modelStatus[name];
    return true;
  }
  return !s.exhausted; // rate-limited models can be retried after backoff
}

function getAvailableModels() {
  resetIfNewDay();
  return MODELS.filter(isAvailable);
}

// ── Raw fetch-based Gemini call ──
async function callGeminiRaw(model, prompt, genConfig = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const body = {
    contents: [{ parts: typeof prompt === "string" ? [{ text: prompt }] : prompt }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 512, ...genConfig },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal }
    );
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") throw new Error(`${model} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  // Record the request against RPD counter regardless of outcome
  recordRequest(model);

  const data = await res.json();

  if (res.status !== 200 || data.error) {
    const errMsg = data.error?.message || `HTTP ${res.status}`;
    const err = new Error(errMsg);
    err.status = data.error?.code || res.status;
    throw err;
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from model");
  return text;
}

// ── Multi-model fallback engine ──
async function tryModels(prompt, genConfig = {}) {
  const available = getAvailableModels();
  if (!available.length) {
    // All models cooling down — reset the oldest one and try it
    const oldest = Object.entries(modelStatus).sort((a, b) => a[1].failedAt - b[1].failedAt)[0];
    if (oldest) {
      delete modelStatus[oldest[0]];
      available.push(oldest[0]);
      console.log(`[RESET] All models exhausted, force-retrying ${oldest[0]}`);
    }
  }

  let lastErr = null;
  let rateLimitedModels = [];

  // Phase 1: try each available model once
  for (const name of available) {
    try {
      const t0 = Date.now();
      const text = await callGeminiRaw(name, prompt, genConfig);
      const ms = Date.now() - t0;
      const used = getRpdUsage(name), limit = RPD_LIMITS[name] || '?';
      console.log(`[OK] ${name} (${ms}ms, RPD: ${used}/${limit})`);
      // Clear any previous bad status on success
      delete modelStatus[name];
      return text;
    } catch (e) {
      lastErr = e;
      const msg = e.message || "";
      console.log(`[FAIL] ${name}: ${msg.substring(0, 120)}`);

      if (isDailyQuotaExhausted(e)) {
        markExhausted(name);
        continue; // auto-switch to next model
      }
      if (isTransientRateLimit(e)) {
        markRateLimited(name);
        rateLimitedModels.push(name);
        console.log(`[RATE-LIMITED] ${name}, switching to next model...`);
        continue; // auto-switch to next model
      }
      // Other errors (model not found, invalid request, etc.) — skip and continue
      console.log(`[SKIP] ${name}: ${msg.substring(0, 120)}`);
      continue;
    }
  }

  // Phase 2: if we had transient rate limits, retry with shorter backoffs
  if (rateLimitedModels.length) {
    const delays = [2000, 4000, 8000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      const model = rateLimitedModels[attempt % rateLimitedModels.length];
      console.log(`[RETRY ${attempt + 1}/${delays.length}] Waiting ${delays[attempt] / 1000}s, retrying ${model}...`);
      await sleep(delays[attempt]);
      try {
        const text = await callGeminiRaw(model, prompt, genConfig);
        const retryUsed = getRpdUsage(model), retryLimit = RPD_LIMITS[model] || '?';
        console.log(`[OK] ${model} (retry ${attempt + 1}, RPD: ${retryUsed}/${retryLimit})`);
        delete modelStatus[model];
        return text;
      } catch (e) {
        lastErr = e;
        if (isDailyQuotaExhausted(e)) {
          markExhausted(model);
          rateLimitedModels = rateLimitedModels.filter((m) => m !== model);
        }
        console.log(`[RETRY FAIL] ${model}: ${(e.message || "").substring(0, 80)}`);
      }
    }
  }

  // All models failed
  const exhaustedCount = Object.values(modelStatus).filter((s) => s.exhausted).length;
  const err = new Error(
    exhaustedCount >= MODELS.length
      ? "All Gemini model quotas exhausted. Please wait a few minutes and try again, or upgrade your plan at https://ai.google.dev/pricing"
      : rateLimitedModels.length
        ? "Gemini API rate limited after retries. Please wait a minute and try again."
        : `AI service error: ${(lastErr?.message || "Unknown error").substring(0, 150)}`
  );
  err.isQuotaError = exhaustedCount > 0 || rateLimitedModels.length > 0;
  throw err;
}

export async function detectFoodFromImage(imageBase64, mimeType = "image/jpeg") {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const promptParts = [
    {
      text: `Identify all visible food items in this image. Estimate the expected portion/quantity (e.g. "1 medium banana", "1 bowl rice", "2 chapatis") and estimated weight in grams from visual size.
Also estimate realistic nutrition (calories, protein, carbs, fat).
CRITICAL ACCURACY RULE: Fruits (banana, apple, orange, watermelon, mango, etc.) have minimal protein (only 0.2g to 1.2g per 100g). A banana does NOT have high protein.
Return ONLY valid JSON (no markdown):
{"items":[{"name":"food name","quantity":"1 medium (120g)","grams":120,"calories":105,"protein":1.3,"carbs":27.0,"fat":0.4}]}`
    },
    { inlineData: { mimeType, data: imageBase64 } }
  ];

  // Use tryModels with multimodal prompt parts
  const text = await tryModels(promptParts, { maxOutputTokens: 600 });
  const raw = JSON.parse(cleanJson(text));
  const items = (Array.isArray(raw?.items) ? raw.items : []).map((i) => {
    const grams = Math.round(clampNum(i.grams, 1, 3000)) || 100;
    const verified = getVerifiedNutrition(i.name, grams);
    return {
      name: verified ? verified.name : (i.name || "Food").trim(),
      quantity: i.quantity || `${grams}g`,
      grams,
      calories: verified ? verified.calories : Math.round(clampNum(i.calories, 0, 5000)),
      protein: verified ? verified.protein : round1(clampNum(i.protein, 0, 500)),
      carbs: verified ? verified.carbs : round1(clampNum(i.carbs, 0, 1000)),
      fat: verified ? verified.fat : round1(clampNum(i.fat, 0, 500)),
    };
  });
  return { items };
}

export async function detectFoodFromText(text) {
  // Gemini detects food items + quantities from text (no nutrition calculation)
  const cacheKey = `gemini:detect:${text.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt = `Identify all food items and their quantities/weight in grams from this description. Standard portions: 1 roti=40g, 1 bowl dal=150g, 1 cup rice=200g, 1 egg=50g, 1 medium banana=118g, 1 chapati=40g, 1 parantha=60g.
Description: "${text}"
Return ONLY valid JSON: {"items":[{"name":"food name","quantity":"1 medium","grams":100}]}. No markdown.`;

  const result = JSON.parse(cleanJson(await tryModels(prompt, { maxOutputTokens: 512 })));
  setCache(cacheKey, result);
  return result;
}

// ── Cal AI-style one-shot meal scan ──
// Single vision call returning items + full macros + health score.
const clampNum = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
};
const round1 = (n) => Math.round(n * 10) / 10;

export function normalizeScanResult(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : [])
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .slice(0, 15)
    .map((i) => {
      const grams = Math.round(clampNum(i.grams, 1, 3000)) || 100;
      const verified = getVerifiedNutrition(i.name, grams);

      // If recognized in our scientific database, use verified macros (especially to correct fruits & staples)
      const calories = verified ? verified.calories : Math.round(clampNum(i.calories, 0, 5000));
      let protein = verified ? verified.protein : round1(clampNum(i.protein, 0, 500));
      const carbs = verified ? verified.carbs : round1(clampNum(i.carbs, 0, 1000));
      const fat = verified ? verified.fat : round1(clampNum(i.fat, 0, 500));

      return {
        name: verified ? verified.name : i.name.trim().slice(0, 80),
        quantity: i.quantity || `${grams}g`,
        grams,
        calories,
        protein,
        carbs,
        fat,
        source: verified ? "verified-database" : "gemini-scan",
      };
    });
  const sum = (k) => round1(items.reduce((s, i) => s + (Number(i[k]) || 0), 0));
  return {
    mealName: (typeof raw?.mealName === "string" && raw.mealName.trim().slice(0, 80)) || items.map((i) => i.name).join(", "),
    items,
    total_calories: Math.round(sum("calories")),
    total_protein: sum("protein"),
    total_carbs: sum("carbs"),
    total_fat: sum("fat"),
    healthScore: items.length ? Math.round(clampNum(raw?.healthScore, 1, 10)) || 5 : 0,
    tip: typeof raw?.tip === "string" ? raw.tip.trim().slice(0, 200) : "",
  };
}

export async function scanMealFromImage(imageBase64, mimeType = "image/jpeg") {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const promptParts = [
    {
      text: `You are a nutrition expert. Identify every food item in this photo, estimate its expected portion quantity and weight in grams from visual portion size, and calculate accurate nutrition.
CRITICAL ACCURACY RULES:
- FRUITS (banana, apple, orange, mango, watermelon, papaya, grapes, etc.): Fruits consist mostly of water and carbs, with MINIMAL PROTEIN (0.2g to 1.2g per 100g). DO NOT hallucinate 5-10g protein for fruits! A 120g banana has only ~1.3g protein, ~27g carbs, ~0.4g fat, ~105 kcal.
- Staples & Proteins: Eggs (~6g protein/egg), dal (~6.5g protein/100g cooked), chicken breast (~31g protein/100g cooked), roti (~3.8g protein/roti).
Return ONLY valid JSON (no markdown) in exactly this shape:
{"mealName":"short meal name","items":[{"name":"food","quantity":"1 medium","grams":120,"calories":105,"protein":1.3,"carbs":27.0,"fat":0.4}],"healthScore":7,"tip":"one short actionable tip"}
Rules: calories in kcal, macros in grams, numbers only. healthScore is 1-10 (10 = very healthy, balanced, whole foods). If no food is visible return {"items":[]}.`,
    },
    { inlineData: { mimeType, data: imageBase64 } },
  ];
  const text = await tryModels(promptParts, { maxOutputTokens: 1200, responseMimeType: "application/json" });
  return normalizeScanResult(JSON.parse(cleanJson(text)));
}
