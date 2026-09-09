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
const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_PAGE_SIZE = 200;
const SEARCH_MAX_RESULTS = 15;
const SEARCH_MAX_PAGES = 12;
const SEARCH_BOOTSTRAP_BUDGET_MS = 7000;
const SEARCH_PER_REQUEST_BUDGET_MS = 4000;
const UPSTREAM_TIMEOUT_MS = 8000;

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
  16: 7.0,   // Sports — badminton, cricket, football, tennis, etc.
};

// More specific MET overrides for common exercises & sports (by name pattern)
const EXERCISE_MET_OVERRIDES = {
  // Sports
  "badminton": 7.0,
  "badminton singles": 8.0,
  "badminton doubles": 6.0,
  "badminton match": 8.5,
  "cricket": 5.0,
  "cricket match": 5.5,
  "batting": 5.0,
  "bowling": 6.5,
  "football": 8.5,
  "soccer": 8.5,
  "basketball": 8.0,
  "tennis": 7.3,
  "table tennis": 4.0,
  "ping pong": 4.0,
  "volleyball": 4.5,
  "beach volleyball": 8.0,
  "squash": 12.0,
  "hockey": 8.0,
  "field hockey": 8.0,
  "pickleball": 6.0,
  "padel": 7.0,
  "rugby": 8.3,
  "baseball": 5.0,
  "golf": 4.5,
  "martial arts": 10.0,
  "karate": 10.0,
  "taekwondo": 10.0,
  "judo": 10.0,

  // Cardio & Gym
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

// Curated sports catalog to guarantee immediate search & calculation for sports
export const SPORTS_CATALOG = [
  {
    id: -101,
    name: "Badminton",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 7.0,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -102,
    name: "Badminton (Competitive / Match)",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 8.5,
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -103,
    name: "Cricket",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 5.0,
    image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -104,
    name: "Football / Soccer",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 8.5,
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -105,
    name: "Basketball",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 8.0,
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -106,
    name: "Tennis",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 7.3,
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -107,
    name: "Table Tennis / Ping Pong",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 4.0,
    image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -108,
    name: "Volleyball",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 4.5,
    image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -109,
    name: "Squash",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 12.0,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -110,
    name: "Swimming (Laps / Sport)",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 8.0,
    image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -111,
    name: "Pickleball",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 6.0,
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -112,
    name: "Hockey",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 8.0,
    image: "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: -113,
    name: "Boxing / Sparring",
    category: "Sports",
    categoryId: 16,
    inputType: "sports",
    met: 9.0,
    image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=300&auto=format&fit=crop&q=80",
  },
];

// ── Category cache ──
let _categories = null;

// ── Exercise info cache (avoids repeated wger API calls) ──
const _exerciseInfoCache = new Map();
let _translationIndex = [];
let _translationIndexFetchedAt = 0;
let _translationIndexPromise = null;

// ── Equipment classification ──
// Weighted equipment: requires external weight
const WEIGHTED_EQUIPMENT = new Set([1, 2, 3, 8, 9, 10]); // Barbell, SZ-Bar, Dumbbell, Bench, Incline bench, Kettlebell
// Bodyweight equipment: uses body as resistance
const BODYWEIGHT_EQUIPMENT = new Set([7, 6, 4, 5, 11]); // none(bodyweight), Pull-up bar, Gym mat, Swiss Ball, Resistance band

// Isometric exercise name patterns
const ISOMETRIC_PATTERNS = /\b(plank|hold|wall.?sit|isometric|l.?sit|hollow.?body|bridge|dead.?hang|side.?bridge)\b/i;

function normalizeSearchText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "");
}

