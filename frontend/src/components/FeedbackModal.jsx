import { useState } from "react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const modalBg = {
  position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "var(--overlay)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center"
};
const modalCard = {
  background: "var(--bg)", borderRadius: "var(--radius)", padding: 28, minWidth: 340, maxWidth: 400, boxShadow: "0 24px 48px rgba(0,0,0,0.12)", border: "1px solid var(--border)",
};

export default function FeedbackModal({ open, onClose }) {
  const { user, userProfile } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!text.trim()) return setError("Feedback cannot be empty.");
    setLoading(true);
    try {
      await addDoc(collection(db, "feedbacks"), {
        text: text.trim(),
        uid: user?.uid || null,
        email: user?.email || null,
        name: userProfile?.name || user?.displayName || null,
        createdAt: serverTimestamp(),
      });
      setSuccess("Thank you for your feedback!");
      setText("");
      setTimeout(() => { setSuccess(""); onClose(); }, 1200);
    } catch (err) {
      setError("Failed to send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalBg}>
      <div style={modalCard}>
        <h2 style={{ margin: 0, fontSize: 20, marginBottom: 10, color: "var(--text)" }}>Send Feedback</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            placeholder="Your feedback..."
            style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 6, fontSize: 15, resize: "vertical", marginBottom: 12, background: "var(--bg-input)", color: "var(--text)" }}
            disabled={loading}
            maxLength={1000}
            required
          />
          {error && <div style={{ color: "#c33", marginBottom: 8 }}>{error}</div>}
          {success && <div style={{ color: "#2e7d32", marginBottom: 8 }}>{success}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="submit" className="auth-button" disabled={loading} style={{ flex: 1 }}>
              {loading ? "Sending..." : "Send"}
            </button>
            <button type="button" onClick={onClose} disabled={loading} style={{ flex: 1, background: "var(--bg-card-alt)", color: "var(--text)", border: "none", borderRadius: 5, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
