import Link from "next/link";
import { Card } from "@/components/ui";
import { BUSINESS } from "@/lib/business";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff login" };

export default function StaffLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <p className="text-sm text-slate-500">{BUSINESS.name}</p>
          <h1 className="text-2xl font-semibold">Staff login</h1>
        </div>
        <Card>
          <LoginForm kind="staff" />
        </Card>
        <p className="text-center text-sm text-slate-600">
          Customer? <Link href="/login/customer" className="font-medium underline">Customer login</Link>
        </p>
      </div>
    </main>
  );
}
