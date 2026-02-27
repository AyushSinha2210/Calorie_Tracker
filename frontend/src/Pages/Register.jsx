import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const sectionTitle = {
  fontSize: 13, fontWeight: 700, color: "#667eea", textTransform: "uppercase",
  letterSpacing: 1, margin: "18px 0 8px", paddingBottom: 4,
  borderBottom: "2px solid rgba(102,126,234,0.15)",
};

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Google sign-up: step 1 = google auth, step 2 = profile fields
  const [step, setStep] = useState("form"); // "form" | "profile"
  const [googleUser, setGoogleUser] = useState(null);

  const navigate = useNavigate();

  const buildProfile = () => {
    const profile = {};
    if (age) profile.age = Number(age);
    if (weight) {
      const wKg = weightUnit === "lbs" ? +(Number(weight) * 0.453592).toFixed(1) : +Number(weight).toFixed(1);
      profile.weight = wKg;
      profile.weightUnit = weightUnit;
      profile.originalWeight = Number(weight);
    }
    if (height) {
      const hCm = heightUnit === "ft" ? +(Number(height) * 30.48).toFixed(1) : +Number(height).toFixed(1);
      profile.height = hCm;
      profile.heightUnit = heightUnit;
      profile.originalHeight = Number(height);
    }
    if (calorieTarget) profile.dailyCalorieTarget = Number(calorieTarget);
    return profile;
  };

  const saveUserToDB = async (user, extra = {}) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const profile = buildProfile();
    const hasProfile = !!(profile.age && profile.weight && profile.height && profile.dailyCalorieTarget);
    if (hasProfile) profile.profileComplete = true;
    await setDoc(
      ref,
      snap.exists()
        ? { lastLogin: serverTimestamp(), lastActive: serverTimestamp(), ...profile, ...extra }
        : { name: user.displayName, email: user.email, photo: user.photoURL, createdAt: serverTimestamp(), lastActive: serverTimestamp(), ...profile, ...extra },
      { merge: true },
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await saveUserToDB(newUser);
      await sendEmailVerification(newUser);
      navigate("/verify-email");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    setError(""); setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setGoogleUser(result.user);
      setStep("profile");
    } catch (e) { setError(e.message || "Google sign-up failed."); }
    finally { setLoading(false); }
  };

  const handleGoogleProfileSave = async (e) => {
    e.preventDefault();
    if (!googleUser) return;
    setError(""); setLoading(true);
    try {
      await saveUserToDB(googleUser);
      navigate("/dashboard");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const profileFields = (
    <>
      <div style={sectionTitle}>Your Profile</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label htmlFor="age">Age</label>
          <input type="number" id="age" placeholder="e.g. 25" min="10" max="120" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div>
          <label htmlFor="calorieTarget">Daily Calorie Target</label>
          <input type="number" id="calorieTarget" placeholder="e.g. 2000" min="500" max="10000" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label htmlFor="weight">Weight</label>
          <input type="number" id="weight" placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 154"} step="0.1" min="20" max="700" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} style={{ height: 40, borderRadius: 5, border: "1px solid #ddd", padding: "0 8px", fontSize: 14 }}>
          <option value="kg">kg</option>
          <option value="lbs">lbs</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label htmlFor="height">Height</label>
          <input type="number" id="height" placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"} step="0.1" min={heightUnit === "ft" ? "1" : "50"} max={heightUnit === "ft" ? "10" : "300"} value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
        <select value={heightUnit} onChange={(e) => setHeightUnit(e.target.value)} style={{ height: 40, borderRadius: 5, border: "1px solid #ddd", padding: "0 8px", fontSize: 14 }}>
          <option value="cm">cm</option>
          <option value="ft">ft</option>
        </select>
      </div>
    </>
  );

  // Google profile completion step
  if (step === "profile" && googleUser) {
    return (
      <div><div>
        <h2>Complete Your Profile</h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 12 }}>
          Signed in as <strong>{googleUser.email}</strong>. Fill in your details to get started.
        </p>
        <form onSubmit={handleGoogleProfileSave}>
          {error && <div>{error}</div>}
          {profileFields}
          <button type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div></div>
    );
  }

  return (
    <div><div>
      <h2>Create Account</h2>
      <form onSubmit={handleRegister}>
        {error && <div>{error}</div>}
        <div><label htmlFor="email">Email</label><input type="email" id="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label htmlFor="password">Password</label><input type="password" id="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div><label htmlFor="confirmPassword">Confirm Password</label><input type="password" id="confirmPassword" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
        {profileFields}
        <button type="submit" disabled={loading} style={{ marginTop: 16 }}>{loading ? "Creating Account..." : "Register"}</button>
      </form>
      <div>OR</div>
      <button onClick={handleGoogleSignUp} disabled={loading}>{loading ? "Signing up..." : "Sign up with Google"}</button>
      <p>Already have an account? <Link to="/login">Login here</Link></p>
    </div></div>
  );
}

export default Register;
