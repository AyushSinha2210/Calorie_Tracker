import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { motion } from "framer-motion";
import BrandLogo from "../components/ui/BrandLogo";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-dark-border/80 bg-dark-surface-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-dark-muted/60 text-dark-text text-sm";
const labelCls = "block text-xs font-bold text-dark-muted uppercase tracking-wider mb-1.5";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const saveUserToDB = async (user) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          name: user.displayName || "",
          email: user.email || "",
          photo: user.photoURL || "",
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          profileComplete: false,
        },
        { merge: true }
      );
      return false;
    } else {
      await setDoc(
        ref,
        { lastLogin: serverTimestamp(), lastActive: serverTimestamp() },
        { merge: true }
      );
      return !!snap.data()?.profileComplete;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user: loggedInUser } = await signInWithEmailAndPassword(auth, email, password);
      if (!loggedInUser.emailVerified) {
        navigate("/verify-email");
        return;
      }
      const isComplete = await saveUserToDB(loggedInUser);
      navigate(isComplete ? "/dashboard" : "/profile-setup");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isComplete = await saveUserToDB(cred.user);
      navigate(isComplete ? "/dashboard" : "/profile-setup");
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completing.");
      } else {
        setError(e.message || "Google login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-text p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[420px] z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-7">
          <BrandLogo size="lg" to="/" />
        </div>

        <div className="card p-8 bg-dark-surface/90 border-dark-border/80 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Welcome back</h2>
            <p className="text-dark-muted text-xs mt-1">Sign in to your FoodCal dashboard</p>
          </div>

          {/* Google Sign-in */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-2.5 bg-dark-surface-2 hover:bg-dark-surface-2/80 border border-dark-border text-dark-text font-bold rounded-xl text-xs flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 btn-press cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path
                  fill="#4285F4"
                  d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                />
                <path
                  fill="#34A853"
                  d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                />
                <path
                  fill="#FBBC05"
                  d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                />
                <path
                  fill="#EA4335"
                  d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                />
              </g>
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center">
            <div className="flex-1 h-px bg-dark-border" />
            <span className="px-3 text-[10px] font-bold text-dark-muted uppercase tracking-wider">
              or with email
            </span>
            <div className="flex-1 h-px bg-dark-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-500/20"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label htmlFor="email" className={labelCls}>
                Email address
              </label>
              <input
                type="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className={labelCls}>
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputCls + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-lime-500 hover:opacity-95 text-dark-bg font-extrabold rounded-xl text-xs transition-all shadow-glow btn-press cursor-pointer mt-2"
            >
              {loading ? "Signing in..." : "Sign in to FoodCal"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-dark-muted mt-6">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-emerald-400 font-bold hover:underline underline-offset-4 transition-all"
          >
            Create one free
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;
