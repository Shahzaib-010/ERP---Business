import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { getEnv } from "@/server/config/env";

/** A new random session token. Only the browser cookie ever holds the raw value. */
export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * What the database stores instead of the token. Keyed with SESSION_SECRET, so a copy of
 * the database alone cannot be turned back into working cookies.
 */
export function hashSessionToken(token) {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(token).digest("hex");
}

/** Hash for rate-limit keys, so usernames, CNICs and IPs are not stored in plain text. */
export function hashKey(value) {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(`rl:${value}`).digest("hex");
}
