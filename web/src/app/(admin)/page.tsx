import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>AIBizScanner — internal report testing</h1>
      <p className="muted">Private tool for testing the Full Business Diagnostic. Milestone 1 skeleton.</p>
      <ul>
        <li>
          <Link href="/businesses">Businesses</Link> — list, add and edit test businesses
        </li>
        <li>
          <Link href="/reports">Reports</Link> — test reports, run monitor, stage reruns and cost
        </li>
        <li>
          <Link href="/health">Health</Link> — database connection and deployed commit
        </li>
      </ul>
    </main>
  );
}
