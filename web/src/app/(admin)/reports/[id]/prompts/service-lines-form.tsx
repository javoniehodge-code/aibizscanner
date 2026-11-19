"use client";
import { useActionState } from "react";
import { saveServiceLines, type LinesState } from "./actions";

export function ServiceLinesForm(props: { reportId: string; lines: string; questions: { id: string; text: string }[]; minQuestions: number; disabled: boolean }) {
  const [state, action, pending] = useActionState<LinesState, FormData>(saveServiceLines, { errors: [] });
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={props.reportId} />
      <label>
        Service lines — one per line: <code>Name | P1, P2, P5</code>. A question can be in several lines.
        <textarea name="lines" rows={5} defaultValue={props.lines} data-testid="service-lines" />
      </label>
      <details>
        <summary>Questions in the approved set</summary>
        <ul>
          {props.questions.map((q) => (
            <li key={q.id}>
              <strong>{q.id}</strong> {q.text}
            </li>
          ))}
        </ul>
      </details>
      <p className="muted">
        Each line gets its own citation map (its own cited sites and top 15 competitors). A line with fewer than {props.minQuestions} questions gets no
        map. Saving asks the AIs nothing again: the outside pages are checked again per line (up to 20 per line, about $0.02 each to read)
        and the maps are rebuilt automatically.
      </p>
      {state.errors.length ? (
        <ul role="alert" className="error">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : state.saved ? (
        <p role="status">Saved. The citation maps are being rebuilt; follow it in the run monitor.</p>
      ) : null}
      <button type="submit" disabled={pending || props.disabled} data-testid="save-service-lines">
        {pending ? "Saving…" : "Save service lines"}
      </button>
    </form>
  );
}
