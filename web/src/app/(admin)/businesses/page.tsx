import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Businesses — AIBizScanner internal" };

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business")
    .select("id, name, website, category, location, service_area, services, place_id, updated_at")
    .order("name");
  if (error) throw new Error(error.message);

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1>Businesses</h1>
        <Link href="/businesses/new">Add business</Link>
      </div>
      {saved ? (
        <p className="ok" role="status">
          Saved.
        </p>
      ) : null}
      {data.length === 0 ? (
        <p className="muted">No businesses yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Location</th>
              <th>Website</th>
              <th>Services</th>
              <th>Identity check</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((b) => (
              <tr key={b.id} data-testid="business-row">
                <td>{b.name}</td>
                <td>{b.category}</td>
                <td>
                  {b.location}
                  {b.service_area ? <div className="muted">{b.service_area}</div> : null}
                </td>
                <td>
                  {b.website ? (
                    <a href={b.website} target="_blank" rel="noreferrer noopener">
                      {b.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  ) : (
                    <span className="muted">none</span>
                  )}
                </td>
                <td>{b.services.length ? b.services.join(", ") : <span className="muted">none</span>}</td>
                <td className="muted">{b.place_id ? "Place id on record" : "Not checked (M2)"}</td>
                <td>
                  <Link href={`/businesses/${b.id}/edit`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
