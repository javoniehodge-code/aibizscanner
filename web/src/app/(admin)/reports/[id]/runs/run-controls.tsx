"use client";
import { useActionState } from "react";
import { processQueueNow, queueStage, type RunActionState } from "../../actions";

const initial: RunActionState = { message: null, error: false };

function Message({ state }: { state: RunActionState }) {
  if (!state.message) return null;
  return (
    <span role="status" className={state.error ? "error" : "ok"} style={{ marginLeft: 8 }}>
      {state.message}
    </span>
  );
}

export function StageRunButton({
  reportId,
  stage,
  label,
  defaultParams,
}: {
  reportId: string;
  stage: string;
  label: string;
  defaultParams: string;
}) {
  const [state, action, pending] = useActionState(queueStage, initial);
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="stage" value={stage} />
      {defaultParams !== "{}" ? (
        <details style={{ marginBottom: 6 }}>
          <summary className="muted">Parameters</summary>
          <textarea name="params" rows={3} defaultValue={defaultParams} aria-label={`Parameters for ${stage}`} />
        </details>
      ) : null}
      <button type="submit" disabled={pending} data-testid={`run-${stage}`}>
        {pending ? "Queuing…" : label}
      </button>
      <Message state={state} />
    </form>
  );
}

export function ProcessQueueButton({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(processQueueNow, initial);
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={reportId} />
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? "Running worker…" : "Process queue now"}
      </button>
      <Message state={state} />
    </form>
  );
}
