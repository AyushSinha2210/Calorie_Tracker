import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { motion } from "framer-motion";
import BrandLogo from "../components/ui/BrandLogo";

const labelCls = "block text-xs font-bold text-dark-muted uppercase tracking-wider mb-1";
const inpCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-dark-border/80 bg-dark-surface-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-dark-muted/60 text-dark-text text-sm";
const selectCls =
  "h-[42px] rounded-xl border border-dark-border/80 bg-dark-surface-2 px-3 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer text-dark-text";

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
    profile.profileComplete = hasProfile;
    await setDoc(
      ref,
      snap.exists()
        ? { lastLogin: serverTimestamp(), lastActive: serverTimestamp(), ...profile, ...extra }
        : {
            name: user.displayName || "",
            email: user.email || "",
            photo: user.photoURL || "",
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            ...profile,
            ...extra,
          },
      { merge: true }
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
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, "users", result.user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data()?.profileComplete) {
        navigate("/dashboard");
      } else {
        setGoogleUser(result.user);
        setStep("profile");
      }
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user") {
        setError("Sign-up popup was closed before completing.");
      } else {
        setError(e.message || "Google sign-up failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleProfileSave = async (e) => {
    e.preventDefault();
    if (!googleUser) return;
    setError("");
    setLoading(true);
    try {
      await saveUserToDB(googleUser);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const profileFields = (
    <div className="space-y-3 pt-2">
      <div className="text-[11px] font-bold text-dark-muted uppercase tracking-wider mb-2 pb-1.5 border-b border-dark-border/60 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Optional Profile Details
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

  if (step === "profile" && googleUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-text p-4 relative overflow-hidden">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-[420px] z-10">
          <div className="flex justify-center mb-7">
            <BrandLogo size="lg" to="/" />
          </div>
          <div className="card p-8 bg-dark-surface/90 border-dark-border/80 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Complete your profile</h2>
              <p className="text-dark-muted text-xs mt-1">Signed in as <span className="text-emerald-400 font-semibold">{googleUser.email}</span></p>
            </div>
            <form onSubmit={handleGoogleProfileSave} className="space-y-4">
              {error && <div className="bg-rose-500/10 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-500/20">{error}</div>}
              {profileFields}
              <button type="submit" disabled={loading} className="w-full py-3 mt-3 bg-gradient-to-r from-emerald-500 to-lime-500 text-dark-bg font-extrabold rounded-xl text-xs transition-all shadow-glow btn-press cursor-pointer">
                {loading ? "Saving..." : "Save & continue to Dashboard"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-text p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-[420px] my-8 z-10">
        <div className="flex justify-center mb-7">
          <BrandLogo size="lg" to="/" />
        </div>

        <div className="card p-8 bg-dark-surface/90 border-dark-border/80 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Create your account</h2>
            <p className="text-dark-muted text-xs mt-1">Start tracking nutrition & workouts with AI</p>
          </div>

          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full py-2.5 bg-dark-surface-2 hover:bg-dark-surface-2/80 border border-dark-border text-dark-text font-bold rounded-xl text-xs flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 btn-press cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
              </g>
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center">
            <div className="flex-1 h-px bg-dark-border" />
            <span className="px-3 text-[10px] font-bold text-dark-muted uppercase tracking-wider">or with email</span>
            <div className="flex-1 h-px bg-dark-border" />
          </div>

          <form onSubmit={handleRegister} className="space-y-3">
            {error && <div className="bg-rose-500/10 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-500/20">{error}</div>}

            <div>
              <label htmlFor="email" className={labelCls}>Email address</label>
              <input type="email" id="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inpCls} />
            </div>

            <div>
              <label htmlFor="password" className={labelCls}>Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} id="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className={inpCls + " pr-10"} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text" tabIndex={-1}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelCls}>Confirm password</label>
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} id="confirmPassword" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inpCls + " pr-10"} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text" tabIndex={-1}>
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {profileFields}

            <button type="submit" disabled={loading} className="w-full py-3 mt-4 bg-gradient-to-r from-emerald-500 to-lime-500 text-dark-bg font-extrabold rounded-xl text-xs transition-all shadow-glow btn-press cursor-pointer">
              {loading ? "Creating account..." : "Create FoodCal Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-dark-muted mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-400 font-bold hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Register;
