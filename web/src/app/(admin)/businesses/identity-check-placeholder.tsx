/**
 * Placeholder for pipeline stage 1's identity check (Google Places lookup confirming name, address and category).
 * Built in Milestone 2; until then no place_id is set and nothing is sent to Google.
 */
export function IdentityCheckPlaceholder({ placeId }: { placeId: string | null }) {
  return (
    <aside
      data-testid="identity-check-placeholder"
      style={{ border: "1px dashed #b8b8c4", borderRadius: 8, padding: 12, margin: "16px 0", maxWidth: 640 }}
    >
      <strong>Identity check (Google Places): not built yet — Milestone 2</strong>
      <div className="muted">
        {placeId
          ? `Place id on record: ${placeId}`
          : "Not checked. Name, address and category are not yet confirmed against Google Places."}
      </div>
    </aside>
  );
}
