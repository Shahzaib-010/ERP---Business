"use server";

import { getStaffActor } from "@/server/auth/current";
import { universalSearch } from "@/server/services/search";

/** Live results for the Ctrl+K menu. Re-checks the session and permissions on every call. */
export async function quickSearchAction(q) {
  const actor = await getStaffActor();
  if (!actor || typeof q !== "string" || q.trim().length < 2) return { groups: [] };
  try {
    const { groups } = await universalSearch(actor, q);
    return { groups: groups.map((g) => ({ ...g, items: g.items.slice(0, 6) })) };
  } catch {
    return { groups: [] };
  }
}
