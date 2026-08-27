import * as React from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Record a voice note in the browser.
 *
 * THE TRACKS ARE STOPPED when recording ends, every time, including on unmount
 * and on an error. A `MediaStream` left open keeps the microphone indicator lit
 * — the red dot in the tab and the light on the laptop — and somebody who sees
 * that after pressing stop reasonably concludes they are still being recorded.
 * It is the single most important line in this file.
 *
 * A DENIED permission is a different message from an ABSENT microphone, because
 * the remedies are different: one is in the browser's address bar, the other is
 * plugging something in. `NotAllowedError` versus `NotFoundError` is how the
 * platform tells them apart, and collapsing both into "could not record" leaves
 * everyone stuck.
 *
 * The elapsed time is on screen while recording. Without it people talk for
 * four minutes into a field that accepts thirty seconds.
 *
 * Nothing is uploaded here. It hands back a `Blob`, and what happens to it is
 * the caller's decision — this component should not be able to send anybody's
 * voice anywhere on its own.
 */
export function AudioRecorder({ onRecorded, maxSeconds = 120, className }: {
  onRecorded: (blob: Blob, seconds: number) => void;
  maxSeconds?: number;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const rec = React.useRef<MediaRecorder | null>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const release = React.useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }, []);

  React.useEffect(() => () => { release(); if (url) URL.revokeObjectURL(url); }, [release, url]);

  const start = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const chunks: BlobPart[] = [];
      const r = new MediaRecorder(s);
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        release();
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
        setState("done");
        onRecorded(blob, seconds);
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => {
        setSeconds((n) => {
          if (n + 1 >= maxSeconds) { try { r.stop(); } catch { /* already stopped */ } }
          return n + 1;
        });
      }, 1000);
    } catch (e) {
      release();
      const name = (e as { name?: string })?.name;
      setError(
        name === "NotAllowedError" ? "Microphone access was refused. Allow it in your browser's address bar and try again."
          : name === "NotFoundError" ? "No microphone found. Plug one in and try again."
          : "Could not start recording.");
    }
  };

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div data-slot="audio-recorder" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3">
        {state === "recording" ? (
          <button type="button" onClick={() => { try { rec.current?.stop(); } catch { /* already stopped */ } }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">
            <Square aria-hidden className="size-3.5" /> Stop
          </button>
        ) : (
          <button type="button" onClick={start}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Mic aria-hidden className="size-3.5" /> {state === "done" ? "Record again" : "Record"}
          </button>
        )}
        {state === "recording" ? (
          <span aria-live="polite" className="text-xs tabular-nums">
            Recording {clock} <span className="text-muted-foreground">of {Math.floor(maxSeconds / 60)}:{String(maxSeconds % 60).padStart(2, "0")}</span>
          </span>
        ) : null}
        {state === "done" && url ? (
          <button type="button" onClick={() => { URL.revokeObjectURL(url); setUrl(null); setState("idle"); setSeconds(0); }}
            aria-label="Discard recording"
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Trash2 aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      {url ? <audio src={url} controls className="w-full" /> : null}
      {error ? <p role="alert" className="text-xs font-medium">{error}</p> : null}
    </div>
  );
}
