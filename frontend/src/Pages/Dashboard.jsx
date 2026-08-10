import { useEffect, useState, useMemo } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FoodForm from "../components/FoodForm";
import FoodLogEditor from "../components/FoodLogEditor";
import NutritionChart from "../components/NutritionChart";
import MonthlyNutritionTable from "../components/MonthlyNutritionTable";
import WeightHistory from "../components/WeightHistory";
import WorkoutTab from "../components/WorkoutTab";
import EmailSettings from "../components/EmailSettings";
import FeedbackModal from "../components/FeedbackModal";
import AICoach from "../components/AICoach";
import PromptGenerator from "../components/PromptGenerator";
import BrandLogo from "../components/ui/BrandLogo";
import CalorieRing from "../components/ui/CalorieRing";
import MacroRings from "../components/ui/MacroRings";
import { collection, query, where, onSnapshot, doc, orderBy } from "firebase/firestore";
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
  { key: "nutrition", label: "Nutrition & Scan", icon: "📸" },
  { key: "workout", label: "Workouts", icon: "🏋️" },
  { key: "weight", label: "Weight & Trends", icon: "⚖️" },
  { key: "coach", label: "AI Coach", icon: "🤖" },
  { key: "reports", label: "Email Reports", icon: "📧" },
];

const Dashboard = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [allFoodLogs, setAllFoodLogs] = useState([]);
  const [allWorkoutLogs, setAllWorkoutLogs] = useState([]);
  const [chartKey, setChartKey] = useState(0);
  const [activeTab, setActiveTab] = useState("nutrition");
  const [showFeedback, setShowFeedback] = useState(false);

  const maintenanceCalories = useMemo(() => calcMaintenanceCalories(userProfile), [userProfile]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch {}
  };

  const refreshCharts = () => setChartKey((k) => k + 1);

  // Single 60-day food logs listener
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

  // Derive today's totals
  const today = new Date().toISOString().split("T")[0];
  const todayFood = useMemo(() => allFoodLogs.filter((l) => l.date === today), [allFoodLogs, today]);
  const todayWorkout = useMemo(() => allWorkoutLogs.filter((l) => l.date === today), [allWorkoutLogs, today]);

  // Today's steps listener: users/{uid}/stepLogs/{today}
  const [todayStepLog, setTodayStepLog] = useState(null);
  useEffect(() => {
    if (!user) return;
    const stepRef = doc(db, "users", user.uid, "stepLogs", today);
    return onSnapshot(stepRef, (snap) => {
      if (snap.exists()) {
        setTodayStepLog(snap.data());
      } else {
        setTodayStepLog(null);
      }
    }, (err) => {
      console.warn("Step log listener:", err);
    });
  }, [user, today]);

  const totalCalories = useMemo(
    () => todayFood.reduce((s, l) => s + (Number(l.calories) || 0), 0),
    [todayFood]
  );
  const totalProtein = useMemo(
    () => todayFood.reduce((s, l) => s + (Number(l.protein) || 0), 0),
    [todayFood]
  );
  const totalCarbs = useMemo(
    () => todayFood.reduce((s, l) => s + (Number(l.carbs) || 0), 0),
    [todayFood]
  );
  const totalFat = useMemo(
    () => todayFood.reduce((s, l) => s + (Number(l.fat) || 0), 0),
    [todayFood]
  );
  const todayCalBurned = useMemo(
    () => todayWorkout.reduce((s, l) => s + (Number(l.caloriesBurned) || 0), 0),
    [todayWorkout]
  );

  const calorieTarget = userProfile?.dailyCalorieTarget || 2000;
  const todayDeficit = maintenanceCalories - Math.round(totalCalories) + todayCalBurned;

  // Macro target estimates based on calorie target (30% P, 45% C, 25% F)
  const targetProteinGrams = Math.round((calorieTarget * 0.3) / 4);
  const targetCarbsGrams = Math.round((calorieTarget * 0.45) / 4);
  const targetFatGrams = Math.round((calorieTarget * 0.25) / 9);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text relative overflow-hidden">
      {/* Subtle ambient gradient mesh */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-lime-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />

        {/* ── Desktop Left Sidebar ── */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="hidden md:flex md:w-60 lg:w-64 flex-col fixed top-0 left-0 h-screen z-20 bg-dark-surface/90 backdrop-blur-xl border-r border-dark-border/80"
        >
          {/* Brand Logo */}
          <div className="px-5 pt-6 pb-4">
            <BrandLogo size="md" to="/dashboard" />
          </div>

          {/* User Profile Mini Card */}
          <div className="px-5 pb-5 border-b border-dark-border/60">
            <div
              onClick={() => navigate("/profile")}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-dark-surface-2 transition-all cursor-pointer group"
            >
              {userProfile?.profileImage ? (
                <img
                  src={userProfile.profileImage}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xs font-extrabold text-emerald-400">
                  {(userProfile?.name || user?.displayName || user?.email || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-dark-text truncate group-hover:text-emerald-400 transition-colors">
                  {userProfile?.name || user?.displayName || user?.email?.split("@")[0]}
                </p>
                <p className="text-[10px] text-dark-muted truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    active
                      ? "bg-gradient-to-r from-emerald-500/20 to-lime-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm"
                      : "text-dark-muted hover:text-dark-text hover:bg-dark-surface-2"
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {active && (
                    <motion.div
                      layoutId="sidebar-tab-pill"
                      className="ml-auto w-1.5 h-4 rounded-full bg-emerald-400"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom actions */}
          <div className="px-3 pb-5 pt-3 border-t border-dark-border/60 space-y-1">
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-dark-muted hover:text-dark-text hover:bg-dark-surface-2 rounded-xl transition-all"
            >
              <span>💬</span> Feedback
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-dark-muted hover:text-dark-text hover:bg-dark-surface-2 rounded-xl transition-all"
            >
              <span>⚙️</span> Settings & Profile
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <span>🚪</span> Log out
            </button>
          </div>
        </motion.aside>

        {/* ── Mobile top & tab bar ── */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-dark-bg/95 backdrop-blur-xl border-b border-dark-border/80">
          <div className="flex items-center justify-between px-4 py-3">
            <BrandLogo size="sm" to="/dashboard" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/profile")}
                className="w-8 h-8 rounded-full bg-dark-surface-2 border border-dark-border flex items-center justify-center text-xs font-bold text-dark-text overflow-hidden"
              >
                {userProfile?.profileImage ? (
                  <img src={userProfile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (userProfile?.name || user?.displayName || user?.email || "U")[0].toUpperCase()
                )}
              </button>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1 text-[11px] font-semibold text-dark-muted border border-dark-border rounded-lg"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-1 px-3 pb-2.5">
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    active
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-dark-muted hover:text-dark-text"
                  }`}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <main className="flex-1 md:ml-60 lg:ml-64 pt-24 md:pt-0 pb-12">
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
            <AnimatePresence mode="wait">
              {/* ── NUTRITION & SCAN TAB ── */}
              {activeTab === "nutrition" && (
                <motion.div
                  key="nutrition"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Cal AI-Style Hero Summary Card with Calorie & Macro Rings */}
                  <div className="card p-6 bg-gradient-to-br from-dark-surface to-dark-surface-2/80 border-dark-border/80">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                          Daily Progress · {today}
                        </span>
                        <h1 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
                          Nutrition Dashboard
                        </h1>
                      </div>
                      {todayDeficit !== 0 && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-dark-muted">
                            {todayDeficit >= 0 ? "Calorie Deficit" : "Surplus"}
                          </span>
                          <p
                            className={`text-sm font-extrabold ${
                              todayDeficit >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {todayDeficit >= 0 ? "" : "+"}
                            {Math.abs(todayDeficit)} kcal
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Ring + Macros in grid */}
                    <div className="grid md:grid-cols-2 gap-6 items-center pt-2">
                      <div className="flex justify-center">
                        <CalorieRing
                          consumed={Math.round(totalCalories)}
                          target={calorieTarget}
                          burned={todayCalBurned}
                          size={200}
                        />
                      </div>

                      <div className="flex flex-col justify-center space-y-3">
                        <span className="text-xs font-bold text-dark-muted uppercase tracking-wider">
                          Macros Breakdown
                        </span>
                        <MacroRings
                          protein={totalProtein}
                          carbs={totalCarbs}
                          fat={totalFat}
                          targetProtein={targetProteinGrams}
                          targetCarbs={targetCarbsGrams}
                          targetFat={targetFatGrams}
                        />
                        <div className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border/50 text-xs text-dark-muted flex items-center justify-between">
                          <span>Maintenance Target</span>
                          <span className="font-bold text-dark-text">{maintenanceCalories} kcal</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Daily Steps Walked Card (Auto-synced from Mobile Sensor) ── */}
                  <div className="card p-5 bg-gradient-to-br from-dark-surface to-dark-surface-2/80 border border-dark-border/80 rounded-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-2xl shadow-inner">
                          👟
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                              Daily Steps
                            </span>
                            <span className="text-[10px] font-semibold text-dark-muted bg-dark-bg/60 px-2 py-0.5 rounded-full border border-dark-border/40">
                              📱 Auto-Synced
                            </span>
                          </div>
                          <h2 className="text-xl font-extrabold text-white tracking-tight mt-0.5">
                            {(todayStepLog?.steps || 0).toLocaleString()}{" "}
                            <span className="text-xs text-dark-muted font-medium">
                              / {(todayStepLog?.targetSteps || 10000).toLocaleString()} steps
                            </span>
                          </h2>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 inline-block">
                          {Math.min(100, Math.round(((todayStepLog?.steps || 0) / (todayStepLog?.targetSteps || 10000)) * 100))}%
                        </span>
                        <p className="text-[10px] text-dark-muted font-medium mt-1">
                          Goal Progress
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-dark-bg/80 h-2.5 rounded-full overflow-hidden border border-dark-border/40 mb-3.5">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max((todayStepLog?.steps ? 2 : 0), Math.round(((todayStepLog?.steps || 0) / (todayStepLog?.targetSteps || 10000)) * 100)))}%`
                        }}
                      />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-2.5 rounded-xl bg-dark-bg/60 border border-dark-border/50">
                        <span className="text-[10px] text-dark-muted uppercase font-bold tracking-wider">Distance</span>
                        <p className="text-sm font-extrabold text-white mt-0.5">
                          {todayStepLog?.distanceKm != null
                            ? Number(todayStepLog.distanceKm).toFixed(2)
                            : (((todayStepLog?.steps || 0) * 0.76) / 1000).toFixed(2)} km
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-dark-bg/60 border border-dark-border/50">
                        <span className="text-[10px] text-dark-muted uppercase font-bold tracking-wider">Calories Burned</span>
                        <p className="text-sm font-extrabold text-amber-400 mt-0.5">
                          🔥 {todayStepLog?.caloriesBurned != null
                            ? Math.round(todayStepLog.caloriesBurned)
                            : Math.round((todayStepLog?.steps || 0) * 0.04)} kcal
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-dark-bg/60 border border-dark-border/50 flex flex-col justify-center items-center">
                        <span className="text-[10px] text-dark-muted uppercase font-bold tracking-wider">Mobile Sensor</span>
                        <p className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Hardware Active
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* FoodForm with Cal AI-style photo scanner */}
                  <FoodForm />

                  {/* Food log editor for editing & deleting entries */}
                  <FoodLogEditor onDataChanged={refreshCharts} />

                  {/* Monthly Table & Nutrition Charts */}
                  <MonthlyNutritionTable
                    allLogs={allFoodLogs}
                    workoutLogs={allWorkoutLogs}
                    maintenanceCalories={maintenanceCalories}
                  />

                  <NutritionChart key={chartKey} allLogs={allFoodLogs} />
                </motion.div>
              )}

              {/* ── WORKOUTS TAB ── */}
              {activeTab === "workout" && (
                <motion.div
                  key="workout"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <WorkoutTab
                    allFoodLogs={allFoodLogs}
                    maintenanceCalories={maintenanceCalories}
                  />
                </motion.div>
              )}

              {/* ── WEIGHT TAB ── */}
              {activeTab === "weight" && (
                <motion.div
                  key="weight"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <WeightHistory />
                </motion.div>
              )}

              {/* ── AI COACH TAB ── */}
              {activeTab === "coach" && (
                <motion.div
                  key="coach"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <AICoach
                    allFoodLogs={allFoodLogs}
                    allWorkoutLogs={allWorkoutLogs}
                    maintenanceCalories={maintenanceCalories}
                  />
                  <PromptGenerator />
                </motion.div>
              )}

              {/* ── EMAIL REPORTS TAB ── */}
              {activeTab === "reports" && (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <EmailSettings />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
