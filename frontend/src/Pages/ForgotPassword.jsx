import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";

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
      else if (code === "auth/too-many-requests") setError("Too many attempts. Please try again later.");
      else setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.iconCircle}>🔑</div>
        <h2 style={styles.heading}>Reset Password</h2>

        {!sent ? (
          <>
            <p style={styles.subtext}>
              Enter the email address associated with your account and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit}>
              {error && <div style={styles.error}>{error}</div>}
              <div style={styles.field}>
                <label htmlFor="reset-email" style={styles.label}>Email address</label>
                <input
                  type="email"
                  id="reset-email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
              <button type="submit" disabled={loading} style={styles.button}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div style={styles.successBox}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>✉️</div>
            <h3 style={{ margin: "0 0 8px", color: "#27ae60" }}>Email Sent!</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#555", lineHeight: "1.6" }}>
              We've sent a password reset link to <strong>{email}</strong>. Check your inbox (and spam folder) and click the link to set a new password.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              style={{ ...styles.button, background: "#f0f1ff", color: "#667eea", marginTop: "16px" }}
            >
              Send to a different email
            </button>
          </div>
        )}

        <div style={styles.links}>
          <Link to="/login" style={styles.link}>← Back to Login</Link>
          <span style={{ color: "#ccc" }}>|</span>
          <Link to="/register" style={styles.link}>Create Account</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "36px 32px",
    maxWidth: "420px",
    width: "100%",
    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    textAlign: "center",
  },
  iconCircle: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    fontSize: "28px",
  },
  heading: {
    margin: "0 0 8px",
    fontSize: "22px",
    color: "#333",
  },
  subtext: {
    margin: "0 0 20px",
    fontSize: "14px",
    color: "#777",
    lineHeight: "1.5",
  },
  field: {
    textAlign: "left",
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#555",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "8px",
    border: "1.5px solid #ddd",
    fontSize: "15px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.15s",
  },
  error: {
    background: "#fee",
    color: "#c33",
    padding: "10px 14px",
    borderRadius: "8px",
    marginBottom: "16px",
    fontSize: "13px",
    borderLeft: "3px solid #c33",
    textAlign: "left",
  },
  successBox: {
    padding: "20px",
    background: "#f0faf0",
    borderRadius: "12px",
    marginBottom: "16px",
  },
  links: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    marginTop: "20px",
    fontSize: "13px",
  },
  link: {
    color: "#667eea",
    textDecoration: "none",
    fontWeight: 600,
  },
};

export default ForgotPassword;
