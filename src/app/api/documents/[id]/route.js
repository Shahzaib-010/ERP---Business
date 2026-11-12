import { getStaffActor } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { getDocumentUrl } from "@/server/services/documents";

// GET /api/documents/:id          -> show the file (inline)
// GET /api/documents/:id?download -> download it
// Checks the session and permissions on every request, writes an audit entry, then
// redirects to a storage URL that is valid for 60 seconds. Nothing here is cached.
const NO_STORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

export async function GET(request, { params }) {
  const { id } = await params;
  const actor = await getStaffActor(); // customers and signed-out visitors get null
  if (!actor) return new Response("Please sign in as staff to open documents.", { status: 401, headers: NO_STORE });

  try {
    const download = new URL(request.url).searchParams.has("download");
    const url = await getDocumentUrl(actor, id, { download });
    return new Response(null, { status: 302, headers: { ...NO_STORE, location: url } });
  } catch (err) {
    if (err instanceof AppError) return new Response(err.message, { status: err.status, headers: NO_STORE });
    console.error("[documents] open failed:", err?.name, err?.message);
    return new Response("The document could not be opened. Please try again.", { status: 500, headers: NO_STORE });
  }
}
