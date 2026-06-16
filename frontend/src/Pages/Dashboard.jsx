import { useEffect, useState, useMemo } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FoodForm from "../components/FoodForm";
import FoodLogEditor from "../components/FoodLogEditor";
import NutritionChart from "../components/NutritionChart";
import MonthlyNutritionTable from "../components/MonthlyNutritionTable";
// WeightPrompt removed — manual weight entry is in Weight tab
import WeightHistory from "../components/WeightHistory";
import WorkoutTab from "../components/WorkoutTab";
import EmailSettings from "../components/EmailSettings";
import FeedbackModal from "../components/FeedbackModal";
import AICoach from "../components/AICoach";
import PromptGenerator from "../components/PromptGenerator";
import BrandLogo from "../components/BrandLogo";
import { collection, query, where, onSnapshot, getDocs, deleteDoc, doc, orderBy } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

// Calculate maintenance calories using Mifflin-St Jeor equation
function calcMaintenanceCalories(profile) {
  if (!profile?.weight || !profile?.height || !profile?.age) return 0;
  const w = Number(profile.weight); // kg
  const h = Number(profile.height); // cm
  const a = Number(profile.age);
  const genderOffset = profile.gender === "female" ? -161 : 5;
  const bmr = 10 * w + 6.25 * h - 5 * a + genderOffset;
  return Math.round(bmr * 1.55); // moderate activity multiplier
}

const TABS = [
  { key: "nutrition", label: "Nutrition", icon: "🍎" },
  { key: "workout", label: "Workout", icon: "🏋️" },
  { key: "weight", label: "Weight", icon: "⚖️" },
  { key: "coach", label: "AI Coach", icon: "🤖" },
  { key: "reports", label: "Reports", icon: "📧" },
];

