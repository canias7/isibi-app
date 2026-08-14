import { cn, divide } from "@/lib/utils";
/**
 * Choose an image shape — square, portrait, widescreen.
 *
 * Each option DRAWS ITS RATIO at a common area rather than a common width, so
 * the boxes compare honestly: sized by width, 16:9 and 1:1 look like two
 * different-sized squares and the shape difference is what somebody is
 * choosing between.
 *
 * Names AND numbers, because "16:9" means nothing to most people and
 * "Widescreen" means nothing to whoever has been given a spec.
 */
const RATIOS = [
  { value: "1/1", label: "Square", w: 1, h: 1 },
  { value: "4/5", label: "Portrait", w: 4, h: 5 },
  { value: "3/4", label: "Tall", w: 3, h: 4 },
  { value: "4/3", label: "Standard", w: 4, h: 3 },
  { value: "3/2", label: "Photo", w: 3, h: 2 },
  { value: "16/9", label: "Widescreen", w: 16, h: 9 },
];
export function AspectPicker({ value, onChange, options = RATIOS, className }: {
  value: string; onChange: (v: string) => void;
  options?: { value: string; label: string; w: number; h: number }[]; className?: string;
}) {
  const area = 900;
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Aspect ratio">
      {options.map((o) => {
        const scale = Math.sqrt(divide(area, o.w * o.h));
        return (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
            className={cn("flex w-20 cursor-pointer flex-col items-center gap-1.5 rounded-md border p-2",
              o.value === value ? "border-foreground" : "border-border hover:bg-muted")}>
            <span className="grid h-10 place-items-center">
              <span className="border-2 border-foreground/70"
                style={{ width: o.w * scale, height: o.h * scale }} aria-hidden="true" />
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">{o.label}</span>
            <span className="text-[10px] tabular-nums leading-none">{o.value.replace("/", ":")}</span>
          </button>
        );
      })}
    </div>
  );
}
