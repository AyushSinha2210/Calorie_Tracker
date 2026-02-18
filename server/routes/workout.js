import express from "express";
import { calculateCalories, getAvailableExercises } from "../services/metService.js";
import { db } from "../config/firebase.js";
import { collection, doc, addDoc } from "firebase/firestore";

const router = express.Router();

router.post("/log", async (req, res) => {
  try {
    const { userId, exercise, durationMin, weight } = req.body;
    if (!userId || !exercise || !durationMin || !weight) return res.status(400).json({ error: "Missing: userId, exercise, durationMin, weight" });
    const calories = calculateCalories(exercise, weight, durationMin);
    await addDoc(collection(doc(collection(db, "users"), userId), "workouts"), { date: new Date(), exercise, durationMin, calories, weight });
    res.json({ exercise, durationMin, weight, calories });
  } catch (e) { res.status(500).json({ error: "Failed to log workout", details: e.message }); }
});

router.get("/exercises", (req, res) => res.json(getAvailableExercises()));

export default router;
