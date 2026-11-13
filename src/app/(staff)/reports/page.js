import { redirect } from "next/navigation";

// "Reports" in the breadcrumb: the daily report is the only report for now.
export default function ReportsPage() {
  redirect("/reports/daily");
}
