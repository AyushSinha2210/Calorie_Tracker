# AI Food Analysis Feature - Setup Guide

## Overview

This food tracking application now supports **three methods** for logging food:

1. **📸 Image Upload/Camera** - Take a photo or upload an image of your food
2. **✍️ AI Text Analysis** - Type what you ate (e.g., "2 rotis and 1 bowl dal")
3. **📝 Manual Entry** - Manually enter food details

### Flow Architecture

```
User (Upload OR Camera)
        ↓
Frontend preprocessing (resize + compress)
        ↓
Backend validation
        ↓
Gemini Vision (food + grams)
        ↓
Groq (calories + protein)
        ↓
Return final JSON
        ↓
User Confirmation (edit if needed)
        ↓
Save to Database
```

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies

```bash
cd server
npm install
```

Required packages:

- `@google/generative-ai` - Gemini Vision API
- `groq-sdk` - Groq API for nutrition calculations
- `multer` - Handle image uploads
- `express`, `cors`, `dotenv` - Server basics

#### Configure Environment Variables

Create a `.env` file in the `server/` directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

**Get API Keys:**

- Gemini API: https://makersuite.google.com/app/apikey
- Groq API: https://console.groq.com/

#### Start the Server

```bash
cd server
npm start
```

Server runs on `http://localhost:5000`

### 2. Frontend Setup

The frontend is already configured! Just ensure your React app is running:

```bash
cd frontend
npm start
```

## Features Breakdown

### 🖼️ Image Analysis

**How it works:**

1. User uploads image or takes photo with camera
2. Frontend resizes to max 1024px and compresses to 70% quality
3. Backend validates the image (max 10MB)
4. **Gemini Vision** analyzes the image to identify:
   - Food items visible
   - Estimated weight in grams for each item
5. **Groq LLM** calculates for each item:
   - Calories
   - Protein content
6. Results shown in confirmation UI

**Image Preprocessing:**

- Max dimension: 1024px (maintains aspect ratio)
- Compression: 70% JPEG quality
- Typical size reduction: ~80%

### ✍️ Text Analysis

**How it works:**

1. User types food description (e.g., "2 eggs and 1 banana")
2. **Gemini LLM** analyzes the text and returns:
   - Food items
   - Quantities
   - Calories
   - Protein
3. Results shown in confirmation UI

### ✅ Confirmation Flow

**Before saving to database:**

- User can review all detected items
- Edit any field (name, quantity, calories, protein)
- Remove unwanted items
- See updated totals in real-time
- Confirm to save OR cancel

### 📝 Manual Entry

**Direct input:**

- Food name
- Quantity
- Calories (optional)
- Protein (optional)
- Saves immediately (no AI analysis needed)

## API Endpoints

### POST `/analyze-food`

Text-based food analysis

**Request:**

```json
{
  "text": "2 rotis and 1 bowl dal"
}
```

**Response:**

```json
{
  "items": [
    {
      "name": "Roti",
      "quantity": "80g",
      "calories": 160,
      "protein": 6
    },
    {
      "name": "Dal",
      "quantity": "150g",
      "calories": 180,
      "protein": 12
    }
  ],
  "total_calories": 340,
  "total_protein": 18
}
```

### POST `/analyze-food-image`

Image-based food analysis

**Request:**

- Content-Type: `multipart/form-data`
- Field: `image` (file)

**Response:** Same format as text analysis

## Technical Details

### Frontend Implementation

**Key Functions:**

- `preprocessImage()` - Resizes and compresses images
- `handleImageSelect()` - Handles file/camera input
- `analyzeImage()` - Sends image to backend
- `updateConfirmationItem()` - Edits items before saving
- `saveAiResults()` - Saves confirmed items to Firestore

### Backend Implementation

**Image Analysis Endpoint:**

1. Multer validates and stores image in memory
2. Gemini Vision model: `gemini-2.0-flash-exp`
3. Groq model: `llama-3.3-70b-versatile`
4. Returns combined JSON with nutrition data

**Error Handling:**

- Image validation (type, size)
- AI model fallbacks
- Detailed error messages

## Database Schema

Food logs saved to Firestore:

```
users/{userId}/foodLogs/{logId}
  - itemName: string
  - quantity: string
  - calories: number
  - protein: number
  - date: string (YYYY-MM-DD)
  - createdAt: timestamp
```

## Mobile Support

**Camera Access:**

- Uses `capture="environment"` for rear camera on mobile
- Falls back to file picker if camera unavailable
- Works on iOS Safari, Android Chrome

## Troubleshooting

### Images not analyzing

- Check that server is running on port 5000
- Verify GEMINI_API_KEY and GROQ_API_KEY in .env
- Check browser console for errors
- Ensure image is < 10MB

### API Key Issues

- Gemini: Check quota at https://makersuite.google.com/
- Groq: Check limits at https://console.groq.com/

### Camera not working

- Grant camera permissions in browser
- Use HTTPS (required for camera API)
- Use "Choose Image" as alternative

## Future Enhancements

Potential improvements:

- Batch image upload
- Meal templates
- Nutrition goals tracking
- Weekly/monthly analytics
- Export data to CSV
- Barcode scanning
- Voice input

## Credits

**APIs Used:**

- Google Gemini Vision - Food identification
- Groq LLM - Nutrition calculation
- Firebase Firestore - Data storage

---

**Need Help?**
Check the console logs (browser & server) for detailed error messages.
