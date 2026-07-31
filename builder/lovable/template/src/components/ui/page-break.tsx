/**
 * Start a new sheet here when printed.
 *
 * `break-before`, not the deprecated `page-break-before` — and `break-inside`
 * on the wrapping variant, which is the one that actually matters: a table
 * row or a signature block split across two sheets is the usual printing
 * complaint, and it is fixed by keeping things together rather than by
 * forcing breaks.
 */
export function PageBreak() {
  return <div className="hidden break-before-page print:block" aria-hidden="true" />;
}
/** Keeps its children on one sheet. Use around a table row, a card, a signature. */
export function KeepTogether({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={className ? `break-inside-avoid ${className}` : "break-inside-avoid"}>{children}</div>;
}
