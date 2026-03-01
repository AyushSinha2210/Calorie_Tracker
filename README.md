# AI Powered Food & Fitness Tracker

A full-stack fitness tracking app with AI-powered food recognition, nutrition analysis, workout tracking, AI coaching, and smart prompt generation. Built with React, Node.js, Firebase, and multiple AI APIs.

## Features

### Food Tracking (3 Methods)
- **Image Analysis** — Upload or capture food photos; Gemini Vision identifies items, FatSecret/Groq calculates nutrition
- **AI Text Entry** — Describe meals naturally (*"2 rotis and 1 bowl dal"*) and get instant nutrition breakdown
- **Manual Entry** — Direct input with full control over calories and protein

### AI Coach
- **Auto-comments** on every meal and workout you log
- **4 tone presets** — Strict Coach, Friendly Trainer, Sarcastic Buddy, Motivational Speaker
- **Day summary** on demand — get feedback on your overall day
- Uses a **separate Groq API key** so coaching doesn't eat into nutrition API quota

### Prompt Generator
- **6 ready-to-paste prompts** pre-filled with your profile data:
  - Home Workout Plan, Gym Workout Plan, Daily Exercise Routine
  - Mess/Hostel Diet Plan, Personalized Diet Plan, Weight Loss Plan
- Customize goal, fitness level, diet preference, target weight, timeframe
- Copy and paste into ChatGPT, Gemini, Claude, or any AI assistant

### Workout Tracking
- Search 800+ exercises from wger API
- MET-based calorie burn calculation (cardio, strength, isometric, bodyweight)
- Daily workout log with history

### Other
- **Weight History** — Track weight over time with visual chart
- **Email Reports** — Automated daily/weekly/monthly nutrition reports via email
- **Nutrition Charts** — 7-day bar charts for calories and protein trends
- **Monthly Nutrition Table** — Full month view with daily totals and averages
- **User Authentication** — Firebase Auth (Email/Password + Google Sign-In)
- **Profile Management** — Age, weight, height, gender, calorie target
- **Responsive Design** — Works on desktop, tablet, and mobile

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, React Router v7, Tailwind CSS, Framer Motion, Recharts |
| **Backend** | Node.js (ESM), Express 5, Multer |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Authentication |
| **AI/Nutrition** | Google Gemini (vision + text), Groq LLMs (Llama models), FatSecret API |
| **Email** | Nodemailer (Gmail) |

## Project Structure

```
├── frontend/                    # React application
│   ├── src/
│   │   ├── config.js            # Shared API base URL
│   │   ├── firebase.js          # Firebase client config
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Auth state + user profile
│   │   ├── Pages/
│   │   │   ├── Dashboard.jsx    # Main app (5 tabs)
│   │   │   ├── Login.jsx        # Email + Google login
│   │   │   ├── Register.jsx     # Registration
│   │   │   ├── Profile.jsx      # View/edit profile
│   │   │   ├── ProfileSetup.jsx # First-time setup
│   │   │   ├── ForgotPassword.jsx
│   │   │   └── VerifyEmail.jsx
│   │   └── components/
│   │       ├── FoodForm.jsx          # Image/Text/Manual food entry
│   │       ├── FoodLogEditor.jsx     # Edit/delete food logs by date
│   │       ├── NutritionChart.jsx    # 7-day calorie/protein charts
│   │       ├── MonthlyNutritionTable.jsx
│   │       ├── WorkoutTab.jsx        # Exercise search + logging
│   │       ├── WeightPrompt.jsx      # Daily weight check-in
│   │       ├── WeightHistory.jsx     # Weight trend chart
│   │       ├── AICoach.jsx           # AI comment feed + tone selector
│   │       ├── PromptGenerator.jsx   # Ready-to-paste prompt builder
│   │       ├── EmailSettings.jsx     # Email report configuration
│   │       ├── FeedbackModal.jsx     # User feedback form
│   │       └── ProtectedRoute.jsx    # Auth guard
│   └── package.json
├── server/                      # Express API server
│   ├── server.js                # Routes + middleware
│   ├── services/
│   │   ├── geminiService.js     # Gemini AI (5-model cascade)
│   │   ├── groqService.js       # Groq LLMs (3-model fallback)
│   │   ├── aiCoachService.js    # AI Coach + prompt templates
│   │   ├── fatsecretService.js  # FatSecret nutrition API
│   │   ├── workoutService.js    # Exercise search + calorie calc
│   │   ├── emailReportService.js # Scheduled email reports
│   │   └── userCleanupService.js # Inactive user cleanup
│   ├── utils/
│   │   └── nutritionCache.js    # In-memory cache (24h TTL)
│   ├── .env.example
│   └── package.json
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Getting Started

### Prerequisites

- Node.js v18+
- Firebase project — [Create one](https://console.firebase.google.com/)
- Gemini API key — [Get one](https://aistudio.google.com/app/apikey)
- Groq API key — [Get one](https://console.groq.com/keys) (free tier)
- FatSecret API credentials — [Register](https://platform.fatsecret.com/api/)

### Installation

```bash
git clone https://github.com/AyushSinha2210/Calorie_Tracker.git
cd Calorie_Tracker

# Backend
cd server
npm install
cp .env.example .env   # Fill in your API keys

# Frontend
cd ../frontend
npm install
```

### Environment Variables

Edit `server/.env` with your keys (see `.env.example` for all options):

```env
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
GROQ_COACH_API_KEY=your_key        # Optional (falls back to GROQ_API_KEY)
FATSECRET_CLIENT_ID=your_id
FATSECRET_CLIENT_SECRET=your_secret
PORT=5000
```

For Firebase Admin features (email reports, user cleanup), also set:
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
EMAIL_USER=your_email@gmail.com
EMAIL_APP_PASSWORD=your_app_password
```

### Running

```bash
# Terminal 1 — Backend
cd server && npm start       # http://localhost:5000

# Terminal 2 — Frontend
cd frontend && npm start     # http://localhost:3000
```

## API Endpoints

### Food Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze-food` | AI text-based food analysis (Groq) |
| POST | `/analyze-food-image` | Image-based food detection (Gemini) |
| POST | `/calculate-nutrition` | Batch nutrition lookup (FatSecret + Groq fallback) |
| POST | `/lookup-food` | Single food nutrition lookup |

### AI Coach
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai-coach/comment` | Get AI coach comment on food/workout entry |
| GET | `/ai-coach/templates` | List available prompt templates |
| POST | `/ai-coach/prompt` | Build a ready-to-paste prompt from template |

### Workout
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workout/search?term=...` | Search exercises |
| GET | `/workout/categories` | List exercise categories |
| GET | `/workout/exercise-info/:id` | Exercise details |
| POST | `/workout/calculate` | Calculate calories burned |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/model-status` | AI model RPD usage stats |
| POST | `/email-report/send-with-data` | Send nutrition report email |
| POST | `/admin/cleanup-inactive-users` | Manual inactive user cleanup |

## AI Model Architecture

**Gemini (Food Vision)** — 5-model cascade with automatic failover:
`gemini-2.0-flash-lite` → `gemini-2.0-flash` → `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.5-pro`

**Groq (Nutrition Analysis)** — 3-model fallback with RPD tracking:
`llama-3.1-8b-instant` → `llama-3.3-70b-versatile` → `llama-4-scout-17b`

**Groq Coach (AI Comments)** — Same model pool, separate API key to avoid quota conflicts.

## License

ISC License — see [LICENSE](LICENSE) for details.
