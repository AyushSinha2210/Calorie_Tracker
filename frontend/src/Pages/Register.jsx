import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

import { motion } from "framer-motion";

const sectionTitleCls = "text-xs font-bold text-brand-600 uppercase tracking-widest mt-6 mb-3 pb-1 border-b-2 border-brand-100";
const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5 ml-1";
const inpCls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-gray-400";
const selectCls = "h-[46px] rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer";

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
    <div className="space-y-4">
      <div className={sectionTitleCls}>Your Profile</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="age" className={labelCls}>Age</label>
          <input type="number" id="age" placeholder="e.g. 25" min="10" max="120" value={age} onChange={(e) => setAge(e.target.value)} className={inpCls} />
        </div>
        <div>
          <label htmlFor="calorieTarget" className={labelCls}>Daily Cal. Target</label>
          <input type="number" id="calorieTarget" placeholder="e.g. 2000" min="500" max="10000" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} className={inpCls} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label htmlFor="weight" className={labelCls}>Weight</label>
          <input type="number" id="weight" placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 154"} step="0.1" min="20" max="700" value={weight} onChange={(e) => setWeight(e.target.value)} className={inpCls} />
        </div>
        <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} className={selectCls}>
          <option value="kg">kg</option>
          <option value="lbs">lbs</option>
        </select>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label htmlFor="height" className={labelCls}>Height</label>
          <input type="number" id="height" placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 5.9"} step="0.1" min={heightUnit === "ft" ? "1" : "50"} max={heightUnit === "ft" ? "10" : "300"} value={height} onChange={(e) => setHeight(e.target.value)} className={inpCls} />
        </div>
        <select value={heightUnit} onChange={(e) => setHeightUnit(e.target.value)} className={selectCls}>
          <option value="cm">cm</option>
          <option value="ft">ft</option>
        </select>
      </div>
    </div>
  );

  // Google profile completion step
  if (step === "profile" && googleUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100 via-white to-white p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8 md:p-10">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Complete Profile</h2>
              <p className="text-gray-500 text-sm">Signed in as <strong className="text-brand-600">{googleUser.email}</strong></p>
            </div>
            <form onSubmit={handleGoogleProfileSave} className="space-y-5">
              {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 text-center">{error}</motion.div>}
              {profileFields}
              <button type="submit" disabled={loading} className="w-full py-3.5 mt-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md disabled:bg-gray-300 transition-all active:scale-[0.98]">
                {loading ? "Saving..." : "Save & Continue"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100 via-white to-white p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden my-8">
        <div className="p-8 md:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Create Account</h2>
            <p className="text-gray-500 text-sm">Start your fitness journey today</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 text-center">{error}</motion.div>}

            <div><label htmlFor="email" className={labelCls}>Email</label><input type="email" id="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inpCls} /></div>
            <div><label htmlFor="password" className={labelCls}>Password</label><input type="password" id="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inpCls} /></div>
            <div><label htmlFor="confirmPassword" className={labelCls}>Confirm Password</label><input type="password" id="confirmPassword" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inpCls} /></div>

            <div className="pt-2">{profileFields}</div>

            <button type="submit" disabled={loading} className="w-full py-3.5 mt-6 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md disabled:bg-gray-300 transition-all active:scale-[0.98]">
              {loading ? "Creating Account..." : "Register"}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">or sign up with</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <button onClick={handleGoogleSignUp} disabled={loading} className="w-full py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" /><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" /><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" /><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" /></g></svg>
            Sign up with Google
          </button>
        </div>

        <div className="bg-gray-50 border-t border-gray-100 p-6 text-center">
          <p className="text-gray-600 text-sm font-medium">Already have an account? <Link to="/login" className="text-brand-600 hover:text-brand-700 font-bold ml-1 hover:underline transition-all">Sign In</Link></p>
        </div>
      </motion.div>
    </div>
  );
}

export default Register;
