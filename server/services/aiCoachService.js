/**
 * AI Coach Service — uses a SEPARATE Groq API key (GROQ_COACH_API_KEY)
 * to generate contextual comments on user food/workout entries and
 * build ready-to-use prompts the user can paste anywhere.
 */

const COACH_TIMEOUT_MS = 12_000;

// Models to rotate through (same free-tier Groq models)
// Models to rotate through (valid Groq models)
const MODELS = [
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
];

const modelHealth = {};

function markBad(name) {
  modelHealth[name] = { bad: true, at: Date.now() };
}
function isOk(name) {
  const s = modelHealth[name];
  if (!s) return true;
  if (Date.now() - s.at > 3 * 60_000) { delete modelHealth[name]; return true; }
  return !s.bad;
}

// ── Tone system prompts ──
const TONE_PROMPTS = {
  strict: `You are an extremely strict and no-nonsense diet coach. You are blunt, use tough love, and don't sugarcoat anything. If someone eats too much junk, you scold them. If they eat well, you give curt approval. You use short, punchy sentences. Examples: "That's WAY too many calories for one meal!", "Finally, some protein. Took you long enough.", "You call that a salad? More like a sugar bowl with lettuce."`,

  friendly: `You are a warm, supportive, and encouraging fitness trainer. You celebrate every small win, gently guide toward better choices, and always keep things positive. You use encouraging words and emojis sparingly. Examples: "Great job adding protein to your meal!", "That's a solid choice — keep it up!", "Maybe swap the soda for water next time? You've got this!"`,

  sarcastic: `You are a sarcastic, witty gym buddy who roasts with love. You use humor and playful jabs to motivate. You're never mean-spirited but always funny. Examples: "Oh wow, another pizza. Training for a competitive eating contest?", "Look at you eating vegetables! Who are you and what have you done with the real you?", "3000 calories before noon? That's what I call speedrunning your calorie goal."`,

  motivational: `You are an intense motivational speaker who treats every meal and workout like a life-changing moment. You're passionate, use powerful language, and make everything sound epic. Examples: "EVERY bite is a CHOICE. And you just chose GREATNESS!", "This protein shake isn't just a drink — it's FUEL for the CHAMPION inside you!", "You showed up. You tracked your food. That's more than 90% of people do. Be PROUD."`,
};

// ── Raw Groq API call using the COACH key ──
async function callCoachGroq(model, messages, config = {}) {
  const apiKey = process.env.GROQ_COACH_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_COACH_API_KEY (or GROQ_API_KEY) not set");

  const body = {
    model,
    messages,
    temperature: config.temperature ?? 0.8,
    max_tokens: config.max_tokens ?? 300,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COACH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") throw new Error(`Coach model ${model} timed out`);
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json();
  if (res.status !== 200 || data.error) {
    const err = new Error(data.error?.message || `HTTP ${res.status}`);
    err.isRateLimit = res.status === 429 || /rate.limit|too many|quota/i.test(data.error?.message || "");
    throw err;
  }

  return data.choices?.[0]?.message?.content || "";
}

// ── Gemini fallback for coach ──
async function callCoachGemini(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const systemMessage = messages.find(m => m.role === "system")?.content || "";
  const userMessage = messages.filter(m => m.role !== "system").map(m => m.content).join("\n\n");
  const prompt = systemMessage ? `${systemMessage}\n\nContext:\n${userMessage}` : userMessage;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 250 },
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidate) return candidate.trim();
    throw new Error(data.error?.message || "Empty response from Gemini");
  } finally {
    clearTimeout(timeout);
  }
}

// Try Groq models with fallback
async function tryCoachModels(messages, config = {}) {
  const available = MODELS.filter(isOk);
  if (!available.length) {
    const oldest = Object.entries(modelHealth).sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) { delete modelHealth[oldest[0]]; available.push(oldest[0]); }
  }

  let lastErr;
  for (const name of available) {
    try {
      const text = await callCoachGroq(name, messages, config);
      delete modelHealth[name];
      return text;
    } catch (e) {
      lastErr = e;
      if (e.isRateLimit) markBad(name);
    }
  }
  throw lastErr || new Error("All coach Groq models failed");
}

/**
 * Intelligent heuristic fallback comment generator.
 * Guarantees a relevant, tone-matched coach comment even if all remote AI APIs are offline.
 */
