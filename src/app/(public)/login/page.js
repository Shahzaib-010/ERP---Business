import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff sign in" };

export default function StaffLoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to the staff app with your username."
      footer={
        <p>
          Are you a customer?{" "}
          <Link href="/login/customer" className="font-medium text-primary hover:underline">
            Customer sign in
          </Link>
        </p>
      }
    >
      <LoginForm kind="staff" />
    </AuthShell>
  );
}
