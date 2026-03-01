import { useEffect, useState, useMemo } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FoodForm from "../components/FoodForm";
import FoodLogEditor from "../components/FoodLogEditor";
import NutritionChart from "../components/NutritionChart";
import MonthlyNutritionTable from "../components/MonthlyNutritionTable";
import WeightPrompt from "../components/WeightPrompt";
import WeightHistory from "../components/WeightHistory";
import WorkoutTab from "../components/WorkoutTab";
import EmailSettings from "../components/EmailSettings";
import FeedbackModal from "../components/FeedbackModal";
import AICoach from "../components/AICoach";
import PromptGenerator from "../components/PromptGenerator";
import { collection, query, where, onSnapshot, getDocs, deleteDoc, doc, orderBy } from "firebase/firestore";
import { motion } from "framer-motion";

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
  { key: "nutrition", label: "🍎 Nutrition" },
  { key: "workout", label: "🏋️ Workout" },
  { key: "weight", label: "⚖️ Weight" },
  { key: "coach", label: "🤖 AI Coach" },
  { key: "reports", label: "📧 Reports" },
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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto min-h-screen">
      <WeightPrompt />
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 m-0">
          Welcome, <span className="text-brand-500">{userProfile?.name || user.displayName || user.email?.split('@')[0]}</span>!
        </h1>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowFeedback(true)} title="Send Feedback" className="px-4 py-2 text-amber-500 border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all">
            💬 Feedback
          </button>
          <button onClick={() => navigate("/profile")} title="My Profile" className="px-4 py-2 text-brand-600 border-2 border-brand-200 hover:border-brand-500 hover:bg-brand-50 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all">
            👤 Profile
          </button>
          <button onClick={handleLogout} className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white border-2 border-transparent rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg">
            Logout
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto no-scrollbar mb-8 border-b-2 border-gray-100 pb-1 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-5 py-2.5 text-sm md:text-base font-semibold rounded-t-xl transition-all ${activeTab === tab.key
                ? "text-brand-600 bg-brand-50 border-b-4 border-brand-500 -mb-[6px]"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-b-4 border-transparent -mb-[6px]"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "nutrition" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <FoodForm />

          <div className="mt-10 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">📊</span> Today's Summary
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div whileHover={{ y: -2 }} className="text-center p-5 bg-orange-50 rounded-2xl border border-orange-100 shadow-sm">
                <div className="text-sm font-medium text-orange-600/70 mb-1 uppercase tracking-wide">Consumed</div>
                <div className="text-3xl font-extrabold text-orange-600">{Math.round(totalCalories)}</div>
                <div className="text-xs text-orange-500/60 font-medium mt-1">kcal</div>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} className="text-center p-5 bg-green-50 rounded-2xl border border-green-100 shadow-sm">
                <div className="text-sm font-medium text-green-600/70 mb-1 uppercase tracking-wide">Protein</div>
                <div className="text-3xl font-extrabold text-green-600">{Math.round(totalProtein)}</div>
                <div className="text-xs text-green-500/60 font-medium mt-1">grams</div>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} className="text-center p-5 bg-red-50 rounded-2xl border border-red-100 shadow-sm">
                <div className="text-sm font-medium text-red-600/70 mb-1 uppercase tracking-wide">Burned</div>
                <div className="text-3xl font-extrabold text-red-600 flex justify-center items-center gap-1">
                  <span className="text-xl">🔥</span> {todayCalBurned}
                </div>
                <div className="text-xs text-red-500/60 font-medium mt-1">kcal</div>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} className={`text-center p-5 rounded-2xl border shadow-sm ${todayDeficit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className={`text-sm font-medium mb-1 uppercase tracking-wide ${todayDeficit >= 0 ? 'text-emerald-700/70' : 'text-rose-700/70'}`}>Deficit</div>
                <div className={`text-3xl font-extrabold flex justify-center items-center gap-1 ${todayDeficit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span className="text-xl">{todayDeficit >= 0 ? "↓" : "↑"}</span> {Math.abs(todayDeficit)}
                </div>
                <div className={`text-xs font-medium mt-1 ${todayDeficit >= 0 ? 'text-emerald-600/60' : 'text-rose-600/60'}`}>{maintenanceCalories} maint.</div>
              </motion.div>
            </div>
          </div>
          <FoodLogEditor onDataChanged={refreshCharts} />
          <MonthlyNutritionTable allLogs={allFoodLogs} workoutLogs={allWorkoutLogs} maintenanceCalories={maintenanceCalories} />
          <NutritionChart key={chartKey} allLogs={allFoodLogs} />
        </motion.div>
      )}

      {activeTab === "weight" && <WeightHistory />}

      {activeTab === "workout" && <WorkoutTab allFoodLogs={allFoodLogs} maintenanceCalories={maintenanceCalories} />}

      {activeTab === "coach" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <AICoach allFoodLogs={allFoodLogs} allWorkoutLogs={allWorkoutLogs} maintenanceCalories={maintenanceCalories} />
          <PromptGenerator />
        </motion.div>
      )}

      {activeTab === "reports" && <EmailSettings />}
    </div>
  );
};

export default Dashboard;
