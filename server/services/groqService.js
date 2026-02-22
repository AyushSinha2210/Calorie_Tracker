import { getCached, setCache } from "../utils/nutritionCache.js";

// ── Groq Models (ordered by speed/capability) ──
// Each model has its own rate-limit pool on Groq's free tier
const GROQ_MODELS = [
  "llama-3.1-8b-instant",                     // fastest, lightweight
  "llama-3.3-70b-versatile",                  // most capable
  "meta-llama/llama-4-scout-17b-16e-instruct",// newer llama-4
  "meta-llama/llama-4-maverick-17b-128e-instruct", // llama-4 large
  "qwen/qwen3-32b",                           // qwen alternative
];

const cleanJson = (t) => t.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRateLimited = (status, body) =>
  status === 429 || /rate.limit|too many|quota|resource.exhausted/i.test(body?.error?.message || "");

// ── Persistent model health tracker ──
const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const modelStatus = {};

function markExhausted(name) {
  modelStatus[name] = { exhausted: true, failedAt: Date.now() };
  console.log(`[GROQ EXHAUSTED] ${name} — skipping for ${COOLDOWN_MS / 1000}s`);
}

function isAvailable(name) {
  const s = modelStatus[name];
  if (!s) return true;
  if (Date.now() - s.failedAt > COOLDOWN_MS) {
    delete modelStatus[name];
    return true;
  }
  return !s.exhausted;
}

// ── Raw Groq API call (OpenAI-compatible) ──
async function callGroq(model, messages, config = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const body = {
    model,
    messages,
    temperature: config.temperature ?? 0.1,
    max_tokens: config.max_tokens ?? 512,
    ...(config.response_format ? { response_format: config.response_format } : {}),
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (res.status !== 200 || data.error) {
    const errMsg = data.error?.message || `HTTP ${res.status}`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.isRateLimit = isRateLimited(res.status, data);
    throw err;
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq model");
  return text;
}

// ── Multi-model fallback engine for Groq ──
async function tryGroqModels(messages, config = {}) {
  const available = GROQ_MODELS.filter(isAvailable);

  if (!available.length) {
    // All models cooling down — reset the oldest
    const oldest = Object.entries(modelStatus).sort((a, b) => a[1].failedAt - b[1].failedAt)[0];
    if (oldest) {
      delete modelStatus[oldest[0]];
      available.push(oldest[0]);
      console.log(`[GROQ RESET] All exhausted, force-retrying ${oldest[0]}`);
    }
  }

  let lastErr = null;
  const rateLimitedModels = [];

  // Phase 1: try each available model once
  for (const name of available) {
    try {
      const text = await callGroq(name, messages, config);
      console.log(`[GROQ OK] ${name}`);
      delete modelStatus[name];
      return text;
    } catch (e) {
      lastErr = e;
      if (e.isRateLimit) {
        markExhausted(name);
        rateLimitedModels.push(name);
        console.log(`[GROQ RATE-LIMITED] ${name}, switching to next...`);
        continue;
      }
      console.log(`[GROQ SKIP] ${name}: ${(e.message || "").substring(0, 120)}`);
      continue;
    }
  }

  // Phase 2: retry rate-limited models with backoff
  if (rateLimitedModels.length) {
    const delays = [3000, 8000, 15000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      const model = rateLimitedModels[attempt % rateLimitedModels.length];
      console.log(`[GROQ RETRY ${attempt + 1}/${delays.length}] Waiting ${delays[attempt] / 1000}s, retrying ${model}...`);
      await sleep(delays[attempt]);
      try {
        const text = await callGroq(model, messages, config);
        console.log(`[GROQ OK] ${model} (retry ${attempt + 1})`);
        delete modelStatus[model];
        return text;
      } catch (e) {
        lastErr = e;
        console.log(`[GROQ RETRY FAIL] ${model}: ${(e.message || "").substring(0, 80)}`);
      }
    }
  }

  const err = new Error(
    `Groq API error: ${(lastErr?.message || "All models failed").substring(0, 150)}`
  );
  err.isQuotaError = rateLimitedModels.length > 0;
  throw err;
}

// ── Public API ──

/**
 * Estimate calories and protein for a list of food items using Groq LLMs.
 * @param {Array<{name: string, grams: number}>} items
 * @returns {Promise<{items: Array<{name, grams, calories, protein}>}>}
 */
export async function estimateNutritionWithGroq(items) {
  const itemKey = items.map((i) => `${i.name}:${i.grams}`).join("|");
  const cacheKey = `groq:nutrition:${itemKey.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt = `You are a nutrition database. For each food item below, provide accurate calories and protein per the given weight. Use Indian food data where applicable.

Food items:
${items.map((i) => `- ${i.name}: ${i.grams}g`).join("\n")}

Return ONLY valid JSON, no markdown, no explanation:
{"items":[{"name":"food name","grams":100,"calories":0,"protein":0}]}`;

  const messages = [
    { role: "system", content: "You are a precise nutrition calculator. Return only valid JSON." },
    { role: "user", content: prompt },
  ];

  const text = await tryGroqModels(messages, {
    max_tokens: 512,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const data = JSON.parse(cleanJson(text));
  console.log(`[GROQ] Nutrition result:`, JSON.stringify(data));
  setCache(cacheKey, data);
  return data;
}

/**
 * Full text-based food analysis: detect items + calculate nutrition via Groq.
 * Used as the nutrition calculation step after Gemini detects food names from text.
 * @param {string} text - User's food description
 * @returns {Promise<{items, total_calories, total_protein}>}
 */
export async function analyzeNutritionFromText(text) {
  const cacheKey = `groq:text:${text.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt = `You are a nutrition calculator for Indian food. Standard portions: 1 roti=40g, 1 bowl dal=150g, 1 cup rice=200g, 1 egg=50g, 1 chapati=40g, 1 parantha=60g.

Analyze this meal: "${text}"

Return ONLY valid JSON:
{"items":[{"name":"food name","quantity":"human readable quantity","calories":0,"protein":0}],"total_calories":0,"total_protein":0}`;

  const messages = [
    { role: "system", content: "You are a precise Indian food nutrition calculator. Return only valid JSON." },
    { role: "user", content: prompt },
  ];

  const result = JSON.parse(
    cleanJson(
      await tryGroqModels(messages, {
        max_tokens: 512,
        temperature: 0.1,
        response_format: { type: "json_object" },
      })
    )
  );

  setCache(cacheKey, result);
  return result;
}
