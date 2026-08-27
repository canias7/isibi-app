import { cn } from "@/lib/utils";
/**
 * "This photo is very dark."
 *
 * SAID AT UPLOAD, where it can be fixed by taking another one. A dark or blown
 * photograph discovered on the published site is a reshoot; discovered while the
 * subject is still in front of you it is thirty seconds.
 *
 * IT DESCRIBES, IT DOES NOT REFUSE. Plenty of deliberately dark images are
 * correct — a night shot, a black product on black — so this is advice with an
 * explicit way to accept it, never a validation failure.
 *
 * The judgement is the caller's, computed from the image; this renders the
 * verdict. Analysing pixels is not a rendering concern and would put an image
 * decode in the middle of a form.
 */
export function ExposureNote({ verdict, onAccept, className }: {
  verdict: "dark" | "bright" | "low-contrast" | "fine";
  onAccept?: () => void;
  className?: string;
}) {
  if (verdict === "fine") return null;
  const WORD = {
    dark: "This photo is very dark",
    bright: "This photo is very bright — some detail is lost",
    "low-contrast": "This photo is quite flat",
  } as const;
  return (
    <p data-slot="exposure-note" role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
      <span className="font-medium">{WORD[verdict]}</span>
      <span className="text-muted-foreground">Another shot may look better on the site.</span>
      {onAccept && (
        <button type="button" onClick={onAccept} className="cursor-pointer underline underline-offset-2">
          Use it anyway
        </button>
      )}
    </p>
  );
}
