import { useState, useMemo } from "react";

const MEAL_TYPES = ["Breakfast", "Lunch", "Evening Snacks", "Dinner", "Late Night", "Others"];
const MEAL_COLORS = {
  Breakfast: "#FF9800", Lunch: "#4CAF50", "Evening Snacks": "#9C27B0",
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

const MonthlyNutritionTable = ({ allLogs = [], workoutLogs = [], maintenanceCalories = 0 }) => {
  const [expandedDate, setExpandedDate] = useState(null);

  const dates = useMemo(() => getDateRange(60), []);

  // Group food logs by date
  const logsByDate = useMemo(() => {
    const map = {};
    for (const log of allLogs) {
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    }
    return map;
  }, [allLogs]);

  // Group workout logs by date
  const workoutsByDate = useMemo(() => {
    const map = {};
    for (const log of workoutLogs) {
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    }
    return map;
  }, [workoutLogs]);

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
              <span style={styles.col}>Deficit</span>
            </div>

            {monthDates.map((date) => {
              const dayLogs = logsByDate[date] || [];
              const cal = Math.round(dayLogs.reduce((s, l) => s + (l.calories || 0), 0));
              const pro = Math.round(dayLogs.reduce((s, l) => s + (l.protein || 0), 0) * 10) / 10;
              const dayBurned = (workoutsByDate[date] || []).reduce((s, l) => s + (l.caloriesBurned || 0), 0);
              const deficit = maintenanceCalories - cal + dayBurned;
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
                      background: isToday ? "#e3f2fd" : (isExpanded ? "#f5f5f5" : "#fff"),
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
                    <span style={{ ...styles.col, color: cal > 0 ? "#e65100" : "#ccc" }}>
                      {cal > 0 ? `${cal}` : "—"}
                    </span>
                    <span style={{ ...styles.col, color: pro > 0 ? "#2e7d32" : "#ccc" }}>
                      {pro > 0 ? `${pro}g` : "—"}
                    </span>
                    <span style={{ ...styles.col, fontWeight: 600, color: (dayLogs.length === 0 && !workoutsByDate[date]?.length) ? "#ccc" : deficit >= 0 ? "#2e7d32" : "#c62828" }}>
                      {(dayLogs.length === 0 && !workoutsByDate[date]?.length) ? "—" : `${deficit >= 0 ? "↓" : "↑"}${Math.abs(deficit)}`}
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
                                <div key={item.id} style={{ marginLeft: "8px", borderLeft: "2px solid #667eea", paddingLeft: "8px", marginBottom: "4px" }}>
                                  <div style={{ ...styles.mealItem, fontWeight: "500", color: "#667eea", fontSize: "12px" }}>📦 Meal Block ({item.items.length} items)</div>
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
                        <span style={{ fontWeight: 700, color: deficit >= 0 ? "#2e7d32" : "#c62828" }}>
                          {deficit >= 0 ? "↓" : "↑"}{Math.abs(deficit)} deficit
                        </span>
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
    marginTop: "30px",
    padding: "20px",
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #e0e0e0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  title: { margin: "0 0 4px 0", fontSize: "20px", color: "#333" },
  subtitle: { margin: "0 0 20px 0", fontSize: "13px", color: "#888" },
  monthBlock: { marginBottom: "24px" },
  monthHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    borderRadius: "8px 8px 0 0",
    color: "#fff",
  },
  monthName: { fontWeight: "700", fontSize: "16px" },
  monthStats: { fontSize: "12px", opacity: 0.9 },
  tableHeader: {
    display: "flex",
    padding: "8px 14px",
    background: "#f0f0f0",
    fontSize: "12px",
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  col: { flex: 1, textAlign: "center" },
  dateRow: {
    display: "flex",
    padding: "10px 14px",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "14px",
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
    background: "#fafafa",
    borderBottom: "2px solid #e0e0e0",
  },
  mealSection: { marginBottom: "10px" },
  mealLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    borderLeft: "3px solid #999",
    background: "#f0f0f0",
    borderRadius: "3px",
    fontSize: "13px",
    marginBottom: "4px",
  },
  mealTotal: { fontSize: "12px", color: "#777" },
  mealItem: {
    display: "flex",
    gap: "12px",
    padding: "5px 10px 5px 16px",
    fontSize: "13px",
    color: "#555",
    alignItems: "center",
  },
  itemName: { flex: 2, fontWeight: "500" },
  itemQty: { flex: 1, color: "#888", textAlign: "center" },
  itemCal: { flex: 1, textAlign: "center", color: "#e65100" },
  itemPro: { flex: 1, textAlign: "center", color: "#2e7d32" },
  dayTotal: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 10px",
    marginTop: "6px",
    borderTop: "1px solid #ddd",
    fontSize: "13px",
    color: "#333",
  },
};

export default MonthlyNutritionTable;
