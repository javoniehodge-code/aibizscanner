"use client";
import { useActionState } from "react";
import { approveAndRun, type ApproveState } from "./actions";

export function PromptSetForm(props: {
  reportId: string;
  groups: string;
  prompts: string;
  location: { city: string; region: string; country: string; timezone: string };
  cap: number;
  busy: boolean;
}) {
  const [state, action, pending] = useActionState<ApproveState, FormData>(approveAndRun, { errors: [] });
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={props.reportId} />
      <label>
        Groups — one per line: <code>Name | description</code>
        <textarea name="groups" rows={4} defaultValue={props.groups} data-testid="groups" />
      </label>
      <label>
        Questions — one per line: <code>group number | demand | question</code> (ids P1, P2, … follow the line order)
        <textarea name="prompts" rows={14} defaultValue={props.prompts} data-testid="prompts" />
      </label>
      <fieldset>
        <legend>Customer location (sent to ChatGPT and Claude as the asker&apos;s approximate location; leave empty for none)</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <label>
            City <input name="city" defaultValue={props.location.city} />
          </label>
          <label>
            Region <input name="region" defaultValue={props.location.region} />
          </label>
          <label>
            Country (2 letters) <input name="country" defaultValue={props.location.country} />
          </label>
          <label>
            Time zone <input name="timezone" defaultValue={props.location.timezone} />
          </label>
        </div>
      </fieldset>
      <label style={{ maxWidth: 260 }}>
        Spending cap for this report (USD)
        <input name="cap" type="number" step="0.5" min="0.5" max="50" defaultValue={props.cap} />
      </label>
      {state.errors.length ? (
        <ul role="alert" className="error">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      <button type="submit" disabled={pending || props.busy} data-testid="approve-and-run">
        {pending ? "Starting…" : "Approve this set and run the prompt analysis"}
      </button>
      {props.busy ? <span className="muted"> A prompt analysis is already running for this report.</span> : null}
    </form>
  );
}
