import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const app = express();
app.use(cors());
app.use(express.json());

app.post("/analyze-food", async (req, res) => {
  const { text } = req.body;

  const modelPriority = [
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-exp-1206"
  ];

  async function callGemini(modelName, prompt) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.2 }
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
        const isRateLimit = error.message.includes("429") || 
                           error.message.includes("quota") || 
                           error.message.includes("rate");
        
        const isNotFound = error.message.includes("404") || 
                          error.message.includes("not found");

        if (isRateLimit || isNotFound) {
          continue;
        } else {
          throw error;
        }
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


app.listen(5000, () => {
  console.log("Server running on port 5000");
});
