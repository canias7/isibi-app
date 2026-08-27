import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The field where somebody writes an image description.
 *
 * "DECORATIVE" IS AN EXPLICIT CHOICE, not an empty field. Empty alt is
 * ambiguous between "deliberately silent" and "forgot"; the checkbox records
 * the decision, disables the field, and the caller stores alt="" knowingly.
 * That distinction is the entire data model of image accessibility.
 *
 * THE GUIDANCE IS IN THE FIELD, where it is read at writing time: say what is
 * IN the picture, skip "image of", mention text in the image because a
 * listener cannot see it. A help page nobody opens does not change what gets
 * written.
 *
 * LENGTH IS NUDGED, NOT CAPPED at the low end — "a barber" for a detailed
 * photograph is the commonest failure, so under ~20 characters a hint asks for
 * more. The ceiling (~125) matters too: screen readers do not pause mid-alt.
 *
 * The image being described is SHOWN BESIDE the field when given. Describing
 * from memory is how alt text ends up describing the wrong photo.
 */
export function AltTextField({ value, onChange, decorative, onDecorativeChange, imageSrc, id, className }: {
  value: string;
  onChange: (next: string) => void;
  decorative?: boolean;
  onDecorativeChange?: (next: boolean) => void;
  imageSrc?: string;
  id?: string;
  className?: string;
}) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  const short = !decorative && value.trim().length > 0 && value.trim().length < 20;
  const long = value.length > 125;

  return (
    <div data-slot="alt-text-field" className={cn("flex gap-3", className)}>
      {imageSrc ? (
        <img src={imageSrc} alt="" className="size-20 shrink-0 rounded-md border border-border object-cover" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium">Describe this picture</label>
        <textarea
          id={fieldId}
          rows={2}
          value={value}
          disabled={decorative}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What is in the picture? Include any text it contains."
          aria-describedby={`${fieldId}-hint`}
          className="resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring disabled:bg-muted disabled:text-muted-foreground"
        />
        <p id={`${fieldId}-hint`} className={cn("text-xs", short || long ? "font-medium" : "text-muted-foreground")}>
          {decorative ? "This picture will be skipped by screen readers."
            : short ? "A little more detail helps — what would you tell somebody on the phone?"
            : long ? `Long descriptions are read without pauses — ${value.length} characters is a lot.`
            : "Written for somebody who cannot see it. Skip “image of…”."}
        </p>
        {onDecorativeChange ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={!!decorative} onChange={(e) => onDecorativeChange(e.target.checked)}
              className="size-3.5 cursor-pointer accent-foreground" />
            It&rsquo;s decorative &mdash; nothing to describe
          </label>
        ) : null}
      </div>
    </div>
  );
}
