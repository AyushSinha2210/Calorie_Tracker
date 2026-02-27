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
import { collection, query, where, onSnapshot, getDocs, deleteDoc, doc } from "firebase/firestore";

const TABS = [
  { key: "nutrition", label: "🍎 Nutrition" },
  { key: "workout", label: "🏋️ Workout" },
  { key: "weight", label: "⚖️ Weight" },
  { key: "reports", label: "📧 Reports" },
];

const Dashboard = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [allFoodLogs, setAllFoodLogs] = useState([]);
  const [chartKey, setChartKey] = useState(0);
  const [activeTab, setActiveTab] = useState("nutrition");
  const [cleanedUp, setCleanedUp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleLogout = async () => { try { await signOut(auth); navigate("/login"); } catch {} };

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
          .catch(() => {});
      }
    }).catch(() => {});
    setCleanedUp(true);
  }, [user, cleanedUp]);

  // Derive today's totals from the shared data
  const today = new Date().toISOString().split("T")[0];
  const totalCalories = allFoodLogs.filter((l) => l.date === today).reduce((s, l) => s + (l.calories || 0), 0);
  const totalProtein = allFoodLogs.filter((l) => l.date === today).reduce((s, l) => s + (l.protein || 0), 0);

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <WeightPrompt />
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ margin: 0 }}>Welcome, {userProfile?.name || user.displayName || user.email}!</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowFeedback(true)} title="Send Feedback" style={{ padding: "10px 18px", background: "transparent", color: "#ff9800", border: "2px solid #ff9800", borderRadius: "5px", cursor: "pointer", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>💬 Feedback</button>
          <button onClick={() => navigate("/profile")} title="My Profile" style={{ padding: "10px 18px", background: "transparent", color: "#667eea", border: "2px solid #667eea", borderRadius: "5px", cursor: "pointer", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>👤 Profile</button>
          <button onClick={handleLogout} style={{ padding: "10px 20px", background: "#667eea", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Logout</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0", marginBottom: "24px", borderBottom: "2px solid #eee" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 24px",
              fontSize: "15px",
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? "#667eea" : "#888",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? "3px solid #667eea" : "3px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s",
              marginBottom: "-2px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "nutrition" && (
        <>
          <FoodForm />
          <div style={{ marginTop: "30px" }}>
            <h2>Today&apos;s Summary</h2>
            <p>Calories: {totalCalories}</p>
            <p>Protein: {totalProtein} g</p>
          </div>
          <FoodLogEditor onDataChanged={refreshCharts} />
          <MonthlyNutritionTable allLogs={allFoodLogs} />
          <NutritionChart key={chartKey} allLogs={allFoodLogs} />
        </>
      )}

      {activeTab === "weight" && <WeightHistory />}

      {activeTab === "workout" && <WorkoutTab />}

      {activeTab === "reports" && <EmailSettings />}
    </div>
  );
};

export default Dashboard;
