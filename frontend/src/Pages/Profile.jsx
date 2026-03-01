import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./Auth.css";

/** Resize an image file to a small square JPEG and return a base64 data-URL */
function resizeImage(file, maxSize = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = maxSize;
        c.height = maxSize;
        const ctx = c.getContext("2d");
        // Center-crop to square
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" };
const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "var(--bg-card-alt)", color: "var(--text)" };
const readOnlyStyle = { ...inputStyle, background: "var(--bg-card-alt)", color: "var(--text-secondary)", cursor: "not-allowed" };
const cardStyle = { background: "var(--bg)", borderRadius: "var(--radius)", padding: "28px 28px 20px", maxWidth: 500, width: "100%", border: "1px solid var(--border)" };

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
  const [profileImage, setProfileImage] = useState(null);  // base64 data-URL
  const [imageUploading, setImageUploading] = useState(false);
  const imgInputRef = useRef(null);

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
    setProfileImage(userProfile.profileImage || null);
  }, [userProfile, user?.displayName]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please select an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("Image must be under 5 MB.");
    setImageUploading(true);
    setError("");
    try {
      const dataUrl = await resizeImage(file, 160);
      setProfileImage(dataUrl);
      // Save immediately to Firestore so it appears on Dashboard right away
      await setDoc(doc(db, "users", user.uid), { profileImage: dataUrl }, { merge: true });
      setSuccess("Profile photo updated!");
    } catch {
      setError("Failed to process image. Try another one.");
    } finally {
      setImageUploading(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const removeImage = async () => {
    setProfileImage(null);
    try {
      await setDoc(doc(db, "users", user.uid), { profileImage: "" }, { merge: true });
      setSuccess("Profile photo removed.");
    } catch { setError("Failed to remove photo."); }
  };

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
        name: name.trim(), age: ageNum, weight: wKg, weightUnit, originalWeight: wNum,
        height: hCm, heightUnit, originalHeight: hNum, dailyCalorieTarget: calNum, gender,
        profileComplete: true, lastActive: serverTimestamp(),
      }, { merge: true });
      setSuccess("Profile updated successfully!");
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally { setLoading(false); }
  };

  const displayWeight = userProfile?.originalWeight
    ? `${userProfile.originalWeight} ${userProfile.weightUnit || "kg"}`
    : userProfile?.weight ? `${userProfile.weight} kg` : "—";
  const displayHeight = userProfile?.originalHeight
    ? `${userProfile.originalHeight} ${userProfile.heightUnit || "cm"}`
    : userProfile?.height ? `${userProfile.height} cm` : "—";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: 20, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60, position: "relative" }}>
      <div style={{ position: "absolute", top: 18, right: 18 }}>
      </div>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--brand)", padding: 0, lineHeight: 1 }} title="Back to Dashboard">←</button>
          <h2 style={{ margin: 0, fontSize: 20, flex: 1, textAlign: "center", color: "var(--text)" }}>My Profile</h2>
          <div style={{ width: 28 }} />
        </div>

        {/* Avatar / user info */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ position: "relative", display: "inline-block", cursor: "pointer" }} onClick={() => imgInputRef.current?.click()} title="Click to change photo">
            {profileImage ? (
              <img src={profileImage} alt="Profile" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--brand)" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--surface-900, #1c1917)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", fontWeight: 700 }}>
                {(userProfile?.name || user?.displayName || user?.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", border: "2px solid var(--bg)", lineHeight: 1 }}>
              {imageUploading ? "…" : "📷"}
            </div>
          </div>
          <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
          {profileImage && (
            <div style={{ marginTop: 6 }}>
              <button onClick={(e) => { e.stopPropagation(); removeImage(); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
                Remove photo
              </button>
            </div>
          )}
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text)", marginTop: profileImage ? 4 : 10 }}>{userProfile?.name || user?.displayName || "—"}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user?.email}</div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: 10, borderRadius: 5, marginBottom: 16, fontSize: 14, borderLeft: "3px solid #2e7d32" }}>{success}</div>}

        {!editing ? (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Name</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{userProfile?.name || user?.displayName || "—"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
              <div><div style={labelStyle}>Age</div><div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{userProfile?.age || "—"}</div></div>
              <div><div style={labelStyle}>Gender</div><div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", textTransform: "capitalize" }}>{userProfile?.gender || "—"}</div></div>
              <div><div style={labelStyle}>Daily Calorie Target</div><div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{userProfile?.dailyCalorieTarget ? `${userProfile.dailyCalorieTarget} kcal` : "—"}</div></div>
              <div><div style={labelStyle}>Weight</div><div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{displayWeight}</div></div>
              <div><div style={labelStyle}>Height</div><div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{displayHeight}</div></div>
            </div>

            {/* AI Coach settings */}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={labelStyle}>AI Coach</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: "var(--text)" }}>{userProfile?.coachEnabled ? "✅ Enabled" : "❌ Disabled"}</span>
              </div>
              {userProfile?.coachEnabled && (
                <div>
                  <div style={labelStyle}>Coach Tone</div>
                  <div style={{ fontSize: 14, color: "var(--text)", textTransform: "capitalize" }}>
                    {userProfile?.coachTone === "strict" ? "🔥 Strict Coach"
                      : userProfile?.coachTone === "sarcastic" ? "😏 Sarcastic Buddy"
                      : userProfile?.coachTone === "motivational" ? "💪 Motivational"
                      : "😊 Friendly Trainer"}
                  </div>
                </div>
              )}
            </div>

            {/* Account info */}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={labelStyle}>Email</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>{user?.email}</div>
              <div style={labelStyle}>Member Since</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                {userProfile?.createdAt?.toDate ? userProfile.createdAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
              </div>
            </div>

            <button className="auth-button" onClick={() => { setEditing(true); setError(""); setSuccess(""); }} style={{ marginTop: 20 }}>Edit Profile</button>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: 10 }}>
              <label htmlFor="p-name" style={labelStyle}>Full Name <span style={{ color: "red" }}>*</span></label>
              <input type="text" id="p-name" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label htmlFor="p-age" style={labelStyle}>Age <span style={{ color: "red" }}>*</span></label><input type="number" id="p-age" min="10" max="120" value={age} onChange={(e) => setAge(e.target.value)} required style={inputStyle} /></div>
              <div><label htmlFor="p-gender" style={labelStyle}>Gender <span style={{ color: "red" }}>*</span></label><select id="p-gender" value={gender} onChange={(e) => setGender(e.target.value)} required style={{ ...inputStyle, background: "var(--bg-card)" }}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div><label htmlFor="p-cal" style={labelStyle}>Daily Calorie Target <span style={{ color: "red" }}>*</span></label><input type="number" id="p-cal" min="500" max="10000" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} required style={inputStyle} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginTop: 10 }}>
              <div><label htmlFor="p-wt" style={labelStyle}>Weight <span style={{ color: "red" }}>*</span></label><input type="number" id="p-wt" step="0.1" min="20" max="700" placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 154"} value={weight} onChange={(e) => setWeight(e.target.value)} required style={inputStyle} /></div>
              <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} style={{ height: 40, borderRadius: 5, border: "1px solid var(--border)", padding: "0 8px", fontSize: 14, background: "var(--bg-card)", color: "var(--text)" }}><option value="kg">kg</option><option value="lbs">lbs</option></select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end", marginTop: 10 }}>
              <div><label htmlFor="p-ht" style={labelStyle}>Height <span style={{ color: "red" }}>*</span></label><input type="number" id="p-ht" step="0.1" min={heightUnit === "ft" ? "1" : "50"} max={heightUnit === "ft" ? "10" : "300"} placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"} value={height} onChange={(e) => setHeight(e.target.value)} required style={inputStyle} /></div>
              <select value={heightUnit} onChange={(e) => setHeightUnit(e.target.value)} style={{ height: 40, borderRadius: 5, border: "1px solid var(--border)", padding: "0 8px", fontSize: 14, background: "var(--bg-card)", color: "var(--text)" }}><option value="cm">cm</option><option value="ft">ft</option></select>
            </div>
            <div style={{ marginTop: 12 }}><label style={labelStyle}>Email</label><input type="text" value={user?.email || ""} readOnly style={readOnlyStyle} /></div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="submit" className="auth-button" disabled={loading} style={{ marginBottom: 0 }}>{loading ? "Saving..." : "Save Changes"}</button>
              <button type="button" onClick={() => { setEditing(false); setError(""); setSuccess(""); }} disabled={loading}
                style={{ flex: 1, padding: "12px", background: "transparent", color: "var(--brand)", border: "1px solid var(--brand)", borderRadius: 5, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile;