async function fetchJsonWithTimeout(url, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`wger request failed: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickEnglishName(item) {
  const t = (item?.translations || []).find((x) => x.language === 2);
  return t?.name || item?.name || "";
}

function collectMatchesFromIndex(index, term, maxResults) {
  const needle = normalizeSearchText(term);
  const seen = new Set();
  const matches = [];

  for (const item of index) {
    if (!item?.nameNorm?.includes(needle)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    matches.push({ id: item.id, name: item.name });
    if (matches.length >= maxResults) break;
  }

  return matches;
}

async function buildTranslationIndex() {
  const start = Date.now();
  const collected = [];
  let nextUrl = `${WGER_BASE}/exerciseinfo/?language=2&ordering=id&limit=${SEARCH_PAGE_SIZE}`;
  let page = 0;

  while (nextUrl && page < SEARCH_MAX_PAGES && (Date.now() - start) < SEARCH_BOOTSTRAP_BUDGET_MS) {
    let data;
    try {
      data = await fetchJsonWithTimeout(nextUrl);
    } catch {
      break;
    }

    for (const item of data.results || []) {
      const name = pickEnglishName(item);
      if (!name) continue;
      collected.push({
        id: item.id,
        name,
        nameNorm: normalizeSearchText(name),
      });
    }

    nextUrl = data.next;
    page += 1;
  }

  if (collected.length > 0) {
    _translationIndex = collected;
    _translationIndexFetchedAt = Date.now();
  }
}

async function ensureTranslationIndex(maxWaitMs = SEARCH_PER_REQUEST_BUDGET_MS) {
  const fresh = _translationIndex.length > 0 && (Date.now() - _translationIndexFetchedAt) < SEARCH_CACHE_TTL_MS;
  if (fresh) return;

  if (!_translationIndexPromise) {
    _translationIndexPromise = buildTranslationIndex().finally(() => {
      _translationIndexPromise = null;
    });
  }

  if (maxWaitMs <= 0) return;

  await Promise.race([
    _translationIndexPromise,
    new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
  ]);
}

async function fetchTranslationMatches(term, maxResults) {
  await ensureTranslationIndex();

  let matches = collectMatchesFromIndex(_translationIndex, term, maxResults);
  if (matches.length > 0) return matches;

  // Fallback for very new exercises not yet in cache; keep it bounded and fast.
  const start = Date.now();
  const seen = new Set();
  const fallback = [];
  const needle = normalizeSearchText(term);
  let nextUrl = `${WGER_BASE}/exerciseinfo/?language=2&ordering=id&limit=${SEARCH_PAGE_SIZE}`;
  let page = 0;

  while (nextUrl && page < 3 && fallback.length < maxResults && (Date.now() - start) < SEARCH_PER_REQUEST_BUDGET_MS) {
    let data;
    try {
      data = await fetchJsonWithTimeout(nextUrl, 5000);
    } catch {
      break;
    }

    for (const item of data.results || []) {
      const name = pickEnglishName(item);
      if (!normalizeSearchText(name).includes(needle)) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      fallback.push({ id: item.id, name });
      if (fallback.length >= maxResults) break;
    }

    nextUrl = data.next;
    page += 1;
  }

  matches = fallback;
  return matches;
}

async function mapTranslationMatch(match) {
  try {
    const info = await getExerciseInfo(match.id);
    return {
      id: info.id,
      name: info.name || match.name,
      category: info.categoryName || getCategoryName(info.categoryId) || "Other",
      image: info.image ? `https://wger.de${info.image}` : null,
      imageThumbnail: info.imageThumbnail ? `https://wger.de${info.imageThumbnail}` : null,
    };
  } catch {
    return {
      id: match.id,
      name: match.name,
      category: "Other",
      image: null,
      imageThumbnail: null,
    };
  }
}

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
  if (baseId < 0) {
    const sport = SPORTS_CATALOG.find((s) => s.id === baseId);
    if (sport) {
      return {
        id: sport.id,
        name: sport.name,
        categoryId: sport.categoryId,
        categoryName: sport.category,
        equipment: [],
        muscles: [],
        musclesSecondary: [],
        inputType: sport.inputType,
        image: sport.image,
        imageThumbnail: sport.image,
      };
    }
  }

  if (_exerciseInfoCache.has(baseId)) return _exerciseInfoCache.get(baseId);

  const data = await fetchJsonWithTimeout(`${WGER_BASE}/exerciseinfo/${baseId}/?format=json`);

  const equipment = (data.equipment || []).map(e => ({ id: e.id, name: e.name }));
  const categoryId = data.category?.id || null;
  const categoryName = data.category?.name || "Other";
  const exerciseName = (data.translations || []).find(t => t.language === 2)?.name
    || data.name || "";
  const image = data.images?.[0]?.image || data.images?.[0]?.image_url || null;
  const imageThumbnail = data.images?.[0]?.image_thumbnail || data.images?.[0]?.image_thumbnail_url || image;

  const inputType = classifyExerciseType(exerciseName, categoryId, equipment);

  const info = {
    id: data.id,
    name: exerciseName,
    categoryId,
    categoryName,
    equipment,
    muscles: (data.muscles || []).map(m => ({ id: m.id, name: m.name_en || m.name })),
    musclesSecondary: (data.muscles_secondary || []).map(m => ({ id: m.id, name: m.name_en || m.name })),
    inputType,
    image,
    imageThumbnail,
  };

  _exerciseInfoCache.set(baseId, info);
  return info;
}

