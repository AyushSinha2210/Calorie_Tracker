# AI Powered Indian Food and Fitness Tracker

A full-stack web application for tracking fitness goals with AI-powered Indian food recognition and nutrition analysis.

## 📁 Project Structure

```
Fitness Goal Tracker/
├── Backend/              # Node.js + Express API server
│   ├── index.js         # Server entry point
│   ├── .env             # Environment variables (not in git)
│   └── package.json     # Backend dependencies
├── frontend/            # React application
│   ├── src/            # React source code
│   ├── public/         # Static assets
│   └── package.json    # Frontend dependencies
├── .gitignore          # Git ignore rules
├── package.json        # Root scripts for running both servers
└── README.md           # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Fitness Goal Tracker"
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install Backend dependencies**
   ```bash
   cd Backend
   npm install
   ```

4. **Install Frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

5. **Setup environment variables**
   
   Create a `.env` file in the `Backend` folder:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

## 🏃 Running the Application

### Option 1: Run Both Servers Together (from root)
```bash
# Start backend server (with auto-reload)
npm start

# In another terminal, start frontend
npm run frontend
```

### Option 2: Run Individually

**Backend Server:**
```bash
cd Backend
npm start
# Server runs on http://localhost:5000
```

**Frontend:**
```bash
cd frontend
npm start
# App runs on http://localhost:3000
```

## 🔗 API Endpoints

- `GET /` - Health check endpoint
  - Response: "API is running"

(Add more endpoints as you develop them)

## 🛠️ Tech Stack

**Frontend:**
- React
- Axios (API calls)
- CSS3

**Backend:**
- Node.js
- Express.js
- CORS
- dotenv (environment variables)
- MongoDB (planned)

**Development Tools:**
- nodemon (auto-reload)

## 📝 Available Scripts

### Root Directory
- `npm start` - Start backend with nodemon
- `npm run backend` - Start backend with nodemon
- `npm run frontend` - Start React frontend

### Backend Directory
- `npm start` - Start server

### Frontend Directory
- `npm start` - Start React dev server
- `npm run build` - Build for production
- `npm test` - Run tests

## 🌟 Features (Planned)

- [ ] User authentication
- [ ] Indian food database
- [ ] AI-powered food recognition
- [ ] Calorie tracking
- [ ] Fitness goal setting
- [ ] Progress visualization
- [ ] Meal planning

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License.

