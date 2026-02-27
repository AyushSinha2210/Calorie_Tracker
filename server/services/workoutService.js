/**
 * Workout Service — wger API integration + calorie-burn estimation via MET values.
 *
 * wger public API (no key required):
 *   - Search exercises: GET /api/v2/exercise/search/?term=X&language=english&format=json
 *   - Categories:       GET /api/v2/exercisecategory/?format=json
 *   - Exercise info:    GET /api/v2/exerciseinfo/{id}/?format=json
 *
 * Calorie calculation uses MET (Metabolic Equivalent of Task):
 *   calories = MET × weightKg × durationHours
 *
 * Exercise input types (classified from wger equipment + category):
 *   - cardio:     Duration (min), Distance (km, optional)
 *   - weighted:   Sets, Reps per set, Weight lifted (kg)
 *   - bodyweight: Sets, Reps per set
 *   - isometric:  Hold Duration (seconds)
 */

const WGER_BASE = "https://wger.de/api/v2";

// ── MET values by wger category ID ──
const CATEGORY_MET = {
  10: 4.0,   // Abs — core exercises
  8:  5.0,   // Arms — bicep curls, tricep exercises
  12: 5.5,   // Back — rows, lat pulldowns
  14: 4.5,   // Calves — calf raises
  15: 8.0,   // Cardio — running, cycling, jumping
  11: 5.0,   // Chest — bench press, push-ups
  9:  6.0,   // Legs — squats, lunges
  13: 5.0,   // Shoulders — overhead press
};

// More specific MET overrides for common exercises (by name pattern)
const EXERCISE_MET_OVERRIDES = {
  "running": 9.8,
  "jogging": 7.0,
  "cycling": 7.5,
  "swimming": 8.0,
  "jump rope": 12.3,
  "jumping jack": 8.0,
  "burpee": 10.0,
  "plank": 3.5,
  "walking": 3.5,
  "yoga": 3.0,
  "stretching": 2.5,
  "deadlift": 6.0,
  "squat": 6.0,
  "bench press": 5.0,
  "pull-up": 8.0,
  "push-up": 8.0,
  "rowing": 7.0,
  "elliptical": 5.0,
  "stair climbing": 9.0,
  "hiking": 6.0,
  "dancing": 5.5,
  "boxing": 9.0,
  "skipping": 12.3,
  "mountain climber": 8.0,
  "kettlebell": 6.0,
  "battle rope": 10.3,
  "treadmill": 8.0,
  "sprinting": 11.5,
};

// ── Category cache ──
let _categories = null;

// ── Exercise info cache (avoids repeated wger API calls) ──
const _exerciseInfoCache = new Map();

// ── Equipment classification ──
// Weighted equipment: requires external weight
const WEIGHTED_EQUIPMENT = new Set([1, 2, 3, 8, 9, 10]); // Barbell, SZ-Bar, Dumbbell, Bench, Incline bench, Kettlebell
// Bodyweight equipment: uses body as resistance
const BODYWEIGHT_EQUIPMENT = new Set([7, 6, 4, 5, 11]); // none(bodyweight), Pull-up bar, Gym mat, Swiss Ball, Resistance band

// Isometric exercise name patterns
const ISOMETRIC_PATTERNS = /\b(plank|hold|wall.?sit|isometric|l.?sit|hollow.?body|bridge|dead.?hang|side.?bridge)\b/i;

/**
 * Fetch all exercise categories from wger (cached).
 */
export async function getCategories() {
  if (_categories) return _categories;
  const res = await fetch(`${WGER_BASE}/exercisecategory/?format=json`);
  if (!res.ok) throw new Error(`wger categories failed: ${res.status}`);
  const data = await res.json();
  _categories = data.results; // [{ id, name }]
  return _categories;
}

/**
 * Fetch exercise details from wger exerciseinfo endpoint (cached).
 * Returns equipment, muscles, category info needed for input-type classification.
 */
export async function getExerciseInfo(baseId) {
  if (_exerciseInfoCache.has(baseId)) return _exerciseInfoCache.get(baseId);

  const res = await fetch(`${WGER_BASE}/exerciseinfo/${baseId}/?format=json`);
  if (!res.ok) throw new Error(`wger exerciseinfo failed: ${res.status}`);
  const data = await res.json();

  const equipment = (data.equipment || []).map(e => ({ id: e.id, name: e.name }));
  const categoryId = data.category?.id || null;
  const categoryName = data.category?.name || "Other";
  const exerciseName = (data.translations || []).find(t => t.language === 2)?.name
    || data.name || "";

  const inputType = classifyExerciseType(exerciseName, categoryId, equipment);

  const info = {
    id: data.id,
    categoryId,
    categoryName,
    equipment,
    muscles: (data.muscles || []).map(m => ({ id: m.id, name: m.name_en || m.name })),
    musclesSecondary: (data.muscles_secondary || []).map(m => ({ id: m.id, name: m.name_en || m.name })),
    inputType,
  };

  _exerciseInfoCache.set(baseId, info);
  return info;
}

/**
 * Classify exercise into input type based on name, category, and equipment.
 * @returns {"cardio"|"weighted"|"bodyweight"|"isometric"}
 */
