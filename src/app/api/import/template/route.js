import writeExcelFile from "write-excel-file/node";
import { getStaffActor } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { CUSTOMER_TEMPLATE_EXAMPLE, CUSTOMER_TEMPLATE_HEADERS } from "@/lib/imports";

// GET /api/import/template?format=xlsx|csv -> an empty customer import template with the
// expected column names and one example row (to be replaced). Needs "customers.create".
export async function GET(request) {
  const actor = await getStaffActor();
  if (!actor || !can(actor, "customers.create")) return new Response("Not allowed.", { status: 403 });

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  if (format === "csv") {
    const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = `﻿${[CUSTOMER_TEMPLATE_HEADERS, CUSTOMER_TEMPLATE_EXAMPLE].map((r) => r.map(esc).join(",")).join("\r\n")}\r\n`;
    return new Response(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="customers-template.csv"' },
    });
  }

  const header = CUSTOMER_TEMPLATE_HEADERS.map((value) => ({ value, fontWeight: "bold", backgroundColor: "#EEF0F4" }));
  // Text cells, so Excel keeps the leading 0 of phone numbers and the CNIC dashes.
  const example = CUSTOMER_TEMPLATE_EXAMPLE.map((value) => ({ value, type: String }));
  const buffer = await writeExcelFile([header, example], {
    sheet: "Customers",
    columns: CUSTOMER_TEMPLATE_HEADERS.map((h) => ({ width: Math.max(14, h.length + 6) })),
    stickyRowsCount: 1,
  }).toBuffer();
  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="customers-template.xlsx"',
    },
  });
}
