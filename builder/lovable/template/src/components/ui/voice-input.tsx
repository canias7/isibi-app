import * as React from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Dictate a prompt instead of typing it.
 *
 * `SpeechRecognition` is PREFIXED in every shipping browser that has it, and
 * absent in Firefox — so it is feature-detected and the button simply does not
 * appear where it cannot work, rather than being a control that does nothing.
 *
 * The INTERIM transcript is shown as it comes, distinct from the committed
 * text. Speech recognition revises what it thought it heard several words
 * later, and hiding that until the end means a long silence that looks like a
 * hang; showing it as if it were final means watching your own words change
 * under you with no explanation.
 *
 * It is push-to-talk with an explicit stop, never a voice-activity guess.
 * Automatic end-of-speech detection cuts people off mid-thought whenever they
 * pause to think, which is precisely when they are composing something worth
 * dictating.
 *
 * `continuous` is on, `interimResults` is on, and the recogniser is stopped on
 * unmount — an abandoned recogniser keeps the microphone open, the same failure
 * `audio-recorder` guards against.
 */
type SpeechEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recogniser = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function recogniserCtor(): (new () => Recogniser) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recogniser) | null;
}

export function VoiceInput({ onTranscript, lang = "en-GB", className }: {
  onTranscript: (text: string, final: boolean) => void;
  lang?: string;
  className?: string;
}) {
  const [supported, setSupported] = React.useState(false);
  const [on, setOn] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const rec = React.useRef<Recogniser | null>(null);

  React.useEffect(() => {
    setSupported(!!recogniserCtor());
    return () => { try { rec.current?.stop(); } catch { /* already stopped */ } };
  }, []);

  const start = () => {
    const Ctor = recogniserCtor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (e.results[i].isFinal) onTranscript(alt.transcript, true);
        else live += alt.transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      setError(e?.error === "not-allowed"
        ? "Microphone access was refused. Allow it in your browser's address bar."
        : "Could not hear anything. Try again.");
      setOn(false);
    };
    r.onend = () => { setOn(false); setInterim(""); };
    rec.current = r;
    r.start();
    setOn(true);
  };

  if (!supported) return null;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => (on ? rec.current?.stop() : start())}
        aria-pressed={on}
        aria-label={on ? "Stop dictating" : "Dictate"}
        className={cn("cursor-pointer rounded-full p-1.5",
          on ? "bg-foreground text-background" : "hover:bg-muted")}
      >
        {on ? <Square aria-hidden className="size-3.5" /> : <Mic aria-hidden className="size-3.5" />}
      </button>
      {interim ? <span className="text-xs text-muted-foreground italic">{interim}</span> : null}
      {error ? <span role="alert" className="text-xs font-medium">{error}</span> : null}
    </span>
  );
}
