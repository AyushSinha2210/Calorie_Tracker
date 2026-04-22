import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { addDoc, collection, query, where, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { apiFetch } from "../config";

// ── Styles (Tailwind) ──
const cardCls = "card p-5 md:p-6 mb-6";
const headingCls = "text-base font-bold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2";
const inpCls = "w-full p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 outline-none transition-all text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400";
const labelCls = "block text-xs font-semibold text-surface-500 dark:text-surface-400 mb-1.5 uppercase tracking-wider";

const CATEGORY_COLORS = {
  Abs: "#e74c3c", Arms: "#3498db", Back: "#27ae60", Calves: "#e67e22",
  Cardio: "#9b59b6", Chest: "#2980b9", Legs: "#f39c12", Shoulders: "#1abc9c", Other: "#95a5a6",
};

const INPUT_TYPE_LABELS = {
  cardio: "🏃 Cardio",
  weighted: "🏋️ Weighted",
  bodyweight: "💪 Bodyweight",
  isometric: "🧘 Isometric / Hold",
};

const WorkoutTab = ({ allFoodLogs = [], maintenanceCalories = 0 }) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState(null);

  // Exercise info from wger (equipment, inputType, muscles)
  const [exerciseInfo, setExerciseInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Dynamic input fields
  const [duration, setDuration] = useState("");        // cardio: minutes
  const [distance, setDistance] = useState("");         // cardio: km (optional)
  const [sets, setSets] = useState("");                 // weighted/bodyweight: number of sets
  const [reps, setReps] = useState("");                 // weighted/bodyweight: reps per set
  const [liftedWeight, setLiftedWeight] = useState(""); // weighted: kg lifted
  const [holdSeconds, setHoldSeconds] = useState("");   // isometric: seconds
  const [userWeight, setUserWeight] = useState("");     // user body weight (kg)

  const [saving, setSaving] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [calcError, setCalcError] = useState("");
  const debounceRef = useRef(null);

  const inputType = exerciseInfo?.inputType || null;

  // Load user weight from Firestore profile
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      if (data?.weight) setUserWeight(String(data.weight));
      else if (data?.lastRecordedWeight) setUserWeight(String(data.lastRecordedWeight));
    });
    return unsub;
  }, [user]);

  // Load 60-day workout logs
  const startDate60 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "workoutLogs"),
      where("date", ">=", startDate60),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setWorkoutLogs(items);
    }, (err) => {
      console.error("Workout logs listener error:", err);
    });
  }, [user, startDate60]);

  // Debounced search
  const handleSearch = useCallback((term) => {
    setSearch(term);
    setSelected(null);
    setExerciseInfo(null);
    setCalcResult(null);
    setSearchError("");
    clearTimeout(debounceRef.current);
    if (term.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/workout/search?term=${encodeURIComponent(term)}`);
        if (res.ok) {
          setResults(await res.json());
          setSearchError("");
        } else {
          const err = await res.json().catch(() => ({}));
          setResults([]);
          setSearchError(err.error || "Workout search failed");
        }
      } catch (err) {
        setResults([]);
        setSearchError(err.message || "Could not reach workout search");
      } finally { setSearching(false); }
    }, 400);
  }, []);

  // Select exercise → fetch wger info to determine input type
  const handleSelect = async (ex) => {
    setSelected(ex);
    setSearch(ex.name);
    setResults([]);
    setCalcResult(null);
    setExerciseInfo(null);
    setSaveError("");
    setSearchError("");
    resetInputFields();

    // Fetch exercise details (equipment, muscles, inputType)
    setLoadingInfo(true);
    try {
      const res = await apiFetch(`/workout/exercise-info/${ex.id}`);
      if (res.ok) {
        const info = await res.json();
        setExerciseInfo(info);
      } else {
        // Fallback: default to bodyweight if info fetch fails
        setExerciseInfo({ inputType: "bodyweight", equipment: [], muscles: [] });
      }
    } catch {
      setExerciseInfo({ inputType: "bodyweight", equipment: [], muscles: [] });
    } finally { setLoadingInfo(false); }
  };

  const resetInputFields = () => {
    setDuration(""); setDistance(""); setSets(""); setReps("");
    setLiftedWeight(""); setHoldSeconds(""); setCalcResult(null);
  };

  // Check if enough input is provided for calculation
  const canCalculate = useMemo(() => {
    if (!selected || !exerciseInfo || !userWeight) return false;
    switch (inputType) {
      case "cardio": return !!duration;
      case "weighted": return !!sets && !!reps && !!liftedWeight;
      case "bodyweight": return !!sets && !!reps;
      case "isometric": return !!holdSeconds;
      default: return !!duration;
    }
  }, [selected, exerciseInfo, inputType, userWeight, duration, sets, reps, liftedWeight, holdSeconds]);

  // Auto-calculate when all inputs are set
  useEffect(() => {
    if (!canCalculate) { setCalcResult(null); return; }
    const abortCtrl = new AbortController();
    setCalcError("");
    const doCalc = async () => {
      try {
        const body = {
          exerciseName: selected.name,
          categoryId: exerciseInfo?.categoryId || null,
          inputType,
          weightKg: Number(userWeight),
        };
        if (inputType === "cardio") {
          body.durationMin = Number(duration);
        } else if (inputType === "weighted") {
          body.sets = Number(sets);
          body.reps = Number(reps);
          body.liftedWeight = Number(liftedWeight);
        } else if (inputType === "bodyweight") {
          body.sets = Number(sets);
          body.reps = Number(reps);
        } else if (inputType === "isometric") {
          body.holdSeconds = Number(holdSeconds);
        } else {
          body.durationMin = Number(duration);
        }
        const res = await apiFetch("/workout/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortCtrl.signal,
        });
        if (!abortCtrl.signal.aborted) {
          if (res.ok) {
            setCalcResult(await res.json());
            setCalcError("");
          } else {
            const err = await res.json().catch(() => ({}));
            setCalcError(err.error || "Calorie calculation failed");
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Calc error:", e);
          setCalcError("Could not reach server for calorie calculation");
        }
      }
    };
    doCalc();
    return () => abortCtrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCalculate, selected, exerciseInfo, inputType, userWeight, duration, sets, reps, liftedWeight, holdSeconds]);

  const handleSave = async () => {
    if (!user || !selected || !calcResult) return;
    setSaving(true);
    setSaveError("");
    try {
      const today = new Date().toISOString().split("T")[0];
      const logData = {
        exerciseName: selected.name,
        exerciseId: selected.id,
        category: selected.category || exerciseInfo?.categoryName || "Other",
        inputType: inputType || "cardio",
        caloriesBurned: calcResult.caloriesBurned,
        met: calcResult.met,
        effectiveDurationMin: calcResult.effectiveDurationMin || 0,
        weightKg: Number(userWeight),
        date: today,
        createdAt: serverTimestamp(),
      };

      // Save image URLs for display in logs
      if (selected.image) logData.image = selected.image;
      if (selected.imageThumbnail) logData.imageThumbnail = selected.imageThumbnail;

      // Add type-specific fields
      if (inputType === "cardio") {
        logData.durationMin = Number(duration);
        if (distance) logData.distanceKm = Number(distance);
      } else if (inputType === "weighted") {
        logData.sets = Number(sets);
        logData.reps = Number(reps);
        logData.liftedWeight = Number(liftedWeight);
        logData.durationMin = calcResult.effectiveDurationMin || 0;
      } else if (inputType === "bodyweight") {
        logData.sets = Number(sets);
        logData.reps = Number(reps);
        logData.durationMin = calcResult.effectiveDurationMin || 0;
      } else if (inputType === "isometric") {
        logData.holdSeconds = Number(holdSeconds);
        logData.durationMin = +(Number(holdSeconds) / 60).toFixed(1);
      } else {
        logData.durationMin = Number(duration);
      }

      await addDoc(collection(db, "users", user.uid, "workoutLogs"), logData);

      // Reset form
      setSelected(null);
      setExerciseInfo(null);
      setSearch("");
      resetInputFields();
    } catch (err) {
      console.error("Failed to save workout:", err);
      setSaveError(err.message || "Failed to save workout. Please try again.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (deleting) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "workoutLogs", id));
    } catch (err) {
      console.error("Failed to delete workout:", err);
    } finally { setDeleting(null); }
  };

  // Today's totals
  const today = new Date().toISOString().split("T")[0];
  const todayLogs = workoutLogs.filter((l) => l.date === today);
  const todayCalBurned = todayLogs.reduce((s, l) => s + (l.caloriesBurned || 0), 0);
  const todayDuration = todayLogs.reduce((s, l) => s + (l.durationMin || l.effectiveDurationMin || 0), 0);
  const todayFoodCal = allFoodLogs.filter((l) => l.date === today).reduce((s, l) => s + (l.calories || 0), 0);
  const todayDeficit = maintenanceCalories - Math.round(todayFoodCal) + todayCalBurned;

  // Group by date for history
  const logsByDate = useMemo(() => {
    const grouped = {};
    for (const log of workoutLogs) {
      if (!grouped[log.date]) grouped[log.date] = [];
      grouped[log.date].push(log);
    }
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [workoutLogs]);

  /** Render a human-readable detail string for a workout log */
  const formatLogDetail = (log) => {
    const t = log.inputType;
    if (t === "cardio") {
      const parts = [`${log.durationMin || 0}m`];
      if (log.distanceKm) parts.push(`${log.distanceKm} km`);
      return parts.join(" · ");
    }
    if (t === "weighted") return `${log.sets}×${log.reps} @ ${log.liftedWeight}kg`;
    if (t === "bodyweight") return `${log.sets}×${log.reps}`;
    if (t === "isometric") return `${log.holdSeconds}s hold`;
    // Legacy logs (no inputType) — fallback to duration
    return `${log.durationMin || 0}m`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* ── Search & Log Workout ── */}
      <div className={cardCls}>
        <h3 className={headingCls}>
          <span className="text-2xl">🏋️</span> Log Workout
        </h3>

        <div className="relative">
          <label htmlFor="workout-search" className={labelCls}>Search Exercise</label>
          <input
            type="text"
            id="workout-search"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Type to search (e.g. push up, squat, running...)"
            className={inpCls}
          />
          {searching && (
            <div style={{ position: "absolute", right: 12, top: 30, color: "var(--text-muted)", fontSize: 12 }}>Searching...</div>
          )}

          {searchError && (
            <div style={{ marginTop: 8, color: "#dc2626", fontSize: 13 }}>
              {searchError}
            </div>
          )}

          {/* Dropdown results */}
          {results.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8,
              maxHeight: 280, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}>
              {results.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => handleSelect(ex)}
                  style={{
                    padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    borderBottom: "1px solid var(--border)", transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                >
                  {ex.imageThumbnail && (
                    <img src={ex.imageThumbnail} alt="" style={{ width: 30, height: 30, borderRadius: 4, objectFit: "cover" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                    <span style={{
                      fontSize: 11, padding: "1px 8px", borderRadius: 10, fontWeight: 600,
                      background: CATEGORY_COLORS[ex.category] ? `${CATEGORY_COLORS[ex.category]}20` : "#f0f0f0",
                      color: CATEGORY_COLORS[ex.category] || "#888",
                    }}>
                      {ex.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected exercise + input type badge */}
        {selected && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-card-alt)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            {selected.image && (
              <img src={selected.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                <span style={{
                  fontSize: 11, padding: "1px 8px", borderRadius: 10, fontWeight: 600,
                  background: CATEGORY_COLORS[selected.category] ? `${CATEGORY_COLORS[selected.category]}20` : "#f0f0f0",
                  color: CATEGORY_COLORS[selected.category] || "#888",
                }}>
                  {selected.category}
                </span>
                {inputType && (
                  <span style={{
                    fontSize: 11, padding: "1px 8px", borderRadius: 10, fontWeight: 600,
                    background: "var(--brand-light)", color: "var(--brand)",
                  }}>
                    {INPUT_TYPE_LABELS[inputType] || inputType}
                  </span>
                )}
                {exerciseInfo?.muscles?.length > 0 && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {exerciseInfo.muscles.map(m => m.name).join(", ")}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => { setSelected(null); setExerciseInfo(null); setSearch(""); resetInputFields(); }}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)" }}>✕</button>
          </div>
        )}

        {/* Loading exercise info */}
        {loadingInfo && (
          <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>
            Loading exercise details...
          </div>
        )}

        {/* ── Dynamic Input Fields ── */}
        {selected && exerciseInfo && !loadingInfo && (
          <div className="mt-4">
            {/* ── Cardio inputs: Duration + Distance ── */}
            {inputType === "cardio" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>Duration (min) *</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 30" min="1" max="600" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Distance (km)</label>
                  <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)}
                    placeholder="optional" min="0" max="200" step="0.1" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Your Weight (kg) *</label>
                  <input type="number" value={userWeight} onChange={(e) => setUserWeight(e.target.value)}
                    placeholder="e.g. 70" min="20" max="700" step="0.1" className={inpCls} />
                </div>
              </div>
            )}

            {/* ── Weighted inputs: Sets + Reps + Weight Lifted ── */}
            {inputType === "weighted" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>Sets *</label>
                  <input type="number" value={sets} onChange={(e) => setSets(e.target.value)}
                    placeholder="e.g. 3" min="1" max="50" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Reps / Set *</label>
                  <input type="number" value={reps} onChange={(e) => setReps(e.target.value)}
                    placeholder="e.g. 12" min="1" max="200" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Weight Lifted (kg) *</label>
                  <input type="number" value={liftedWeight} onChange={(e) => setLiftedWeight(e.target.value)}
                    placeholder="e.g. 40" min="0" max="1000" step="0.5" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Body Weight (kg) *</label>
                  <input type="number" value={userWeight} onChange={(e) => setUserWeight(e.target.value)}
                    placeholder="e.g. 70" min="20" max="700" step="0.1" className={inpCls} />
                </div>
              </div>
            )}

            {/* ── Bodyweight inputs: Sets + Reps ── */}
            {inputType === "bodyweight" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>Sets *</label>
                  <input type="number" value={sets} onChange={(e) => setSets(e.target.value)}
                    placeholder="e.g. 3" min="1" max="50" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Reps / Set *</label>
                  <input type="number" value={reps} onChange={(e) => setReps(e.target.value)}
                    placeholder="e.g. 15" min="1" max="200" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Your Weight (kg) *</label>
                  <input type="number" value={userWeight} onChange={(e) => setUserWeight(e.target.value)}
                    placeholder="e.g. 70" min="20" max="700" step="0.1" className={inpCls} />
                </div>
              </div>
            )}

            {/* ── Isometric inputs: Hold Duration ── */}
            {inputType === "isometric" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className={labelCls}>Hold Duration (seconds) *</label>
                  <input type="number" value={holdSeconds} onChange={(e) => setHoldSeconds(e.target.value)}
                    placeholder="e.g. 60" min="1" max="3600" className={inpCls} />
                </div>
                <div>
                  <label className={labelCls}>Your Weight (kg) *</label>
                  <input type="number" value={userWeight} onChange={(e) => setUserWeight(e.target.value)}
                    placeholder="e.g. 70" min="20" max="700" step="0.1" className={inpCls} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calorie result */}
        {calcResult && (
          <div style={{
            marginTop: 14, padding: 16, background: "var(--bg-card-alt)",
            borderRadius: 10, border: "1px solid var(--border)", textAlign: "center",
          }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Estimated Calories Burned</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#e74c3c" }}>
              🔥 {calcResult.caloriesBurned} kcal
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              MET: {calcResult.met}
              {inputType === "cardio" && <> · {duration} min{distance ? ` · ${distance} km` : ""}</>}
              {inputType === "weighted" && <> · {sets}×{reps} @ {liftedWeight}kg</>}
              {inputType === "bodyweight" && <> · {sets}×{reps}</>}
              {inputType === "isometric" && <> · {holdSeconds}s hold</>}
              {" · "}{userWeight} kg
              {calcResult.effectiveDurationMin > 0 && <> · ~{calcResult.effectiveDurationMin}m</>}
            </div>
          </div>
        )}

        {/* Calculation error */}
        {calcError && !calcResult && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
            ⚠️ {calcError}
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
            ⚠️ {saveError}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!selected || !calcResult || saving}
          className={`w-full mt-4 py-3 rounded-lg font-semibold transition-all ${!selected || !calcResult || saving ? 'bg-surface-200 dark:bg-surface-700 text-surface-400 dark:text-surface-500 cursor-not-allowed' : 'bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-200'}`}
        >
          {saving ? "Saving..." : "Save Workout"}
        </button>
      </div>

      {/* ── Today's Summary ── */}
      <div className={cardCls}>
        <h3 className={headingCls}>
          <span className="text-2xl">📊</span> Today's Summary
        </h3>
        <div className="summary-grid">
          <div style={{ textAlign: "center", padding: 12, background: "#fef3f3", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Calories Burned</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#e74c3c" }}>🔥 {todayCalBurned}</div>
          </div>
          <div style={{ textAlign: "center", padding: 12, background: "var(--brand-light)", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Workouts</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brand)" }}>{todayLogs.length}</div>
          </div>
          <div style={{ textAlign: "center", padding: 12, background: "#eafaf1", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Duration</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#27ae60" }}>{Math.round(todayDuration)}m</div>
          </div>
          <div style={{ textAlign: "center", padding: 12, background: todayDeficit >= 0 ? "#e8f5e9" : "#fce4ec", borderRadius: 8, border: `2px solid ${todayDeficit >= 0 ? "#4caf50" : "#e74c3c"}30` }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Deficit</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: todayDeficit >= 0 ? "#2e7d32" : "#c62828" }}>
              {todayDeficit >= 0 ? "↓" : "↑"} {Math.abs(todayDeficit)}
            </div>
          </div>
        </div>

        {todayLogs.length > 0 && (
          <div className="nutrition-table-wrap" style={{ marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 450 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Exercise</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Detail</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}>Calories</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontWeight: 600 }}></th>
                </tr>
              </thead>
              <tbody>
                {todayLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {log.imageThumbnail ? (
                          <img src={log.imageThumbnail} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: CATEGORY_COLORS[log.category] ? `${CATEGORY_COLORS[log.category]}15` : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏋️</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{log.exerciseName}</div>
                          <span style={{
                            fontSize: 11, padding: "1px 6px", borderRadius: 8,
                            background: CATEGORY_COLORS[log.category] ? `${CATEGORY_COLORS[log.category]}15` : "#f0f0f0",
                            color: CATEGORY_COLORS[log.category] || "#888",
                          }}>{log.category}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>{formatLogDetail(log)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#e74c3c" }}>{log.caloriesBurned}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => handleDelete(log.id)}
                        disabled={deleting === log.id}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-muted)" }}
                        title="Delete"
                      >{deleting === log.id ? "…" : "🗑️"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 60-day Workout History ── */}
      <div className={cardCls}>
        <h3 className={headingCls}>
          <span className="text-2xl">📅</span> Workout History (60 Days)
        </h3>
        {logsByDate.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No workouts logged yet. Start by searching for an exercise above!</p>
        ) : (
          <div>
            {logsByDate.map(([date, logs]) => {
              const totalCal = logs.reduce((s, l) => s + (l.caloriesBurned || 0), 0);
              const totalMin = logs.reduce((s, l) => s + (l.durationMin || l.effectiveDurationMin || 0), 0);
              return (
                <div key={date} style={{ marginBottom: 16 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "2px solid var(--border)",
                  }}>
                    <div style={{ fontWeight: 700, color: "var(--text)" }}>{date}</div>
                    <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
                      <span style={{ color: "#e74c3c", fontWeight: 600 }}>🔥 {totalCal} kcal</span>
                      <span style={{ color: "var(--brand)", fontWeight: 600 }}>⏱ {Math.round(totalMin)}m</span>
                      <span style={{ color: "var(--text-muted)" }}>{logs.length} exercise{logs.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "6px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              {log.imageThumbnail ? (
                                <img src={log.imageThumbnail} alt="" style={{ width: 26, height: 26, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 26, height: 26, borderRadius: 5, background: CATEGORY_COLORS[log.category] ? `${CATEGORY_COLORS[log.category]}15` : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🏋️</div>
                              )}
                              <span style={{ fontWeight: 600 }}>{log.exerciseName}</span>
                              <span style={{
                                fontSize: 10, marginLeft: 2, padding: "1px 6px", borderRadius: 8,
                                background: CATEGORY_COLORS[log.category] ? `${CATEGORY_COLORS[log.category]}15` : "#f0f0f0",
                                color: CATEGORY_COLORS[log.category] || "#888",
                              }}>{log.category}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", padding: "6px 8px", color: "var(--text-muted)", fontSize: 12 }}>{formatLogDetail(log)}</td>
                          <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, color: "#e74c3c" }}>{log.caloriesBurned} kcal</td>
                          <td style={{ textAlign: "center", width: 30 }}>
                            <button
                              onClick={() => handleDelete(log.id)}
                              disabled={deleting === log.id}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-muted)" }}
                            >{deleting === log.id ? "…" : "🗑️"}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WorkoutTab;