const Dashboard = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [allFoodLogs, setAllFoodLogs] = useState([]);
  const [allWorkoutLogs, setAllWorkoutLogs] = useState([]);
  const [chartKey, setChartKey] = useState(0);
  const [activeTab, setActiveTab] = useState("nutrition");
  const [cleanedUp, setCleanedUp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const maintenanceCalories = useMemo(() => calcMaintenanceCalories(userProfile), [userProfile]);

  const handleLogout = async () => { try { await signOut(auth); navigate("/login"); } catch { } };

  const refreshCharts = () => setChartKey((k) => k + 1);

  // Single 60-day food logs listener (feeds Dashboard totals, MonthlyNutritionTable, NutritionChart)
  const startDate60 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "foodLogs"),
      where("date", ">=", startDate60)
    );
    return onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setAllFoodLogs(items);
    });
  }, [user, startDate60]);

  // 60-day workout logs listener
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
      setAllWorkoutLogs(items);
    });
  }, [user, startDate60]);

  // One-time cleanup of old records (>45 days) — once per session
  useEffect(() => {
    if (!user || cleanedUp) return;
    const RETENTION_DAYS = 45;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    getDocs(query(
      collection(db, "users", user.uid, "foodLogs"),
      where("date", "<", cutoffStr)
    )).then((snap) => {
      if (!snap.empty) {
        Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "users", user.uid, "foodLogs", d.id))))
          .then(() => console.log(`[CLEANUP] Deleted ${snap.size} old food log(s)`))
          .catch(() => { });
      }
    }).catch(() => { });
    setCleanedUp(true);
  }, [user, cleanedUp]);

  // Derive today's totals from the shared data
  const today = new Date().toISOString().split("T")[0];
  const totalCalories = allFoodLogs.filter((l) => l.date === today).reduce((s, l) => s + (l.calories || 0), 0);
  const totalProtein = allFoodLogs.filter((l) => l.date === today).reduce((s, l) => s + (l.protein || 0), 0);
  const todayCalBurned = allWorkoutLogs.filter((l) => l.date === today).reduce((s, l) => s + (l.caloriesBurned || 0), 0);
  const todayDeficit = maintenanceCalories - Math.round(totalCalories) + todayCalBurned;

  /* ---- Animated floating UI background pieces ---- */
  const bgElements = useMemo(() => [
    // Mini stat cards
    { type: "card", x: "4%", y: "10%", w: 120, h: 72, delay: 0, dur: 18, label: "1,847", sub: "kcal" },
    { type: "card", x: "80%", y: "6%", w: 110, h: 66, delay: 2, dur: 20, label: "124g", sub: "protein" },
    { type: "card", x: "85%", y: "52%", w: 115, h: 68, delay: 5, dur: 19, label: "420", sub: "burned" },
    { type: "card", x: "2%", y: "65%", w: 108, h: 64, delay: 3, dur: 21, label: "573", sub: "deficit" },
    { type: "card", x: "45%", y: "88%", w: 105, h: 62, delay: 7, dur: 22, label: "2,100", sub: "target" },
    // Chart bars
    { type: "bars", x: "70%", y: "72%", delay: 1, dur: 16 },
    { type: "bars", x: "12%", y: "40%", delay: 6, dur: 18 },
    { type: "bars", x: "50%", y: "20%", delay: 4, dur: 17 },
    // Progress rings
    { type: "ring", x: "58%", y: "8%", delay: 2, dur: 20, pct: 72 },
    { type: "ring", x: "30%", y: "78%", delay: 0, dur: 18, pct: 58 },
    { type: "ring", x: "88%", y: "35%", delay: 5, dur: 22, pct: 85 },
    // Pill badges
    { type: "pill", x: "38%", y: "4%", delay: 3, dur: 15, text: "AI Parsed" },
    { type: "pill", x: "20%", y: "88%", delay: 6, dur: 16, text: "Logged" },
    { type: "pill", x: "75%", y: "42%", delay: 1, dur: 17, text: "+320 kcal" },
    { type: "pill", x: "8%", y: "52%", delay: 8, dur: 14, text: "On Track" },
    // Dots / circles
    { type: "dot", x: "18%", y: "22%", size: 12, delay: 0, dur: 12 },
    { type: "dot", x: "62%", y: "58%", size: 10, delay: 3, dur: 14 },
    { type: "dot", x: "92%", y: "25%", size: 14, delay: 1, dur: 11 },
    { type: "dot", x: "42%", y: "48%", size: 10, delay: 5, dur: 13 },
    { type: "dot", x: "75%", y: "18%", size: 8, delay: 7, dur: 15 },
    { type: "dot", x: "28%", y: "60%", size: 11, delay: 2, dur: 10 },
  ], []);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 relative overflow-hidden">

      {/* ====== Animated floating UI background ====== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Base ambient gradient */}
        <div className="absolute top-0 inset-x-0 h-72 bg-gradient-to-b from-brand-50/40 via-transparent to-transparent dark:from-brand-950/20" />
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-brand-50/20 via-transparent to-transparent dark:from-brand-950/10" />

        {bgElements.map((el, i) => {
          const common = {
            position: "absolute",
            left: el.x,
            top: el.y,
          };

          if (el.type === "card") {
            return (
              <motion.div
                key={i}
                style={{ ...common, width: el.w, height: el.h }}
                initial={{ opacity: 0, y: 30, rotate: -3 }}
                animate={{
                  opacity: [0, 0.18, 0.18, 0],
                  y: [30, -24, -24, 30],
                  rotate: [-3, 2, -1, -3],
                }}
                transition={{ delay: el.delay, duration: el.dur, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-xl border border-surface-300/80 dark:border-surface-600/50 bg-white/80 dark:bg-surface-800/60 backdrop-blur-sm shadow-md flex flex-col items-center justify-center"
              >
                <span className="text-lg font-bold text-surface-800 dark:text-surface-200/80 tracking-tight">{el.label}</span>
                <span className="text-[9px] text-surface-500 dark:text-surface-400/70 uppercase tracking-widest mt-0.5">{el.sub}</span>
              </motion.div>
            );
          }

          if (el.type === "bars") {
            const barHeights = [60, 85, 45, 70, 90, 55, 75];
            return (
              <motion.div
                key={i}
                style={common}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.22, 0.22, 0] }}
                transition={{ delay: el.delay, duration: el.dur, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-end gap-1.5"
              >
                {barHeights.map((h, j) => (
                  <motion.div
                    key={j}
                    className="w-3.5 rounded-t bg-brand-500/70 dark:bg-brand-400/60"
                    initial={{ height: 0 }}
                    animate={{ height: [0, h * 0.6, h * 0.6, 0] }}
                    transition={{ delay: el.delay + j * 0.12, duration: el.dur, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
              </motion.div>
            );
          }

          if (el.type === "ring") {
            const r = 20;
            const circ = 2 * Math.PI * r;
            const offset = circ * (1 - el.pct / 100);
            return (
              <motion.div
                key={i}
                style={common}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: [0, 0.25, 0.25, 0], scale: [0.7, 1.05, 1, 0.7], rotate: [0, 360] }}
                transition={{ delay: el.delay, duration: el.dur, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="3.5"
                    className="text-surface-300/70 dark:text-surface-600/50" />
                  <circle cx="28" cy="28" r={r} fill="none" strokeWidth="3.5"
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    className="text-brand-500/80 dark:text-brand-400/70" stroke="currentColor"
                    transform="rotate(-90 28 28)" />
                </svg>
              </motion.div>
            );
          }

          if (el.type === "pill") {
            return (
              <motion.div
                key={i}
                style={common}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: [0, 0.3, 0.3, 0], x: [-14, 12, 12, -14] }}
                transition={{ delay: el.delay, duration: el.dur, repeat: Infinity, ease: "easeInOut" }}
                className="px-3.5 py-1.5 rounded-full bg-brand-100/80 dark:bg-brand-900/50 border border-brand-300/70 dark:border-brand-700/50 text-[10px] font-semibold text-brand-700/80 dark:text-brand-300/60 tracking-wide shadow-sm"
              >
                {el.text}
              </motion.div>
            );
          }

          if (el.type === "dot") {
            return (
              <motion.div
                key={i}
                style={{ ...common, width: el.size, height: el.size }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0.35, 0.35, 0], scale: [0, 1.4, 1.1, 0] }}
                transition={{ delay: el.delay, duration: el.dur, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-full bg-brand-400/60 dark:bg-brand-500/50"
              />
            );
          }

          return null;
        })}
      </div>
      {/* ====== End animated background ====== */}

      <div className="relative flex min-h-screen">
        <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />

        {/* ── Left Sidebar ── */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="hidden md:flex md:w-56 lg:w-60 flex-col fixed top-0 left-0 h-screen z-20 bg-surface-900/80 backdrop-blur-xl border-r border-surface-800/60"
        >
          {/* Logo & brand */}
          <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
            <BrandLogo compact />
          </div>

          {/* User info */}
          <div className="px-5 pb-4 border-b border-surface-800/60">
            <div className="flex items-center gap-2.5">
              {userProfile?.profileImage ? (
                <img src={userProfile.profileImage} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-surface-700" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300">
                  {(userProfile?.name || user.displayName || user.email || "?")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-surface-100 truncate">
                  {userProfile?.name || user.displayName || user.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-surface-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.key
                    ? "bg-brand-600/20 text-brand-400 shadow-sm"
                    : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/60"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1 h-4 rounded-full bg-brand-500"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Bottom actions */}
          <div className="px-3 pb-4 space-y-1 border-t border-surface-800/60 pt-3">
            <button onClick={() => setShowFeedback(true)} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 rounded-lg transition-all">
              <span className="text-sm">💬</span> Feedback
            </button>
            <button onClick={() => navigate("/profile")} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 rounded-lg transition-all">
              <span className="text-sm">👤</span> Profile
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
              <span className="text-sm">🚪</span> Log out
            </button>
          </div>
        </motion.aside>

        {/* ── Mobile top bar ── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-surface-950/90 backdrop-blur-xl border-b border-surface-800/60">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <BrandLogo compact />
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => navigate("/profile")} className="p-1 rounded-full transition-all" title="Profile">
                {userProfile?.profileImage ? (
                  <img src={userProfile.profileImage} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-surface-700" />
                ) : (
                  <span className="text-surface-500 hover:text-surface-100 text-xs">👤</span>
                )}
              </button>
              <button onClick={handleLogout} className="px-2 py-1 text-[10px] font-medium text-surface-400 border border-surface-700/50 rounded-md transition-all">Log out</button>
            </div>
          </div>
          {/* Mobile tab bar */}
          <div className="flex overflow-x-auto no-scrollbar gap-0.5 px-3 pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all rounded-md ${
                  activeTab === tab.key
                    ? "bg-surface-800/80 text-surface-50 shadow-sm"
                    : "text-surface-500 hover:text-surface-300"
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className="flex-1 md:ml-56 lg:ml-60 pt-[88px] md:pt-0">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6">

        <AnimatePresence mode="wait">
        {activeTab === "nutrition" && (
          <motion.div key="nutrition" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <FoodForm />

            <div className="mt-6 mb-5">
              <h2 className="text-[10px] font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-500" />
                Today's summary
              </h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {/* Consumed */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="rounded-lg border border-surface-200/40 dark:border-surface-700/40 bg-white/50 dark:bg-surface-900/50 backdrop-blur-md p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-full w-0.5 bg-orange-400 rounded-l-lg" />
                  <div className="text-[9px] font-semibold text-surface-400 dark:text-surface-500 mb-1 uppercase tracking-widest">Consumed</div>
                  <div className="text-xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight">{Math.round(totalCalories)}</div>
                  <div className="text-[9px] text-surface-400 dark:text-surface-500 mt-0.5 font-medium">
                    {userProfile?.dailyCalorieTarget ? `of ${userProfile.dailyCalorieTarget} kcal` : 'kcal'}
                  </div>
                  {userProfile?.dailyCalorieTarget > 0 && (
                    <div className="mt-1.5 h-0.5 bg-surface-100/60 dark:bg-surface-800/60 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((totalCalories / userProfile.dailyCalorieTarget) * 100, 100)}%` }}
                        transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${(totalCalories / userProfile.dailyCalorieTarget) > 1 ? 'bg-red-500' : 'bg-orange-400'}`}
                      />
                    </div>
                  )}
                </motion.div>

                {/* Protein */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="rounded-lg border border-surface-200/40 dark:border-surface-700/40 bg-white/50 dark:bg-surface-900/50 backdrop-blur-md p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-full w-0.5 bg-blue-400 rounded-l-lg" />
                  <div className="text-[9px] font-semibold text-surface-400 dark:text-surface-500 mb-1 uppercase tracking-widest">Protein</div>
                  <div className="text-xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight">{Math.round(totalProtein)}</div>
                  <div className="text-[9px] text-surface-400 dark:text-surface-500 mt-0.5 font-medium">g today</div>
                </motion.div>

                {/* Burned */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="rounded-lg border border-surface-200/40 dark:border-surface-700/40 bg-white/50 dark:bg-surface-900/50 backdrop-blur-md p-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 h-full w-0.5 bg-green-400 rounded-l-lg" />
                  <div className="text-[9px] font-semibold text-surface-400 dark:text-surface-500 mb-1 uppercase tracking-widest">Burned</div>
                  <div className="text-xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight">{todayCalBurned}</div>
                  <div className="text-[9px] text-surface-400 dark:text-surface-500 mt-0.5 font-medium">kcal workouts</div>
                </motion.div>

                {/* Net Deficit */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="rounded-lg border border-surface-200/40 dark:border-surface-700/40 bg-white/50 dark:bg-surface-900/50 backdrop-blur-md p-3 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 h-full w-0.5 rounded-l-lg ${todayDeficit >= 0 ? 'bg-brand-500' : 'bg-red-500'}`} />
                  <div className="text-[9px] font-semibold text-surface-400 dark:text-surface-500 mb-1 uppercase tracking-widest">Net deficit</div>
                  <div className={`text-xl font-extrabold tracking-tight ${todayDeficit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                    {todayDeficit >= 0 ? '' : '+'}{Math.abs(todayDeficit)}
                  </div>
                  <div className="text-[9px] text-surface-400 dark:text-surface-500 mt-0.5 font-medium">{maintenanceCalories} maint.</div>
                </motion.div>
              </div>
            </div>
            <FoodLogEditor onDataChanged={refreshCharts} />
            <MonthlyNutritionTable allLogs={allFoodLogs} workoutLogs={allWorkoutLogs} maintenanceCalories={maintenanceCalories} />
            <NutritionChart key={chartKey} allLogs={allFoodLogs} />
          </motion.div>
        )}

        {activeTab === "weight" && (
          <motion.div key="weight" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <WeightHistory />
          </motion.div>
        )}

        {activeTab === "workout" && (
          <motion.div key="workout" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <WorkoutTab allFoodLogs={allFoodLogs} maintenanceCalories={maintenanceCalories} />
          </motion.div>
        )}

        {activeTab === "coach" && (
          <motion.div key="coach" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <AICoach allFoodLogs={allFoodLogs} allWorkoutLogs={allWorkoutLogs} maintenanceCalories={maintenanceCalories} />
            <PromptGenerator />
          </motion.div>
        )}

        {activeTab === "reports" && (
          <motion.div key="reports" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <EmailSettings />
          </motion.div>
        )}
        </AnimatePresence>

          </div>
        </div>
        {/* End main content */}

      </div>
    </div>
  );
};

export default Dashboard;
