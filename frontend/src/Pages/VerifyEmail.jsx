import { useState, useEffect } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";

function VerifyEmail() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);

  // If no user or already verified, redirect
  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.emailVerified) navigate("/dashboard");
  }, [user, navigate]);

  const handleResend = async () => {
    setResending(true);
    setMessage("");
    try {
      await sendEmailVerification(user);
      setMessage("Verification email sent! Check your inbox.");
    } catch (err) {
      setMessage(err.code === "auth/too-many-requests"
        ? "Too many attempts. Please wait a few minutes."
        : "Failed to send email. Try again later.");
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
    <div style={wrapper}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <BrandLogo />
        </div>
        <div style={{ fontSize: "48px", textAlign: "center", marginBottom: "10px" }}>📧</div>
        <h2 style={{ margin: "0 0 8px", textAlign: "center", color: "var(--text)" }}>Verify Your Email</h2>
        <p style={{ color: "var(--text-secondary)", textAlign: "center", margin: "0 0 20px", fontSize: "14px" }}>
          We sent a verification link to <strong>{user.email}</strong>. Please check your inbox and click the link to activate your account.
        </p>

        {message && (
          <div style={msgBox}>{message}</div>
        )}

        <button onClick={handleCheckVerification} disabled={checking} style={primaryBtn}>
          {checking ? "Checking…" : "I've verified — continue"}
        </button>

        <button onClick={handleResend} disabled={resending} style={secondaryBtn}>
          {resending ? "Sending…" : "Resend verification email"}
        </button>

        <button onClick={handleLogout} style={linkBtn}>
          Use a different account
        </button>
      </div>
    </div>
  );
}

const wrapper = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "20px",
  background: "var(--bg)",
};

const card = {
  maxWidth: "420px",
  width: "100%",
  padding: "36px 32px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--bg)",
};

const msgBox = {
  background: "var(--bg-card-alt)",
  color: "var(--text)",
  padding: "10px 14px",
  borderRadius: "6px",
  marginBottom: "16px",
  fontSize: "13px",
  textAlign: "center",
  border: "1px solid var(--border)",
};

const primaryBtn = {
  width: "100%",
  padding: "12px",
  background: "var(--surface-900, #1c1917)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: "10px",
};

const secondaryBtn = {
  width: "100%",
  padding: "10px",
  background: "var(--bg-card-alt)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "14px",
  cursor: "pointer",
  marginBottom: "10px",
};

const linkBtn = {
  width: "100%",
  padding: "8px",
  background: "none",
  color: "var(--text-muted)",
  border: "none",
  fontSize: "13px",
  cursor: "pointer",
  textDecoration: "underline",
};

export default VerifyEmail;
