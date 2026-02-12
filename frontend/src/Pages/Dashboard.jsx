import React, { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FoodForm from "../components/FoodForm";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [foodLogs, setFoodLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const foodLogsRef = collection(db, "users", user.uid, "foodLogs");
    const q = query(foodLogsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFoodLogs(logs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleDelete = async (logId) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "foodLogs", logId));
    } catch (error) {
      console.error("Error deleting food log:", error);
    }
  };

  const getTodayTotal = () => {
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = foodLogs.filter(log => log.date === today);
    
    const totalCalories = todayLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
    const totalProtein = todayLogs.reduce((sum, log) => sum + (log.protein || 0), 0);
    
    return { totalCalories, totalProtein };
  };

  const { totalCalories, totalProtein } = getTodayTotal();

  return (
    <div>
      <h1>Welcome, {user.displayName || user.email}!</h1>
      <button onClick={handleLogout}>
        Logout
      </button>
      
      <div>
        <h2>Today's Summary</h2>
        <div>
          <div>
            <h3>Calories</h3>
            <p>{totalCalories}</p>
          </div>
          <div>
            <h3>Protein</h3>
            <p>{totalProtein}g</p>
          </div>
        </div>
      </div>

      <FoodForm />
      
      <div>
        <h2>Food Logs</h2>
        {loading ? (
          <p>Loading...</p>
        ) : foodLogs.length === 0 ? (
          <p>No food logs yet. Add your first meal above!</p>
        ) : (
          <div>
            {foodLogs.map((log) => (
              <div key={log.id}>
                <div>
                  <h3>{log.itemName}</h3>
                  <p>
                    Quantity: {log.quantity} | Calories: {log.calories} | Protein: {log.protein}g
                  </p>
                  <p>
                    {log.date}
                  </p>
                </div>
                <button onClick={() => handleDelete(log.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
