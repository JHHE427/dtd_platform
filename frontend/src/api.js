const DEFAULT_TIMEOUT_MS = 60000;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const APP_BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

// In-flight GET dedup: identical concurrent requests share one Promise.
const inFlight = new Map();

function shouldUseAppBase() {
  if (!APP_BASE || typeof window === "undefined") return false;
  return window.location.pathname === APP_BASE || window.location.pathname.startsWith(`${APP_BASE}/`);
}

export function appPath(path) {
  if (!path || typeof path !== "string") return path;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;
  if (!path.startsWith("/")) return path;
  if (!shouldUseAppBase()) return path;
  if (path === APP_BASE || path.startsWith(`${APP_BASE}/`)) return path;
  return `${APP_BASE}${path}`;
}

async function parseErrorResponse(resp) {
  const ctype = resp.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const data = await resp.json().catch(() => null);
    if (data?.detail) return String(data.detail);
    if (data?.error) return String(data.error);
  }
  const text = await resp.text().catch(() => "");
  return text || `HTTP ${resp.status}`;
}

export function isAbortError(err) {
  return err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("aborted");
}

async function fetchOnce(path, options, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestPath = appPath(path);
    const resp = await fetch(requestPath, { ...options, signal: controller.signal });
    if (!resp.ok) {
      const msg = await parseErrorResponse(resp);
      const err = new Error(msg);
      err.status = resp.status;
      throw err;
    }
    return resp.json();
  } finally {
    clearTimeout(t);
  }
}

export async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? (method === "GET" ? 1 : 0);
  const dedup = method === "GET" && !options.body && options.dedup !== false;

  const runner = async () => {
    let attempt = 0;
    while (true) {
      try {
        return await fetchOnce(path, options, timeoutMs);
      } catch (err) {
        if (isAbortError(err)) {
          throw new Error("Request timeout");
        }
        const status = Number(err?.status || 0);
        const retryable = !status || RETRYABLE_STATUS.has(status);
        if (attempt < retries && retryable) {
          attempt += 1;
          await sleep(260 * attempt);
          continue;
        }
        throw err;
      }
    }
  };

  if (!dedup) return runner();
  const key = `${method} ${path}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = runner().finally(() => {
    if (inFlight.get(key) === p) inFlight.delete(key);
  });
  inFlight.set(key, p);
  return p;
}

export function query(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  return sp.toString();
}
