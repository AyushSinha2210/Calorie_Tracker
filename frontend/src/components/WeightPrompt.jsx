import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const WeightPrompt = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("kg");
  const [saving, setSaving] = useState(false);
  const [lastWeight, setLastWeight] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() || {};
        const lastPrompt = data.lastWeightPrompt?.toDate?.() || data.lastWeightPrompt;
        if (data.lastRecordedWeight) setLastWeight(data.lastRecordedWeight);
        if (!lastPrompt || Date.now() - new Date(lastPrompt).getTime() >= WEEK_MS) {
          setShow(true);
        }
      } catch (err) {
        console.error("WeightPrompt: failed to check last prompt", err);
        // Don't force-show on error — wait until next session
      }
    })();
  }, [user]);

  const handleSave = async () => {
    const val = Number.parseFloat(weight);
    if (!val || val <= 0 || val > 700) return;
    setSaving(true);
    try {
      const weightKg = unit === "lbs" ? +(val * 0.453592).toFixed(1) : +val.toFixed(1);
      await addDoc(collection(db, "users", user.uid, "weightLogs"), {
        weight: weightKg,
        originalWeight: val,
        unit,
        date: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", user.uid), {
        lastWeightPrompt: serverTimestamp(),
        lastWeightLogDate: new Date().toISOString().split("T")[0],
        lastRecordedWeight: weightKg,
      }, { merge: true });
      setShow(false);
    } catch (err) {
      console.error("Failed to save weight:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      await setDoc(doc(db, "users", user.uid), {
        lastWeightPrompt: serverTimestamp(),
      }, { merge: true });
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>Weekly Weight Check-in</h2>
        <p style={{ color: "#666", margin: "0 0 18px", fontSize: "14px" }}>
          {lastWeight
            ? `Last recorded: ${lastWeight} kg — how are you doing this week?`
            : "Track your progress by logging your weight weekly."}
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
          <input
            type="number"
            placeholder="Enter weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min="1"
            max="700"
            step="0.1"
            style={inputStyle}
            autoFocus
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={selectStyle}>
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleSave} disabled={saving || !weight} style={saveBtn}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={handleSkip} disabled={saving} style={skipBtn}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modal = {
  background: "#fff",
  borderRadius: "12px",
  padding: "28px 32px",
  maxWidth: "400px",
  width: "90%",
  boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
};

const inputStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: "5px",
  border: "1px solid #ddd",
  fontSize: "16px",
};

const selectStyle = {
  padding: "10px",
  borderRadius: "5px",
  border: "1px solid #ddd",
  fontSize: "16px",
  background: "#fff",
  cursor: "pointer",
};

const saveBtn = {
  flex: 1,
  padding: "10px 20px",
  background: "linear-gradient(135deg, #5568d3 0%, #6a3a8a 100%)",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const skipBtn = {
  padding: "10px 20px",
  background: "transparent",
  color: "#888",
  border: "1px solid #ddd",
  borderRadius: "5px",
  fontSize: "14px",
  cursor: "pointer",
};

export default WeightPrompt;
