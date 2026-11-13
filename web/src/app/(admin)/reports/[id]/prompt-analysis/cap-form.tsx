"use client";
import { useActionState } from "react";
import { updateSpendingCap, type CapState } from "./actions";

export function CapForm({ reportId, cap }: { reportId: string; cap: number }) {
  const [state, action, pending] = useActionState<CapState, FormData>(updateSpendingCap, { message: null, error: false });
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="reportId" value={reportId} />
      <label>
        Spending cap ($){" "}
        <input name="cap" type="number" step="0.5" min="0.5" max="50" defaultValue={cap} style={{ width: 90 }} data-testid="cap-input" />
      </label>
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? "Saving…" : "Change cap"}
      </button>
      {state.message ? (
        <span role="status" className={state.error ? "error" : "ok"}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
