import { SafeImage } from "@/components/ui/safe-image";
import { AnnotationPin } from "@/components/ui/annotation-pin";
import { cn } from "@/lib/utils";
/**
 * An uploaded photo you can point at — click to drop a numbered marker.
 *
 * POINTING BEATS DESCRIBING. "The scratch is on the lower left, near the
 * handle" is a sentence somebody has to map onto an image; a numbered pin is
 * unambiguous, and the note attached to it says what the mark means.
 *
 * COORDINATES ARE PERCENTAGES, so a pin stays on the same feature when the
 * photo is shown at thumbnail size, full width, or printed. Pixel offsets drift
 * the moment the layout changes, which is every time.
 *
 * A KEYBOARD CAN ADD ONE. Click-to-place is unreachable without a pointer, so
 * the image is a `<button>` and Enter drops a pin in the centre for the caller
 * to move — imperfect, but the alternative is a feature some people cannot use
 * at all.
 *
 * PINS COMPOSE FROM `AnnotationPin`, so the numbering, the resolved state and
 * the accessibility live in one place rather than being restated here.
 */
export type UploadPin = { id: string; x: number; y: number; note?: string; resolved?: boolean };

export function AnnotationUpload({ src, pins, onAdd, onSelect, selectedId, readOnly, className }: {
  src?: string;
  pins: UploadPin[];
  /** Called with percentage coordinates. */
  onAdd?: (at: { x: number; y: number }) => void;
  onSelect?: (id: string) => void;
  selectedId?: string;
  readOnly?: boolean;
  className?: string;
}) {
  const place = (e: React.MouseEvent<HTMLElement>) => {
    if (readOnly || !onAdd) return;
    const r = e.currentTarget.getBoundingClientRect();
    onAdd({
      x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
      y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
    });
  };
  return (
    <div data-slot="annotation-upload" className={cn("space-y-1.5", className)}>
      <div className="relative">
        {readOnly || !onAdd ? (
          <SafeImage src={src} alt="" className="w-full rounded-md object-cover" />
        ) : (
          <button type="button" onClick={place}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAdd({ x: 50, y: 50 }); } }}
            aria-label="Add a marker to this photo"
            className="block w-full cursor-crosshair">
            <SafeImage src={src} alt="" className="w-full rounded-md object-cover" />
          </button>
        )}
        {pins.map((p, i) => (
          <AnnotationPin key={p.id} number={i + 1} x={p.x} y={p.y} resolved={p.resolved}
            open={p.id === selectedId} onToggle={() => onSelect?.(p.id)}
            label={p.note ? `Marker ${i + 1}: ${p.note}` : undefined} />
        ))}
      </div>
      {pins.length > 0 && (
        <ol className="space-y-0.5 text-xs">
          {pins.map((p, i) => (
            <li key={p.id} className={cn("flex gap-2", p.resolved && "text-muted-foreground")}>
              <span className="tabular-nums">{i + 1}.</span>
              <span className="min-w-0">{p.note || "No note"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
