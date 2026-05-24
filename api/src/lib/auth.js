import {
  apiOrigin,
  cookieHeader,
  clearCookieHeader,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  parseCookies,
} from "./http.js";
import { signEnvelope, verifyEnvelope } from "./session.js";
import { getUser, publicUser, putUser } from "./store.js";

export function providerStatus(env) {
  return {
    discord: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  };
}

export async function sessionUser(request, env, kv) {
  const session = await verifyEnvelope(parseCookies(request)[SESSION_COOKIE], env.SESSION_SECRET);
  if (!session?.uid) return null;
  return getUser(kv, session.uid);
}

export function buildUserId(provider, providerUserId) {
  return `${provider}:${providerUserId}`;
}

export async function upsertOAuthUser(kv, profile) {
  const now = Date.now();
  const id = buildUserId(profile.provider, profile.providerUserId);
  const existing = (await getUser(kv, id)) || {};
  const user = {
    ...existing,
    id,
    provider: profile.provider,
    providerUserId: String(profile.providerUserId),
    displayName: profile.displayName || existing.displayName || "Player",
    avatarUrl: profile.avatarUrl || existing.avatarUrl || "",
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  await putUser(kv, user);
  return user;
}

export async function createSession(user, request, env) {
  const session = await signEnvelope(
    { uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 },
    env.SESSION_SECRET,
  );
  return cookieHeader(SESSION_COOKIE, session, request, env);
}

async function exchangeDiscordCode(env, code, redirectUri) {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Discord token exchange failed");
  const data = await res.json();
  return data.access_token;
}

async function fetchDiscordProfile(accessToken) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Discord profile fetch failed");
  const data = await res.json();
  const avatarUrl = data.avatar
    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128`
    : "";
  return {
    provider: "discord",
    providerUserId: data.id,
    displayName: data.global_name || data.username || "Player",
    avatarUrl,
  };
}

async function exchangeGoogleCode(env, code, redirectUri) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Google token exchange failed");
  const data = await res.json();
  return data.access_token;
}

async function fetchGoogleProfile(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Google profile fetch failed");
  const data = await res.json();
  return {
    provider: "google",
    providerUserId: data.sub,
    displayName: data.name || data.email || "Player",
    avatarUrl: data.picture || "",
  };
}

export async function loginRedirect(provider, request, env, returnTo) {
  if (!env.SESSION_SECRET) return { error: "auth_not_configured", status: 503 };
  const providers = providerStatus(env);
  if (!providers[provider]) return { error: "provider_not_configured", status: 503 };

  const origin = apiOrigin(request, env);
  const redirectUri = `${origin}/v1/auth/callback/${provider}`;
  const statePayload = {
    provider,
    returnTo,
    nonce: crypto.randomUUID?.() || String(Date.now()),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const state = await signEnvelope(statePayload, env.SESSION_SECRET);

  let authUrl;
  if (provider === "discord") {
    authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "identify");
    authUrl.searchParams.set("state", state);
  } else {
    authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "select_account");
  }

  return {
    redirect: authUrl.href,
    stateCookie: cookieHeader(OAUTH_STATE_COOKIE, state, request, env, 10 * 60),
  };
}

export async function handleOAuthCallback(provider, request, env, kv, code, state, returnToFallback) {
  const cookies = parseCookies(request);
  const statePayload = await verifyEnvelope(state, env.SESSION_SECRET);
  if (!code || !statePayload || statePayload.provider !== provider || cookies[OAUTH_STATE_COOKIE] !== state) {
    return { error: "invalid_callback", status: 400 };
  }

  const origin = apiOrigin(request, env);
  const redirectUri = `${origin}/v1/auth/callback/${provider}`;
  let profile;
  if (provider === "discord") {
    const token = await exchangeDiscordCode(env, code, redirectUri);
    profile = await fetchDiscordProfile(token);
  } else {
    const token = await exchangeGoogleCode(env, code, redirectUri);
    profile = await fetchGoogleProfile(token);
  }

  const user = await upsertOAuthUser(kv, profile);
  const sessionCookie = await createSession(user, request, env);
  const returnTo = statePayload.returnTo || returnToFallback;
  return { user, sessionCookie, returnTo, clearStateCookie: clearCookieHeader(OAUTH_STATE_COOKIE, request, env) };
}

export async function authMe(request, env, kv) {
  const user = await sessionUser(request, env, kv);
  return { user: publicUser(user), providers: providerStatus(env) };
}
