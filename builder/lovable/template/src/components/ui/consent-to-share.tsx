import { cn } from "@/lib/utils";
/**
 * Who may see what — as a decision the person can change.
 *
 * IT IS SCOPED TO WHO AND TO WHAT, NOT A SINGLE SWITCH. "Share my record" is not
 * a decision anybody can make meaningfully; sharing medication with a pharmacy
 * and sharing mental health notes with an employer's occupational health service
 * are entirely different questions and get one toggle in almost every system.
 *
 * WITHDRAWING IS AS PROMINENT AS GIVING, and the component states plainly that it
 * can be withdrawn without a reason. Consent presented as permanent is not
 * consent.
 *
 * WHAT CANNOT BE WITHHELD IS STATED HONESTLY. There are always things shared
 * without permission — emergencies, and whatever the local rules require — and a
 * screen implying total control is lying in a way that is discovered at the worst
 * moment.
 *
 * NO PRE-TICKED BOXES. A default that shares is not a decision, and this is the
 * clearest case of that anywhere in software.
 */
export type ShareScope = { id: string; who: string; what: string; allowed?: boolean };

export function ConsentToShare({ scopes, onToggle, sharedAnywayNote, className }: {
  scopes: ShareScope[];
  onToggle?: (id: string) => void;
  /** What is shared without permission, stated honestly. */
  sharedAnywayNote?: string;
  className?: string;
}) {
  return (
    <div data-slot="consent-to-share" className={cn("space-y-1.5 text-sm", className)}>
      <ul className="divide-y divide-border rounded-md border border-border">
        {scopes.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-baseline gap-3 px-3 py-2">
              {/* Never pre-ticked by the component: a default that shares is not a
                  decision anybody made. */}
              <input
                type="checkbox"
                checked={!!s.allowed}
                onChange={() => onToggle?.(s.id)}
                className="mt-1 accent-foreground"
              />
              <span className="min-w-0 flex-1">
                {s.who}
                <span className="block text-xs text-muted-foreground">Can see {s.what}</span>
              </span>
              <span className={cn("shrink-0 text-xs", s.allowed ? "text-muted-foreground" : "font-medium")}>
                {s.allowed ? "Allowed" : "Not allowed"}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        You can change any of these at any time, and you do not have to give a reason.
      </p>
      <p className="text-xs">
        {sharedAnywayNote ??
          "Some information is shared without asking — in an emergency, and where the law requires it. Nothing here changes that."}
      </p>
    </div>
  );
}