export function classifyExerciseType(exerciseName, categoryId, equipment = []) {
  // 1. Isometric check (by name)
  if (ISOMETRIC_PATTERNS.test(exerciseName)) return "isometric";

  // 2. Cardio category (15)
  if (categoryId === 15) return "cardio";

  // 3. Check equipment
  const equipIds = equipment.map(e => e.id);
  const hasWeighted = equipIds.some(id => WEIGHTED_EQUIPMENT.has(id));

  if (hasWeighted) return "weighted";

  // 4. Bodyweight (no equipment, or bodyweight-only equipment)
  return "bodyweight";
}

/**
 * Search exercises by term using wger's search API.
 * Returns top results with id, name, category info.
 */
export async function searchExercises(term) {
  if (!term || term.trim().length < 2) return [];

  const url = `${WGER_BASE}/exercise/search/?term=${encodeURIComponent(term)}&language=english&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wger search failed: ${res.status}`);
  const data = await res.json();

  // Deduplicate by base_id (some exercises appear multiple times)
  const seen = new Set();
  const results = [];
  for (const s of data.suggestions || []) {
    const d = s.data;
    if (seen.has(d.base_id)) continue;
    seen.add(d.base_id);
    results.push({
      id: d.base_id,
      name: d.name,
      category: d.category || "Other",
      image: d.image ? `https://wger.de${d.image}` : null,
      imageThumbnail: d.image_thumbnail ? `https://wger.de${d.image_thumbnail}` : null,
    });
    if (results.length >= 15) break;
  }
  return results;
}

/**
 * Get MET value for an exercise.
 * Checks name-based overrides first, then falls back to category MET.
 */
function getMET(exerciseName, categoryId) {
  const lower = (exerciseName || "").toLowerCase();
  for (const [key, met] of Object.entries(EXERCISE_MET_OVERRIDES)) {
    if (lower.includes(key)) return met;
  }
  return CATEGORY_MET[categoryId] || 5.0; // default moderate exercise
}

/**
 * Estimate effective duration in minutes from sets × reps.
 * Assumes ~4 sec per rep + ~60 sec rest between sets.
 */
function estimateDurationFromReps(sets, reps) {
  const timePerRep = 4; // seconds
  const restBetweenSets = 60; // seconds
  const totalRepTime = sets * reps * timePerRep;
  const totalRestTime = Math.max(0, sets - 1) * restBetweenSets;
  return (totalRepTime + totalRestTime) / 60; // minutes
}

/**
 * Calculate calories burned — supports duration-based AND reps-based exercises.
 *
 * @param {Object} p
 * @param {string}  p.exerciseName
 * @param {number}  p.categoryId       — wger category ID
 * @param {string}  p.inputType        — "cardio"|"weighted"|"bodyweight"|"isometric"
 * @param {number}  [p.durationMin]    — minutes  (cardio)
 * @param {number}  [p.sets]           — number of sets (weighted/bodyweight)
 * @param {number}  [p.reps]           — reps per set  (weighted/bodyweight)
 * @param {number}  [p.liftedWeight]   — weight lifted in kg (weighted)
 * @param {number}  [p.holdSeconds]    — hold duration in seconds (isometric)
 * @param {number}  p.weightKg         — user's body weight in kg
 * @returns {{ caloriesBurned: number, met: number, effectiveDurationMin: number }}
 */
export function calculateCaloriesBurned(p) {
  const met = getMET(p.exerciseName, p.categoryId);
  let effectiveDurationMin;

  switch (p.inputType) {
    case "cardio":
      effectiveDurationMin = p.durationMin || 0;
      break;
    case "weighted":
    case "bodyweight":
      effectiveDurationMin = estimateDurationFromReps(p.sets || 1, p.reps || 1);
      break;
    case "isometric":
      effectiveDurationMin = (p.holdSeconds || 0) / 60;
      break;
    default:
      effectiveDurationMin = p.durationMin || 0;
  }

  let caloriesBurned = Math.round(met * p.weightKg * (effectiveDurationMin / 60));

  // Bonus for weighted exercises — heavier load increases energy expenditure
  if (p.inputType === "weighted" && p.liftedWeight > 0) {
    const volumeBonus = Math.round((p.sets || 1) * (p.reps || 1) * p.liftedWeight * 0.002);
    caloriesBurned += volumeBonus;
  }

  // Ensure minimum 1 calorie when exercise happened
  if (caloriesBurned < 1 && effectiveDurationMin > 0) caloriesBurned = 1;

  return {
    caloriesBurned,
    met: +met.toFixed(1),
    effectiveDurationMin: +effectiveDurationMin.toFixed(1),
  };
}

/**
 * Get category name by ID.
 */
const CATEGORY_NAMES = {
  10: "Abs", 8: "Arms", 12: "Back", 14: "Calves",
  15: "Cardio", 11: "Chest", 9: "Legs", 13: "Shoulders",
};

export function getCategoryName(id) {
  return CATEGORY_NAMES[id] || "Other";
}

/**
 * Get category ID from name string.
 */
export function getCategoryId(name) {
  const lower = (name || "").toLowerCase();
  for (const [id, n] of Object.entries(CATEGORY_NAMES)) {
    if (n.toLowerCase() === lower) return Number(id);
  }
  return null;
}
