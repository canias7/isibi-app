import * as React from "react";
import { Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Play a page as speech, with the sentence being spoken highlighted.
 *
 * `voice-input` IS THE OTHER DIRECTION. Nothing here reads anything OUT, and
 * for a long article, a recipe you are cooking from, or a reader who finds
 * text hard, listening is the point of the page.
 *
 * IT SPEAKS SENTENCE BY SENTENCE, NOT THE WHOLE BLOB. One long utterance
 * cannot be highlighted, cannot be skipped, and on several engines cannot
 * even be paused past a length limit. Splitting also makes "skip this
 * paragraph" possible at all.
 *
 * IT DEGRADES TO NOTHING VISIBLE when the engine is absent (`speechSynthesis`
 * is missing on some in-app browsers) — a play button that does nothing is
 * worse than no play button, so it renders null.
 *
 * VOICES ARE ASYNCHRONOUS on Chrome: `getVoices()` is empty on first call and
 * fills after an event. A component that reads it once ships a picker that is
 * permanently empty for most users, which is a bug people report as "no
 * voices on my machine".
 *
 * Cancelled on unmount, or the page keeps talking after you navigate away.
 */
export function ReadAloud({ text, className }: { text: string; className?: string }) {
  const [supported, setSupported] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "playing" | "paused">("idle");
  const [at, setAt] = React.useState(-1);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = React.useState("");

  const sentences = React.useMemo(
    () => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean),
    [text],
  );

  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    // getVoices() is empty on the first call in Chrome and fills on this event.
    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", read);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speakFrom = React.useCallback((i: number) => {
    if (!supported || i >= sentences.length) { setState("idle"); setAt(-1); return; }
    const u = new SpeechSynthesisUtterance(sentences[i]);
    const v = voices.find((x) => x.name === voice);
    if (v) u.voice = v;
    u.onend = () => { setAt(i + 1); speakFrom(i + 1); };
    setAt(i);
    setState("playing");
    window.speechSynthesis.speak(u);
  }, [supported, sentences, voices, voice]);

  if (!supported) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button"
          onClick={() => {
            if (state === "playing") { window.speechSynthesis.pause(); setState("paused"); }
            else if (state === "paused") { window.speechSynthesis.resume(); setState("playing"); }
            else { window.speechSynthesis.cancel(); speakFrom(0); }
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted">
          {state === "playing" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Listen"}
        </button>
        {state !== "idle" ? (
          <button type="button"
            onClick={() => { window.speechSynthesis.cancel(); setState("idle"); setAt(-1); }}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted">
            <Square className="size-3.5" aria-hidden /> Stop
          </button>
        ) : null}
        {voices.length ? (
          <select value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voice"
            className="h-7 max-w-40 cursor-pointer rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Default voice</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        ) : null}
        {state !== "idle" ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            sentence {at + 1} of {sentences.length}
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed">
        {sentences.map((s, i) => (
          <span key={i} className={cn(i === at && "bg-foreground text-background")}>{s}{" "}</span>
        ))}
      </p>
    </div>
  );
}
