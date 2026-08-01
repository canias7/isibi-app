import { cn } from "@/lib/utils";
/**
 * Placeholder rows while a table loads.
 *
 * IT KEEPS THE COLUMN COUNT, so the header does not jump when real rows arrive.
 * A spinner in the middle of an empty table collapses the layout and then
 * expands it again, which is the shift that makes people click the wrong thing.
 *
 * `aria-hidden` ON THE ROWS AND ONE LIVE MESSAGE INSTEAD. A screen reader
 * reading eight rows of decorative grey bars is worse than silence; "Loading
 * bookings" said once is what the reader needs.
 *
 * The bars vary in width, because a grid of identical rectangles reads as a
 * rendering fault rather than as pending content — and they stop pulsing under
 * `prefers-reduced-motion`, which is a real trigger at this size and repetition.
 */
export function TableLoading({ columns, rows = 5, label = "Loading", className }: {
  columns: number;
  rows?: number;
  label?: string;
  className?: string;
}) {
  if (columns <= 0) return null;
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3"];
  return (
    <>
      <tr>
        <td colSpan={columns} className="p-0">
          <span role="status" className="sr-only">{label}</span>
        </td>
      </tr>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden className={cn("border-b border-border", className)}>
          {Array.from({ length: columns }, (_, c) => (
            <td key={c} className="px-3 py-2">
              <span className={cn("block h-3 rounded bg-muted motion-safe:animate-pulse", widths[(r + c) % widths.length])} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
