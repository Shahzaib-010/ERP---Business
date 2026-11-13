import "server-only";
import { connectDB } from "@/server/db/mongoose";
import { Session } from "@/server/models/Session";
import { StaffUser } from "@/server/models/StaffUser";
import { Customer } from "@/server/models/Customer";
import { CustomerCredential } from "@/server/models/CustomerCredential";
import { hashSessionToken, newSessionToken } from "@/server/auth/tokens";

// Staff use shared office computers, so their sessions are short.
export const SESSION_TTL_MS = {
  staff: 12 * 60 * 60 * 1000, // 12 hours
  customer: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function createSession({ kind, subjectId, userAgent }) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS[kind]);
  await Session.create({
    tokenHash: hashSessionToken(token),
    kind,
    subjectId,
    expiresAt,
    userAgent: userAgent?.slice(0, 300),
  });
  return { token, expiresAt };
}

/**
 * Turn a cookie token into the signed-in actor, or null. Checks the account on every call,
 * so a disabled account or a disabled portal login loses access at once.
 *
 * Staff actor:    { kind: "staff", id, sessionId, name, username, role, permissions, isActive }
 * Customer actor: { kind: "customer", id, sessionId, name }
 */
export async function resolveSession(token) {
  if (!token || typeof token !== "string" || token.length > 200) return null;
  await connectDB();

  // One round trip: the session plus its account (and, for customers, the login row).
  // This runs on every request, so it is the main thing between a click and the page.
  const [session] = await Session.aggregate([
    { $match: { tokenHash: hashSessionToken(token), expiresAt: { $gt: new Date() } } },
    { $limit: 1 },
    {
      $lookup: {
        from: StaffUser.collection.name,
        localField: "subjectId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, username: 1, role: 1, permissions: 1, isActive: 1 } }],
        as: "staff",
      },
    },
    {
      $lookup: {
        from: Customer.collection.name,
        localField: "subjectId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, portalEnabled: 1 } }],
        as: "customer",
      },
    },
    {
      $lookup: {
        from: CustomerCredential.collection.name,
        localField: "subjectId",
        foreignField: "customerId",
        pipeline: [{ $project: { isActive: 1 } }],
        as: "credential",
      },
    },
  ]);
  if (!session) return null;

  const actor =
    session.kind === "staff"
      ? staffActor(session, session.staff[0])
      : customerActor(session, session.customer[0], session.credential[0]);

  if (!actor) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  return actor;
}

function staffActor(session, user) {
  if (!user || !user.isActive) return null;
  return {
    kind: "staff",
    id: String(user._id),
    sessionId: String(session._id),
    name: user.name,
    username: user.username,
    role: user.role,
    permissions: user.permissions ?? [],
    isActive: true,
  };
}

function customerActor(session, customer, credential) {
  if (!customer || !customer.portalEnabled || !credential?.isActive) return null;
  return {
    kind: "customer",
    id: String(customer._id),
    sessionId: String(session._id),
    name: customer.name,
  };
}

export async function deleteSessionByToken(token) {
  if (!token) return;
  await connectDB();
  await Session.deleteOne({ tokenHash: hashSessionToken(token) });
}

/** Sign an account out everywhere, optionally keeping one session (the one making the change). */
export async function deleteSessionsFor(kind, subjectId, { exceptSessionId, session } = {}) {
  const filter = { kind, subjectId };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  await Session.deleteMany(filter, session ? { session } : undefined);
}
