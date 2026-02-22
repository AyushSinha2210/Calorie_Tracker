import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FoodForm from "../components/FoodForm";
import FoodLogEditor from "../components/FoodLogEditor";
import NutritionChart from "../components/NutritionChart";
import MonthlyNutritionTable from "../components/MonthlyNutritionTable";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [chartKey, setChartKey] = useState(0);

  const handleLogout = async () => { try { await signOut(auth); navigate("/login"); } catch {} };

  const refreshCharts = () => setChartKey((k) => k + 1);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    return onSnapshot(query(collection(db, "users", user.uid, "foodLogs"), where("date", "==", today)), (snap) => {
      let cal = 0, pro = 0;
      snap.forEach((d) => { const data = d.data(); cal += data.calories; pro += data.protein; });
      setTotalCalories(cal); setTotalProtein(pro);
    });
  }, [user]);

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Welcome, {user.displayName || user.email}!</h1>
      <button onClick={handleLogout} style={{ padding: "10px 20px", background: "#667eea", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", marginBottom: "20px" }}>Logout</button>
      <FoodForm />
      <div style={{ marginTop: "30px" }}>
        <h2>Today's Summary</h2>
        <p>Calories: {totalCalories}</p>
        <p>Protein: {totalProtein} g</p>
      </div>
      <FoodLogEditor onDataChanged={refreshCharts} />
      <MonthlyNutritionTable />
      <NutritionChart key={chartKey} />
    </div>
  );
};

export default Dashboard;
