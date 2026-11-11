import "server-only";
import mongoose from "mongoose";
import { connectDB, withTransaction } from "@/server/db/mongoose";
import { Customer } from "@/server/models/Customer";
import { CustomerCredential } from "@/server/models/CustomerCredential";
import { hashPassword } from "@/server/auth/password";
import { NotFoundError, parseOrThrow } from "@/server/errors";
import { requirePermission } from "@/server/permissions";
import { resetPasswordSchema } from "@/server/validation/auth";
import { recordAudit } from "@/server/services/audit";
import { deleteSessionsFor } from "@/server/services/auth/sessions";

// Staff turn on a customer's portal login and set or reset the password in person, after
// checking the CNIC (proposed answer to open decision 9; no email or SMS needed).

async function loadCustomer(customerId, session) {
  if (!mongoose.isValidObjectId(customerId)) throw new NotFoundError("Customer not found.");
  const customer = await Customer.findById(customerId).session(session);
  if (!customer) throw new NotFoundError("Customer not found.");
  return customer;
}

export async function setCustomerPortalPassword(actor, customerId, input) {
  requirePermission(actor, "customers.edit");
  const { password } = parseOrThrow(resetPasswordSchema, input);
  const passwordHash = await hashPassword(password);
  await connectDB();

  await withTransaction(async (session) => {
    const customer = await loadCustomer(customerId, session);
    await CustomerCredential.updateOne(
      { customerId: customer._id },
      { $set: { passwordHash, isActive: true, passwordChangedAt: new Date() } },
      { upsert: true, session },
    );
    const wasEnabled = customer.portalEnabled;
    customer.portalEnabled = true;
    await customer.save({ session });
    // A new password signs the customer out of every device.
    await deleteSessionsFor("customer", customer._id, { session });
    await recordAudit(
      {
        actor,
        action: "customer.portal_password_set",
        scope: "security",
        entityType: "customer",
        entityId: customer._id,
        before: { portalEnabled: wasEnabled },
        after: { portalEnabled: true },
      },
      session,
    );
  });
}

export async function disableCustomerPortal(actor, customerId) {
  requirePermission(actor, "customers.edit");
  await connectDB();

  await withTransaction(async (session) => {
    const customer = await loadCustomer(customerId, session);
    customer.portalEnabled = false;
    await customer.save({ session });
    await CustomerCredential.updateOne(
      { customerId: customer._id },
      { $set: { isActive: false } },
      { session },
    );
    await deleteSessionsFor("customer", customer._id, { session });
    await recordAudit(
      {
        actor,
        action: "customer.portal_disabled",
        scope: "security",
        entityType: "customer",
        entityId: customer._id,
        before: { portalEnabled: true },
        after: { portalEnabled: false },
      },
      session,
    );
  });
}
