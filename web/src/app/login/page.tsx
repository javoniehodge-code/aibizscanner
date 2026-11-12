import { safeNextPath } from "@/lib/auth-paths";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — AIBizScanner internal" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main>
      <h1>AIBizScanner — internal</h1>
      <p className="muted">Private testing tool. Accounts are created by the owner; there is no sign-up.</p>
      <LoginForm next={safeNextPath(next)} />
    </main>
  );
}
