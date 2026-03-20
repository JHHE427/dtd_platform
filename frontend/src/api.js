const DEFAULT_TIMEOUT_MS = 20000;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

export async function api(path, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? ((options.method || "GET").toUpperCase() === "GET" ? 1 : 0);
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(path, { ...options, signal: controller.signal });
      if (!resp.ok) {
        const msg = await parseErrorResponse(resp);
        const err = new Error(msg);
        err.status = resp.status;
        throw err;
      }
      return resp.json();
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
    } finally {
      clearTimeout(t);
    }
  }
}

export function query(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  return sp.toString();
}
