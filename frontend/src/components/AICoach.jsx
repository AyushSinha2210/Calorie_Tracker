import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import API_URL from "../config";

const TONES = [
  { key: "strict", label: "🔥 Strict Coach", description: "Tough love, no sugarcoating" },
  { key: "friendly", label: "😊 Friendly Trainer", description: "Supportive and encouraging" },
  { key: "sarcastic", label: "😏 Sarcastic Buddy", description: "Funny roasts with love" },
  { key: "motivational", label: "💪 Motivational", description: "Epic and inspiring" },
];

const AICoach = ({ allFoodLogs, allWorkoutLogs, maintenanceCalories }) => {
  const { user, userProfile } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [tone, setTone] = useState("friendly");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const prevLogCountRef = useRef({ food: 0, workout: 0 });

  // Load coach preferences from profile
  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.coachEnabled !== undefined) setEnabled(userProfile.coachEnabled);
    if (userProfile.coachTone) setTone(userProfile.coachTone);
  }, [userProfile]);

  // Save coach preferences
  const savePreferences = useCallback(async (newEnabled, newTone) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        coachEnabled: newEnabled,
        coachTone: newTone,
      }, { merge: true });
    } catch { }
  }, [user]);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    savePreferences(next, tone);
    if (!next) setComments([]);
  };

  const changeTone = (newTone) => {
    setTone(newTone);
    savePreferences(enabled, newTone);
  };

  // Compute today's stats
  const today = new Date().toISOString().split("T")[0];
  const todayFood = (allFoodLogs || []).filter(l => l.date === today);
  const todayWorkout = (allWorkoutLogs || []).filter(l => l.date === today);
  const totalCalories = todayFood.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProtein = todayFood.reduce((s, l) => s + (l.protein || 0), 0);
  const caloriesBurned = todayWorkout.reduce((s, l) => s + (l.caloriesBurned || 0), 0);

  // Auto-fetch comment when a new log is added
  useEffect(() => {
    if (!enabled) return;

    const foodCount = todayFood.length;
    const workoutCount = todayWorkout.length;
    const prev = prevLogCountRef.current;

    let newEntry = null;
    let activityType = null;

    if (foodCount > prev.food && foodCount > 0) {
      // New food log detected
      const newest = [...todayFood].sort((a, b) => {
        const ta = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const tb = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return tb - ta;
      })[0];
      newEntry = { name: newest.item || newest.name, calories: newest.calories, protein: newest.protein, mealType: newest.mealType, quantity: newest.quantity };
      activityType = "food";
    } else if (workoutCount > prev.workout && workoutCount > 0) {
      const newest = [...todayWorkout].sort((a, b) => {
        const ta = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const tb = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return tb - ta;
      })[0];
      newEntry = { exerciseName: newest.exerciseName || newest.name, caloriesBurned: newest.caloriesBurned, durationMin: newest.durationMin, sets: newest.sets, reps: newest.reps };
      activityType = "workout";
    }

    prevLogCountRef.current = { food: foodCount, workout: workoutCount };

    if (newEntry && activityType) {
      fetchComment(activityType, newEntry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayFood.length, todayWorkout.length, enabled]);

  // Initialize prev count on mount
  useEffect(() => {
    prevLogCountRef.current = { food: todayFood.length, workout: todayWorkout.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchComment = async (activityType, entry) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai-coach/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          activityType,
          entry,
          dayStats: {
            totalCalories: Math.round(totalCalories),
            totalProtein: Math.round(totalProtein),
            calorieTarget: userProfile?.dailyCalorieTarget || 0,
            caloriesBurned,
            maintenanceCalories: maintenanceCalories || 0,
          },
          userProfile: userProfile ? {
            name: userProfile.name,
            weight: userProfile.weight,
            height: userProfile.height,
            age: userProfile.age,
            gender: userProfile.gender,
          } : null,
        }),
      });
      const data = await res.json();
      if (data.comment) {
        const newComment = {
          id: Date.now(),
          text: data.comment,
          type: activityType,
          entry: activityType === "food" ? entry.name : entry.exerciseName,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setComments(prev => [newComment, ...prev].slice(0, 10));
      }
    } catch {
      // Silently fail — coach is optional
    } finally {
      setLoading(false);
    }
  };

  // Manual "Get a comment" for current day stats
  const requestSummaryComment = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai-coach/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          activityType: "food",
          entry: {
            name: `Today's total (${todayFood.length} items)`,
            calories: Math.round(totalCalories),
            protein: Math.round(totalProtein),
          },
          dayStats: {
            totalCalories: Math.round(totalCalories),
            totalProtein: Math.round(totalProtein),
            calorieTarget: userProfile?.dailyCalorieTarget || 0,
            caloriesBurned,
            maintenanceCalories: maintenanceCalories || 0,
          },
          userProfile: userProfile ? {
            name: userProfile.name,
            weight: userProfile.weight,
            height: userProfile.height,
            age: userProfile.age,
            gender: userProfile.gender,
          } : null,
        }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments(prev => [{
          id: Date.now(),
          text: data.comment,
          type: "summary",
          entry: "Day summary",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }, ...prev].slice(0, 10));
      }
    } catch { } finally { setLoading(false); }
  };

  const dismissComment = (id) => setComments(prev => prev.filter(c => c.id !== id));

  return (
    <div className="card p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h3 className="text-lg font-bold text-surface-800 dark:text-surface-100 m-0">AI Coach</h3>
          {loading && <span className="inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(s => !s)}
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 text-sm transition-colors"
            title="Coach settings"
          >
            ⚙️
          </button>
          <label className="relative inline-flex items-center cursor-pointer" aria-label="Toggle AI Coach">
            <input type="checkbox" checked={enabled} onChange={toggleEnabled} className="sr-only peer" />
            <div className="w-11 h-6 bg-surface-200 dark:bg-surface-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 dark:after:border-surface-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500" />
          </label>
        </div>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
              <div className="text-sm font-semibold text-surface-600 dark:text-surface-300 mb-2">Coach Tone</div>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => changeTone(t.key)}
                    className={`text-left p-2.5 rounded-lg text-sm transition-all border ${tone === t.key
                      ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 font-semibold"
                      : "bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-500"
                      }`}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!enabled ? (
        <p className="text-sm text-surface-400 m-0">
          Enable AI Coach to get personalized comments on your meals and workouts
        </p>
      ) : (
        <>
          {/* Action buttons */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={requestSummaryComment}
              disabled={loading}
              className="px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 rounded-lg text-sm font-medium hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors disabled:opacity-50"
            >
              {loading ? "Thinking..." : "💬 Get Day Summary"}
            </button>
          </div>

          {/* Comments feed */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <AnimatePresence>
              {comments.map(c => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`p-3 rounded-xl text-sm border ${c.type === "food"
                    ? "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30"
                    : c.type === "workout"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30"
                      : "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
                          {c.type === "food" ? "🍔" : c.type === "workout" ? "🏋️" : "📊"} {c.entry}
                        </span>
                        <span className="text-xs text-surface-400">{c.time}</span>
                      </div>
                      <p className="m-0 text-surface-700 dark:text-surface-200 leading-relaxed">{c.text}</p>
                    </div>
                    <button
                      onClick={() => dismissComment(c.id)}
                      className="text-surface-300 dark:text-surface-500 hover:text-surface-500 dark:hover:text-surface-300 text-lg leading-none flex-shrink-0 mt-0.5"
                    >
                      ×
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {comments.length === 0 && (
              <p className="text-sm text-surface-400 text-center py-4 m-0">
                Log a meal or workout to get Coach's take, or tap "Get Day Summary"
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AICoach;