export function generateHeuristicCoachComment({ tone = "friendly", activityType = "daily", entry = {}, dayStats = {} }) {
  const cals = Number(dayStats?.totalCalories) || 0;
  const target = Number(dayStats?.calorieTarget) || 2000;
  const burned = Number(dayStats?.caloriesBurned) || 0;
  const protein = Number(dayStats?.totalProtein) || 0;
  const remaining = target - cals;

  if (activityType === "daily" || activityType === "summary") {
    if (tone === "strict") {
      if (remaining < -200) {
        return `You're over budget by ${Math.abs(remaining)} kcal today. Put down the snacks, drink water, and keep your discipline.`;
      } else if (remaining >= 0 && remaining <= 300) {
        return `Right on target for calories today (${cals}/${target} kcal). Keep this exact consistency tomorrow.`;
      } else {
        return `You've eaten ${cals} kcal out of your ${target} kcal target. Hit your protein target and don't ruin it tonight.`;
      }
    } else if (tone === "sarcastic") {
      if (remaining < -200) {
        return `Did someone say calorie deficit? Because your food log certainly didn't. Hope those extra ${Math.abs(remaining)} kcal were delicious!`;
      } else if (cals === 0) {
        return `Zero calories logged today. Are you photosynthesizing or just practicing invisible eating?`;
      } else {
        return `Look at you tracking your stats! ${cals} kcal consumed, ${burned} kcal burned. The gym deities are mildly impressed.`;
      }
    } else if (tone === "motivational") {
      return `Every single calorie tracked brings you closer to your fitness goals! You're sitting at ${cals} kcal and ${protein}g protein today. Keep that fire burning!`;
    } else {
      // friendly
      if (cals === 0) {
        return `Welcome to a fresh day! Don't forget to track your meals and stay hydrated today. You've got this!`;
      } else if (remaining < 0) {
        return `You've logged ${cals} kcal today. Focus on nutrient-dense foods and good hydration for the rest of the evening!`;
      } else {
        return `Great progress today! You're at ${cals} kcal out of ${target} kcal with ${burned} kcal burned. Finish strong!`;
      }
    }
  } else if (activityType === "food") {
    const foodName = entry?.name || entry?.item || "your meal";
    const foodCals = entry?.calories || 0;
    const foodPro = entry?.protein || 0;
    if (tone === "strict") {
      return foodPro >= 15
        ? `Solid protein (${foodPro}g) in ${foodName}. That's the fuel that actually builds muscle.`
        : `${foodCals} kcal from ${foodName} with only ${foodPro}g protein. Prioritize real protein in your next meal.`;
    } else if (tone === "sarcastic") {
      return foodCals > 500
        ? `${foodName} for ${foodCals} kcal? Hope your taste buds threw a celebration for that one.`
        : `Logged ${foodName}. Look at you making responsible dietary decisions!`;
    } else if (tone === "motivational") {
      return `Every bite is fuel for greatness! ${foodName} delivers ${foodCals} kcal to energize your journey today.`;
    } else {
      return `Nice choice logging ${foodName} (${foodCals} kcal, ${foodPro}g protein)! Every step counts toward your goal.`;
    }
  } else {
    // workout
    const exName = entry?.exerciseName || entry?.name || "your workout";
    const burnedCals = entry?.caloriesBurned || 0;
    if (tone === "strict") {
      return `Logged ${exName} for ${burnedCals} kcal burned. Don't use it as an excuse to overeat later.`;
    } else if (tone === "sarcastic") {
      return `Crushed ${exName}! That's ${burnedCals} calories obliterated. Celebrate with a tall glass of water.`;
    } else if (tone === "motivational") {
      return `CHAMPION EFFORT! You put in the work on ${exName} and burned ${burnedCals} kcal. You are unstoppable!`;
    } else {
      return `Awesome workout! ${exName} burned approximately ${burnedCals} kcal. Keep up the consistent effort!`;
    }
  }
}

// ──────────────────────────────────────────────
// PUBLIC: Generate AI Coach Comment
// ──────────────────────────────────────────────

/**
 * Generate an AI coach comment for user's food/workout/daily activity.
 * @param {Object} params
 * @param {string} params.tone - "strict" | "friendly" | "sarcastic" | "motivational"
 * @param {string} params.activityType - "food" | "workout" | "daily" | "summary"
 * @param {Object} params.entry - { name, calories, protein, ... } or workout details
 * @param {Object} params.dayStats - { totalCalories, totalProtein, calorieTarget, caloriesBurned, maintenanceCalories }
 * @param {Object} [params.userProfile] - { name, weight, height, age, gender }
 * @returns {Promise<{ comment: string }>}
 */