/**
 * Classify exercise into input type based on name, category, and equipment.
 * @returns {"sports"|"cardio"|"weighted"|"bodyweight"|"isometric"}
 */
export function classifyExerciseType(exerciseName, categoryId, equipment = []) {
  if (categoryId === 16) return "sports";
  if (/(badminton|cricket|football|soccer|basketball|tennis|table.?tennis|ping.?pong|volleyball|squash|hockey|pickleball|padel|rugby|baseball)/i.test(exerciseName)) {
    return "sports";
  }

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
 * Search exercises by term using wger's search API + local Sports catalog.
 * Returns top results with id, name, category info.
 */
export async function searchExercises(term) {
  if (!term || term.trim().length < 2) return [];
  const needle = normalizeSearchText(term);
  const matchedSports = SPORTS_CATALOG.filter(s =>
    normalizeSearchText(s.name).includes(needle) || needle.includes(normalizeSearchText(s.name))
  ).map(s => ({
    id: s.id,
    name: s.name,
    category: s.category,
    image: s.image,
    imageThumbnail: s.image,
    inputType: s.inputType,
  }));

  try {
    const matches = await fetchTranslationMatches(term, SEARCH_MAX_RESULTS);
    const gymMatches = await Promise.all(matches.map(mapTranslationMatch));
    return [...matchedSports, ...gymMatches].slice(0, SEARCH_MAX_RESULTS);
  } catch {
    // If upstream wger is slow or fails, return sports matches cleanly
    return matchedSports;
  }
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
 * @param {string}  p.inputType        — "sports"|"cardio"|"weighted"|"bodyweight"|"isometric"
 * @param {number}  [p.durationMin]    — minutes  (sports, cardio)
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
    case "sports":
    case "sport":
    case "cardio":
      effectiveDurationMin = p.durationMin || 0;
      break;
    case "weighted":
    case "weight_reps":
    case "bodyweight":
      effectiveDurationMin = estimateDurationFromReps(p.sets || 1, p.reps || 1);
      break;
    case "isometric":
    case "hold":
      effectiveDurationMin = (p.holdSeconds || 0) / 60;
      break;
    default:
      effectiveDurationMin = p.durationMin || 0;
  }

  let caloriesBurned = Math.round(met * p.weightKg * (effectiveDurationMin / 60));

  // Bonus for weighted exercises — heavier load increases energy expenditure
  if ((p.inputType === "weighted" || p.inputType === "weight_reps") && p.liftedWeight > 0) {
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
  15: "Cardio", 11: "Chest", 9: "Legs", 13: "Shoulders", 16: "Sports",
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
