import Link from "next/link";
import { AuthShell } from "../../auth-shell";
import { LoginForm } from "../login-form";

export const metadata = { title: "Customer sign in" };

export default function CustomerLoginPage() {
  return (
    <AuthShell
      title="Customer sign in"
      description="See your installment plans and payment history."
      footer={
        <>
          <p>Forgot your password? Visit the shop with your CNIC card.</p>
          <p>
            Staff member?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Staff sign in
            </Link>
          </p>
        </>
      }
    >
      <LoginForm kind="customer" />
    </AuthShell>
  );
}
