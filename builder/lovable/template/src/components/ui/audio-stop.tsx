import { cn } from "@/lib/utils";
/**
 * One stop on an audio guide — with a transcript, always.
 *
 * THE TRANSCRIPT IS NOT OPTIONAL AND IS NOT A SEPARATE PAGE. An audio guide
 * without one excludes every deaf visitor from the interpretation the museum
 * spent most of its budget writing — and it is also what a hearing visitor uses
 * in a loud gallery, or to read afterwards.
 *
 * THE NUMBER IS SHOWN LARGE, because it is keyed into a handset while standing
 * in front of an object, and a stop number rendered as body text is the reason
 * people give up on the handsets.
 *
 * THE LENGTH IS STATED BEFORE PLAY. Visitors decide whether to start based on
 * whether they will be standing there for two minutes or eight, and hiding it
 * means most stops get abandoned halfway.
 *
 * A BRITISH-SIGN-LANGUAGE OR AUDIO-DESCRIBED VERSION IS SURFACED HERE where it
 * exists, rather than on an access page nobody visits mid-gallery.
 */
export function AudioStop({ number, title, seconds, transcript, hasSignLanguage, hasAudioDescription, language, className }: {
  /** The number keyed into the handset. */
  number: string | number;
  title: string;
  seconds?: number;
  /** The full text. Always supply it. */
  transcript?: string;
  hasSignLanguage?: boolean;
  hasAudioDescription?: boolean;
  /** Where this stop is in a language other than the default. */
  language?: string;
  className?: string;
}) {
  const length = seconds !== undefined
    ? seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60 ? `${seconds % 60} sec` : ""}`.trim()
    : undefined;
  return (
    <div data-slot="audio-stop" className={cn("space-y-1 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className="font-mono text-lg tabular-nums">{number}</span>
        <span className="min-w-0 flex-1">{title}</span>
        {length && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{length}</span>}
      </p>
      {(hasSignLanguage || hasAudioDescription || language) && (
        <p className="text-xs text-muted-foreground">
          {[
            language,
            hasSignLanguage ? "signed version available" : null,
            hasAudioDescription ? "audio described" : null,
          ].filter(Boolean).join(" · ")}
        </p>
      )}
      {transcript ? (
        <details className="text-xs">
          <summary className="cursor-pointer underline underline-offset-2">Read the transcript</summary>
          <p className="pt-1 text-muted-foreground">{transcript}</p>
        </details>
      ) : (
        <p className="text-xs font-medium">No transcript — this stop is unavailable to deaf visitors.</p>
      )}
    </div>
  );
}
