# AI Powered Indian Food and Fitness Tracker

A full-stack web application for tracking fitness goals with AI-powered Indian food recognition and nutrition analysis using Google Gemini AI. Features real-time calorie and protein calculation for Indian food items with intelligent model fallback system.

## ✨ Features

- 🔐 **User Authentication** - Secure Firebase authentication (Login/Register)
- 🍛 **AI Food Analysis** - Natural language food input with Gemini AI
- 🇮🇳 **Indian Food Focus** - Specialized nutrition data for Indian cuisine
- 📊 **Nutrition Tracking** - Automatic calorie and protein calculation
- 🔄 **Smart Fallback** - Cascading AI model system for high availability
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎯 **Protected Routes** - Secure dashboard access

## 📁 Project Structure

```
Fitness Goal Tracker/
├── server/              # Node.js + Express API server with Gemini AI
│   ├── index.js         # Server with AI integration & fallback system
│   ├── .env             # Environment variables (API keys)
│   └── package.json     # Backend dependencies
├── frontend/            # React application
│   ├── src/
│   │   ├── Pages/       # Login, Register, Dashboard
│   │   ├── components/  # FoodForm, ProtectedRoute
│   │   ├── context/     # AuthContext
│   │   └── firebase.js  # Firebase configuration
│   ├── public/          # Static assets
│   └── package.json     # Frontend dependencies
└── README.md            # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- Firebase project ([Create one here](https://console.firebase.google.com/))

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd "Fitness Goal Tracker"
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

   Create a `.env` file in the `server` folder:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. **Configure Firebase**

   Update `frontend/src/firebase.js` with your Firebase project credentials:

   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-auth-domain",
     projectId: "your-project-id",
     // ... other config
   };
   ```

## 🏃 Running the Application

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

## 🔗 API Endpoints

### POST `/analyze-food`

Analyzes food text and returns nutritional information.

**Request:**

```json
{
  "text": "2 roti with dal"
}
```

**Response:**

```json
{
  "items": [
    {
      "name": "Roti",
      "quantity": "2",
      "calories": 280,
      "protein": 10
    },
    {
      "name": "Dal",
      "quantity": "1 bowl",
      "calories": 165,
      "protein": 10.5
    }
  ],
  "total_calories": 445,
  "total_protein": 20.5
}
```

**Fallback Response** (when all AI models fail):

```json
{
  "items": [],
  "total_calories": 0,
  "total_protein": 0,
  "note": "Service temporarily unavailable"
}
```

## 🛠️ Tech Stack

**Frontend:**

- React 18
- React Router v6
- Firebase Authentication
- Axios (API calls)

**Backend:**

- Node.js
- Express.js
- Google Gemini AI (2.5 Flash, 3 Flash Preview, 2.5 Pro)
- CORS
- dotenv

**Development Tools:**

- nodemon (auto-reload)

## 🤖 AI Model Cascade

The system uses intelligent fallback across multiple Gemini models:

1. **gemini-2.5-flash** (Primary - Fast & Reliable)
2. **gemini-3-flash-preview** (Backup - Latest Features)
3. **gemini-2.5-pro** (Backup - Enhanced Accuracy)
4. **gemini-2.0-flash** (Backup - Legacy Support)
5. **gemini-exp-1206** (Final Backup - Experimental)

If all models fail, returns a graceful fallback response.

## 📝 Available Scripts

### Backend (`/server`)

```bash
npm start      # Start server with nodemon (auto-reload)
```

### Frontend (`/frontend`)

```bash
npm start      # Start React dev server
npm run build  # Build for production
npm test       # Run tests
```

## 🍛 Supported Indian Foods

The AI is trained to recognize common Indian food items with standardized portions:

- Roti (40g)
- Dal (150g per bowl)
- Rice (200g per cup)
- Biryani, Curry, Paratha, Dosa, Idli, and more

Simply describe your meal naturally: "2 roti with dal" or "1 plate chicken biryani"

## 🔒 Security

- API keys stored in `.env` (not committed to git)
- Firebase authentication for secure user access
- Protected routes prevent unauthorized access
- CORS enabled for frontend-backend communication

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Google Gemini AI for food recognition
- Firebase for authentication services
- Indian nutrition databases for reference values
