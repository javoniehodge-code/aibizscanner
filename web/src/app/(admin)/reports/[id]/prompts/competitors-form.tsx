"use client";
import { useActionState } from "react";
import { saveCompetitors, type LinesState } from "./actions";

export function CompetitorsForm(props: { reportId: string; names: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<LinesState, FormData>(saveCompetitors, { errors: [] });
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={props.reportId} />
      <label>
        Compare with — two business names as AI names them, separated by a comma. Leave empty to compare with the two AI recommends most in the
        main service line.
        <input name="competitors" defaultValue={props.names} data-testid="competitors" />
      </label>
      {state.errors.length ? (
        <ul role="alert" className="error">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : state.saved ? (
        <p role="status">Saved. The comparison is being rebuilt; follow it in the run monitor.</p>
      ) : null}
      <button type="submit" disabled={pending || props.disabled} data-testid="save-competitors">
        {pending ? "Saving…" : "Save competitors"}
      </button>
    </form>
  );
}
