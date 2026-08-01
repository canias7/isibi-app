import { cn } from "@/lib/utils";
/**
 * Who a tag belongs to — just you, the team, or everyone.
 *
 * SCOPE IS INVISIBLE UNTIL IT BITES. Somebody adds a personal tag, a colleague
 * cannot see the filter built on it, and neither has any way to discover why.
 * Stating the scope on the tag itself is the only place that question gets
 * answered at the moment it matters.
 *
 * NARROWING IS WHAT NEEDS THE WARNING, not widening. Moving a shared tag to
 * personal takes it off everybody else's records and breaks their saved views —
 * a much larger act than sharing one — so the consequence line changes with the
 * direction of the move.
 *
 * A WORD, NOT AN ICON. A padlock means restricted to some people and private to
 * others, and a globe means public to some and worldwide to others; there is no
 * icon here that reads unambiguously.
 *
 * READ-ONLY WHEN `onChange` IS ABSENT, because most places a tag appears are
 * not where its scope should be editable.
 */
const SCOPES = {
  personal: { word: "Only me", note: "Nobody else sees this tag." },
  team: { word: "My team", note: "Everyone in your team sees this tag." },
  everyone: { word: "Everyone", note: "Everyone with access sees this tag." },
} as const;

export type TagScopeValue = keyof typeof SCOPES;
const ORDER: TagScopeValue[] = ["personal", "team", "everyone"];

export function TagScope({ value, onChange, name = "tag-scope", className }: {
  value: TagScopeValue;
  onChange?: (v: TagScopeValue) => void;
  name?: string;
  className?: string;
}) {
  if (!onChange) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{SCOPES[value].word}</span>;
  }
  return (
    <fieldset className={cn("space-y-1", className)}>
      <legend className="mb-1 text-sm font-medium">Who can see this tag</legend>
      {ORDER.map((k) => (
        <label key={k} className="flex items-start gap-2 text-sm">
          <input type="radio" name={name} value={k} checked={value === k} className="mt-0.5 size-4 accent-foreground"
            onChange={() => {
              const narrowing = ORDER.indexOf(k) < ORDER.indexOf(value);
              if (narrowing && !window.confirm("This takes the tag off other people's records and breaks any views built on it. Continue?")) return;
              onChange(k);
            }} />
          <span>
            {SCOPES[k].word}
            <span className="block text-xs text-muted-foreground">{SCOPES[k].note}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
