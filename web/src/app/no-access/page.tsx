import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "No access — AIBizScanner internal" };

export default async function NoAccessPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <main>
      <h1>No access</h1>
      <p>
        You are signed in as <strong>{user.email}</strong>, but this account is not an admin of this tool.
      </p>
      <p className="muted">Ask the owner to add your user id to the admin_user table.</p>
      <form action={signOut}>
        <button type="submit" className="secondary">
          Sign out
        </button>
      </form>
    </main>
  );
}
