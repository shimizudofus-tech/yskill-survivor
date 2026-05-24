const SESSION_COOKIE = "yskill_survivor_session";
const OAUTH_STATE_COOKIE = "yskill_survivor_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export { SESSION_COOKIE, OAUTH_STATE_COOKIE, SESSION_MAX_AGE_SECONDS };

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        return eq === -1 ? [part, ""] : [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      }),
  );
}

function secureCookie(request, env) {
  return new URL(request.url).protocol === "https:" || String(env.PUBLIC_API_URL || "").startsWith("https://");
}

export function cookieHeader(name, value, request, env, maxAge = SESSION_MAX_AGE_SECONDS, httpOnly = true) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=None",
    httpOnly ? "HttpOnly" : "",
    secureCookie(request, env) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearCookieHeader(name, request, env) {
  return cookieHeader(name, "", request, env, 0);
}

export function apiOrigin(request, env) {
  const configured = env.PUBLIC_API_URL || env.URL;
  return configured ? configured.replace(/\/+$/, "") : new URL(request.url).origin;
}

export function allowedOrigins(env) {
  return String(env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function json(data, status = 200, extraHeaders = {}, request = null, env = null) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  };
  if (request && env) Object.assign(headers, corsHeaders(request, env));
  return new Response(JSON.stringify(data), { status, headers });
}

export async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > 64_000) throw new Error("Body too large");
  return text ? JSON.parse(text) : {};
}

export function safeReturnTo(raw, env) {
  const fallback = String(env.PUBLIC_PLAY_URL || "https://yskillstudio.com/play/").replace(/\/?$/, "/");
  try {
    const allowed = new URL(fallback);
    const target = new URL(raw || fallback);
    if (target.origin !== allowed.origin) return fallback;
    return target.href;
  } catch {
    return fallback;
  }
}
