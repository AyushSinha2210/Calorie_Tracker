import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import BrandLogo from "../components/ui/BrandLogo";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err) {
      const code = err.code || "";
      if (code === "auth/user-not-found") setError("No account found with this email.");
      else if (code === "auth/invalid-email") setError("Please enter a valid email address.");
      else if (code === "auth/too-many-requests")
        setError("Too many attempts. Please try again later.");
      else setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-text p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-[420px] z-10"
      >
        <div className="flex justify-center mb-7">
          <BrandLogo size="lg" to="/" />
        </div>

        <div className="card p-8 bg-dark-surface/90 border-dark-border/80 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl mx-auto mb-4">
            🔑
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">Reset Password</h2>

          {!sent ? (
            <>
              <p className="text-dark-muted text-xs leading-relaxed mb-6">
                Enter your account email address and we'll send you a secure link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {error && (
                  <div className="bg-rose-500/10 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-500/20">
                    {error}
                  </div>
                )}
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-bold text-dark-muted uppercase tracking-wider mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    id="reset-email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-dark-border/80 bg-dark-surface-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-dark-text text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-lime-500 text-dark-bg font-extrabold rounded-xl text-xs transition-all shadow-glow btn-press cursor-pointer mt-2"
                >
                  {loading ? "Sending link…" : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <div className="text-3xl mb-2">✉️</div>
              <h3 className="text-sm font-bold text-emerald-400 mb-1">Email Sent!</h3>
              <p className="text-xs text-dark-muted leading-relaxed">
                Check inbox and spam folder for <strong>{email}</strong> and follow the link to choose a new password.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-dark-surface-2 border border-dark-border text-xs font-bold text-white hover:bg-dark-border transition-all"
              >
                Try another email
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mt-6 pt-5 border-t border-dark-border/60 text-xs">
            <Link to="/login" className="text-emerald-400 font-bold hover:underline">
              ← Back to Login
            </Link>
            <span className="text-dark-muted">·</span>
            <Link to="/register" className="text-dark-muted hover:text-white transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default ForgotPassword;
