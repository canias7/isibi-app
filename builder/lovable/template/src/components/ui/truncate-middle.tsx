/**
 * Cuts from the MIDDLE, keeping both ends.
 *
 * For filenames and ids, where the end matters as much as the start —
 * "invoice-2026-08-…-final.pdf" is readable and "invoice-2026-08-03-dr…" is not.
 */
export function TruncateMiddle({ text, max = 28, className }: {
  text: string; max?: number; className?: string;
}) {
  if (text.length <= max) return <span className={className}>{text}</span>;
  const keep = Math.floor((max - 1) / 2);
  return (
    <span className={className} title={text}>
      {text.slice(0, keep)}…{text.slice(-keep)}
    </span>
  );
}
