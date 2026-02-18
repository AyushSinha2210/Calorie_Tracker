import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-pro", "gemini-3-pro"];
const cleanJson = (t) => t.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isRateLimit = (e) => /429|Too Many Requests|quota|RESOURCE_EXHAUSTED/.test(e.message || '');

async function tryModels(prompt, genConfig = {}) {
  const config = { temperature: 0.2, maxOutputTokens: 4096, ...genConfig };
  let lastErr = null, hadRL = false;
  for (const name of MODELS) {
    for (let i = 0; i < 2; i++) {
      try {
        const result = await getGenAI().getGenerativeModel({ model: name, generationConfig: config }).generateContent(prompt);
        console.log(`[OK] ${name}`);
        return result.response.text();
      } catch (e) {
        lastErr = e;
        if (isRateLimit(e)) { hadRL = true; console.log(`[RATE-LIMITED] ${name} #${i+1}`); await sleep((i+1)*10000); }
        else { console.log(`[FAIL] ${name}: ${(e.message||'').substring(0,120)}`); break; }
      }
    }
  }
  throw new Error(`All models exhausted. ${hadRL ? "Rate limited" : (lastErr?.message||'').substring(0,200)}`);
}

export async function detectFoodFromImage(imageBase64, mimeType = "image/jpeg") {
  const prompt = `Analyze this food image. Identify all food items and estimate weight in grams. Return ONLY valid JSON: {"items":[{"name":"food item","grams":number}]}. Be specific with names, realistic with grams. No markdown.`;
  return JSON.parse(cleanJson(await tryModels([prompt, { inlineData: { data: imageBase64, mimeType } }])));
}

export async function analyzeFoodText(text) {
  const prompt = `You are a certified Indian nutrition expert. Use standardized Indian values. Assume: 1 roti=40g, 1 bowl dal=150g, 1 cup rice=200g, 1 egg=50g. Analyze: "${text}". Return ONLY JSON: {"items":[{"name":"","quantity":"","calories":0,"protein":0}],"total_calories":0,"total_protein":0}`;
  return JSON.parse(cleanJson(await tryModels(prompt, { responseMimeType: "application/json" })));
}

export async function estimateNutritionFallback(items) {
  const prompt = `Nutrition expert. Calculate calories and protein for: ${items.map(i => `${i.name}: ${i.grams}g`).join(', ')}. Return ONLY JSON: {"items":[{"name":"","grams":0,"calories":0,"protein":0}]}. Use Indian food data.`;
  try {
    const data = JSON.parse(cleanJson(await tryModels(prompt, { responseMimeType: "application/json" })));
    console.log(`Gemini fallback:`, JSON.stringify(data));
    return data;
  } catch (e) { console.error(`Gemini fallback failed: ${e.message}`); return null; }
}
