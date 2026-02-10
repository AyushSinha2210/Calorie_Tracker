import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Welcome, {user.displayName || user.email}!</h1>
      <button 
        onClick={handleLogout}
        style={{
          padding: "10px 20px",
          background: "#667eea",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginBottom: "20px"
        }}
      >
        Logout
      </button>
      <div style={{ marginTop: "30px" }}>
        <h2>Your Fitness Journey</h2>
        <p>Calories • Protein • Workouts coming soon 🔥</p>
      </div>
    </div>
  );
};

export default Dashboard;
