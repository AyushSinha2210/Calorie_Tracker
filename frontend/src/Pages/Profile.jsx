import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./Auth.css";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#555" };
const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 5, fontSize: 14, boxSizing: "border-box", background: "#f9f9fb" };
const readOnlyStyle = { ...inputStyle, background: "#eee", color: "#666", cursor: "not-allowed" };
const cardStyle = { background: "#fff", borderRadius: 12, padding: "28px 28px 20px", maxWidth: 500, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.10)" };

function Profile() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill from Firestore profile
  useEffect(() => {
    if (!userProfile) return;
    setName(userProfile.name || user?.displayName || "");
    setAge(userProfile.age?.toString() || "");
    setWeight(userProfile.originalWeight?.toString() || userProfile.weight?.toString() || "");
    setWeightUnit(userProfile.weightUnit || "kg");
    setHeight(userProfile.originalHeight?.toString() || userProfile.height?.toString() || "");
    setHeightUnit(userProfile.heightUnit || "cm");
    setCalorieTarget(userProfile.dailyCalorieTarget?.toString() || "");
    setGender(userProfile.gender || "");
  }, [userProfile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!name.trim() || !age || !weight || !height || !calorieTarget) return setError("All fields are required.");
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

      setSuccess("Profile updated successfully!");
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  const displayWeight = userProfile?.originalWeight
    ? `${userProfile.originalWeight} ${userProfile.weightUnit || "kg"}`
    : userProfile?.weight ? `${userProfile.weight} kg` : "—";

  const displayHeight = userProfile?.originalHeight
    ? `${userProfile.originalHeight} ${userProfile.heightUnit || "cm"}`
    : userProfile?.height ? `${userProfile.height} cm` : "—";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: 20, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60 }}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#667eea", padding: 0, lineHeight: 1 }} title="Back to Dashboard">
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: 20, flex: 1, textAlign: "center" }}>My Profile</h2>
          <div style={{ width: 28 }} />
        </div>

        {/* Avatar / user info */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 28, color: "#fff", fontWeight: 700 }}>
            {(userProfile?.name || user?.displayName || user?.email || "?")[0].toUpperCase()}
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#333" }}>{userProfile?.name || user?.displayName || "—"}</div>
          <div style={{ fontSize: 13, color: "#888" }}>{user?.email}</div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: 10, borderRadius: 5, marginBottom: 16, fontSize: 14, borderLeft: "3px solid #2e7d32" }}>{success}</div>}

        {!editing ? (
          /* ----- VIEW MODE ----- */
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Name</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>{userProfile?.name || user?.displayName || "—"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
              <div>
                <div style={labelStyle}>Age</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>{userProfile?.age || "—"}</div>
              </div>
              <div>
                <div style={labelStyle}>Gender</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#333", textTransform: "capitalize" }}>{userProfile?.gender || "—"}</div>
              </div>
              <div>
                <div style={labelStyle}>Daily Calorie Target</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>{userProfile?.dailyCalorieTarget ? `${userProfile.dailyCalorieTarget} kcal` : "—"}</div>
              </div>
              <div>
                <div style={labelStyle}>Weight</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>{displayWeight}</div>
              </div>
              <div>
                <div style={labelStyle}>Height</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>{displayHeight}</div>
              </div>
            </div>

            {/* AI Coach settings */}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #eee" }}>
              <div style={labelStyle}>AI Coach</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: "#333" }}>{userProfile?.coachEnabled ? "✅ Enabled" : "❌ Disabled"}</span>
              </div>
              {userProfile?.coachEnabled && (
                <div>
                  <div style={labelStyle}>Coach Tone</div>
                  <div style={{ fontSize: 14, color: "#333", textTransform: "capitalize" }}>
                    {userProfile?.coachTone === "strict" ? "🔥 Strict Coach"
                      : userProfile?.coachTone === "sarcastic" ? "😏 Sarcastic Buddy"
                      : userProfile?.coachTone === "motivational" ? "💪 Motivational"
                      : "😊 Friendly Trainer"}
                  </div>
                </div>
              )}
            </div>

            {/* Account info */}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #eee" }}>
              <div style={labelStyle}>Email</div>
              <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>{user?.email}</div>
              <div style={labelStyle}>Member Since</div>
              <div style={{ fontSize: 14, color: "#555" }}>
                {userProfile?.createdAt?.toDate
                  ? userProfile.createdAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                  : "—"}
              </div>
            </div>

            <button className="auth-button" onClick={() => { setEditing(true); setError(""); setSuccess(""); }} style={{ marginTop: 20 }}>
              Edit Profile
            </button>
          </div>
        ) : (
          /* ----- EDIT MODE ----- */
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: 10 }}>
              <label htmlFor="p-name" style={labelStyle}>Full Name <span style={{ color: "red" }}>*</span></label>
              <input type="text" id="p-name" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label htmlFor="p-age" style={labelStyle}>Age <span style={{ color: "red" }}>*</span></label>
                <input type="number" id="p-age" min="10" max="120" value={age} onChange={(e) => setAge(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label htmlFor="p-gender" style={labelStyle}>Gender <span style={{ color: "red" }}>*</span></label>
                <select id="p-gender" value={gender} onChange={(e) => setGender(e.target.value)} required
                  style={{ ...inputStyle, background: "#fff" }}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label htmlFor="p-cal" style={labelStyle}>Daily Calorie Target <span style={{ color: "red" }}>*</span></label>
                <input type="number" id="p-cal" min="500" max="10000" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} required style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginTop: 10 }}>
              <div>
                <label htmlFor="p-wt" style={labelStyle}>Weight <span style={{ color: "red" }}>*</span></label>
                <input type="number" id="p-wt" step="0.1" min="20" max="700" placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 154"} value={weight} onChange={(e) => setWeight(e.target.value)} required style={inputStyle} />
              </div>
              <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} style={{ height: 40, borderRadius: 5, border: "1px solid #ddd", padding: "0 8px", fontSize: 14 }}>
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginTop: 10 }}>
              <div>
                <label htmlFor="p-ht" style={labelStyle}>Height <span style={{ color: "red" }}>*</span></label>
                <input type="number" id="p-ht" step="0.1" min={heightUnit === "ft" ? "1" : "50"} max={heightUnit === "ft" ? "10" : "300"} placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"} value={height} onChange={(e) => setHeight(e.target.value)} required style={inputStyle} />
              </div>
              <select value={heightUnit} onChange={(e) => setHeightUnit(e.target.value)} style={{ height: 40, borderRadius: 5, border: "1px solid #ddd", padding: "0 8px", fontSize: 14 }}>
                <option value="cm">cm</option>
                <option value="ft">ft</option>
              </select>
            </div>

            {/* Read-only email */}
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Email</label>
              <input type="text" value={user?.email || ""} readOnly style={readOnlyStyle} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="submit" className="auth-button" disabled={loading} style={{ marginBottom: 0 }}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => { setEditing(false); setError(""); setSuccess(""); }} disabled={loading}
                style={{ flex: 1, padding: "12px", background: "transparent", color: "#667eea", border: "1px solid #667eea", borderRadius: 5, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile;
