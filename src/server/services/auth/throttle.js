import "server-only";
import { LoginThrottle } from "@/server/models/LoginThrottle";
import { hashKey } from "@/server/auth/tokens";
import { RateLimitError } from "@/server/errors";

const WINDOW_MS = 15 * 60 * 1000;

// Per account (username or CNIC): stops password guessing on one account.
// Per IP: stops one machine trying many accounts. Generous, since an office shares one IP.
export const LIMITS = { account: 5, ip: 30 };

function keysFor({ account, ip }) {
  const keys = [{ key: hashKey(`acct:${account}`), limit: LIMITS.account }];
  if (ip) keys.push({ key: hashKey(`ip:${ip}`), limit: LIMITS.ip });
  return keys;
}

/** Throws RateLimitError if the account or IP has too many recent failures. */
export async function assertNotThrottled(subject) {
  const keys = keysFor(subject);
  const rows = await LoginThrottle.find({
    key: { $in: keys.map((k) => k.key) },
    expiresAt: { $gt: new Date() },
  }).lean();
  for (const row of rows) {
    const { limit } = keys.find((k) => k.key === row.key);
    if (row.failures >= limit) throw new RateLimitError();
  }
}

export async function recordLoginFailure(subject) {
  const now = new Date();
  await Promise.all(
    keysFor(subject).map(async ({ key }) => {
      // Start a fresh window if the old one has expired but the TTL monitor has not removed it.
      await LoginThrottle.deleteOne({ key, expiresAt: { $lte: now } });
      await LoginThrottle.updateOne(
        { key },
        { $inc: { failures: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + WINDOW_MS) } },
        { upsert: true },
      );
    }),
  );
}

/** After a successful login, forget that account's failures (the IP count stays). */
export async function clearAccountFailures(account) {
  await LoginThrottle.deleteOne({ key: hashKey(`acct:${account}`) });
}
