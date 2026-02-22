import { getCached, setCache } from "../utils/nutritionCache.js";

// Ordered by: newest/cheapest models first (separate quota pools), then older ones
// Each model family has its own free-tier bucket, so we try many families
const MODELS = [
  "gemini-2.5-flash-lite",                   // lightweight, own quota pool
  "gemini-3-flash-preview",                  // newest flash preview
  "gemini-2.5-flash-lite-preview-09-2025",   // preview variant, separate pool
  "gemini-flash-lite-latest",                // latest alias — may route differently
  "gemini-flash-latest",                     // latest flash alias
  "gemini-2.5-flash",                        // standard 2.5 flash
  "gemini-2.0-flash-lite",                   // 2.0 lite
  "gemini-2.0-flash",                        // 2.0 standard
  "gemini-2.0-flash-001",                    // pinned 2.0
];

const cleanJson = (t) => t.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const isQuotaOrRateLimit = (e) => /429|Too Many Requests|quota|RESOURCE_EXHAUSTED|503|overloaded/i.test(e.message || '');
const isDailyQuotaExhausted = (e) => /limit: 0|exceeded your current quota/i.test(e.message || '');
const isTransientRateLimit = (e) => isQuotaOrRateLimit(e) && !isDailyQuotaExhausted(e);

// ── Persistent model health tracker ──
// Remembers which models are exhausted so we skip them instantly on subsequent calls.
// Entries expire after COOLDOWN_MS so we re-check periodically.
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const modelStatus = {}; // { modelName: { exhausted: boolean, rateLimited: boolean, failedAt: timestamp } }

function markExhausted(name) {
  modelStatus[name] = { exhausted: true, rateLimited: false, failedAt: Date.now() };
  console.log(`[EXHAUSTED] ${name} — will skip for ${COOLDOWN_MS / 1000}s`);
}

function markRateLimited(name) {
  modelStatus[name] = { exhausted: false, rateLimited: true, failedAt: Date.now() };
}

function isAvailable(name) {
  const s = modelStatus[name];
  if (!s) return true;
  // Expired — give it another chance
  if (Date.now() - s.failedAt > COOLDOWN_MS) {
    delete modelStatus[name];
    return true;
  }
  return !s.exhausted; // rate-limited models can be retried after backoff
}

function getAvailableModels() {
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

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
      const text = await callGeminiRaw(name, prompt, genConfig);
      console.log(`[OK] ${name}`);
      // Clear any previous bad status on success
      delete modelStatus[name];
      return text;
    } catch (e) {
      lastErr = e;
      const msg = e.message || "";

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

  // Phase 2: if we had transient rate limits, retry those with backoff
  if (rateLimitedModels.length) {
    const delays = [3000, 8000, 15000, 25000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      const model = rateLimitedModels[attempt % rateLimitedModels.length];
      console.log(`[RETRY ${attempt + 1}/${delays.length}] Waiting ${delays[attempt] / 1000}s, retrying ${model}...`);
      await sleep(delays[attempt]);
      try {
        const text = await callGeminiRaw(model, prompt, genConfig);
        console.log(`[OK] ${model} (retry ${attempt + 1})`);
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
    { text: `Identify all food items in this image with estimated weight in grams. Return ONLY valid JSON: {"items":[{"name":"food name","grams":100}]}. No markdown.` },
    { inlineData: { mimeType, data: imageBase64 } }
  ];

  // Use tryModels with multimodal prompt parts
  const text = await tryModels(promptParts, { maxOutputTokens: 512 });
  return JSON.parse(cleanJson(text));
}

export async function detectFoodFromText(text) {
  // Gemini detects food items + quantities from text (no nutrition calculation)
  const cacheKey = `gemini:detect:${text.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt = `Identify all food items and their quantities/weight in grams from this description. Standard portions: 1 roti=40g, 1 bowl dal=150g, 1 cup rice=200g, 1 egg=50g, 1 chapati=40g, 1 parantha=60g.
Description: "${text}"
Return ONLY valid JSON: {"items":[{"name":"food name","grams":100}]}. No markdown.`;

  const result = JSON.parse(cleanJson(await tryModels(prompt, { maxOutputTokens: 512 })));
  setCache(cacheKey, result);
  return result;
}
