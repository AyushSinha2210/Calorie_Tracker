# AI Powered Indian Food and Fitness Tracker

A full-stack web application for tracking fitness goals with AI-powered Indian food recognition and nutrition analysis using Google Gemini AI. Features real-time calorie and protein calculation with **image recognition, camera capture, and text input**.

## Features

- **AI Image Analysis** - Upload food photos or use camera for instant nutrition analysis
- **User Authentication** - Secure Firebase authentication (Email + Google Sign-In)
- **AI Food Analysis** - Natural language food input with Gemini AI
- **Smart Confirmation** - Review and edit AI results before saving
- **Indian Food Focus** - Specialized nutrition data for Indian cuisine
- **Nutrition Tracking** - Automatic calorie and protein calculation via FatSecret + USDA APIs
- **Smart Fallback** - Cascading AI model system for high availability
- **Workout Tracking** - MET-based calorie burn calculation for 10+ exercises
- **Responsive Design** - Works on desktop and mobile devices
- **Protected Routes** - Secure dashboard access

## Three Ways to Track Food

1. **Image Upload/Camera** - Take a photo or upload an image
   - Frontend preprocessing (resize + compress to JPEG)
   - Gemini Vision identifies food and estimates grams
   - FatSecret/USDA APIs calculate accurate calories and protein

2. **AI Text Entry** - Type what you ate
   - Example: "2 rotis and 1 bowl dal"
   - AI analyzes and returns nutrition data

3. **Manual Entry** - Direct input for full control
   - Enter food name, quantity, calories, and protein manually

## Project Structure

```
Fitness Goal Tracker/
├── server/                    # Node.js + Express API server
│   ├── server.js              # Main server entry point
│   ├── config/
│   │   └── firebase.js        # Firebase Admin config
│   ├── routes/
│   │   ├── food.js            # Food API routes
│   │   └── workout.js         # Workout API routes
│   ├── services/
│   │   ├── geminiService.js   # Gemini AI integration with model cascade
│   │   ├── fatsecretService.js # FatSecret + USDA nutrition APIs
│   │   └── metService.js      # MET-based workout calorie calculator
│   ├── utils/
│   │   └── nutritionCache.js  # In-memory nutrition cache (24h TTL)
│   ├── .env                   # Environment variables (not committed)
│   └── package.json
├── frontend/                  # React application
│   ├── src/
│   │   ├── Pages/
│   │   │   ├── Dashboard.jsx  # Main dashboard with food log summary
│   │   │   ├── Login.jsx      # Login page (Email + Google)
│   │   │   └── Register.jsx   # Registration page
│   │   ├── components/
│   │   │   ├── FoodForm.jsx   # Image/Text/Manual food entry
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Firebase auth state management
│   │   └── firebase.js        # Firebase client config
│   ├── public/
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Firebase project ([Create one here](https://console.firebase.google.com/))

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/AyushSinha2210/Calorie_Tracker.git
   cd Calorie_Tracker
   ```

2. **Install Backend dependencies**

   ```bash
   cd server
   npm install
   ```

3. **Install Frontend dependencies**

   ```bash
   cd ../frontend
   npm install
   ```

4. **Setup environment variables**

   Copy the example env file and fill in your keys:

   ```bash
   cp server/.env.example server/.env
   ```

   Required variables:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   FATSECRET_CLIENT_ID=your_fatsecret_client_id
   FATSECRET_CLIENT_SECRET=your_fatsecret_client_secret
   ```

5. **Configure Firebase**

   Update `frontend/src/firebase.js` and `server/config/firebase.js` with your Firebase project credentials.

## Running the Application

### Start Backend Server

```bash
cd server
npm start
```

Server runs on `http://localhost:5000`

### Start Frontend (in a new terminal)

```bash
cd frontend
npm start
```

App runs on `http://localhost:3000`

## API Endpoints

### Food Analysis

| Method | Endpoint               | Description                              |
| ------ | ---------------------- | ---------------------------------------- |
| POST   | `/analyze-food`        | Analyze food text with Gemini AI         |
| POST   | `/analyze-food-image`  | Analyze food image (multipart/form-data) |
| POST   | `/calculate-nutrition` | Calculate nutrition via FatSecret/USDA   |
| POST   | `/lookup-food`         | Lookup single food nutrition             |

### Workout

| Method | Endpoint                 | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| POST   | `/api/workout/log`       | Log a workout with calorie calculation   |
| GET    | `/api/workout/exercises` | List available exercises with MET values |

### Example Request

```json
POST /analyze-food
{ "text": "2 roti with dal" }
```

### Example Response

```json
{
  "items": [
    { "name": "Roti", "quantity": "2 (80g)", "calories": 248, "protein": 8 },
    {
      "name": "Dal",
      "quantity": "1 bowl (150g)",
      "calories": 165,
      "protein": 10.5
    }
  ],
  "total_calories": 413,
  "total_protein": 18.5
}
```

## Tech Stack

**Frontend:** React 19, React Router v7, Firebase Auth & Firestore

**Backend:** Node.js (ESM), Express 5, Multer, dotenv

**AI & Nutrition:** Google Gemini AI (multi-model cascade), FatSecret API, USDA FoodData Central

**AI Model Cascade:**

1. `gemini-2.5-flash` (Primary)
2. `gemini-2.0-flash` (Fallback)
3. `gemini-2.0-flash-lite` (Fallback)
4. `gemini-2.5-pro` (Fallback)
5. `gemini-3-pro` (Final Fallback)

## Supported Indian Foods

The AI recognizes common Indian food items with standardized portions:

Roti (40g), Dal (150g/bowl), Rice (200g/cup), Biryani, Curry, Paratha, Dosa, Idli, and more.

Simply describe your meal naturally: _"2 roti with dal"_ or _"1 plate chicken biryani"_

## Security

- API keys stored in `.env` (not committed to git)
- Firebase authentication for secure user access
- Protected routes prevent unauthorized access
- CORS enabled for frontend-backend communication

## License

This project is licensed under the ISC License.
