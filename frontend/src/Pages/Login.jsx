import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

import { motion } from "framer-motion";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const saveUserToDB = async (user) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    await setDoc(ref, snap.exists() ? { lastLogin: serverTimestamp(), lastActive: serverTimestamp() } : { name: user.displayName, email: user.email, photo: user.photoURL, createdAt: serverTimestamp(), lastActive: serverTimestamp() }, { merge: true });
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
      await saveUserToDB(loggedInUser);
      navigate("/dashboard");
    } catch { setError("Invalid email or password."); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setError(""); setLoading(true);
    try {
      await saveUserToDB((await signInWithPopup(auth, googleProvider)).user);
      navigate("/dashboard");
    } catch (e) { setError(e.message || "Google login failed."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100 via-white to-white p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
      >
        <div className="p-8 md:p-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Welcome Back</h2>
            <p className="text-gray-500 text-sm">Sign in to continue your fitness journey</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 text-center">{error}</motion.div>}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Email</label>
              <input type="email" id="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-gray-400" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Password</label>
              <input type="password" id="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-gray-400" />
            </div>

            <div className="flex justify-end pt-1">
              <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors">Forgot Password?</Link>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md disabled:bg-gray-300 transition-all active:scale-[0.98]">
              {loading ? "Logging in..." : "Sign In"}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">or continue with</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <button onClick={handleGoogleLogin} disabled={loading} className="w-full py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" /><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" /><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" /><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" /></g></svg>
            Sign in with Google
          </button>
        </div>

        <div className="bg-gray-50 border-t border-gray-100 p-6 text-center">
          <p className="text-gray-600 text-sm font-medium">Don't have an account? <Link to="/register" className="text-brand-600 hover:text-brand-700 font-bold ml-1 hover:underline transition-all">Create Account</Link></p>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
