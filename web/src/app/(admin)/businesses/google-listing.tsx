"use client";
import { useState, useTransition } from "react";
import type { PlaceCandidate } from "@/lib/google/places";
import { confirmListing, findListing } from "./listing-actions";

/**
 * Pipeline stage 1, identity check: find the business's Google listing and confirm it once. Only the place ID is kept;
 * the search results are shown here and not stored (Google Places API policies).
 */
export function GoogleListing({ businessId, placeId, confirmedAt, stale, keySet }: { businessId: string; placeId: string | null; confirmedAt: string | null; stale: boolean; keySet: boolean }) {
  const [pending, start] = useTransition();
  const [results, setResults] = useState<{ query: string; candidates: PlaceCandidate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = () =>
    start(async () => {
      setError(null);
      const r = await findListing(businessId);
      if (r.ok) setResults({ query: r.query, candidates: r.candidates });
      else setError(r.error);
    });
  const choose = (id: string | null) =>
    start(async () => {
      const r = await confirmListing(businessId, id);
      if (r.ok) setResults(null);
      else setError(r.error ?? "Could not save.");
    });

  return (
    <aside data-testid="google-listing" style={{ border: "1px solid #d0d0da", borderRadius: 8, padding: 12, margin: "16px 0", maxWidth: 720 }}>
      <strong>Google listing</strong>
      <div className="muted" style={{ margin: "4px 0 8px" }}>
        {placeId
          ? `Confirmed${confirmedAt ? ` on ${confirmedAt.slice(0, 10)}` : ""}. Place ID ${placeId}.${stale ? " Over a year old: search again to refresh it." : ""}`
          : "Not confirmed yet. Find the business on Google and pick its listing; reports then read it fresh each time."}
      </div>
      {!keySet ? (
        <div className="muted">The Google Places key isn&apos;t set (GOOGLE_PLACES_API_KEY in Vercel).</div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={search} disabled={pending}>
            {pending ? "Working…" : placeId ? "Search again" : "Find on Google"}
          </button>
          {placeId && (
            <button type="button" onClick={() => choose(null)} disabled={pending}>
              Clear
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {results && (
        <div style={{ marginTop: 12 }}>
          <div className="muted">
            Searched Google for “{results.query}”. {results.candidates.length ? "Pick the business's own listing:" : "No listings found. Check the name and location."}
          </div>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {results.candidates.map((c) => (
              <li key={c.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid #eee" }}>
                <span style={{ flex: 1 }}>
                  <strong>{c.name}</strong>
                  {c.type ? ` · ${c.type}` : ""}
                  <br />
                  <span className="muted">{c.address ?? "No address shown"}</span>
                  {c.mapsUrl && (
                    <>
                      {" · "}
                      <a href={c.mapsUrl} target="_blank" rel="noreferrer">
                        View on Google Maps
                      </a>
                    </>
                  )}
                </span>
                <button type="button" onClick={() => choose(c.id)} disabled={pending}>
                  {c.id === placeId ? "Confirmed" : "This is the business"}
                </button>
              </li>
            ))}
          </ul>
          <div className="muted" style={{ fontSize: 12 }}>Results from Google Maps.</div>
        </div>
      )}
    </aside>
  );
}
