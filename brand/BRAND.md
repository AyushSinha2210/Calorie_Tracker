# FoodCal Brand & Shared Spec

Used by both the Android app (`android_native/`) and the website (`frontend/`).

## Logo
- `logo.svg` — app icon (rounded-square dark background, 512×512 viewBox)
- `logo-mark.svg` — transparent mark (ring "C" + tilted leaf + lime dot)
- Wordmark: **FoodCal** in Plus Jakarta Sans ExtraBold; "Food" in foreground color, "Cal" in the brand gradient.

## Colors (dark-first)
| Token | Hex | Use |
|---|---|---|
| bg | `#07090F` | app background |
| surface | `#0F141C` | cards |
| surface-2 | `#161D27` | raised / inputs |
| border | `#1F2937` | hairlines (use ~60% opacity) |
| text | `#F5F7FA` | primary text |
| text-muted | `#94A3B8` | secondary text |
| brand | `#10B981` | primary (emerald) |
| brand-2 | `#A3E635` | accent (lime); gradient = brand → brand-2 at 135° |
| logo gradient | `#34D399 → #A3E635` | logo only |
| calories | `#F97316` | calorie ring / burned |
| protein | `#F43F5E` | protein |
| carbs | `#F59E0B` | carbs |
| fat | `#38BDF8` | fat |
| danger | `#EF4444` | errors |

Light theme: bg `#F7F8FA`, surface `#FFFFFF`, surface-2 `#F1F5F9`, text `#0B1220`, muted `#64748B`, same accents (brand `#059669`).

## Shape & motion
- Radius: cards 24, buttons/pills 16, chips 999.
- Spring animations (stiffness ~200, damping ~20); rings animate 0→value over ~900ms with ease-out.
- Number counters tick up; shimmer skeletons while loading; subtle scale(0.97) on press.

## Data model (Firestore — SAME project for web + app)
- `users/{uid}`: name, email, photo, profileImage (data URL), age, gender, weight (kg), weightUnit, originalWeight, height (cm), heightUnit, originalHeight, dailyCalorieTarget, profileComplete, coachEnabled, coachTone, emailReport{enabled,frequency,time,dayOfWeek,dayOfMonth,email}, lastRecordedWeight, lastWeightLogDate, lastActive, createdAt
- `users/{uid}/foodLogs`: itemName, quantity, calories, protein, mealType, date ("YYYY-MM-DD"), createdAt, items[]{name,quantity,calories,protein}
  - **NEW optional** fields: carbs, fat, healthScore (1–10), source ("scan"|"text"|"manual"), items[].carbs, items[].fat, items[].grams. Old docs lack them → treat as 0 / hidden.
- `users/{uid}/workoutLogs`: exerciseName, exerciseId, category, inputType (cardio|weighted|bodyweight|isometric), caloriesBurned, met, effectiveDurationMin, weightKg, durationMin, distanceKm?, sets?, reps?, liftedWeight?, holdSeconds?, image?, imageThumbnail?, date, createdAt
- `users/{uid}/weightLogs`: weight (kg), originalWeight, unit, date, createdAt (also update users doc lastRecordedWeight/lastWeightLogDate)
- `feedbacks`: see FeedbackModal.jsx

## API (Render: https://calorie-tracker-k014.onrender.com — free tier, cold starts up to ~60s)
- **NEW** `POST /scan-meal` multipart `image` → `{mealName, items[{name,quantity,grams,calories,protein,carbs,fat}], total_calories, total_protein, total_carbs, total_fat, healthScore, tip, note?, fallback?}`; 429 on quota. If 404 (not yet deployed) → fall back to `/analyze-food-image` + `/calculate-nutrition`.
- `POST /analyze-food` `{text}` → `{items[{name,quantity,calories,protein}], total_calories, total_protein, note?}`
- `POST /analyze-food-image` multipart `image` → items with grams (needs `/calculate-nutrition`)
- `POST /calculate-nutrition` `{items[{name,grams,quantity}]}` → items with calories/protein
- `POST /lookup-food` `{name, quantity:"150g"}`
- `GET /workout/search?term=`, `GET /workout/categories`, `GET /workout/exercise-info/:id`, `POST /workout/calculate` `{exerciseName,categoryId,inputType,durationMin,sets,reps,liftedWeight,holdSeconds,weightKg}`
- `POST /ai-coach/comment` `{tone, activityType:"food"|"workout", entry, dayStats{totalCalories,totalProtein,calorieTarget,caloriesBurned,maintenanceCalories}, userProfile{name,weight,height,age,gender}}` → `{comment}`
- `GET /ai-coach/templates`, `POST /ai-coach/prompt` `{templateKey, profile}`
- `POST /email-report/send-with-data` `{email, displayName, frequency, foodLogs, weightLogs, workoutLogs, maintenanceCalories}`

Secrets (Gemini/Groq/FatSecret/SendGrid/service account) live ONLY on the server.

