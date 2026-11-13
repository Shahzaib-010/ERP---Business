import { getStaffActor } from "@/server/auth/current";
import { universalSearch } from "@/server/services/search";

// GET /api/search?q=… -> live results for the Ctrl+K menu.
// A plain GET (not a Server Action) so it never holds up page navigation: the router runs
// Server Actions one at a time, and a click made while one is in flight has to wait for it.
// Checks the session itself; the search service checks permissions per module.
const NO_STORE = { "cache-control": "no-store" };

export async function GET(request) {
  const actor = await getStaffActor();
  if (!actor) return Response.json({ groups: [] }, { status: 401, headers: NO_STORE });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2 || q.length > 100) return Response.json({ groups: [] }, { headers: NO_STORE });
  try {
    const { groups } = await universalSearch(actor, q);
    return Response.json({ groups: groups.map((g) => ({ ...g, items: g.items.slice(0, 6) })) }, { headers: NO_STORE });
  } catch {
    return Response.json({ groups: [] }, { status: 500, headers: NO_STORE });
  }
}