export async function generateCoachComment({ tone = "friendly", activityType = "daily", entry, dayStats, userProfile }) {
  const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.friendly;

  let userMessage;
  if (activityType === "daily" || activityType === "summary") {
    userMessage = `The user is reviewing today's fitness and nutrition totals:
- Total calories consumed: ${dayStats?.totalCalories || 0} kcal
- Daily calorie target: ${dayStats?.calorieTarget || "not set"} kcal
- Total protein: ${dayStats?.totalProtein || 0}g
- Calories burned from exercise: ${dayStats?.caloriesBurned || 0} kcal
- Net calorie balance: ${(dayStats?.totalCalories || 0) - (dayStats?.caloriesBurned || 0)} kcal

${userProfile ? `User info: ${userProfile.name || "User"}, ${userProfile.age || "?"}y, ${userProfile.weight || "?"}kg, Goal: ${userProfile.goal || "fitness"}` : ""}

Give a short (1-3 sentence) summary feedback comment in your character. Consider their calorie deficit/surplus and protein. Don't use hashtags.`;
  } else if (activityType === "food") {
    userMessage = `The user just logged a food entry:
- Food: ${entry?.name || entry?.item || "food"}
- Calories: ${entry?.calories || 0} kcal
- Protein: ${entry?.protein || 0}g
${entry?.quantity ? `- Quantity: ${entry.quantity}` : ""}
${entry?.mealType ? `- Meal type: ${entry.mealType}` : ""}

Today's running totals:
- Total calories consumed: ${dayStats?.totalCalories || 0} kcal
- Total protein: ${dayStats?.totalProtein || 0}g
- Daily calorie target: ${dayStats?.calorieTarget || "not set"}
- Calories burned today: ${dayStats?.caloriesBurned || 0}

${userProfile ? `User info: ${userProfile.name || "User"}, ${userProfile.age || "?"}y, ${userProfile.weight || "?"}kg` : ""}

Give a short (1-3 sentence) comment about this food entry in your character. Consider the day's totals. Be specific about the food. Don't use hashtags.`;
  } else {
    userMessage = `The user just logged a workout:
- Exercise: ${entry?.exerciseName || entry?.name || "workout"}
- Calories burned: ${entry?.caloriesBurned || 0} kcal
${entry?.durationMin ? `- Duration: ${entry.durationMin} min` : ""}
${entry?.sets ? `- Sets: ${entry.sets}, Reps: ${entry?.reps || "?"}` : ""}

Today's running totals:
- Total calories consumed: ${dayStats?.totalCalories || 0} kcal
- Total calories burned: ${dayStats?.caloriesBurned || 0}
- Daily calorie target: ${dayStats?.calorieTarget || "not set"}

Give a short (1-3 sentence) comment about this workout in your character. Be specific about the exercise. Don't use hashtags.`;
  }

  const messages = [
    { role: "system", content: tonePrompt },
    { role: "user", content: userMessage },
  ];

  try {
    const comment = await tryCoachModels(messages, { temperature: 0.85, max_tokens: 200 });
    return { comment: comment.trim() };
  } catch (err) {
    console.warn(`[AI COACH] Groq models failed (${err.message}), trying Gemini...`);
    try {
      const geminiComment = await callCoachGemini(messages);
      return { comment: geminiComment };
    } catch (gErr) {
      console.warn(`[AI COACH] Gemini fallback failed (${gErr.message}), using heuristic fallback...`);
      const fallback = generateHeuristicCoachComment({ tone, activityType, entry, dayStats });
      return { comment: fallback };
    }
  }
}

// ──────────────────────────────────────────────
// PUBLIC: Generate a ready-to-use prompt
// ──────────────────────────────────────────────

