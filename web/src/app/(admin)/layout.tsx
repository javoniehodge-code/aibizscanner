import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

// Every page in this group reads the session, so none of them can be prerendered.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <>
      <nav
        style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 24px", borderBottom: "1px solid var(--line)" }}
      >
        <strong>AIBizScanner internal</strong>
        <Link href="/">Home</Link>
        <Link href="/health">Health</Link>
        <span style={{ marginLeft: "auto" }} className="muted">
          {session.email}
        </span>
        <form action={signOut}>
          <button type="submit" className="secondary">
            Sign out
          </button>
        </form>
      </nav>
      {children}
    </>
  );
}
