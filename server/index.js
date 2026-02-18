import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import fatsecret from "fatsecret";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize FatSecret API
const fatsecretAPI = new fatsecret({
  client_id: process.env.FATSECRET_CLIENT_ID,
  client_secret: process.env.FATSECRET_CLIENT_SECRET
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

app.post("/analyze-food", async (req, res) => {
  const { text } = req.body;

  const modelPriority = [
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-exp-1206"
  ];

  async function callGemini(modelName, prompt) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { 
        temperature: 0.2, 
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const prompt = `
You are a certified Indian nutrition expert.

Use standardized Indian nutrition reference values.

Assume:
- 1 roti = 40g
- 1 bowl dal = 150g
- 1 cup rice = 200g
- 1 egg = 50g

Analyze this meal:
"${text}"

Return ONLY valid JSON:

{
  "items": [
    {
      "name": "",
      "quantity": "",
      "calories": number,
      "protein": number
    }
  ],
  "total_calories": number,
  "total_protein": number
}

No markdown.
No explanation.
`;

  try {
    let responseText;

    // Try each model until one succeeds
    for (const modelName of modelPriority) {
      try {
        responseText = await callGemini(modelName, prompt);
        console.log(`✅ ${modelName}`);
        break;
      } catch (error) {
        console.log(`⚠️ ${modelName} failed: ${(error.message || '').substring(0, 80)}`);
        continue;
      }
    }

    if (!responseText) {
      throw new Error("All models exhausted");
    }

    const cleaned = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    res.json(parsed);

  } catch (error) {
    console.log("⚠️ Fallback mode");

    res.json({
      items: [],
      total_calories: 0,
      total_protein: 0,
      note: "Service temporarily unavailable"
    });
  }
});

// New endpoint for image-based food analysis
app.post("/analyze-food-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    // Step 1: Validate image
    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    
    console.log(`📸 Received image: ${req.file.originalname} (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

    // Step 2: Use Gemini Vision to identify food items and estimate grams
    const visionModelPriority = [
      "gemini-3-flash-preview",
      "gemini-3-pro-preview",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-exp-1206"
    ];
    
    const visionPrompt = `Analyze this food image carefully. Identify all food items visible and estimate their weight in grams.

Return ONLY valid JSON in this exact format:
{
  "items": [
    {
      "name": "food item name",
      "grams": estimated_weight_in_grams_as_number
    }
  ]
}

Be specific with food names (e.g., "grilled chicken breast" not just "chicken").
Be realistic with gram estimates based on typical serving sizes.
No markdown. No explanation. Only JSON.`;

    let visionText;
    for (const modelName of visionModelPriority) {
      try {
        const visionModel = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { 
            temperature: 0.2, 
            maxOutputTokens: 4096 
          }
        });
        const visionResult = await visionModel.generateContent([
          visionPrompt,
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType
            }
          }
        ]);
        visionText = visionResult.response.text();
        console.log(`🤖 Gemini Vision (${modelName}):`, visionText);
        break;
      } catch (error) {
        console.log(`⚠️ ${modelName} unavailable: ${(error.message || '').substring(0, 80)}`);
        continue;
      }
    }

    if (!visionText) {
      throw new Error("All vision models exhausted");
    }
    
    const cleanedVision = visionText.replace(/```json|```/g, "").trim();
    const visionData = JSON.parse(cleanedVision);

    if (!visionData.items || visionData.items.length === 0) {
      return res.json({
        items: [],
        total_calories: 0,
        total_protein: 0,
        note: "No food items detected in the image"
      });
    }

    // Return items for user confirmation (nutrition will be calculated after confirmation)
    const finalItems = visionData.items.map(item => ({
      name: item.name,
      quantity: `${item.grams}g`,
      grams: item.grams,
      calories: 0,  // Will be calculated after confirmation
      protein: 0    // Will be calculated after confirmation
    }));

    res.json({
      items: finalItems,
      total_calories: 0,
      total_protein: 0,
      needsNutritionCalculation: true
    });

  } catch (error) {
    console.error("❌ Error analyzing food image:", error);
    res.status(500).json({
      error: "Failed to analyze food image",
      details: error.message,
      items: [],
      total_calories: 0,
      total_protein: 0
    });
  }
});

// Helper: lookup a single food item from USDA FoodData Central API
async function lookupUSDA(foodName, grams) {
  const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&pageSize=5&api_key=DEMO_KEY`;
  const searchRes = await fetch(searchUrl);
  
  if (!searchRes.ok) throw new Error(`USDA API error: ${searchRes.status}`);
  
  const searchData = await searchRes.json();
  
  if (!searchData.foods || searchData.foods.length === 0) {
    throw new Error(`No USDA results for "${foodName}"`);
  }

  const food = searchData.foods[0];
  const nutrients = food.foodNutrients || [];
  
  // USDA values are per 100g
  const energyNutrient = nutrients.find(n => n.nutrientName === 'Energy' && n.unitName === 'KCAL');
  const proteinNutrient = nutrients.find(n => n.nutrientName === 'Protein');
  
  const calPer100g = energyNutrient?.value || 0;
  const proPer100g = proteinNutrient?.value || 0;
  
  const factor = grams / 100;
  
  return {
    name: food.description,
    grams,
    calories: Math.round(calPer100g * factor),
    protein: Math.round(proPer100g * factor * 10) / 10,
    source: 'usda'
  };
}

// Helper: lookup from FatSecret API (OAuth2)
async function lookupFatSecret(foodName, grams) {
  // Get OAuth2 token
  const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${process.env.FATSECRET_CLIENT_ID}&client_secret=${process.env.FATSECRET_CLIENT_SECRET}`
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('FatSecret auth failed');

  const searchRes = await fetch(
    `https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=${encodeURIComponent(foodName)}&format=json&max_results=3`,
    { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
  );
  const searchData = await searchRes.json();
  
  if (searchData.error) throw new Error(searchData.error.message);
  if (!searchData.foods?.food?.length) throw new Error(`No FatSecret results for "${foodName}"`);
  
  const firstFood = Array.isArray(searchData.foods.food) ? searchData.foods.food[0] : searchData.foods.food;
  
  // Get detailed food info
  const detailRes = await fetch(
    `https://platform.fatsecret.com/rest/server.api?method=food.get.v2&food_id=${firstFood.food_id}&format=json`,
    { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
  );
  const detailData = await detailRes.json();
  if (detailData.error) throw new Error(detailData.error.message);
  
  const servings = detailData.food.servings.serving;
  const servingList = Array.isArray(servings) ? servings : [servings];
  const per100g = servingList.find(s => Number.parseFloat(s.metric_serving_amount) === 100);
  const serving = per100g || servingList[0];
  
  const cal = Number.parseFloat(serving.calories) || 0;
  const pro = Number.parseFloat(serving.protein) || 0;
  const servingSize = Number.parseFloat(serving.metric_serving_amount) || 100;
  const factor = grams / servingSize;

  return {
    name: detailData.food.food_name,
    grams,
    calories: Math.round(cal * factor),
    protein: Math.round(pro * factor * 10) / 10,
    source: 'fatsecret'
  };
}

// New endpoint to calculate nutrition — USDA first, then FatSecret, then Gemini as fallback
app.post("/calculate-nutrition", async (req, res) => {
  try {
    const { items } = req.body;
    
    console.log("📥 Received calculate-nutrition request:", JSON.stringify(items, null, 2));
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No food items provided" });
    }

    console.log(`🔢 Calculating nutrition for ${items.length} items`);

    // Step 1: Try USDA API for each item, then FatSecret, then collect failures for Gemini
    const results = [];
    const failedItems = [];

    for (const item of items) {
      const grams = item.grams || Number.parseInt(item.quantity) || 100;
      
      // Try USDA first
      try {
        const usdaResult = await lookupUSDA(item.name, grams);
        console.log(`✅ USDA: ${item.name} (${grams}g) → ${usdaResult.calories} cal, ${usdaResult.protein}g protein`);
        results.push(usdaResult);
        continue;
      } catch (usdaErr) {
        console.log(`⚠️ USDA failed for "${item.name}": ${usdaErr.message}`);
      }

      // Try FatSecret as second option
      try {
        const fsResult = await lookupFatSecret(item.name, grams);
        console.log(`✅ FatSecret: ${item.name} (${grams}g) → ${fsResult.calories} cal, ${fsResult.protein}g protein`);
        results.push(fsResult);
        continue;
      } catch (fsErr) {
        console.log(`⚠️ FatSecret failed for "${item.name}": ${fsErr.message}`);
      }

      // Both failed — mark for Gemini fallback
      failedItems.push({ name: item.name, grams, index: results.length });
      results.push(null);
    }

    // Step 2: Use Gemini as final fallback for items neither API could find
    if (failedItems.length > 0) {
      console.log(`🤖 Using Gemini fallback for ${failedItems.length} item(s): ${failedItems.map(i => i.name).join(', ')}`);
      
      const fallbackText = failedItems.map(item => `${item.name}: ${item.grams}g`).join('\n');
      const fallbackPrompt = `You are a certified nutrition expert. Calculate accurate calories and protein for these food items:

${fallbackText}

Return ONLY valid JSON (no markdown, no backticks):
{"items":[{"name":"food name","grams":100,"calories":200,"protein":10}]}

Use accurate nutritional data for Indian foods.`;

      const modelPriority = [
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-exp-1206"
      ];

      let geminiData = null;
      for (const modelName of modelPriority) {
        for (const useJsonMode of [true, false]) {
          try {
            const config = { temperature: 0.2, maxOutputTokens: 4096 };
            if (useJsonMode) config.responseMimeType = "application/json";
            
            const model = genAI.getGenerativeModel({ model: modelName, generationConfig: config });
            const result = await model.generateContent(fallbackPrompt);
            const text = result.response.text().replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            geminiData = JSON.parse(text);
            console.log(`🍽️ Gemini fallback (${modelName}):`, JSON.stringify(geminiData));
            break;
          } catch {
            continue;
          }
        }
        if (geminiData) break;
      }

      // Fill in failed items with Gemini results
      for (const fi of failedItems) {
        const geminiItem = geminiData?.items?.[failedItems.indexOf(fi)] || 
                          geminiData?.items?.find(gi => gi.name.toLowerCase().includes(fi.name.toLowerCase().split(' ')[0]));
        
        results[fi.index] = {
          name: fi.name,
          grams: fi.grams,
          calories: geminiItem?.calories || 0,
          protein: geminiItem?.protein || 0,
          source: geminiItem ? 'gemini' : 'unknown'
        };
        if (geminiItem) console.log(`✅ Gemini filled: ${fi.name} → ${geminiItem.calories} cal`);
      }
    }

    // Format response
    const finalItems = results.map(item => ({
      name: item.name,
      quantity: `${item.grams}g`,
      grams: item.grams,
      calories: item.calories,
      protein: item.protein,
      source: item.source
    }));

    const total_calories = finalItems.reduce((sum, item) => sum + item.calories, 0);
    const total_protein = finalItems.reduce((sum, item) => sum + item.protein, 0);

    console.log(`📊 Total: ${total_calories} cal, ${total_protein}g protein`);
    console.log(`📊 Sources: ${finalItems.map(i => `${i.name}(${i.source})`).join(', ')}`);

    res.json({
      items: finalItems,
      total_calories,
      total_protein
    });

  } catch (error) {
    console.error("❌ Error calculating nutrition:", error);
    res.status(500).json({
      error: "Failed to calculate nutrition",
      details: error.message,
      items: [],
      total_calories: 0,
      total_protein: 0
    });
  }
});

// Endpoint to lookup a single food's nutrition (used when editing food names)
app.post("/lookup-food", async (req, res) => {
  try {
    const { name, quantity } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Food name is required" });
    }

    let grams = 100;
    if (quantity) {
      const match = quantity.match(/(\d+(?:\.\d+)?)\s*g/i);
      if (match) grams = Number.parseFloat(match[1]);
    }

    console.log(`🔍 Looking up: ${name} (${grams}g)`);

    // Try USDA first
    try {
      const result = await lookupUSDA(name, grams);
      console.log(`✅ USDA lookup: ${result.name} → ${result.calories} cal, ${result.protein}g protein`);
      return res.json({
        name: result.name,
        quantity: `${grams}g`,
        grams,
        calories: result.calories,
        protein: result.protein
      });
    } catch (usdaErr) {
      console.log(`⚠️ USDA lookup failed: ${usdaErr.message}`);
    }

    // Try FatSecret
    try {
      const result = await lookupFatSecret(name, grams);
      console.log(`✅ FatSecret lookup: ${result.name} → ${result.calories} cal, ${result.protein}g protein`);
      return res.json({
        name: result.name,
        quantity: `${grams}g`,
        grams,
        calories: result.calories,
        protein: result.protein
      });
    } catch (fsErr) {
      console.log(`⚠️ FatSecret lookup failed: ${fsErr.message}`);
    }

    res.status(404).json({ 
      error: "Food not found",
      message: `No nutrition data found for "${name}"` 
    });

  } catch (error) {
    console.error("❌ Error looking up food:", error);
    res.status(500).json({
      error: "Failed to lookup food",
      details: error.message
    });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
