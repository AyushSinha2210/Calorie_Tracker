import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
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
        <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
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
    marginTop: "20px",
    padding: "14px",
    background: "var(--glass-surface)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: "12px",
    border: "1px solid var(--glass-border-subtle)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "10px",
  },
  title: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.025em",
  },
  toggleGroup: {
    display: "flex",
    gap: "2px",
    background: "var(--bg-card-alt)",
    borderRadius: "8px",
    padding: "3px",
    border: "1px solid var(--border)",
  },
  toggleBtn: {
    padding: "4px 12px",
    border: "none",
    background: "transparent",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    transition: "all 0.2s",
  },
  toggleActive: {
    padding: "4px 12px",
    border: "none",
    background: "var(--surface-900, #1c1917)",
    color: "#fff",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: "8px",
    marginBottom: "16px",
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "10px",
    background: "var(--glass-surface-btn)",
    backdropFilter: "blur(8px)",
    borderRadius: "8px",
    border: "1px solid var(--glass-border-faint)",
    transition: "all 0.2s",
  },
  statLabel: {
    fontSize: "9px",
    color: "var(--text-muted)",
    marginBottom: "2px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 600,
  },
  statValue: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "var(--text)",
  },
  monthSection: {
    marginBottom: "20px",
  },
  monthTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "4px",
    marginBottom: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  chartWrapper: {
    marginBottom: "14px",
  },
  chartLabel: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    marginBottom: "6px",
    marginLeft: "6px",
    fontWeight: 500,
  },
  tooltip: {
    borderRadius: "8px",
    border: "1px solid var(--border)",
    fontSize: "13px",
    background: "var(--bg-card)",
    color: "var(--text)",
  },
  footerNote: {
    textAlign: "center",
    fontSize: "12px",
    color: "var(--text-muted)",
    marginTop: "10px",
    marginBottom: 0,
  },
};

export default NutritionChart;
