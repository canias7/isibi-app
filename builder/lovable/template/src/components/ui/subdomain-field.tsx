import { cn } from "@/lib/utils";
/**
 * Choosing a subdomain, with the full address visible as it is typed.
 *
 * THE WHOLE URL IS SHOWN, NOT JUST THE FIELD. People type "acme.isibi.app" into
 * a box labelled "subdomain" and end up at acme.isibi.app.isibi.app; seeing the
 * assembled address underneath prevents it without a validation message.
 *
 * IT CANNOT BE CHANGED LATER — SAID BEFORE, NOT AFTER. A subdomain ends up in
 * links, emails and bookmarks, so most products freeze it, and somebody who
 * knows that thinks for five seconds longer about the name.
 *
 * IT NORMALISES QUIETLY AND SAYS SO. Uppercase and spaces are the two things
 * people type; silently lowercasing without a note makes the field feel broken,
 * and rejecting with an error is worse than fixing something unambiguous.
 *
 * RESERVED AND TAKEN ARE DIFFERENT MESSAGES. "www is not available" is a rule;
 * "acme is taken" invites trying acme2 — and telling somebody a name is taken
 * when it is reserved sends them hunting for a nonexistent competitor.
 */
export function SubdomainField({ value, onChange, base, state = "ok", id = "subdomain", permanent = true, className }: {
  value: string;
  onChange: (v: string) => void;
  /** The domain it sits under — "isibi.app". */
  base: string;
  state?: "ok" | "taken" | "reserved" | "checking" | "too-short";
  id?: string;
  permanent?: boolean;
  className?: string;
}) {
  const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-/, "");
  const MSG = {
    ok: "",
    checking: "Checking…",
    taken: `${value} is already taken — try another.`,
    reserved: `${value} is reserved and cannot be used.`,
    "too-short": "A little longer, please.",
  } as const;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">Your address</label>
      <div className="flex items-center gap-1">
        <input id={id} value={value} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => onChange(clean(e.target.value))}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm" />
        <span className="shrink-0 text-sm text-muted-foreground">.{base}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {value ? (
          <>Your address will be <code className="font-mono text-foreground">https://{value}.{base}</code></>
        ) : (
          "Lower case letters, numbers and hyphens."
        )}
      </p>
      {MSG[state] && (
        <p role="status" className={cn("text-xs", state === "checking" ? "text-muted-foreground" : "font-medium")}>
          {MSG[state]}
        </p>
      )}
      {permanent && (
        <p className="text-xs text-muted-foreground">This cannot be changed later — it ends up in links and emails.</p>
      )}
    </div>
  );
}
