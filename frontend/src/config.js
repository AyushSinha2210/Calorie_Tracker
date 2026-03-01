/** Shared API base URL — single source of truth for all fetch calls */
const API_URL = process.env.REACT_APP_API_URL || "https://calorie-tracker-k014.onrender.com";
export default API_URL;

/**
 * Wrapper around fetch with a generous timeout for Render free-tier cold starts.
 * Use this for all backend API calls.
 */
export async function apiFetch(path, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out. The server may be waking up — please try again in 30 seconds.");
    if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))
      throw new Error("Cannot reach the server. It may be starting up — wait ~30s and retry.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
