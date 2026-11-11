import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { resolveSession } from "@/server/services/auth/sessions";
import { can } from "@/server/permissions";
import { getEnv } from "@/server/config/env";

// The data access layer for "who is signed in". Every page, Server Action and route handler
// that touches protected data calls one of these itself. proxy.js only redirects.

// "__Host-" makes the browser refuse the cookie unless it is Secure, host-only and path "/".
// Plain HTTP on localhost cannot use it, so development uses a plain name.
export function sessionCookieName() {
  return getEnv().NODE_ENV === "production" ? "__Host-bb_session" : "bb_session";
}

/** The signed-in actor for this request, or null. Looked up once per request. */
export const getActor = cache(async () => {
  // Session checks compare against the current time, so they must never be prerendered.
  await connection();
  const token = (await cookies()).get(sessionCookieName())?.value;
  return resolveSession(token);
});

export async function getStaffActor() {
  const actor = await getActor();
  return actor?.kind === "staff" ? actor : null;
}

export async function getCustomerActor() {
  const actor = await getActor();
  return actor?.kind === "customer" ? actor : null;
}

/** For staff pages. Not signed in -> login page. Missing permission -> "no access" page. */
export async function requireStaffPage(permission) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.kind !== "staff") redirect("/portal");
  if (permission && !can(actor, permission)) redirect("/no-access");
  return actor;
}

/** For customer portal pages. */
export async function requireCustomerPage() {
  const actor = await getActor();
  if (!actor) redirect("/login/customer");
  if (actor.kind !== "customer") redirect("/dashboard");
  return actor;
}

/** Only call from a Server Action or route handler. */
export async function setSessionCookie(token, expiresAt) {
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function readSessionToken() {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName());
}

/** Client IP and user agent, used only for login rate limiting and the session row. */
export async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-nf-client-connection-ip") || // Netlify
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined;
  return { ip, userAgent: h.get("user-agent") ?? undefined };
}
