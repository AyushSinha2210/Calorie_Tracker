import { useState, useMemo } from "react";

const MEAL_TYPES = ["Breakfast", "Lunch", "Evening Snacks", "Dinner", "Late Night", "Others"];
const MEAL_COLORS = {
  Breakfast: "#FF9800", Lunch: "#4CAF50", "Evening Snacks": "#10b981",
  Dinner: "#2196F3", "Late Night": "#607D8B", Others: "#795548",
};

// Generate array of dates from today going back `days` days
const getDateRange = (days) => {
  const result = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().split("T")[0]);
  }
  return result;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const getMonthLabel = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const MonthlyNutritionTable = ({ allLogs = [] }) => {
  const [expandedDate, setExpandedDate] = useState(null);

  const dates = useMemo(() => getDateRange(60), []);

  // Group logs by date
  const logsByDate = useMemo(() => {
    const map = {};
    for (const log of allLogs) {
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    }
    return map;
  }, [allLogs]);

  // Group dates by month
  const months = useMemo(() => {
    const map = new Map();
    for (const date of dates) {
      const label = getMonthLabel(date);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(date);
    }
    return Array.from(map.entries());
  }, [dates]);

  const toggleDate = (date) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📊 Monthly Nutrition Table</h3>
      <p style={styles.subtitle}>Last 60 days — click any date for meal details</p>

      {months.map(([monthLabel, monthDates]) => {
        const monthLogs = monthDates.flatMap((d) => logsByDate[d] || []);
        const monthCal = Math.round(monthLogs.reduce((s, l) => s + (l.calories || 0), 0));
        const monthPro = Math.round(monthLogs.reduce((s, l) => s + (l.protein || 0), 0) * 10) / 10;
        const activeDays = monthDates.filter((d) => (logsByDate[d] || []).length > 0).length;

        return (
          <div key={monthLabel} style={styles.monthBlock}>
            <div style={styles.monthHeader}>
              <span style={styles.monthName}>{monthLabel}</span>
              <span style={styles.monthStats}>
                {activeDays} day{activeDays !== 1 ? "s" : ""} logged · {monthCal} kcal · {monthPro}g protein
              </span>
            </div>

            {/* Table header */}
            <div style={styles.tableHeader}>
              <span style={{ ...styles.col, flex: 2 }}>Date</span>
              <span style={styles.col}>Items</span>
              <span style={styles.col}>Calories</span>
              <span style={styles.col}>Protein</span>
            </div>

            {monthDates.map((date) => {
              const dayLogs = logsByDate[date] || [];
              const cal = Math.round(dayLogs.reduce((s, l) => s + (l.calories || 0), 0));
              const pro = Math.round(dayLogs.reduce((s, l) => s + (l.protein || 0), 0) * 10) / 10;
              const isExpanded = expandedDate === date;
              const today = new Date().toISOString().split("T")[0];
              const isToday = date === today;

              return (
                <div key={date}>
                  {/* Date row */}
                  <div
                    role="button"
                    tabIndex={dayLogs.length > 0 ? 0 : -1}
                    onClick={() => dayLogs.length > 0 && toggleDate(date)}
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && dayLogs.length > 0) { e.preventDefault(); toggleDate(date); } }}
                    style={{
                      ...styles.dateRow,
                      background: isToday ? "var(--brand-light)" : (isExpanded ? "var(--bg-card-alt)" : "var(--bg-card)"),
                      cursor: dayLogs.length > 0 ? "pointer" : "default",
                      opacity: dayLogs.length === 0 ? 0.5 : 1,
                    }}
                  >
                    <span style={{ ...styles.col, flex: 2, fontWeight: isToday ? "700" : "400" }}>
                      {isExpanded ? "▼ " : (dayLogs.length > 0 ? "▶ " : "  ")}
                      {formatDate(date)}
                      {isToday && <span style={styles.todayBadge}>Today</span>}
                    </span>
                    <span style={styles.col}>{dayLogs.length || "—"}</span>
                    <span style={{ ...styles.col, color: cal > 0 ? "#e65100" : "var(--text-muted)" }}>
                      {cal > 0 ? `${cal}` : "—"}
                    </span>
                    <span style={{ ...styles.col, color: pro > 0 ? "#2e7d32" : "var(--text-muted)" }}>
                      {pro > 0 ? `${pro}g` : "—"}
                    </span>
                  </div>

                  {/* Expanded detail: grouped by meal type */}
                  {isExpanded && (
                    <div style={styles.detailPanel}>
                      {MEAL_TYPES.map((mt) => {
                        const mealItems = dayLogs.filter((l) => (l.mealType || "Others") === mt);
                        if (mealItems.length === 0) return null;
                        const mealCal = Math.round(mealItems.reduce((s, l) => s + (l.calories || 0), 0));
                        const mealPro = Math.round(mealItems.reduce((s, l) => s + (l.protein || 0), 0) * 10) / 10;
                        return (
                          <div key={mt} style={styles.mealSection}>
                            <div style={{ ...styles.mealLabel, borderLeftColor: MEAL_COLORS[mt] }}>
                              <span style={{ color: MEAL_COLORS[mt], fontWeight: "600" }}>{mt}</span>
                              <span style={styles.mealTotal}>{mealCal} kcal · {mealPro}g</span>
                            </div>
                            {mealItems.map((item) => (
                              item.items && item.items.length > 0 ? (
                                <div key={item.id} style={{ marginLeft: "8px", borderLeft: "2px solid var(--brand)", paddingLeft: "8px", marginBottom: "4px" }}>
                                  <div style={{ ...styles.mealItem, fontWeight: "500", color: "var(--brand)", fontSize: "12px" }}>📦 Meal Block ({item.items.length} items)</div>
                                  {item.items.map((sub, si) => (
                                    <div key={si} style={styles.mealItem}>
                                      <span style={styles.itemName}>{sub.name}</span>
                                      <span style={styles.itemQty}>{sub.quantity}</span>
                                      <span style={styles.itemCal}>{sub.calories} kcal</span>
                                      <span style={styles.itemPro}>{sub.protein}g</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div key={item.id} style={styles.mealItem}>
                                  <span style={styles.itemName}>{item.itemName}</span>
                                  <span style={styles.itemQty}>{item.quantity}</span>
                                  <span style={styles.itemCal}>{item.calories} kcal</span>
                                  <span style={styles.itemPro}>{item.protein}g</span>
                                </div>
                              )
                            ))}
                          </div>
                        );
                      })}
                      {/* Day total in detail */}
                      <div style={styles.dayTotal}>
                        <span style={{ fontWeight: "700" }}>Day Total</span>
                        <span>{cal} kcal</span>
                        <span>{pro}g protein</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  container: {
    marginTop: "20px",
    padding: "14px",
    background: "var(--glass-surface)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: "12px",
    border: "1px solid var(--glass-border-subtle)",
  },
  title: { margin: "0 0 2px 0", fontSize: "13px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.025em" },
  subtitle: { margin: "0 0 12px 0", fontSize: "11px", color: "var(--text-muted)" },
  monthBlock: { marginBottom: "16px" },
  monthHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    background: "var(--surface-900, #1c1917)",
    borderRadius: "8px 8px 0 0",
    color: "#fff",
  },
  monthName: { fontWeight: "700", fontSize: "12px", letterSpacing: "-0.01em" },
  monthStats: { fontSize: "10px", opacity: 0.8 },
  tableHeader: {
    display: "flex",
    padding: "5px 10px",
    background: "var(--glass-surface-light)",
    fontSize: "9px",
    fontWeight: "600",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border)",
  },
  col: { flex: 1, textAlign: "center" },
  dateRow: {
    display: "flex",
    padding: "6px 10px",
    borderBottom: "1px solid var(--glass-border-faint)",
    fontSize: "12px",
    transition: "background 0.15s",
    alignItems: "center",
  },
  todayBadge: {
    marginLeft: "8px",
    padding: "1px 8px",
    background: "#2196F3",
    color: "#fff",
    borderRadius: "10px",
    fontSize: "10px",
    fontWeight: "600",
    verticalAlign: "middle",
  },
  detailPanel: {
    padding: "12px 20px 12px 30px",
    background: "var(--bg-card)",
    borderBottom: "2px solid var(--border)",
  },
  mealSection: { marginBottom: "10px" },
  mealLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    borderLeft: "3px solid #999",
    background: "var(--bg-card-alt)",
    borderRadius: "3px",
    fontSize: "13px",
    marginBottom: "4px",
  },
  mealTotal: { fontSize: "12px", color: "var(--text-muted)" },
  mealItem: {
    display: "flex",
    gap: "12px",
    padding: "5px 10px 5px 16px",
    fontSize: "13px",
    color: "var(--text-secondary)",
    alignItems: "center",
  },
  itemName: { flex: 2, fontWeight: "500" },
  itemQty: { flex: 1, color: "var(--text-muted)", textAlign: "center" },
  itemCal: { flex: 1, textAlign: "center", color: "#e65100" },
  itemPro: { flex: 1, textAlign: "center", color: "#2e7d32" },
  dayTotal: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 10px",
    marginTop: "6px",
    borderTop: "1px solid var(--border)",
    fontSize: "13px",
    color: "var(--text)",
  },
};

export default MonthlyNutritionTable;
