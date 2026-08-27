import { cn } from "@/lib/utils";
/**
 * How to say a name.
 *
 * The respelling ("MOR-wen-na") is for readers; the IPA is for people who read
 * it. Both are offered because the audiences barely overlap, and a component
 * that picks one leaves half its readers no better off.
 *
 * THE RESPELLING IS `aria-hidden` AND THE NAME IS NOT. A screen reader attempting
 * to pronounce "MOR-wen-na" produces something worse than its attempt at the
 * real spelling, so the hint is visual and the announcement says what it is
 * rather than reading it out.
 *
 * `audioSrc` is a plain `<audio>` with controls when the caller has a recording,
 * which is the only version that settles it — no notation survives contact with
 * a name from an unfamiliar language.
 */
export function PronunciationHint({ name, respelling, ipa, audioSrc, className }: {
  name: string;
  /** "MOR-wen-na" */
  respelling?: string;
  /** "/mɔːˈwɛnə/" */
  ipa?: string;
  audioSrc?: string;
  className?: string;
}) {
  return (
    <span data-slot="pronunciation-hint" className={cn("inline-flex flex-wrap items-center gap-x-2 text-sm", className)}>
      <span>{name}</span>
      {respelling && (
        <span aria-hidden className="text-muted-foreground">{respelling}</span>
      )}
      {ipa && <span aria-hidden className="text-muted-foreground">{ipa}</span>}
      <span className="sr-only">pronunciation guidance available</span>
      {audioSrc && (
        <audio controls preload="none" src={audioSrc} aria-label={`How to say ${name}`} className="h-6" />
      )}
    </span>
  );
}
