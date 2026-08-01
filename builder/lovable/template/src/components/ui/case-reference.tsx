import { cn } from "@/lib/utils";
/**
 * The number somebody has to quote — presented so it can actually be quoted.
 *
 * IT IS GROUPED AND MONOSPACED. A reference is read aloud down a phone,
 * copied onto a form and typed back in, and an unbroken 16-character string is
 * where every one of those goes wrong. Grouping is not decoration; it is what
 * makes the thing usable at all.
 *
 * A LEADING LETTER PREFIX IS KEPT WHOLE. Grouping blindly by four turns
 * `HB2026041887` into "HB20 2604 1887" — a first group that is half a scheme
 * code and half a year, which is read aloud as "H B two zero" and typed back
 * wrong. The prefix is a token; only the rest is a number to be chunked.
 *
 * IT SAYS WHAT THE REFERENCE IS FOR. People hold four numbers from the same
 * organisation and cannot tell which opens which door — a claim number, a
 * National Insurance number, an appointment code. Labelling it is half the
 * value.
 *
 * IT WARNS WHEN A REFERENCE IS NOT PROOF OF IDENTITY. A case number is often
 * enough to look up a record, which means it is also enough for somebody else
 * to, and people read it out in public.
 *
 * COPYING IS OFFERED BUT THE TEXT IS ALWAYS SELECTABLE. A copy button that is
 * the only route fails on every browser where the clipboard API is blocked,
 * which is more of them than anyone expects.
 */
export function CaseReference({ reference, label = "Your reference", group = 4, sensitive, note, className }: {
  reference: string;
  label?: string;
  /** Characters per group when read aloud. 0 leaves it unbroken. */
  group?: number;
  /** True where the reference alone can open the record. */
  sensitive?: boolean;
  note?: string;
  className?: string;
}) {
  const prefix = group > 0 ? (reference.match(/^[A-Za-z]+/)?.[0] ?? "") : "";
  const rest = reference.slice(prefix.length);
  const grouped = group > 0
    ? [prefix, ...(rest.match(new RegExp(`.{1,${group}}`, "g")) ?? [rest])].filter(Boolean)
    : [reference];
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex flex-wrap gap-x-2 font-mono text-base tabular-nums">
        {grouped.map((g, i) => <span key={i}>{g}</span>)}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {sensitive && (
        <p className="text-xs">
          Anyone with this number can look up your case — keep it as you would a password.
        </p>
      )}
    </div>
  );
}
