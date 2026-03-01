import { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, addDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const DAYS = 45;

const getStartDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - DAYS);
  return d.toISOString().split("T")[0];
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const WeightHistory = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newUnit, setNewUnit] = useState("kg");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [addingSaving, setAddingSaving] = useState(false);

  const startDate = useMemo(getStartDate, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "weightLogs"),
      where("date", ">=", startDate),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setLogs(items);
    });
  }, [user, startDate]);

  const handleDelete = async (id) => {
    if (deleting) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "weightLogs", id));
    } catch (err) {
      console.error("Failed to delete weight log:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleAddWeight = async () => {
    const val = Number.parseFloat(newWeight);
    if (!val || val <= 0 || val > 700) return;
    setAddingSaving(true);
    try {
      const weightKg = newUnit === "lbs" ? +(val * 0.453592).toFixed(1) : +val.toFixed(1);
      await addDoc(collection(db, "users", user.uid, "weightLogs"), {
        weight: weightKg,
        originalWeight: val,
        unit: newUnit,
        date: newDate,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", user.uid), {
        lastRecordedWeight: weightKg,
        lastWeightLogDate: newDate,
      }, { merge: true });
      setNewWeight("");
      setNewDate(new Date().toISOString().split("T")[0]);
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed to add weight:", err);
    } finally {
      setAddingSaving(false);
    }
  };

  // Compute change from previous entry
  const logsWithChange = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((log, i) => {
      const prev = i > 0 ? sorted[i - 1].weight : null;
      const change = prev != null ? +(log.weight - prev).toFixed(1) : null;
      return { ...log, change };
    }).reverse(); // back to desc for display
  }, [logs]);

  if (!logs.length) {
    return (
      <div style={container}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ ...heading, marginBottom: 0 }}>Weight History (Last 45 Days)</h3>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            style={{
              padding: "8px 16px",
              background: showAddForm ? "var(--bg-card)" : "var(--brand)",
              color: showAddForm ? "var(--text)" : "#fff",
              border: showAddForm ? "1px solid var(--border)" : "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {showAddForm ? "Cancel" : "+ Add Weight"}
          </button>
        </div>

        {showAddForm && (
          <div style={addFormContainer}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 120px" }}>
                <label style={addLabel}>Weight</label>
                <input type="number" placeholder="Enter weight" value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)} min="1" max="700" step="0.1" style={addInput} autoFocus />
              </div>
              <div style={{ flex: "0 0 80px" }}>
                <label style={addLabel}>Unit</label>
                <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={addSelect}>
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={addLabel}>Date</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]} style={addInput} />
              </div>
              <button onClick={handleAddWeight} disabled={addingSaving || !newWeight}
                style={{ padding: "10px 22px", background: "var(--brand)", color: "#fff", border: "none",
                  borderRadius: "8px", fontSize: "14px", fontWeight: 600,
                  cursor: addingSaving || !newWeight ? "not-allowed" : "pointer",
                  opacity: addingSaving || !newWeight ? 0.5 : 1, transition: "all 0.2s", whiteSpace: "nowrap" }}>
                {addingSaving ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </div>
        )}

        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>
          No weight entries yet. Click "+ Add Weight" or wait for your weekly check-in.
        </p>
      </div>
    );
  }

  const minW = Math.min(...logs.map((l) => l.weight));
  const maxW = Math.max(...logs.map((l) => l.weight));
  const avgW = (logs.reduce((s, l) => s + l.weight, 0) / logs.length).toFixed(1);
  const totalChange = logs.length > 1
    ? +(logsWithChange[0].weight - logsWithChange[logsWithChange.length - 1].weight).toFixed(1)
    : 0;

  return (
    <div style={container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ ...heading, marginBottom: 0 }}>Weight History (Last 45 Days)</h3>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            padding: "8px 16px",
            background: showAddForm ? "var(--bg-card)" : "var(--brand)",
            color: showAddForm ? "var(--text)" : "#fff",
            border: showAddForm ? "1px solid var(--border)" : "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {showAddForm ? "Cancel" : "+ Add Weight"}
        </button>
      </div>

      {/* Manual weight entry form */}
      {showAddForm && (
        <div style={addFormContainer}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 120px" }}>
              <label style={addLabel}>Weight</label>
              <input
                type="number"
                placeholder="Enter weight"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                min="1" max="700" step="0.1"
                style={addInput}
                autoFocus
              />
            </div>
            <div style={{ flex: "0 0 80px" }}>
              <label style={addLabel}>Unit</label>
              <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={addSelect}>
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label style={addLabel}>Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                style={addInput}
              />
            </div>
            <button
              onClick={handleAddWeight}
              disabled={addingSaving || !newWeight}
              style={{
                padding: "10px 22px",
                background: "var(--brand)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: addingSaving || !newWeight ? "not-allowed" : "pointer",
                opacity: addingSaving || !newWeight ? 0.5 : 1,
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {addingSaving ? "Saving…" : "Save Entry"}
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={summaryRow}>
        <div style={card}>
          <div style={cardLabel}>Current</div>
          <div style={cardValue}>{logsWithChange[0].weight} kg</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>Avg</div>
          <div style={cardValue}>{avgW} kg</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>Range</div>
          <div style={cardValue}>{minW}–{maxW} kg</div>
        </div>
        <div style={{ ...card, borderLeft: `3px solid ${totalChange <= 0 ? "#4CAF50" : "#f44336"}` }}>
          <div style={cardLabel}>Change</div>
          <div style={{ ...cardValue, color: totalChange <= 0 ? "#4CAF50" : "#f44336" }}>
            {totalChange > 0 ? "+" : ""}{totalChange} kg
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={{ ...th, textAlign: "right" }}>Weight (kg)</th>
              <th style={{ ...th, textAlign: "right" }}>Change</th>
              <th style={{ ...th, textAlign: "center", width: "50px" }}></th>
            </tr>
          </thead>
          <tbody>
            {logsWithChange.map((log) => (
              <tr key={log.id} style={row}>
                <td style={td}>{formatDate(log.date)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{log.weight}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {log.change != null ? (
                    <span style={{ color: log.change < 0 ? "#4CAF50" : log.change > 0 ? "#f44336" : "#888" }}>
                      {log.change > 0 ? "+" : ""}{log.change} kg
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <button
                    onClick={() => handleDelete(log.id)}
                    disabled={deleting === log.id}
                    title="Delete entry"
                    style={delBtn}
                  >
                    {deleting === log.id ? "…" : "✕"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "8px", textAlign: "center" }}>
        {logs.length} entr{logs.length === 1 ? "y" : "ies"} in the last 45 days
      </p>
    </div>
  );
};

/* ---- Styles ---- */

const container = { marginTop: "30px" };

const heading = { marginBottom: "14px", fontSize: "18px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.025em" };

const summaryRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: "10px",
  marginBottom: "16px",
};

const card = {
  background: "var(--bg-card)",
  borderRadius: "10px",
  padding: "14px 16px",
  border: "1px solid var(--border)",
  transition: "all 0.2s",
};

const cardLabel = { fontSize: "11px", color: "var(--text-muted)", marginBottom: "3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };

const cardValue = { fontSize: "18px", fontWeight: 700, color: "var(--text)" };

const tableWrap = {
  overflowX: "auto",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const th = {
  padding: "10px 12px",
  textAlign: "left",
  background: "var(--bg-card-alt)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--text-secondary)",
  borderBottom: "2px solid var(--border)",
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
};

const row = { transition: "background 0.15s" };

const delBtn = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "14px",
  padding: "2px 6px",
  borderRadius: "4px",
};

const addFormContainer = {
  background: "var(--bg-card)",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  padding: "16px 18px",
  marginBottom: "16px",
};

const addLabel = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
};

const addInput = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border)",
  fontSize: "14px",
  background: "var(--bg-input)",
  color: "var(--text)",
  boxSizing: "border-box",
};

const addSelect = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border)",
  fontSize: "14px",
  background: "var(--bg-input)",
  color: "var(--text)",
  cursor: "pointer",
  boxSizing: "border-box",
};

export default WeightHistory;
