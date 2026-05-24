function bytesFromBase64(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64url(new Uint8Array(signature));
}

export async function signEnvelope(payload, secret) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

export async function verifyEnvelope(value, secret) {
  if (!value || !secret) return null;
  const [encoded, sig] = String(value).split(".");
  if (!encoded || !sig) return null;
  if ((await hmac(encoded, secret)) !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytesFromBase64(encoded)));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
