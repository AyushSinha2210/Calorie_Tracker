import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./Auth.css";

const sectionTitle = {
  fontSize: 13, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase",
  letterSpacing: 1, margin: "18px 0 8px", paddingBottom: 4,
  borderBottom: "2px solid var(--border)",
};

function ProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!name.trim() || !age || !weight || !height || !calorieTarget || !gender) {
      return setError("All fields are required.");
    }
    const ageNum = Number(age);
    if (ageNum < 10 || ageNum > 120) return setError("Age must be between 10 and 120.");
    const wNum = Number(weight);
    if (wNum < 20 || wNum > 700) return setError("Please enter a valid weight.");
    const hNum = Number(height);
    if (hNum < (heightUnit === "ft" ? 1 : 50) || hNum > (heightUnit === "ft" ? 10 : 300))
      return setError("Please enter a valid height.");
    const calNum = Number(calorieTarget);
    if (calNum < 500 || calNum > 10000) return setError("Calorie target must be between 500 and 10,000.");

    setLoading(true);
    try {
      const wKg = weightUnit === "lbs" ? +(wNum * 0.453592).toFixed(1) : +wNum.toFixed(1);
      const hCm = heightUnit === "ft" ? +(hNum * 30.48).toFixed(1) : +hNum.toFixed(1);

      await setDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        age: ageNum,
        weight: wKg,
        weightUnit,
        originalWeight: wNum,
        height: hCm,
        heightUnit,
        originalHeight: hNum,
        dailyCalorieTarget: calNum,
        gender,
        profileComplete: true,
        lastActive: serverTimestamp(),
      }, { merge: true });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "36px 32px", maxWidth: 440, width: "100%", border: "1px solid var(--border)" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, textAlign: "center", color: "var(--text)" }}>Complete Your Profile</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, textAlign: "center" }}>
          Welcome, <strong>{user?.displayName || user?.email}</strong>! Please fill in your details to continue.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div style={sectionTitle}>Your Details</div>

          <div style={{ marginBottom: 10 }}>
            <label htmlFor="name" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Full Name <span style={{ color: "red" }}>*</span></label>
            <input type="text" id="name" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 14, boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label htmlFor="age" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Age <span style={{ color: "red" }}>*</span></label>
              <input type="number" id="age" placeholder="e.g. 25" min="10" max="120" value={age} onChange={(e) => setAge(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 14, boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text)" }} />
            </div>
            <div>
              <label htmlFor="gender" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Gender <span style={{ color: "red" }}>*</span></label>
              <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 14, boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text)" }}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div>
              <label htmlFor="calorieTarget" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Daily Calorie Target <span style={{ color: "red" }}>*</span></label>
              <input type="number" id="calorieTarget" placeholder="e.g. 2000" min="500" max="10000" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 14, boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text)" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginTop: 10 }}>
            <div>
              <label htmlFor="weight" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Weight <span style={{ color: "red" }}>*</span></label>
              <input type="number" id="weight" placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 154"} step="0.1" min="20" max="700" value={weight} onChange={(e) => setWeight(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 14, boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text)" }} />
            </div>
            <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}
              style={{ height: 40, borderRadius: 5, border: "1px solid var(--border)", padding: "0 8px", fontSize: 14, background: "var(--bg-input)", color: "var(--text)" }}>
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginTop: 10 }}>
            <div>
              <label htmlFor="height" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Height <span style={{ color: "red" }}>*</span></label>
              <input type="number" id="height" placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"} step="0.1" min={heightUnit === "ft" ? "1" : "50"} max={heightUnit === "ft" ? "10" : "300"} value={height} onChange={(e) => setHeight(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 14, boxSizing: "border-box", background: "var(--bg-input)", color: "var(--text)" }} />
            </div>
            <select value={heightUnit} onChange={(e) => setHeightUnit(e.target.value)}
              style={{ height: 40, borderRadius: 5, border: "1px solid var(--border)", padding: "0 8px", fontSize: 14, background: "var(--bg-input)", color: "var(--text)" }}>
              <option value="cm">cm</option>
              <option value="ft">ft</option>
            </select>
          </div>

          <button type="submit" className="auth-button" disabled={loading} style={{ marginTop: 20 }}>
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileSetup;
