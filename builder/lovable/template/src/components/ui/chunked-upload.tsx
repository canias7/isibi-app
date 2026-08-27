import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A big file, sent in pieces that can survive a dropped connection.
 *
 * PROGRESS IS BYTES *ACKNOWLEDGED*, never bytes sent — a chunk in flight
 * is not done, and the difference is exactly the part a dropped
 * connection loses. Resume re-sends from the first unacked chunk, which
 * is why chunking exists at all; pause aborts the in-flight chunk and
 * keeps the ledger.
 *
 * `sendChunk` IS INJECTED (the publish-pages discipline): the component
 * owns slicing, sequencing, retry-on-resume and the ledger; where the
 * bytes go is the caller's. A chunk that throws marks the upload
 * `stalled` rather than looping — a retry button beats a silent
 * infinite retry against a server that is refusing for a reason.
 *
 * One chunk in flight at a time, deliberately: parallel chunks race for
 * upstream bandwidth and make the progress bar lie in both directions.
 */
export function useChunkedUpload(
  sendChunk: (chunk: Blob, index: number, of: number) => Promise<boolean>,
  chunkSize = 1024 * 1024,
) {
  const [state, setState] = React.useState<{
    status: "idle" | "uploading" | "paused" | "stalled" | "done";
    acked: number; total: number; file?: File;
  }>({ status: "idle", acked: 0, total: 0 });
  const abort = React.useRef(false);
  const running = React.useRef(false);

  const pump = React.useCallback(async (file: File, from: number) => {
    if (running.current) return;
    running.current = true;
    abort.current = false;
    const total = Math.ceil(file.size / chunkSize);
    setState({ status: "uploading", acked: from, total, file });
    for (let i = from; i < total; i++) {
      if (abort.current) { running.current = false; return; }
      let ok = false;
      try { ok = await sendChunk(file.slice(i * chunkSize, (i + 1) * chunkSize), i, total); } catch { ok = false; }
      if (!ok) { setState((s) => ({ ...s, status: "stalled" })); running.current = false; return; }
      setState((s) => ({ ...s, acked: i + 1 }));
    }
    setState((s) => ({ ...s, status: "done" }));
    running.current = false;
  }, [sendChunk, chunkSize]);

  return {
    state,
    start: (file: File) => void pump(file, 0),
    pause: () => { abort.current = true; setState((s) => ({ ...s, status: "paused" })); },
    resume: () => { if (state.file) void pump(state.file, state.acked); },
  };
}

export function ChunkedUploadBar({ state, onPause, onResume, className }: {
  state: { status: string; acked: number; total: number; file?: File };
  onPause: () => void;
  onResume: () => void;
  className?: string;
}) {
  if (state.status === "idle") return null;
  const pct = state.total ? Math.round((state.acked / state.total) * 100) : 0;
  return (
    <div data-slot="chunked-upload-bar" className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 truncate">{state.file?.name}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {state.status === "done" ? "done" : `${state.acked} of ${state.total} pieces`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-2">
        {state.status === "uploading" ? (
          <button type="button" onClick={onPause} className="cursor-pointer text-xs underline underline-offset-2">Pause</button>
        ) : null}
        {state.status === "paused" || state.status === "stalled" ? (
          <button type="button" onClick={onResume} className="cursor-pointer text-xs underline underline-offset-2">
            {state.status === "stalled" ? "Retry from where it stopped" : "Resume"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