const PROMPT_TEMPLATES = {
  "workout-home": (profile) => `Create a detailed weekly home workout plan for me. I don't have any gym equipment.

My details:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Weight: ${profile.weight || "Not specified"} kg
- Height: ${profile.height || "Not specified"} cm
- Goal: ${profile.goal || "Lose weight and get fit"}
- Fitness level: ${profile.fitnessLevel || "Beginner"}

Please include:
1. A structured weekly plan (Monday-Sunday) with rest days
2. Specific exercises with sets and reps
3. Warm-up and cool-down routines
4. Progressive difficulty over 4 weeks
5. Estimated calories burned per session`,

  "workout-gym": (profile) => `Create a detailed weekly gym workout plan with access to full gym equipment.

My details:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Weight: ${profile.weight || "Not specified"} kg
- Height: ${profile.height || "Not specified"} cm
- Goal: ${profile.goal || "Build muscle and lose fat"}
- Fitness level: ${profile.fitnessLevel || "Beginner"}

Please include:
1. A structured weekly split (Push/Pull/Legs or similar)
2. Specific exercises with sets, reps, and rest periods
3. Compound and isolation exercises
4. Warm-up and cool-down routines
5. Progressive overload strategy over 4 weeks
6. Estimated calories burned per session`,

  "workout-exercise": (profile) => `Create a simple daily exercise routine that I can do anywhere in 20-30 minutes.

My details:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Weight: ${profile.weight || "Not specified"} kg
- Goal: ${profile.goal || "Stay active and healthy"}
- Fitness level: ${profile.fitnessLevel || "Beginner"}

Please include:
1. A mix of cardio, strength, and flexibility exercises
2. Each exercise with duration/reps
3. No equipment needed
4. Easy to follow daily
5. Can be done in the morning or evening`,

  "diet-mess": (profile) => `Create a weekly diet plan using a typical Indian college/hostel mess menu.

My details:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Weight: ${profile.weight || "Not specified"} kg
- Height: ${profile.height || "Not specified"} cm
- Daily calorie target: ${profile.calorieTarget || "2000"} kcal
- Daily protein target: ${profile.proteinTarget || "Not set"}
- Goal: ${profile.goal || "Maintain weight and eat healthy"}

Typical mess options available:
- Breakfast: Poha, Upma, Paratha, Bread-Butter, Idli, Dosa, Cornflakes, Boiled Eggs
- Lunch: Rice, Dal, Roti, Sabzi (seasonal), Curd, Salad
- Evening: Tea/Coffee, Biscuits, Samosa, Bread Pakora, Fruits
- Dinner: Rice, Dal, Roti, Sabzi (seasonal), Kheer/Sweet (sometimes)

Please provide:
1. What to eat and what to skip at each meal
2. Portion sizes to match calorie target
3. How to maximize protein from mess food
4. Snacking strategies between meals
5. Weekend meal suggestions`,

  "diet-plan": (profile) => `Create a personalized weekly diet/meal plan for me.

My details:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Weight: ${profile.weight || "Not specified"} kg
- Height: ${profile.height || "Not specified"} cm
- Daily calorie target: ${profile.calorieTarget || "2000"} kcal
- Goal: ${profile.goal || "Lose weight while staying energized"}
- Diet preference: ${profile.dietPref || "Indian vegetarian & non-vegetarian"}
- Budget: ${profile.budget || "Moderate (student-friendly)"}

Please include:
1. Day-by-day meal plan (Breakfast, Lunch, Snacks, Dinner)
2. Calorie and protein breakdown per meal
3. Grocery list for the week
4. Quick meal prep tips
5. Affordable substitutions
6. Hydration and supplement recommendations`,

  "weight-loss": (profile) => `Create a comprehensive weight loss plan combining diet and exercise.

My details:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Current weight: ${profile.weight || "Not specified"} kg
- Target weight: ${profile.targetWeight || "Not specified"} kg
- Height: ${profile.height || "Not specified"} cm
- Timeframe: ${profile.timeframe || "3 months"}
- Activity level: ${profile.activityLevel || "Sedentary"}
- Constraints: ${profile.constraints || "None"}

Please include:
1. Realistic weekly weight loss targets
2. Daily calorie deficit recommendation
3. Simple diet guidelines (not a rigid plan)
4. Exercise routine (mix of cardio + strength)
5. Common mistakes to avoid
6. How to track progress
7. What to do on plateaus`,
};

/**
 * Build a ready-to-paste prompt based on a template + user profile.
 * Does NOT call AI — just fills in a template so user can paste it into ChatGPT, etc.
 * @param {string} templateKey - one of the PROMPT_TEMPLATES keys
 * @param {Object} profile - user profile data + any extra fields
 * @returns {{ prompt: string, title: string }}
 */
export function buildPrompt(templateKey, profile = {}) {
  const template = PROMPT_TEMPLATES[templateKey];
  if (!template) {
    return { prompt: "", title: "", error: `Unknown template: ${templateKey}` };
  }

  const titles = {
    "workout-home": "🏠 Home Workout Plan",
    "workout-gym": "🏋️ Gym Workout Plan",
    "workout-exercise": "🏃 Daily Exercise Routine",
    "diet-mess": "🍱 Mess/Hostel Diet Plan",
    "diet-plan": "🥗 Personalized Diet Plan",
    "weight-loss": "⚖️ Weight Loss Plan",
  };

  return {
    prompt: template(profile),
    title: titles[templateKey] || templateKey,
  };
}

/** List all available prompt templates */
export function getPromptTemplates() {
  return [
    { key: "workout-home", title: "🏠 Home Workout Plan", description: "No equipment needed, full body workout at home" },
    { key: "workout-gym", title: "🏋️ Gym Workout Plan", description: "Structured gym routine with equipment" },
    { key: "workout-exercise", title: "🏃 Daily Exercise Routine", description: "Quick 20-30 min daily exercise, no equipment" },
    { key: "diet-mess", title: "🍱 Mess/Hostel Diet Plan", description: "Optimize your college mess meals" },
    { key: "diet-plan", title: "🥗 Personalized Diet Plan", description: "Custom weekly meal plan for your goals" },
    { key: "weight-loss", title: "⚖️ Weight Loss Plan", description: "Complete diet + exercise weight loss strategy" },
  ];
}
