// Edge + Node compatible auth helpers (Web Crypto only).

export const COOKIE = "svs_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (at least 16 characters).");
  return s;
}

function b64url(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function createSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `v1.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const exp = parseInt(parts[1], 10);
  if (!exp || exp < Date.now() / 1000) return false;
  try {
    return safeEqual(parts[2], await hmac(payload));
  } catch {
    return false;
  }
}

export async function checkPassword(pw: string) {
  const want = process.env.APP_PASSWORD;
  if (!want) throw new Error("APP_PASSWORD is not set.");
  // compare HMACs so timing doesn't leak length
  return safeEqual(await hmac("pw:" + pw), await hmac("pw:" + want));
}

/** Key used by the app to call its own API routes (fan-out of script generation). */
export async function internalKey() {
  return hmac("internal-call");
}

export async function isInternalCall(header: string | null) {
  if (!header) return false;
  try {
    return safeEqual(header, await internalKey());
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = MAX_AGE;
