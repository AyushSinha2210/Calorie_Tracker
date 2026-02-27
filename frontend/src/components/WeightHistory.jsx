import { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
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
        <h3 style={heading}>Weight History (Last 45 Days)</h3>
        <p style={{ color: "#888", textAlign: "center", padding: "30px 0" }}>
          No weight entries yet. Your weekly check-ins will appear here.
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
      <h3 style={heading}>Weight History (Last 45 Days)</h3>

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
                    <span style={{ color: "#ccc" }}>—</span>
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
      <p style={{ color: "#aaa", fontSize: "12px", marginTop: "8px", textAlign: "center" }}>
        {logs.length} entr{logs.length === 1 ? "y" : "ies"} in the last 45 days
      </p>
    </div>
  );
};

/* ---- Styles ---- */

const container = { marginTop: "30px" };

const heading = { marginBottom: "14px", fontSize: "18px" };

const summaryRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: "10px",
  marginBottom: "16px",
};

const card = {
  background: "#f8f9fa",
  borderRadius: "8px",
  padding: "12px 14px",
};

const cardLabel = { fontSize: "12px", color: "#888", marginBottom: "2px" };

const cardValue = { fontSize: "18px", fontWeight: 700 };

const tableWrap = {
  overflowX: "auto",
  borderRadius: "8px",
  border: "1px solid #eee",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const th = {
  padding: "10px 12px",
  textAlign: "left",
  background: "#f5f5f5",
  fontWeight: 600,
  fontSize: "13px",
  color: "#555",
  borderBottom: "2px solid #eee",
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid #f0f0f0",
};

const row = { transition: "background 0.15s" };

const delBtn = {
  background: "none",
  border: "none",
  color: "#ccc",
  cursor: "pointer",
  fontSize: "14px",
  padding: "2px 6px",
  borderRadius: "4px",
};

export default WeightHistory;
