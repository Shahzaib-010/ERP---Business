import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;

// Comparing against a real hash when an account does not exist takes the same time as a
// real check, so response time does not reveal which usernames or CNICs exist.
let dummyHash;
async function getDummyHash() {
  dummyHash ??= bcrypt.hash("not-a-real-password", COST);
  return dummyHash;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

/** Returns true only if `hash` exists and matches. Always spends the bcrypt time. */
export async function verifyPassword(plain, hash) {
  if (!hash) {
    await bcrypt.compare(plain, await getDummyHash());
    return false;
  }
  return bcrypt.compare(plain, hash);
}
