import { cn } from "@/lib/utils";
/**
 * One cell that failed to save, marked in place.
 *
 * THE ERROR STAYS IN THE CELL. A toast saying "3 cells failed" on a hundred-row
 * grid is unusable — the reader cannot find them, and scrolling to hunt is
 * exactly the work the message was supposed to save.
 *
 * THE OLD VALUE IS KEPT AND SHOWN. A failed edit that silently reverts looks
 * like the typing never registered; showing what it was and what was attempted
 * is the only way somebody can decide whether to retry or fix the input.
 *
 * Marked with weight and an underline rather than a red background — a coloured
 * cell in a dense grid is invisible to a large minority and says nothing when
 * printed.
 */
export function CellError({ value, attempted, message, onRetry, className }: {
  /** What is stored. */
  value: React.ReactNode;
  /** What the reader typed. */
  attempted?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      <span className="font-medium underline decoration-wavy underline-offset-4">{value}</span>
      <span role="alert" className="text-xs text-muted-foreground">
        {attempted ? <>“{attempted}” didn&apos;t save — {message}</> : message}
        {onRetry && (
          <> <button type="button" onClick={onRetry} className="cursor-pointer underline underline-offset-2">Retry</button></>
        )}
      </span>
    </span>
  );
}
