import { getStaffActor } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { getNotifications } from "@/server/services/notifications";

// GET /api/notifications -> what the header bell shows.
// A plain GET (not a Server Action) so the bell's background refresh never delays a click
// on a link: the router runs Server Actions one at a time and navigations wait behind them.
// Checks the session itself; the service checks permissions per module.
const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  const actor = await getStaffActor();
  if (!actor) return Response.json({ ok: false }, { status: 401, headers: NO_STORE });
  try {
    return Response.json({ ok: true, data: await getNotifications(actor) }, { headers: NO_STORE });
  } catch (err) {
    const status = err instanceof AppError ? err.status : 500;
    return Response.json({ ok: false }, { status, headers: NO_STORE });
  }
}
