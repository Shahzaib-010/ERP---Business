import "server-only";
import { connectDB } from "@/server/db/mongoose";
import { StaffUser } from "@/server/models/StaffUser";
import { Customer } from "@/server/models/Customer";
import { CustomerCredential } from "@/server/models/CustomerCredential";
import { verifyPassword } from "@/server/auth/password";
import { AppError, ValidationError, parseOrThrow } from "@/server/errors";
import { customerLoginSchema, staffLoginSchema } from "@/server/validation/auth";
import { normalizeCnic } from "@/lib/cnic";
import { recordAudit } from "@/server/services/audit";
import { createSession } from "./sessions";
import { assertNotThrottled, clearAccountFailures, recordLoginFailure } from "./throttle";

// One message for every failure, so the form does not reveal which usernames or CNICs exist.
const BAD_CREDENTIALS = "The login details are not correct.";

class LoginFailedError extends AppError {
  constructor(message = BAD_CREDENTIALS) {
    super(message, { code: "LOGIN_FAILED", status: 401 });
  }
}

/** Returns `{ token, expiresAt, role }`. Throws LoginFailedError, RateLimitError or ValidationError. */
export async function loginStaff(input, { ip, userAgent } = {}) {
  const { username, password } = parseOrThrow(staffLoginSchema, input);
  await connectDB();

  const subject = { account: `staff:${username}`, ip };
  await assertNotThrottled(subject);

  const user = await StaffUser.findOne({ username }).select("+passwordHash").lean();
  const ok = await verifyPassword(password, user?.passwordHash);

  if (!ok) {
    await recordLoginFailure(subject);
    if (user) {
      await recordAudit({
        action: "auth.staff_login_failed",
        scope: "security",
        entityType: "staffUser",
        entityId: user._id,
      });
    }
    throw new LoginFailedError();
  }
  if (!user.isActive) {
    // The password was right, so it is safe to say why.
    throw new LoginFailedError("This account is disabled. Ask the Superadmin.");
  }

  await clearAccountFailures(subject.account);
  await StaffUser.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  const { token, expiresAt } = await createSession({ kind: "staff", subjectId: user._id, userAgent });
  await recordAudit({
    actor: { kind: "staff", id: user._id, role: user.role },
    action: "auth.staff_login",
    scope: "security",
    entityType: "staffUser",
    entityId: user._id,
  });
  return { token, expiresAt, role: user.role };
}

/** Customer portal login: CNIC identifies, the password authenticates. */
export async function loginCustomer(input, { ip, userAgent } = {}) {
  const { cnic, password } = parseOrThrow(customerLoginSchema, input);
  const cnicNormalized = normalizeCnic(cnic);
  if (!cnicNormalized) {
    throw new ValidationError(undefined, { cnic: "A CNIC has 13 digits, e.g. 31303-1234567-1." });
  }
  await connectDB();

  const subject = { account: `customer:${cnicNormalized}`, ip };
  await assertNotThrottled(subject);

  const customer = await Customer.findOne({ cnicNormalized }).select("_id portalEnabled").lean();
  const credential = customer
    ? await CustomerCredential.findOne({ customerId: customer._id }).lean()
    : null;
  const ok = await verifyPassword(password, credential?.passwordHash);

  if (!ok || !customer.portalEnabled || !credential.isActive) {
    await recordLoginFailure(subject);
    throw new LoginFailedError();
  }

  await clearAccountFailures(subject.account);
  await CustomerCredential.updateOne({ _id: credential._id }, { $set: { lastLoginAt: new Date() } });
  const { token, expiresAt } = await createSession({
    kind: "customer",
    subjectId: customer._id,
    userAgent,
  });
  await recordAudit({
    actor: { kind: "customer", id: customer._id },
    action: "auth.customer_login",
    scope: "security",
    entityType: "customer",
    entityId: customer._id,
  });
  return { token, expiresAt };
}
