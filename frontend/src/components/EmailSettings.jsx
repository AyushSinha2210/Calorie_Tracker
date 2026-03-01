import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, setDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import API_URL from "../config";

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

// Helper: get date range based on frequency
function getDateRange(freq) {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start;
  if (freq === "daily") {
    start = end;
  } else if (freq === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    start = d.toISOString().split("T")[0];
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    start = d.toISOString().split("T")[0];
  }
  return { start, end };
}

const EmailSettings = () => {
  const { user, userProfile } = useAuth();
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

  // Send report now — fetches data from Firestore client SDK and sends to server
  const handleSendNow = async () => {
    if (!user) return;
    setSending(true);
    try {
      const { start, end } = getDateRange(frequency);
      const uid = user.uid;

      // Fetch food logs, weight logs, and workout logs from Firestore client SDK
      const [foodSnap, weightSnap, workoutSnap] = await Promise.all([
        getDocs(query(
          collection(db, "users", uid, "foodLogs"),
          where("date", ">=", start), where("date", "<=", end), orderBy("date", "asc")
        )),
        getDocs(query(
          collection(db, "users", uid, "weightLogs"),
          where("date", ">=", start), where("date", "<=", end), orderBy("date", "asc")
        )),
        getDocs(query(
          collection(db, "users", uid, "workoutLogs"),
          where("date", ">=", start), where("date", "<=", end), orderBy("date", "asc")
        )),
      ]);

      const foodLogs = foodSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const weightLogs = weightSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const workoutLogs = workoutSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const res = await fetch(`${API_URL}/email-report/send-with-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName || user.email,
          frequency,
          foodLogs,
          weightLogs,
          workoutLogs,
          maintenanceCalories: (() => {
            if (!userProfile?.weight || !userProfile?.height || !userProfile?.age) return 0;
            const w = Number(userProfile.weight), h = Number(userProfile.height), a = Number(userProfile.age);
            const offset = userProfile.gender === "female" ? -161 : 5;
            return Math.round((10 * w + 6.25 * h - 5 * a + offset) * 1.55);
          })(),
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
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>Enable scheduled reports</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          style={{
            ...styles.toggle,
            background: enabled ? "var(--brand)" : "var(--border)",
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
                borderColor: frequency === opt.value ? "var(--brand)" : "var(--border)",
                background: frequency === opt.value ? "var(--brand-light)" : "var(--bg-card)",
                color: frequency === opt.value ? "var(--brand)" : "var(--text-secondary)",
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
                    background: dayOfWeek === d.value ? "var(--brand)" : "var(--brand-light)",
                    color: dayOfWeek === d.value ? "#fff" : "var(--text-secondary)",
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
    background: "var(--bg)",
    borderRadius: "var(--radius)",
    padding: "24px",
    border: "1px solid var(--border)",
    marginTop: "16px",
  },
  heading: {
    margin: "0 0 4px",
    fontSize: "18px",
    color: "var(--text)",
    letterSpacing: "-0.025em",
  },
  subtext: {
    margin: "0 0 16px",
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: "1.5",
  },
  label: {
    margin: "0 0 8px",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: "var(--bg-card-alt)",
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
    background: "var(--bg-card-alt)",
    borderRadius: "10px",
    border: "1px solid var(--border)",
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
    color: "var(--text-secondary)",
    minWidth: "60px",
  },
  input: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--border)",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    background: "var(--bg-input)",
    color: "var(--text)",
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
    background: "var(--bg-card)",
    borderRadius: "8px",
    fontSize: "13px",
    color: "var(--brand)",
    border: "1px dashed var(--border)",
  },
  saveBtn: {
    padding: "10px 22px",
    background: "var(--surface-900, #1c1917)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  sendBtn: {
    padding: "10px 22px",
    background: "var(--bg-card)",
    color: "var(--brand)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  info: {
    marginTop: "16px",
    padding: "14px",
    background: "var(--bg-card-alt)",
    borderRadius: "8px",
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
};

export default EmailSettings;
