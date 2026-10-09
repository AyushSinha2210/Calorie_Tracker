/**
 * Strava Service — Integration with Strava API v3 for activity synchronization.
 *
 * Strava API endpoints:
 *   - Authorize: https://www.strava.com/oauth/authorize
 *   - Token:     POST https://www.strava.com/oauth/token
 *   - Activities: GET https://www.strava.com/api/v3/athlete/activities
 */

import { calculateCaloriesBurned } from "./workoutService.js";

const STRAVA_AUTH_BASE = "https://www.strava.com/oauth";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export function getStravaAuthUrl({ redirectUri, state }) {
  const clientId = process.env.STRAVA_CLIENT_ID || "";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri || "https://localhost:3000/strava-callback",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  if (state) params.set("state", state);
  return `${STRAVA_AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeStravaCode({ code, clientId, clientSecret }) {
  const cId = clientId || process.env.STRAVA_CLIENT_ID;
  const cSecret = clientSecret || process.env.STRAVA_CLIENT_SECRET;

  if (!cId || !cSecret) {
    throw new Error("Strava Client ID and Client Secret are required");
  }

  const res = await fetch(`${STRAVA_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cId,
      client_secret: cSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Strava token exchange failed with HTTP ${res.status}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    expiresIn: data.expires_in,
    athlete: data.athlete
      ? {
          id: data.athlete.id,
          username: data.athlete.username,
          firstname: data.athlete.firstname,
          lastname: data.athlete.lastname,
          profile: data.athlete.profile,
        }
      : null,
  };
}

export async function refreshStravaToken({ refreshToken, clientId, clientSecret }) {
  const cId = clientId || process.env.STRAVA_CLIENT_ID;
  const cSecret = clientSecret || process.env.STRAVA_CLIENT_SECRET;

  const res = await fetch(`${STRAVA_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cId,
      client_secret: cSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Strava token refresh failed with HTTP ${res.status}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

export async function fetchStravaActivities({ accessToken, perPage = 30, after = null }) {
  if (!accessToken) throw new Error("Strava access token is required");

  const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
  url.searchParams.set("per_page", String(perPage));
  if (after) url.searchParams.set("after", String(after));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Strava API error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Maps a raw Strava activity into a standard FoodCal workout entry.
 */
export function mapStravaActivityToWorkout(act, userWeightKg = 70) {
  const durationMin = Math.max(1, Math.round((act.moving_time || act.elapsed_time || 0) / 60));
  const distanceKm = Number(((act.distance || 0) / 1000).toFixed(2));
  const startDateStr = act.start_date_local ? act.start_date_local.split("T")[0] : new Date().toISOString().split("T")[0];

  const type = (act.type || "Workout").toLowerCase();
  const sportType = (act.sport_type || "").toLowerCase();

  let category = "Cardio";
  let inputType = "cardio";
  let met = 7.0;
  let image = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&auto=format&fit=crop&q=80";

  if (type.includes("badminton") || sportType.includes("badminton")) {
    category = "Sports";
    inputType = "sports";
    met = 7.0;
    image = "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&auto=format&fit=crop&q=80";
  } else if (type.includes("soccer") || type.includes("football") || sportType.includes("soccer")) {
    category = "Sports";
    inputType = "sports";
    met = 8.5;
    image = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=80";
  } else if (type.includes("tennis") || sportType.includes("tennis") || sportType.includes("pickleball")) {
    category = "Sports";
    inputType = "sports";
    met = 7.3;
    image = "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=80";
  } else if (type.includes("cricket")) {
    category = "Sports";
    inputType = "sports";
    met = 5.0;
    image = "https://images.unsplash.com/photo-1531415074868-036b107e775a?w=400&auto=format&fit=crop&q=80";
  } else if (type.includes("basketball")) {
    category = "Sports";
    inputType = "sports";
    met = 8.0;
    image = "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80";
  } else if (type.includes("squash")) {
    category = "Sports";
    inputType = "sports";
    met = 12.0;
    image = "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&auto=format&fit=crop&q=80";
  } else if (type.includes("ride") || type.includes("cycling")) {
    category = "Cardio";
    inputType = "cardio";
    met = 7.5;
    image = "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=300&auto=format&fit=crop&q=80";
  } else if (type.includes("swim")) {
    category = "Cardio";
    inputType = "cardio";
    met = 8.0;
    image = "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=300&auto=format&fit=crop&q=80";
  } else if (type.includes("walk") || type.includes("hike")) {
    category = "Cardio";
    inputType = "cardio";
    met = 3.8;
    image = "https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=300&auto=format&fit=crop&q=80";
  } else if (type.includes("weight") || type.includes("crossfit") || type.includes("gym")) {
    category = "General";
    inputType = "weighted";
    met = 5.0;
    image = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&auto=format&fit=crop&q=80";
  } else {
    // Run / default
    category = "Cardio";
    inputType = "cardio";
    met = 9.8;
    image = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&auto=format&fit=crop&q=80";
  }

  // Calculate calories burned
  let caloriesBurned = act.calories ? Math.round(act.calories) : 0;
  if (!caloriesBurned || caloriesBurned <= 0) {
    const calc = calculateCaloriesBurned({
      exerciseName: act.name,
      inputType,
      durationMin,
      weightKg: userWeightKg,
    });
    caloriesBurned = calc.caloriesBurned;
  }

  return {
    exerciseName: act.name || `${act.type} (Strava)`,
    exerciseId: -1,
    category,
    inputType,
    durationMin,
    distanceKm,
    caloriesBurned,
    met,
    effectiveDurationMin: durationMin,
    weightKg: userWeightKg,
    sets: 0,
    reps: 0,
    liftedWeight: 0,
    holdSeconds: 0,
    image,
    date: startDateStr,
    stravaActivityId: String(act.id),
    source: "strava",
  };
}

