import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts";

const RETENTION_DAYS = 45;

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getMonthLabel = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
};

const NutritionChart = ({ allLogs = [] }) => {
  const [chartType, setChartType] = useState("bar"); // "bar" or "line"

  // Filter to last 45 days and aggregate daily calories & protein
  const dailyData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const dailyMap = {};
    for (const log of allLogs) {
      const date = log.date;
      if (!date || date < cutoffStr) continue;
      if (!dailyMap[date]) dailyMap[date] = { date, calories: 0, protein: 0 };
      dailyMap[date].calories += log.calories || 0;
      dailyMap[date].protein += log.protein || 0;
    }

    const sorted = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((d) => {
      d.calories = Math.round(d.calories);
      d.protein = Math.round(d.protein * 10) / 10;
      d.label = formatDate(d.date);
      d.month = getMonthLabel(d.date);
    });
    return sorted;
  }, [allLogs]);

  // Group data by month for display
  const monthlyGroups = useMemo(() => {
    const groups = {};
    dailyData.forEach((d) => {
      if (!groups[d.month]) groups[d.month] = [];
      groups[d.month].push(d);
    });
    return groups;
  }, [dailyData]);

  // Summary stats
  const stats = useMemo(() => {
    if (!dailyData.length) return null;
    const totalCal = dailyData.reduce((s, d) => s + d.calories, 0);
    const totalPro = dailyData.reduce((s, d) => s + d.protein, 0);
    const avgCal = Math.round(totalCal / dailyData.length);
    const avgPro = Math.round((totalPro / dailyData.length) * 10) / 10;
    const maxCal = Math.max(...dailyData.map((d) => d.calories));
    const maxPro = Math.max(...dailyData.map((d) => d.protein));
    return { totalCal, totalPro, avgCal, avgPro, maxCal, maxPro, days: dailyData.length };
  }, [dailyData]);

  if (!dailyData.length) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>📊 Nutrition Tracking</h3>
        <p style={{ textAlign: "center", color: "#888" }}>
          No food data yet. Start logging your meals to see charts!
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📊 Nutrition Tracking (Last 45 Days)</h3>
        <div style={styles.toggleGroup}>
          <button
            onClick={() => setChartType("bar")}
            style={chartType === "bar" ? styles.toggleActive : styles.toggleBtn}
          >
            Bar
          </button>
          <button
            onClick={() => setChartType("line")}
            style={chartType === "line" ? styles.toggleActive : styles.toggleBtn}
          >
            Line
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Avg Daily Calories</span>
            <span style={styles.statValue}>{stats.avgCal} kcal</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Avg Daily Protein</span>
            <span style={styles.statValue}>{stats.avgPro} g</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Days Tracked</span>
            <span style={styles.statValue}>{stats.days}</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Peak Calories</span>
            <span style={styles.statValue}>{stats.maxCal} kcal</span>
          </div>
        </div>
      )}

      {/* Month-wise Charts */}
      {Object.entries(monthlyGroups).map(([month, data]) => (
        <div key={month} style={styles.monthSection}>
          <h4 style={styles.monthTitle}>{month}</h4>

          {/* Calorie Chart */}
          <div style={styles.chartWrapper}>
            <h5 style={styles.chartLabel}>🔥 Daily Calories</h5>
            <ResponsiveContainer width="100%" height={250}>
              {chartType === "bar" ? (
                <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={styles.tooltip}
                    formatter={(value) => [`${value} kcal`, "Calories"]}
                  />
                  <Bar dataKey="calories" fill="#FF6B6B" radius={[4, 4, 0, 0]} name="Calories" />
                </BarChart>
              ) : (
                <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={styles.tooltip}
                    formatter={(value) => [`${value} kcal`, "Calories"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="calories"
                    stroke="#FF6B6B"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#FF6B6B" }}
                    activeDot={{ r: 6 }}
                    name="Calories"
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Protein Chart */}
          <div style={styles.chartWrapper}>
            <h5 style={styles.chartLabel}>💪 Daily Protein</h5>
            <ResponsiveContainer width="100%" height={250}>
              {chartType === "bar" ? (
                <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={styles.tooltip}
                    formatter={(value) => [`${value} g`, "Protein"]}
                  />
                  <Bar dataKey="protein" fill="#4ECDC4" radius={[4, 4, 0, 0]} name="Protein" />
                </BarChart>
              ) : (
                <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={styles.tooltip}
                    formatter={(value) => [`${value} g`, "Protein"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="protein"
                    stroke="#4ECDC4"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#4ECDC4" }}
                    activeDot={{ r: 6 }}
                    name="Protein"
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      ))}

      <p style={styles.footerNote}>
        Data auto-resets after 45 days. Currently showing {dailyData.length} day(s) of data.
      </p>
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "15px",
  },
  title: {
    margin: 0,
    fontSize: "20px",
    color: "#333",
  },
  toggleGroup: {
    display: "flex",
    gap: "4px",
    background: "#f0f0f0",
    borderRadius: "6px",
    padding: "3px",
  },
  toggleBtn: {
    padding: "6px 14px",
    border: "none",
    background: "transparent",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    color: "#666",
  },
  toggleActive: {
    padding: "6px 14px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "25px",
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px",
    background: "#f8f9ff",
    borderRadius: "8px",
    border: "1px solid #e8eaf6",
  },
  statLabel: {
    fontSize: "12px",
    color: "#888",
    marginBottom: "4px",
  },
  statValue: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#333",
  },
  monthSection: {
    marginBottom: "30px",
  },
  monthTitle: {
    fontSize: "16px",
    color: "#555",
    borderBottom: "2px solid #667eea",
    paddingBottom: "6px",
    marginBottom: "15px",
  },
  chartWrapper: {
    marginBottom: "20px",
  },
  chartLabel: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "8px",
    marginLeft: "10px",
  },
  tooltip: {
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "13px",
  },
  footerNote: {
    textAlign: "center",
    fontSize: "12px",
    color: "#aaa",
    marginTop: "10px",
    marginBottom: 0,
  },
};

export default NutritionChart;
