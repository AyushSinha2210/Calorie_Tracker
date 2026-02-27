import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const FREQ_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const EmailSettings = () => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [time, setTime] = useState("20:00");       // HH:MM
  const [dayOfWeek, setDayOfWeek] = useState(1);    // 0=Sun..6=Sat (for weekly)
  const [dayOfMonth, setDayOfMonth] = useState(1);  // 1-28 (for monthly)
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Load existing preference
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        if (data?.emailReport) {
          setEnabled(data.emailReport.enabled ?? false);
          setFrequency(data.emailReport.frequency || "weekly");
          setTime(data.emailReport.time || "20:00");
          setDayOfWeek(data.emailReport.dayOfWeek ?? 1);
          setDayOfMonth(data.emailReport.dayOfMonth ?? 1);
        }
      } catch (e) {
        console.error("Failed to load email settings:", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [user]);

  const flash = useCallback((text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }, []);

  // Build a human-readable schedule summary
  const getScheduleSummary = () => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const timeStr = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    if (frequency === "daily") return `Every day at ${timeStr}`;
    if (frequency === "weekly") return `Every ${DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || "Mon"} at ${timeStr}`;
    return `${dayOfMonth}${dayOfMonth === 1 ? "st" : dayOfMonth === 2 ? "nd" : dayOfMonth === 3 ? "rd" : "th"} of each month at ${timeStr}`;
  };

  // Save preference to Firestore
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          emailReport: {
            enabled,
            frequency,
            time,
            dayOfWeek,
            dayOfMonth,
            email: user.email,
          },
        },
        { merge: true }
      );
      flash("Email preferences saved!");
    } catch (e) {
      flash("Failed to save: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Send report now
  const handleSendNow = async () => {
    if (!user) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/email-report/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
          frequency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      flash(`Report sent to ${user.email}!`);
    } catch (e) {
      flash(e.message, "error");
    } finally {
      setSending(false);
    }
  };

  if (!loaded) return null;

  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>📧 Email Reports</h2>
      <p style={styles.subtext}>
        Get a beautiful tabular report with your weight changes, daily calories, protein, and food log delivered to <strong>{user.email}</strong>.
      </p>

      {/* Enable toggle */}
      <div style={styles.toggleRow}>
        <span style={{ fontSize: "14px", fontWeight: 600 }}>Enable scheduled reports</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          style={{
            ...styles.toggle,
            background: enabled ? "#667eea" : "#ccc",
            border: "none",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              ...styles.toggleKnob,
              transform: enabled ? "translateX(20px)" : "translateX(2px)",
            }}
          />
        </button>
      </div>

      {/* Frequency selector */}
      <div style={{ marginTop: "16px" }}>
        <p style={styles.label}>Report frequency</p>
        <div style={styles.freqGrid}>
          {FREQ_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFrequency(opt.value)}
              style={{
                ...styles.freqBtn,
                borderColor: frequency === opt.value ? "#667eea" : "#ddd",
                background: frequency === opt.value ? "#f0f1ff" : "#fff",
                color: frequency === opt.value ? "#667eea" : "#555",
              }}
            >
              <strong>{opt.label}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule config */}
      <div style={styles.scheduleBox}>
        <p style={styles.label}>Schedule</p>

        {/* Time picker (always shown) */}
        <div style={styles.fieldRow}>
          <span style={styles.fieldLabel}>🕐 Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={styles.input}
          />
        </div>

        {/* Day of week (weekly only) */}
        {frequency === "weekly" && (
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>📅 Day</span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDayOfWeek(d.value)}
                  style={{
                    ...styles.dayBtn,
                    background: dayOfWeek === d.value ? "#667eea" : "#f0f1ff",
                    color: dayOfWeek === d.value ? "#fff" : "#555",
                    fontWeight: dayOfWeek === d.value ? 700 : 500,
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Day of month (monthly only) */}
        {frequency === "monthly" && (
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>📅 Date</span>
            <select
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
              style={styles.input}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {/* Schedule summary */}
        <div style={styles.summary}>
          📋 <strong>{getScheduleSummary()}</strong>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
        <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? "Saving…" : "Save Preferences"}
        </button>
        <button onClick={handleSendNow} disabled={sending} style={styles.sendBtn}>
          {sending ? "Sending…" : "📩 Send Report Now"}
        </button>
      </div>

      {/* Flash message */}
      {msg && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            background: msg.type === "error" ? "#fee" : "#e8f5e9",
            color: msg.type === "error" ? "#c0392b" : "#27ae60",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Info */}
      <div style={styles.info}>
        <strong>What's in the report?</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: "18px", lineHeight: "1.7" }}>
          <li>⚖️ Weight tracking with daily change</li>
          <li>📊 Day-wise calories &amp; protein summary</li>
          <li>🍽️ Detailed food log (name, quantity, calories, protein)</li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    border: "1px solid #eee",
    marginTop: "16px",
  },
  heading: {
    margin: "0 0 4px",
    fontSize: "18px",
    color: "#333",
  },
  subtext: {
    margin: "0 0 16px",
    fontSize: "13px",
    color: "#777",
    lineHeight: "1.5",
  },
  label: {
    margin: "0 0 8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#555",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: "#f8f9ff",
    borderRadius: "8px",
    cursor: "pointer",
  },
  toggle: {
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    position: "relative",
    transition: "background 0.2s",
    cursor: "pointer",
  },
  toggleKnob: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#fff",
    position: "absolute",
    top: "2px",
    transition: "transform 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  freqGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  freqBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px 8px",
    borderRadius: "8px",
    border: "2px solid",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
    transition: "all 0.2s",
  },
  scheduleBox: {
    marginTop: "16px",
    padding: "16px",
    background: "#f8f9ff",
    borderRadius: "10px",
    border: "1px solid #e8e9ff",
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  fieldLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#555",
    minWidth: "60px",
  },
  input: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid #ddd",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    background: "#fff",
  },
  dayBtn: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.15s",
  },
  summary: {
    marginTop: "4px",
    padding: "10px 14px",
    background: "#fff",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#667eea",
    border: "1px dashed #667eea44",
  },
  saveBtn: {
    padding: "10px 20px",
    background: "#667eea",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  sendBtn: {
    padding: "10px 20px",
    background: "#fff",
    color: "#667eea",
    border: "2px solid #667eea",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  info: {
    marginTop: "16px",
    padding: "14px",
    background: "#f8f9ff",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#555",
  },
};

export default EmailSettings;
