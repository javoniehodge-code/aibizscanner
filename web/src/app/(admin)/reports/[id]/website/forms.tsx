"use client";
import { useActionState } from "react";
import { approvePages, findPages, type WebsiteFormState } from "./actions";

function Feedback({ state }: { state: WebsiteFormState }) {
  return (
    <>
      {state.errors.length ? (
        <ul role="alert" className="error">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {state.message ? <p role="status">{state.message}</p> : null}
    </>
  );
}

export function FindPagesForm({ reportId, label, busy }: { reportId: string; label: string; busy: boolean }) {
  const [state, action, pending] = useActionState<WebsiteFormState, FormData>(findPages, { errors: [] });
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={reportId} />
      <button type="submit" disabled={pending || busy} data-testid="find-pages">
        {pending ? "Queuing…" : label}
      </button>
      {busy ? <span className="muted"> A website step is already running for this report.</span> : null}
      <Feedback state={state} />
    </form>
  );
}

export type PageRow = { url: string; kind: string; sources: string[]; linkText: string | null; suggested: string | null };

export function ApprovePagesForm(props: { reportId: string; website: string; rows: PageRow[]; cap: number; busy: boolean }) {
  const [state, action, pending] = useActionState<WebsiteFormState, FormData>(approvePages, { errors: [] });
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={props.reportId} />
      <input type="hidden" name="website" value={props.website} />
      <p className="muted">
        Suggested pages are ticked (up to {props.cap}). Untick or tick to change the list; the approved list is frozen as a new version.
      </p>
      <table data-testid="ws-candidates">
        <thead>
          <tr>
            <th></th>
            <th>Page</th>
            <th>Kind</th>
            <th>Found via</th>
            <th>Why suggested</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.url}>
              <td>
                <input type="checkbox" name="page" value={`${r.url}\t${r.suggested ?? "Selected by admin"}`} defaultChecked={r.suggested !== null} aria-label={`Check ${r.url}`} />
              </td>
              <td style={{ wordBreak: "break-all" }}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.url}
                </a>
                {r.linkText ? <div className="muted">{r.linkText}</div> : null}
              </td>
              <td>{r.kind}</td>
              <td>{r.sources.join(", ")}</td>
              <td>{r.suggested ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <label>
        Add pages that weren&apos;t found — one full address per line
        <textarea name="added" rows={3} placeholder="https://example.com/services/delivery" />
      </label>
      <Feedback state={state} />
      <button type="submit" disabled={pending || props.busy} data-testid="approve-pages">
        {pending ? "Saving…" : "Approve these pages and take snapshots"}
      </button>
    </form>
  );
}
