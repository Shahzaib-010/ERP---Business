"use server";

import { runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import { markNotificationsRead } from "@/server/services/notifications";

// The bell reads from GET /api/notifications; this marks it as read. Each call re-reads the session; the service checks permissions.

export async function markNotificationsReadAction() {
  return runAction(async () => markNotificationsRead(await getStaffActor()));
}
