import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { motion } from "framer-motion";

const labelCls = "block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5";
const inpCls = "w-full px-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-surface-400 dark:placeholder:text-surface-600 text-surface-900 dark:text-surface-100 text-sm";
const selectCls = "h-[38px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer text-surface-900 dark:text-surface-100";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("form");
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
    <div className="space-y-3">
      <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mt-5 mb-2 pb-2 border-b border-surface-200 dark:border-surface-700 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
        Profile details
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="age" className={labelCls}>Age</label>
          <input type="number" id="age" placeholder="25" min="10" max="120" value={age} onChange={(e) => setAge(e.target.value)} className={inpCls} />
        </div>
        <div>
          <label htmlFor="calorieTarget" className={labelCls}>Calorie target</label>
          <input type="number" id="calorieTarget" placeholder="2000" min="500" max="10000" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} className={inpCls} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label htmlFor="weight" className={labelCls}>Weight</label>
          <input type="number" id="weight" placeholder={weightUnit === "kg" ? "70" : "154"} step="0.1" min="20" max="700" value={weight} onChange={(e) => setWeight(e.target.value)} className={inpCls} />
        </div>
        <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} className={selectCls}>
          <option value="kg">kg</option>
          <option value="lbs">lbs</option>
        </select>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label htmlFor="height" className={labelCls}>Height</label>
          <input type="number" id="height" placeholder={heightUnit === "cm" ? "175" : "5.9"} step="0.1" min={heightUnit === "ft" ? "1" : "50"} max={heightUnit === "ft" ? "10" : "300"} value={height} onChange={(e) => setHeight(e.target.value)} className={inpCls} />
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
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-4 relative">
        <div className="absolute inset-0 bg-mesh-light dark:bg-mesh-dark pointer-events-none" />
        <div className="absolute top-5 right-5 z-10"></div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="relative w-full max-w-[400px]">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold tracking-tight">FC</div>
              <span className="text-lg font-bold tracking-tight text-surface-900 dark:text-surface-100">FoodCal</span>
            </div>
          </div>
          <div className="card p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-50 tracking-tight">Complete your profile</h2>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-1.5">Signed in as <span className="font-medium text-surface-700 dark:text-surface-300">{googleUser.email}</span></p>
            </div>
            <form onSubmit={handleGoogleProfileSave} className="space-y-4">
              {error && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-lg text-sm border border-red-200 dark:border-red-900/50">{error}</motion.div>}
              {profileFields}
              <button type="submit" disabled={loading} className="w-full py-2.5 mt-2 bg-surface-900 dark:bg-surface-100 hover:bg-surface-800 dark:hover:bg-white text-white dark:text-surface-900 font-semibold rounded-lg text-sm disabled:opacity-50 transition-all active:scale-[0.98]">
                {loading ? "Saving..." : "Save & continue"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-4 relative">
      <div className="absolute inset-0 bg-mesh-light dark:bg-mesh-dark pointer-events-none" />
      <div className="absolute top-5 right-5 z-10"></div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="relative w-full max-w-[400px] my-8">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold tracking-tight">FC</div>
            <span className="text-lg font-bold tracking-tight text-surface-900 dark:text-surface-100">FoodCal</span>
          </Link>
        </div>

        <div className="card p-8">
          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-50 tracking-tight">Create your account</h2>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-1.5">Start tracking your fitness journey</p>
          </div>

          {/* Google button first */}
          <button onClick={handleGoogleSignUp} disabled={loading} className="w-full py-2.5 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium rounded-lg text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 active:scale-[0.98]">
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" /><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" /><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" /><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" /></g></svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center">
            <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
            <span className="px-4 text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
          </div>

          <form onSubmit={handleRegister} className="space-y-3">
            {error && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-lg text-sm border border-red-200 dark:border-red-900/50">{error}</motion.div>}

            <div><label htmlFor="email" className={labelCls}>Email</label><input type="email" id="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inpCls} /></div>
            <div>
              <label htmlFor="password" className={labelCls}>Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} id="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className={inpCls + " pr-10"} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 transition-colors" tabIndex={-1}>
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelCls}>Confirm password</label>
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} id="confirmPassword" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inpCls + " pr-10"} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 transition-colors" tabIndex={-1}>
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {profileFields}

            <button type="submit" disabled={loading} className="w-full py-2.5 mt-3 bg-surface-900 dark:bg-surface-100 hover:bg-surface-800 dark:hover:bg-white text-white dark:text-surface-900 font-semibold rounded-lg text-sm disabled:opacity-50 transition-all active:scale-[0.98]">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-500 dark:text-surface-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-surface-900 dark:text-surface-100 font-semibold hover:underline underline-offset-2 transition-all">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Register;
