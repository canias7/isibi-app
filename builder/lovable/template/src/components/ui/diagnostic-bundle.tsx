import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A support bundle, with its contents listed before it is generated.
 *
 * WHAT GOES IN IT IS LISTED FIRST, because a diagnostic bundle is the single
 * easiest way for a customer to send us data they never meant to. Somebody
 * pressing "download diagnostics" during an incident is not reading carefully,
 * so the contents have to be visible before rather than discoverable inside.
 *
 * WHAT IS EXCLUDED IS STATED TOO. "No customer records, no passwords" is the
 * sentence that gets the bundle sent at all — without it a cautious
 * administrator refuses, and the incident takes a day longer.
 *
 * ANYTHING OPTIONAL IS OPT-IN. Logs that might contain personal data are worth
 * having and must not be included by default; making them a tick keeps the
 * decision with the person who is allowed to make it.
 *
 * IT IS DOWNLOADED, NOT SENT AUTOMATICALLY. A bundle that uploads itself takes
 * the choice away, and the customer's own security review will ask about
 * exactly that.
 */
export type BundlePart = { id: string; label: string; detail?: string; optional?: boolean; sensitive?: boolean };

export function DiagnosticBundle({ parts, selected, onChange, excluded = [], onGenerate, busy, className }: {
  parts: BundlePart[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** What is never included. */
  excluded?: string[];
  onGenerate: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="diagnostic-bundle" className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">What goes in the bundle</p>
      <ul className="space-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.id}>
            {p.optional ? (
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={selected.includes(p.id)} className="mt-0.5 size-4 accent-foreground"
                  onChange={(e) => onChange(e.target.checked
                    ? [...selected, p.id]
                    : selected.filter((x) => x !== p.id))} />
                <span className="min-w-0">
                  {p.label}
                  {p.sensitive && <span className="ms-1.5 text-xs font-medium">may contain personal data</span>}
                  {p.detail && <span className="block text-xs text-muted-foreground">{p.detail}</span>}
                </span>
              </label>
            ) : (
              <span className="flex gap-2">
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className="min-w-0">
                  {p.label}
                  {p.detail && <span className="block text-xs text-muted-foreground">{p.detail}</span>}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Never included: {excluded.join(", ")}.
        </p>
      )}
      <Button type="button" size="sm" onClick={onGenerate} disabled={busy}>
        {busy ? "Building…" : "Download the bundle"}
      </Button>
      <p className="text-xs text-muted-foreground">
        It downloads to your machine — nothing is sent anywhere until you attach it.
      </p>
    </div>
  );
}
