import Link from "next/link";
import { Card } from "@/components/ui";
import { BUSINESS } from "@/lib/business";
import { LoginForm } from "../login-form";

export const metadata = { title: "Customer login" };

export default function CustomerLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <p className="text-sm text-slate-500">{BUSINESS.name}</p>
          <h1 className="text-2xl font-semibold">Customer login</h1>
          <p className="mt-1 text-sm text-slate-600">
            See your installment plans and payments.
          </p>
        </div>
        <Card>
          <LoginForm kind="customer" />
        </Card>
        <p className="text-center text-sm text-slate-600">
          Forgot your password? Visit the shop with your CNIC card.
        </p>
        <p className="text-center text-sm text-slate-600">
          Staff? <Link href="/login" className="font-medium underline">Staff login</Link>
        </p>
      </div>
    </main>
  );
}
