import {
  clearCookieHeader,
  corsHeaders,
  json,
  readJsonBody,
  safeReturnTo,
  SESSION_COOKIE,
} from "./lib/http.js";
import { authMe, handleOAuthCallback, loginRedirect, sessionUser } from "./lib/auth.js";
import { completeRun, fetchLeaderboard, publicConfig, startRun } from "./lib/runs.js";

export default {
  async fetch(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  const kv = env.SURVIVOR_KV;

  try {
    if (path === "/health" && method === "GET") {
      return json({ ok: true, service: "yskill-survivor-api" }, 200, corsHeaders(request, env), request, env);
    }

    if (path === "/v1/config" && method === "GET") {
      return json({ ok: true, config: publicConfig() }, 200, corsHeaders(request, env), request, env);
    }

    if (path === "/v1/auth/me" && method === "GET") {
      if (!kv) return json({ error: "kv_not_configured" }, 503, corsHeaders(request, env), request, env);
      const result = await authMe(request, env, kv);
      return json(result, 200, corsHeaders(request, env), request, env);
    }

    if (path === "/v1/auth/logout" && method === "POST") {
      return json(
        { ok: true },
        200,
        {
          ...corsHeaders(request, env),
          "set-cookie": clearCookieHeader(SESSION_COOKIE, request, env),
        },
        request,
        env,
      );
    }

    const loginMatch = path.match(/^\/v1\/auth\/login\/(discord|google)$/);
    if (loginMatch && method === "GET") {
      const provider = loginMatch[1];
      const returnTo = safeReturnTo(url.searchParams.get("returnTo"), env);
      const result = await loginRedirect(provider, request, env, returnTo);
      if (result.error) {
        return json(result, result.status || 400, corsHeaders(request, env), request, env);
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: result.redirect,
          "set-cookie": result.stateCookie,
          "cache-control": "no-store",
          ...corsHeaders(request, env),
        },
      });
    }

    const callbackMatch = path.match(/^\/v1\/auth\/callback\/(discord|google)$/);
    if (callbackMatch && method === "GET") {
      if (!kv) return json({ error: "kv_not_configured" }, 503, corsHeaders(request, env), request, env);
      const provider = callbackMatch[1];
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const fallback = safeReturnTo(null, env);
      const result = await handleOAuthCallback(provider, request, env, kv, code, state, fallback);
      if (result.error) {
        return json(result, result.status || 400, corsHeaders(request, env), request, env);
      }
      const headers = new Headers({
        Location: result.returnTo,
        "cache-control": "no-store",
        ...corsHeaders(request, env),
      });
      headers.append("set-cookie", result.sessionCookie);
      headers.append("set-cookie", result.clearStateCookie);
      return new Response(null, { status: 302, headers });
    }

    if (path === "/v1/runs/start" && method === "POST") {
      if (!kv) return json({ error: "kv_not_configured" }, 503, corsHeaders(request, env), request, env);
      const user = await sessionUser(request, env, kv);
      if (!user) return json({ error: "sign_in_required" }, 401, corsHeaders(request, env), request, env);
      const body = await readJsonBody(request);
      const result = await startRun(kv, user, body);
      if (result.error) return json(result, result.status || 400, corsHeaders(request, env), request, env);
      return json(result, 200, corsHeaders(request, env), request, env);
    }

    if (path === "/v1/runs/complete" && method === "POST") {
      if (!kv) return json({ error: "kv_not_configured" }, 503, corsHeaders(request, env), request, env);
      const user = await sessionUser(request, env, kv);
      if (!user) return json({ error: "sign_in_required" }, 401, corsHeaders(request, env), request, env);
      const body = await readJsonBody(request);
      const result = await completeRun(kv, user, body);
      if (result.error) return json(result, result.status || 400, corsHeaders(request, env), request, env);
      return json(result, 200, corsHeaders(request, env), request, env);
    }

    if (path === "/v1/leaderboards/adventure" && method === "GET") {
      if (!kv) return json({ error: "kv_not_configured" }, 503, corsHeaders(request, env), request, env);
      const user = await sessionUser(request, env, kv);
      const stageId = url.searchParams.get("stageId");
      const result = await fetchLeaderboard(kv, "adventure", stageId, user?.id || "");
      if (result.error) return json(result, result.status || 400, corsHeaders(request, env), request, env);
      return json(result, 200, corsHeaders(request, env), request, env);
    }

    if (path === "/v1/leaderboards/fullskill" && method === "GET") {
      if (!kv) return json({ error: "kv_not_configured" }, 503, corsHeaders(request, env), request, env);
      const user = await sessionUser(request, env, kv);
      const result = await fetchLeaderboard(kv, "fullskill", null, user?.id || "");
      if (result.error) return json(result, result.status || 400, corsHeaders(request, env), request, env);
      return json(result, 200, corsHeaders(request, env), request, env);
    }

    return json({ error: "not_found" }, 404, corsHeaders(request, env), request, env);
  } catch (err) {
    return json(
      { error: "server_error", message: err?.message || "Unexpected error" },
      500,
      corsHeaders(request, env),
      request,
      env,
    );
  }
  },
};
