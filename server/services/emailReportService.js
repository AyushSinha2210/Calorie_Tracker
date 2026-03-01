import admin from "firebase-admin";
import nodemailer from "nodemailer";
import cron from "node-cron";

// ── Email transporter (Gmail App Password) ──
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("EMAIL_USER and EMAIL_APP_PASSWORD must be set in .env");
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
    requireTLS: true,
    connectionTimeout: 30000,   // 30s to establish TCP connection
    greetingTimeout: 30000,     // 30s for SMTP greeting
    socketTimeout: 60000,       // 60s for socket inactivity
  });
  return transporter;
}

// ── Firestore helpers ──
function getDb() {
  if (!admin.apps.length) throw new Error("Firebase Admin not initialised");
  return admin.firestore();
}

/**
 * Fetch food logs for a user within a date range.
 * Returns array of { date, name, quantity, calories, protein }
 */
async function fetchFoodLogs(uid, startDate, endDate) {
  const db = getDb();
  const snap = await db
    .collection("users").doc(uid).collection("foodLogs")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .orderBy("date", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch weight logs for a user within a date range.
 * Returns array of { date, weightKg }
 */
async function fetchWeightLogs(uid, startDate, endDate) {
  const db = getDb();
  const snap = await db
    .collection("users").doc(uid).collection("weightLogs")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .orderBy("date", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch workout logs for a user within a date range.
 */
async function fetchWorkoutLogs(uid, startDate, endDate) {
  const db = getDb();
  const snap = await db
    .collection("users").doc(uid).collection("workoutLogs")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .orderBy("date", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Date helpers ──
function fmt(d) { return d.toISOString().split("T")[0]; } // YYYY-MM-DD

function getDateRange(frequency) {
  const now = new Date();
  const end = fmt(now);
  let start;
  if (frequency === "daily") {
    start = end; // today only
  } else if (frequency === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    start = fmt(d);
  } else {
    // monthly — last 30 days
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    start = fmt(d);
  }
  return { start, end };
}

// ── HTML table builders ──
const style = `
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937; background: #f9fafb; margin: 0; padding: 24px 12px; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border: 1px solid #f3f4f6; }
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 36px 24px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.025em; }
  .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; font-weight: 500; }
  .section { padding: 28px 24px; border-bottom: 1px solid #f3f4f6; }
  .section:last-of-type { border-bottom: none; }
  .section h2 { color: #111827; font-size: 18px; font-weight: 700; margin: 0 0 16px; display: flex; align-items: center; letter-spacing: -0.01em; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; margin-bottom: 8px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  th { background: #f9fafb; color: #4b5563; padding: 12px 14px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
  td { padding: 12px 14px; border-bottom: 1px solid #e5e7eb; color: #374151; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background-color: #fafafa; }
  .summary-row td { font-weight: 700; background: #f3f4f6 !important; color: #111827; }
  .positive { color: #dc2626; font-weight: 600; }
  .negative { color: #16a34a; font-weight: 600; }
  .neutral { color: #9ca3af; }
  .footer { text-align: center; padding: 24px; font-size: 12px; color: #6b7280; background: #f9fafb; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-daily { background: #dcfce7; color: #16a34a; }
  .badge-weekly { background: #e0e7ff; color: #4338ca; }
  .badge-monthly { background: #fee2e2; color: #dc2626; }
  
  /* Responsive styles for email */
  .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 16px; border-radius: 12px; }
  .table-responsive table { margin-bottom: 0; min-width: 450px; }
  
  @media only screen and (max-width: 600px) {
    body { padding: 12px 8px !important; }
    .container { width: 100% !important; border-radius: 16px !important; }
    .header { padding: 24px 16px !important; }
    .header h1 { font-size: 22px !important; }
    .section { padding: 20px 16px !important; }
    th, td { padding: 10px 8px !important; font-size: 13px !important; }
  }
</style>`;

function buildWeightTable(weightLogs) {
  if (!weightLogs.length) return `<p style="color:#999;font-style:italic;">No weight records for this period.</p>`;

  // Deduplicate by date — keep the latest entry per date (by createdAt)
  const byDate = {};
  for (const w of weightLogs) {
    const wt = w.weight ?? w.weightKg ?? 0;
    const ts = w.createdAt?._seconds || 0;
    if (!byDate[w.date] || ts > byDate[w.date].ts) {
      byDate[w.date] = { date: w.date, weight: wt, ts };
    }
  }
  const entries = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  if (!entries.length) return `<p style="color:#999;font-style:italic;">No weight records for this period.</p>`;

  let rows = "";
  for (let i = 0; i < entries.length; i++) {
    const { date, weight: wt } = entries[i];
    const prev = i > 0 ? entries[i - 1].weight : null;
    const change = prev !== null ? (wt - prev).toFixed(1) : "—";
    const cls = change === "—" ? "neutral" : Number(change) > 0 ? "positive" : Number(change) < 0 ? "negative" : "neutral";
    rows += `<tr><td>${date}</td><td>${wt} kg</td><td class="${cls}">${change === "—" ? "—" : (Number(change) > 0 ? "+" : "") + change + " kg"}</td></tr>`;
  }
  // Overall change
  if (entries.length >= 2) {
    const firstWt = entries[0].weight;
    const lastWt = entries[entries.length - 1].weight;
    const totalChange = (lastWt - firstWt).toFixed(1);
    const cls = Number(totalChange) > 0 ? "positive" : Number(totalChange) < 0 ? "negative" : "neutral";
    rows += `<tr class="summary-row"><td colspan="2"><strong>Total Change</strong></td><td class="${cls}"><strong>${Number(totalChange) > 0 ? "+" : ""}${totalChange} kg</strong></td></tr>`;
  }
  return `<div class="table-responsive"><table><tr><th>Date</th><th>Weight</th><th>Change</th></tr>${rows}</table></div>`;
}

function buildDailyNutritionTable(foodLogs) {
  if (!foodLogs.length) return `<p style="color:#999;font-style:italic;">No nutrition records for this period.</p>`;
  // Group by date
  const byDate = {};
  for (const log of foodLogs) {
    if (!byDate[log.date]) byDate[log.date] = { calories: 0, protein: 0 };
    byDate[log.date].calories += log.calories || 0;
    byDate[log.date].protein += log.protein || 0;
  }
  const dates = Object.keys(byDate).sort();
  let rows = "";
  let totalCal = 0, totalPro = 0;
  for (const date of dates) {
    const { calories, protein } = byDate[date];
    totalCal += calories;
    totalPro += protein;
    rows += `<tr><td>${date}</td><td>${Math.round(calories)}</td><td>${Math.round(protein)} g</td></tr>`;
  }
  const avgCal = Math.round(totalCal / dates.length);
  const avgPro = Math.round(totalPro / dates.length);
  rows += `<tr class="summary-row"><td><strong>Average</strong></td><td><strong>${avgCal}</strong></td><td><strong>${avgPro} g</strong></td></tr>`;
  rows += `<tr class="summary-row"><td><strong>Total</strong></td><td><strong>${Math.round(totalCal)}</strong></td><td><strong>${Math.round(totalPro)} g</strong></td></tr>`;
  return `<div class="table-responsive"><table><tr><th>Date</th><th>Calories</th><th>Protein</th></tr>${rows}</table></div>`;
}

function buildFoodItemsTable(foodLogs) {
  if (!foodLogs.length) return "";
  let rows = "";
  for (const log of foodLogs) {
    const qty = log.quantity || "—";
    const cal = Math.round(log.calories || 0);
    const pro = Math.round(log.protein || 0);
    rows += `<tr><td>${log.date}</td><td>${log.name || log.food || "—"}</td><td>${qty}</td><td>${cal}</td><td>${pro} g</td></tr>`;
  }
  return `
    <div class="section">
      <h2>🍽️ Food Items Detail</h2>
      <div class="table-responsive">
        <table>
          <tr><th>Date</th><th>Food</th><th>Quantity</th><th>Calories</th><th>Protein</th></tr>
          ${rows}
        </table>
      </div>
    </div>`;
}

function buildWorkoutTable(workoutLogs) {
  if (!workoutLogs.length) return `<p style="color:#999;font-style:italic;">No workout records for this period.</p>`;

  // Group by date
  const byDate = {};
  for (const log of workoutLogs) {
    if (!byDate[log.date]) byDate[log.date] = { exercises: [], totalCal: 0, totalMin: 0 };
    byDate[log.date].exercises.push(log);
    byDate[log.date].totalCal += log.caloriesBurned || 0;
    byDate[log.date].totalMin += log.durationMin || 0;
  }

  const dates = Object.keys(byDate).sort();
  let rows = "";
  let grandTotalCal = 0, grandTotalMin = 0, totalWorkouts = 0;

  for (const date of dates) {
    const { exercises, totalCal, totalMin } = byDate[date];
    grandTotalCal += totalCal;
    grandTotalMin += totalMin;
    totalWorkouts += exercises.length;
    const names = exercises.map((e) => e.exerciseName).join(", ");
    rows += `<tr><td>${date}</td><td>${names}</td><td>${totalMin} min</td><td style="font-weight:700;color:#e74c3c;">🔥 ${totalCal}</td></tr>`;
  }

  rows += `<tr class="summary-row"><td><strong>Total</strong></td><td><strong>${totalWorkouts} exercise(s)</strong></td><td><strong>${grandTotalMin} min</strong></td><td style="font-weight:700;color:#e74c3c;"><strong>🔥 ${grandTotalCal} kcal</strong></td></tr>`;

  if (dates.length > 1) {
    const avgCal = Math.round(grandTotalCal / dates.length);
    const avgMin = Math.round(grandTotalMin / dates.length);
    rows += `<tr class="summary-row"><td><strong>Daily Avg</strong></td><td></td><td><strong>${avgMin} min</strong></td><td style="font-weight:700;color:#e74c3c;"><strong>🔥 ${avgCal} kcal</strong></td></tr>`;
  }

  return `<div class="table-responsive"><table><tr><th>Date</th><th>Exercises</th><th>Duration</th><th>Calories Burned</th></tr>${rows}</table></div>`;
}

function buildWorkoutDetailTable(workoutLogs) {
  if (!workoutLogs.length) return "";
  let rows = "";
  for (const log of workoutLogs) {
    // Build detail string based on inputType
    let detail;
    const t = log.inputType;
    if (t === "cardio") {
      detail = `${log.durationMin || 0} min`;
      if (log.distanceKm) detail += ` · ${log.distanceKm} km`;
    } else if (t === "weighted") {
      detail = `${log.sets}×${log.reps} @ ${log.liftedWeight}kg`;
    } else if (t === "bodyweight") {
      detail = `${log.sets}×${log.reps}`;
    } else if (t === "isometric") {
      detail = `${log.holdSeconds}s hold`;
    } else {
      detail = `${log.durationMin || 0} min`;
    }
    rows += `<tr><td>${log.date}</td><td>${log.exerciseName}</td><td>${log.category || "—"}</td><td>${detail}</td><td style="font-weight:600;color:#e74c3c;">🔥 ${log.caloriesBurned}</td></tr>`;
  }
  return `
    <div class="section">
      <h2>🏋️ Workout Details</h2>
      <div class="table-responsive">
        <table>
          <tr><th>Date</th><th>Exercise</th><th>Category</th><th>Detail</th><th>Calories</th></tr>
          ${rows}
        </table>
      </div>
    </div>`;
}

function buildDeficitTable(foodLogs, workoutLogs, maintenanceCalories) {
  if (!maintenanceCalories) return `<p style="color:#999;font-style:italic;">Maintenance calories not configured — update your profile to see deficit data.</p>`;

  // Group food and workout by date
  const foodByDate = {};
  for (const log of foodLogs) {
    if (!foodByDate[log.date]) foodByDate[log.date] = 0;
    foodByDate[log.date] += log.calories || 0;
  }
  const workoutByDate = {};
  for (const log of workoutLogs) {
    if (!workoutByDate[log.date]) workoutByDate[log.date] = 0;
    workoutByDate[log.date] += log.caloriesBurned || 0;
  }
  const allDates = [...new Set([...Object.keys(foodByDate), ...Object.keys(workoutByDate)])].sort();
  if (!allDates.length) return `<p style="color:#999;font-style:italic;">No data to calculate deficit.</p>`;

  let rows = "";
  let totalDeficit = 0;
  for (const date of allDates) {
    const consumed = Math.round(foodByDate[date] || 0);
    const burned = Math.round(workoutByDate[date] || 0);
    const deficit = maintenanceCalories - consumed + burned;
    totalDeficit += deficit;
    const cls = deficit >= 0 ? "negative" : "positive";
    rows += `<tr><td>${date}</td><td>${maintenanceCalories}</td><td>${consumed}</td><td>${burned}</td><td class="${cls}" style="font-weight:700;">${deficit >= 0 ? "\u2193" : "\u2191"}${Math.abs(deficit)}</td></tr>`;
  }
  const avgDeficit = Math.round(totalDeficit / allDates.length);
  const avgCls = avgDeficit >= 0 ? "negative" : "positive";
  rows += `<tr class="summary-row"><td><strong>Average</strong></td><td>${maintenanceCalories}</td><td></td><td></td><td class="${avgCls}" style="font-weight:700;"><strong>${avgDeficit >= 0 ? "\u2193" : "\u2191"}${Math.abs(avgDeficit)}</strong></td></tr>`;

  return `<div class="table-responsive"><table><tr><th>Date</th><th>Maintenance</th><th>Consumed</th><th>Burned</th><th>Deficit</th></tr>${rows}</table></div>`;
}

function buildEmailHtml(frequency, displayName, weightLogs, foodLogs, workoutLogs, dateRange, maintenanceCalories) {
  const freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const badgeCls = `badge-${frequency}`;
  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    ${style}
  </head><body>
<div class="container">
  <div class="header">
    <h1>🏋️ FoodCal Report</h1>
    <p><span class="badge ${badgeCls}">${freqLabel}</span> &nbsp; ${dateRange.start}${dateRange.start !== dateRange.end ? " → " + dateRange.end : ""}</p>
  </div>

  <div class="section">
    <p>Hi <strong>${displayName || "there"}</strong>, here's your ${frequency} fitness summary:</p>
  </div>

  <div class="section">
    <h2>⚖️ Weight Tracking</h2>
    ${buildWeightTable(weightLogs)}
  </div>

  <div class="section">
    <h2>📊 Day-wise Calories & Protein</h2>
    ${buildDailyNutritionTable(foodLogs)}
  </div>

  <div class="section">
    <h2>🏋️ Workout Summary</h2>
    ${buildWorkoutTable(workoutLogs)}
  </div>

  ${buildFoodItemsTable(foodLogs)}

  ${buildWorkoutDetailTable(workoutLogs)}

  <div class="section">
    <h2>📉 Calorie Deficit</h2>
    ${buildDeficitTable(foodLogs, workoutLogs, maintenanceCalories)}
  </div>

  <div class="footer">
    You're receiving this because you subscribed to ${frequency} reports on FoodCal.<br/>
    To change frequency or unsubscribe, update your settings in the app.
  </div>
</div>
</body></html>`;
}

// ── Send report for ONE user ──
export async function sendReportForUser(uid, email, displayName, frequency) {
  const { start, end } = getDateRange(frequency);
  console.log(`[EMAIL DEBUG] uid=${uid}, freq=${frequency}, range=${start} → ${end}`);
  const [foodLogs, weightLogs, workoutLogs] = await Promise.all([
    fetchFoodLogs(uid, start, end),
    fetchWeightLogs(uid, start, end),
    fetchWorkoutLogs(uid, start, end),
  ]);
  console.log(`[EMAIL DEBUG] foodLogs=${foodLogs.length}, weightLogs=${weightLogs.length}, workoutLogs=${workoutLogs.length}`);
  if (weightLogs.length) {
    console.log(`[EMAIL DEBUG] weightLogs sample:`, JSON.stringify(weightLogs.slice(0, 3)));
  }

  // Compute maintenance calories from user profile
  let maintenanceCalories = 0;
  try {
    const admin = (await import("firebase-admin")).default;
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const p = userDoc.data();
    if (p?.weight && p?.height && p?.age) {
      const offset = p.gender === "female" ? -161 : 5;
      const bmr = 10 * Number(p.weight) + 6.25 * Number(p.height) - 5 * Number(p.age) + offset;
      maintenanceCalories = Math.round(bmr * 1.55);
    }
  } catch (e) {
    console.error("[EMAIL] Failed to compute maintenance calories:", e.message);
  }

  const freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const html = buildEmailHtml(frequency, displayName, weightLogs, foodLogs, workoutLogs, { start, end }, maintenanceCalories);

  await getTransporter().sendMail({
    from: `"FoodCal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${freqLabel} FoodCal Report (${start}${start !== end ? " – " + end : ""})`,
    html,
  });
  console.log(`[EMAIL] Sent ${frequency} report to ${email}`);
}

// ── Send on-demand report (triggered by user) ──
export async function sendOnDemandReport(uid, email, displayName, frequency) {
  return sendReportForUser(uid, email, displayName, frequency || "weekly");
}

/**
 * Send on-demand report using data provided directly by the client.
 * This does NOT require Firebase Admin — data comes from the frontend.
 */
export async function sendOnDemandReportWithData({ email, displayName, frequency, foodLogs, weightLogs, workoutLogs, maintenanceCalories }) {
  const { start, end } = getDateRange(frequency || "weekly");
  const freqLabel = (frequency || "weekly").charAt(0).toUpperCase() + (frequency || "weekly").slice(1);
  const html = buildEmailHtml(frequency || "weekly", displayName, weightLogs || [], foodLogs || [], workoutLogs || [], { start, end }, maintenanceCalories || 0);

  await getTransporter().sendMail({
    from: `"FoodCal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${freqLabel} FoodCal Report (${start}${start !== end ? " – " + end : ""})`,
    html,
  });
  console.log(`[EMAIL] Sent ${frequency || "weekly"} on-demand report (with client data) to ${email}`);
}

// ── Scheduled sends (per-user custom schedule) ──
// Runs every minute, queries Firestore for users whose schedule matches NOW.
// Caches user list for 5 minutes to reduce Firestore reads from 1,440/day → ~288/day.
let _scheduledUsersCache = null;
let _scheduledUsersCacheTime = 0;
const SCHEDULE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getScheduledUsers() {
  const now = Date.now();
  if (_scheduledUsersCache && now - _scheduledUsersCacheTime < SCHEDULE_CACHE_TTL) {
    return _scheduledUsersCache;
  }
  const db = getDb();
  const snap = await db
    .collection("users")
    .where("emailReport.enabled", "==", true)
    .get();
  const users = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  _scheduledUsersCache = users;
  _scheduledUsersCacheTime = now;
  return users;
}

async function checkAndSendScheduledReports() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay();        // 0=Sun..6=Sat
  const currentDayOfMonth = now.getDate();       // 1-31
  const currentTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  // Get users from cache (refreshes every 5 min)
  const users = await getScheduledUsers();
  if (!users.length) return;

  let sent = 0;
  for (const { id, data } of users) {
    const cfg = data.emailReport;
    if (!cfg?.email || !cfg?.frequency) continue;

    // Check if user's scheduled time matches current time
    const userTime = cfg.time || "20:00";
    if (userTime !== currentTime) continue;

    // Check frequency-specific conditions
    if (cfg.frequency === "weekly") {
      const userDay = cfg.dayOfWeek ?? 1; // default Monday
      if (currentDayOfWeek !== userDay) continue;
    } else if (cfg.frequency === "monthly") {
      const userDate = cfg.dayOfMonth ?? 1; // default 1st
      if (currentDayOfMonth !== userDate) continue;
    }
    // daily: no extra check needed, just matches time

    try {
      await sendReportForUser(id, cfg.email, data.displayName || data.name || "", cfg.frequency);
      sent++;
    } catch (e) {
      console.error(`[EMAIL CRON] Failed for ${cfg.email}:`, e.message);
    }
  }

  if (sent > 0) console.log(`[EMAIL CRON] Sent ${sent} scheduled report(s) at ${currentTime}.`);
}

// ── Weight Reminder: 10-day inactivity email ──
const WEIGHT_STALE_DAYS = 10;
const REMINDER_COOLDOWN_DAYS = 10; // don't re-send reminder more than once per 10 days

function buildWeightReminderHtml(displayName, daysSince) {
  return `<!DOCTYPE html><html><head>${style}</head><body>
<div class="container">
  <div class="header">
    <h1>⚖️ Weight Check-in Reminder</h1>
    <p>It's been a while since your last weigh-in</p>
  </div>
  <div class="section" style="text-align:center; padding-top: 40px; padding-bottom: 40px;">
    <p style="font-size:18px; color:#111827; margin-bottom: 8px;">Hi <strong>${displayName || "there"}</strong>,</p>
    <p style="font-size:15px; color:#4b5563; line-height:1.7; max-width: 450px; margin: 0 auto;">
      ${daysSince
      ? `It's been <strong style="color:#dc2626;">${daysSince} days</strong> since you last logged your weight.`
      : `You haven't logged your weight yet.`}
      <br/>Regular tracking helps you stay on top of your fitness goals!
    </p>
    <div style="margin-top:32px;">
      <a href="https://fitness-tracker-app.com" style="display:inline-block; padding:14px 36px; background:linear-gradient(135deg, #667eea, #764ba2); color:#ffffff; border-radius:12px; text-decoration:none; font-weight:700; font-size:16px; box-shadow: 0 4px 6px -1px rgba(102, 126, 234, 0.4);">
        Open FoodCal
      </a>
    </div>
  </div>
  <div class="footer">
    This reminder is sent when no weight entry is recorded for ${WEIGHT_STALE_DAYS}+ days.<br/>
    Log your weight in the app to stop receiving these reminders.
  </div>
</div>
</body></html>`;
}

async function checkAndSendWeightReminders() {
  const db = getDb();
  const now = new Date();
  const staleDate = new Date(now);
  staleDate.setDate(staleDate.getDate() - WEIGHT_STALE_DAYS);
  const staleDateStr = fmt(staleDate);

  // Get all users
  const usersSnap = await db.collection("users").get();
  if (usersSnap.empty) return;

  let sent = 0;
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const email = data.emailReport?.email || data.email;
    if (!email) continue;

    // Check cooldown: don't send another reminder if one was sent recently
    const lastReminder = data.lastWeightReminder?.toDate?.() || data.lastWeightReminder;
    if (lastReminder) {
      const cooldownMs = REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(lastReminder).getTime() < cooldownMs) continue;
    }

    // Check last weight log date
    const lastWeightLogDate = data.lastWeightLogDate; // stored as "YYYY-MM-DD"
    let daysSince = null;

    if (lastWeightLogDate) {
      if (lastWeightLogDate >= staleDateStr) continue; // recently logged, skip
      daysSince = Math.floor((now - new Date(lastWeightLogDate)) / (24 * 60 * 60 * 1000));
    } else {
      // No weight log at all — also check weightLogs sub-collection as fallback
      const logsSnap = await db
        .collection("users").doc(userDoc.id).collection("weightLogs")
        .orderBy("date", "desc")
        .limit(1)
        .get();

      if (!logsSnap.empty) {
        const latestDate = logsSnap.docs[0].data().date;
        if (latestDate >= staleDateStr) continue;
        daysSince = Math.floor((now - new Date(latestDate)) / (24 * 60 * 60 * 1000));
      }
      // If no logs at all, daysSince stays null — we'll still remind
    }

    try {
      const displayName = data.displayName || data.name || "";
      const html = buildWeightReminderHtml(displayName, daysSince);
      await getTransporter().sendMail({
        from: `"FoodCal" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `⚖️ Time to log your weight${daysSince ? ` (${daysSince} days since last entry)` : ""}`,
        html,
      });
      // Update cooldown timestamp
      await db.collection("users").doc(userDoc.id).set(
        { lastWeightReminder: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      sent++;
      console.log(`[WEIGHT REMINDER] Sent to ${email} (${daysSince ?? "no"} days since last log)`);
    } catch (e) {
      console.error(`[WEIGHT REMINDER] Failed for ${email}:`, e.message);
    }
  }

  if (sent > 0) console.log(`[WEIGHT REMINDER] Sent ${sent} reminder(s).`);
}

// ── Cron schedule: runs every minute ──
export function scheduleEmailReports() {
  const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD;
  if (!emailConfigured) {
    console.log("[EMAIL] Skipped - EMAIL_USER / EMAIL_APP_PASSWORD not set.");
    return;
  }

  // Per-user custom report schedule (checks every minute)
  cron.schedule("* * * * *", () => {
    checkAndSendScheduledReports().catch((e) => console.error("[EMAIL CRON] error:", e.message));
  });

  // Weight reminder: runs once daily at 10:00 AM
  cron.schedule("0 10 * * *", () => {
    checkAndSendWeightReminders().catch((e) => console.error("[WEIGHT REMINDER CRON] error:", e.message));
  });

  console.log("[EMAIL] Custom schedule checker started (checks every minute).");
  console.log("[WEIGHT REMINDER] Daily weight reminder cron started (10:00 AM).");
}
