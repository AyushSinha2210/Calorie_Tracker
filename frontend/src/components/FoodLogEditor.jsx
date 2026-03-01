import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const MEAL_TYPES = ["Breakfast", "Lunch", "Evening Snacks", "Dinner", "Late Night", "Others"];
const MEAL_COLORS = { Breakfast: "#FF9800", Lunch: "#4CAF50", "Evening Snacks": "#10b981", Dinner: "#2196F3", "Late Night": "#607D8B", Others: "#795548" };

const FoodLogEditor = ({ onDataChanged }) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [logs, setLogs] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [expandedGroupId, setExpandedGroupId] = useState(null);

  // Listen to food logs for the selected date
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "foodLogs"),
      where("date", "==", selectedDate)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      // Sort by createdAt
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return ta - tb;
      });
      setLogs(items);
    });
    return unsub;
  }, [user, selectedDate]);

  const startEditing = (log) => {
    setEditingId(log.id);
    if (log.items && log.items.length > 0) {
      // Grouped entry — edit sub-items
      setEditValues({
        isGroup: true,
        mealType: log.mealType || "Others",
        items: log.items.map((it) => ({
          name: it.name || "", quantity: it.quantity || "",
          calories: it.calories || 0, protein: it.protein || 0,
        })),
      });
    } else {
      setEditValues({
        isGroup: false,
        itemName: log.itemName || "",
        quantity: log.quantity || "",
        calories: log.calories || 0,
        protein: log.protein || 0,
        mealType: log.mealType || "Others",
      });
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const ref = doc(db, "users", user.uid, "foodLogs", editingId);
      if (editValues.isGroup) {
        const items = editValues.items.map((it) => ({
          name: it.name, quantity: it.quantity,
          calories: Number(it.calories) || 0, protein: Number(it.protein) || 0,
        }));
        const totalCal = items.reduce((s, i) => s + i.calories, 0);
        const totalPro = Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10;
        await updateDoc(ref, {
          items,
          itemName: items.map((i) => i.name).join(", "),
          calories: totalCal,
          protein: totalPro,
          quantity: `${items.length} item${items.length !== 1 ? "s" : ""}`,
          mealType: editValues.mealType || "Others",
        });
      } else {
        await updateDoc(ref, {
          itemName: editValues.itemName,
          quantity: editValues.quantity,
          calories: Number(editValues.calories) || 0,
          protein: Number(editValues.protein) || 0,
          mealType: editValues.mealType || "Others",
        });
      }
      setEditingId(null);
      setEditValues({});
      if (onDataChanged) onDataChanged();
    } catch {
      alert("Failed to update food log");
    } finally {
      setSaving(false);
    }
  };

  const deleteLog = async (logId) => {
    if (!window.confirm("Delete this food entry?")) return;
    setDeleting(logId);
    try {
      await deleteDoc(doc(db, "users", user.uid, "foodLogs", logId));
      if (onDataChanged) onDataChanged();
    } catch {
      alert("Failed to delete food log");
    } finally {
      setDeleting(null);
    }
  };

  const changeField = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const changeGroupItem = (index, field, value) => {
    setEditValues((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: field === "calories" || field === "protein" ? Number(value) : value };
      return { ...prev, items };
    });
  };

  const removeGroupItem = (index) => {
    setEditValues((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      if (items.length === 0) { cancelEditing(); return prev; }
      return { ...prev, items };
    });
  };

  // Navigate dates
  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().split("T")[0];
    // Don't go into the future
    if (iso > new Date().toISOString().split("T")[0]) return;
    setSelectedDate(iso);
    setEditingId(null);
  };

  const prettyDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return d.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  };

  const totalCal = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalPro = logs.reduce((s, l) => s + (l.protein || 0), 0);

  // Group logs by meal type
  const grouped = MEAL_TYPES.reduce((acc, mt) => {
    const items = logs.filter((l) => (l.mealType || "Others") === mt);
    if (items.length > 0) acc.push({ mealType: mt, items });
    return acc;
  }, []);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📝 Edit Food Logs</h3>

      {/* Date Navigator */}
      <div style={styles.dateNav}>
        <button onClick={() => shiftDate(-1)} style={styles.navBtn}>◀ Prev</button>
        <div style={styles.dateDisplay}>
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => { setSelectedDate(e.target.value); setEditingId(null); }}
            style={styles.dateInput}
          />
          <span style={styles.dateLabel}>{prettyDate(selectedDate)}</span>
        </div>
        <button
          onClick={() => shiftDate(1)}
          style={styles.navBtn}
          disabled={selectedDate >= new Date().toISOString().split("T")[0]}
        >
          Next ▶
        </button>
      </div>

      {/* Day Totals */}
      <div style={styles.totalsRow}>
        <span style={styles.totalItem}>
          🔥 <strong>{Math.round(totalCal)}</strong> kcal
        </span>
        <span style={styles.totalItem}>
          💪 <strong>{Math.round(totalPro * 10) / 10}</strong> g protein
        </span>
        <span style={styles.totalItem}>
          🍽️ <strong>{logs.length}</strong> item{logs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Food Logs grouped by meal type */}
      {logs.length === 0 ? (
        <p style={styles.emptyMsg}>No food logged for this day.</p>
      ) : (
        <div style={styles.logList}>
          {grouped.map(({ mealType: mt, items }) => (
            <div key={mt}>
              <div style={{ ...styles.mealHeader, borderLeftColor: MEAL_COLORS[mt] || "#999" }}>
                <span style={{ fontWeight: "600", color: MEAL_COLORS[mt] || "#999" }}>{mt}</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {Math.round(items.reduce((s, l) => s + (l.calories || 0), 0))} kcal · {Math.round(items.reduce((s, l) => s + (l.protein || 0), 0) * 10) / 10}g protein
                </span>
              </div>
              {items.map((log) => (
                <div key={log.id} style={styles.logCard}>
                  {editingId === log.id ? (
                    <div style={styles.editForm}>
                      {/* Meal type selector */}
                      <div style={styles.editRowGroup}>
                        <div style={styles.editCol}>
                          <label style={styles.editLabel}>Meal Type</label>
                          <select value={editValues.mealType} onChange={(e) => changeField("mealType", e.target.value)} style={styles.editInput}>
                            {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>

                      {editValues.isGroup ? (
                        /* ---- Group editing (AI/image entries) ---- */
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--brand)", fontWeight: "600", marginBottom: "8px" }}>MEAL BLOCK — {editValues.items.length} items</div>
                          {editValues.items.map((subItem, si) => (
                            <div key={si} style={{ padding: "8px", marginBottom: "6px", background: "var(--bg-card-alt)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                <input placeholder="Food" value={subItem.name} onChange={(e) => changeGroupItem(si, "name", e.target.value)} style={{ ...styles.editInput, flex: 2, marginBottom: 0 }} />
                                <input placeholder="Qty" value={subItem.quantity} onChange={(e) => changeGroupItem(si, "quantity", e.target.value)} style={{ ...styles.editInput, flex: 1, marginBottom: 0 }} />
                                <input type="number" placeholder="Cal" value={subItem.calories} onChange={(e) => changeGroupItem(si, "calories", e.target.value)} style={{ ...styles.editInput, flex: 1, marginBottom: 0 }} />
                                <input type="number" step="0.1" placeholder="Pro" value={subItem.protein} onChange={(e) => changeGroupItem(si, "protein", e.target.value)} style={{ ...styles.editInput, flex: 1, marginBottom: 0 }} />
                                <button onClick={() => removeGroupItem(si)} style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--glass-surface-btn)", cursor: "pointer", fontSize: "13px" }}>🗑️</button>
                              </div>
                            </div>
                          ))}
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", padding: "6px 8px", background: "var(--brand-light)", borderRadius: "4px" }}>
                            Block Total: {editValues.items.reduce((s, i) => s + (Number(i.calories) || 0), 0)} kcal · {Math.round(editValues.items.reduce((s, i) => s + (Number(i.protein) || 0), 0) * 10) / 10}g protein
                          </div>
                        </div>
                      ) : (
                        /* ---- Single item editing ---- */
                        <>
                          <div style={styles.editRowGroup}>
                            <div style={{ ...styles.editCol, flex: 2 }}>
                              <label style={styles.editLabel}>Food</label>
                              <input value={editValues.itemName} onChange={(e) => changeField("itemName", e.target.value)} style={styles.editInput} />
                            </div>
                          </div>
                          <div style={styles.editRowGroup}>
                            <div style={styles.editCol}>
                              <label style={styles.editLabel}>Quantity</label>
                              <input value={editValues.quantity} onChange={(e) => changeField("quantity", e.target.value)} style={styles.editInput} />
                            </div>
                            <div style={styles.editCol}>
                              <label style={styles.editLabel}>Calories</label>
                              <input type="number" value={editValues.calories} onChange={(e) => changeField("calories", e.target.value)} style={styles.editInput} />
                            </div>
                            <div style={styles.editCol}>
                              <label style={styles.editLabel}>Protein (g)</label>
                              <input type="number" step="0.1" value={editValues.protein} onChange={(e) => changeField("protein", e.target.value)} style={styles.editInput} />
                            </div>
                          </div>
                        </>
                      )}

                      <div style={styles.editActions}>
                        <button onClick={saveEdit} disabled={saving} style={styles.saveBtn}>{saving ? "Saving..." : "✓ Save"}</button>
                        <button onClick={cancelEditing} style={styles.cancelBtn}>✕ Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ---- View mode ---- */
                    <div>
                      <div style={styles.viewRow}>
                        <div style={styles.viewInfo}>
                          {log.items && log.items.length > 0 ? (
                            <>
                              <span style={{ ...styles.foodName, cursor: "pointer" }} onClick={() => setExpandedGroupId((prev) => prev === log.id ? null : log.id)}>
                                {expandedGroupId === log.id ? "▼" : "▶"} 📦 {log.items.length} items
                              </span>
                              <span style={styles.foodMeta}>
                                {log.calories || 0} kcal · {log.protein || 0}g protein
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={styles.foodName}>{log.itemName || "—"}</span>
                              <span style={styles.foodMeta}>
                                {log.quantity || "—"} · {log.calories || 0} kcal · {log.protein || 0}g protein
                              </span>
                            </>
                          )}
                        </div>
                        <div style={styles.viewActions}>
                          <button onClick={() => startEditing(log)} style={styles.editBtn} title="Edit">✏️</button>
                          <button onClick={() => deleteLog(log.id)} disabled={deleting === log.id} style={styles.deleteBtn} title="Delete">{deleting === log.id ? "…" : "🗑️"}</button>
                        </div>
                      </div>
                      {/* Expanded sub-items for grouped entries */}
                      {log.items && log.items.length > 0 && expandedGroupId === log.id && (
                        <div style={{ marginTop: "8px", paddingLeft: "20px", borderLeft: "2px solid var(--brand)" }}>
                          {log.items.map((sub, si) => (
                            <div key={si} style={{ display: "flex", gap: "12px", padding: "4px 0", fontSize: "13px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                              <span style={{ flex: 2, fontWeight: "500" }}>{sub.name}</span>
                              <span style={{ flex: 1, color: "var(--text-muted)" }}>{sub.quantity}</span>
                              <span style={{ flex: 1, color: "#e65100" }}>{sub.calories} kcal</span>
                              <span style={{ flex: 1, color: "#2e7d32" }}>{sub.protein}g</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { marginTop: "20px", padding: "14px", background: "var(--glass-surface)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "12px", border: "1px solid var(--glass-border-subtle)" },
  title: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" },
  dateNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "10px" },
  navBtn: { padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--glass-surface-hover)", backdropFilter: "blur(8px)", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", transition: "all 0.15s" },
  dateDisplay: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" },
  dateInput: { padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", textAlign: "center", background: "var(--glass-surface-hover)", color: "var(--text)" },
  dateLabel: { fontSize: "10px", color: "var(--text-muted)" },
  totalsRow: { display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", padding: "6px 12px", background: "var(--glass-surface-light)", backdropFilter: "blur(8px)", borderRadius: "8px", marginBottom: "10px", border: "1px solid var(--glass-border-faint)" },
  totalItem: { fontSize: "12px", color: "var(--text-secondary)" },
  emptyMsg: { textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "12px 0", fontSize: "12px" },
  logList: { display: "flex", flexDirection: "column", gap: "4px" },
  mealHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", marginTop: "4px", marginBottom: "2px", borderLeft: "3px solid #999", background: "var(--glass-surface-light)", borderRadius: "4px", fontSize: "11px" },
  logCard: { padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--glass-border-faint)", background: "var(--glass-surface-subtle)", backdropFilter: "blur(6px)", transition: "all 0.15s" },
  viewRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" },
  viewInfo: { display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: 0 },
  foodName: { fontSize: "12px", fontWeight: "600", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  foodMeta: { fontSize: "10px", color: "var(--text-muted)" },
  viewActions: { display: "flex", gap: "3px", flexShrink: 0 },
  editBtn: { padding: "3px 6px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--glass-surface-btn)", cursor: "pointer", fontSize: "12px" },
  deleteBtn: { padding: "3px 6px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--glass-surface-btn)", cursor: "pointer", fontSize: "12px", color: "var(--text-muted)" },
  editForm: { display: "flex", flexDirection: "column", gap: "6px" },
  editRow: { display: "flex", flexDirection: "column", gap: "2px" },
  editRowGroup: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" },
  editCol: { display: "flex", flexDirection: "column", gap: "2px" },
  editLabel: { fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 },
  editInput: { padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "12px", width: "100%", boxSizing: "border-box", background: "var(--glass-surface-hover)", color: "var(--text)", transition: "border-color 0.15s", outline: "none" },
  editActions: { display: "flex", gap: "6px", marginTop: "2px" },
  saveBtn: { padding: "5px 12px", border: "none", borderRadius: "6px", background: "var(--brand)", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: "600" },
  cancelBtn: { padding: "5px 12px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--glass-surface-btn)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "11px" },
};

export default FoodLogEditor;
