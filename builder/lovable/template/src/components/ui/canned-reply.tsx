import { cn } from "@/lib/utils";
/**
 * Saved replies, inserted with one press.
 *
 * They INSERT rather than send. A one-press send is how a stock answer goes
 * to the one customer it does not fit, and the whole value of a saved reply
 * is the sentence you add to it.
 */
export function CannedReply({ replies, onInsert, className }: {
  replies: { label: string; body: string }[];
  onInsert: (body: string) => void; className?: string;
}) {
  if (!replies.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {replies.map((r) => (
        <button key={r.label} type="button" onClick={() => onInsert(r.body)} title={r.body}
          className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">
          {r.label}
        </button>
      ))}
    </div>
  );
}
