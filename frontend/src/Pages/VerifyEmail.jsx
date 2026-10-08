import { useState, useEffect } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BrandLogo from "../components/ui/BrandLogo";

function VerifyEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.emailVerified) navigate("/dashboard");
  }, [user, navigate]);

  const handleResend = async () => {
    setResending(true);
    setMessage("");
    try {
      await sendEmailVerification(user);
      setMessage("Verification email sent! Check your inbox.");
    } catch (err) {
      setMessage(
        err.code === "auth/too-many-requests"
          ? "Too many attempts. Please wait a few minutes."
          : "Failed to send email. Try again later."
      );
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerification = async () => {
    setChecking(true);
    setMessage("");
    try {
      await user.reload();
      if (auth.currentUser.emailVerified) {
        navigate("/dashboard");
      } else {
        setMessage("Email not verified yet. Please check your inbox and click the link.");
      }
    } catch {
      setMessage("Could not check verification status. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (!user) return null;

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
            📧
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
            Verify Your Email
          </h2>
          <p className="text-dark-muted text-xs leading-relaxed mb-6">
            We sent a verification link to <strong className="text-emerald-400">{user.email}</strong>. Please check your inbox and click the link to activate your FoodCal account.
          </p>

          {message && (
            <div className="mb-4 p-3 rounded-xl bg-dark-surface-2 border border-dark-border text-xs text-dark-text">
              {message}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-lime-500 text-dark-bg font-extrabold rounded-xl text-xs transition-all shadow-glow btn-press cursor-pointer"
            >
              {checking ? "Checking Status…" : "I've verified — continue to App →"}
            </button>

            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 bg-dark-surface-2 hover:bg-dark-border text-dark-text font-bold rounded-xl text-xs transition-all border border-dark-border btn-press cursor-pointer"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-2 text-dark-muted hover:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
            >
              Sign out / Use another account
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default VerifyEmail;
