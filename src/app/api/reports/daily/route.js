import { getStaffActor } from "@/server/auth/current";
import { AppError } from "@/server/errors";
import { getDailyReport } from "@/server/services/reports";
import { dailyReportWorkbook } from "@/server/services/reports/excel";

// GET /api/reports/daily?date=YYYY-MM-DD -> the daily report as an Excel (.xlsx) download.
// Checks the session and permissions itself (the service needs "transactions.view").
export async function GET(request) {
  const actor = await getStaffActor();
  if (!actor) return new Response("Please sign in as staff.", { status: 401, headers: { "cache-control": "no-store" } });

  try {
    const date = new URL(request.url).searchParams.get("date") ?? undefined;
    const report = await getDailyReport(actor, { date });
    const buffer = await dailyReportWorkbook(report);
    return new Response(buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="daily-report-${report.date}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return new Response(err.message, { status: err.status, headers: { "cache-control": "no-store" } });
    console.error("[reports] excel export failed:", err?.name, err?.message);
    return new Response("The report could not be created. Please try again.", { status: 500 });
  }
}
