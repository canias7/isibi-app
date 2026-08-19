import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { MentionPicker } from "@/components/ui/mention-picker";
import { cn } from "@/lib/utils";
/**
 * A textarea that offers people after an "@".
 *
 * The trigger only fires at a WORD BOUNDARY, so an email address typed into
 * the box does not open the picker on its domain — the commonest false
 * positive, and infuriating because it happens mid-word.
 *
 * Arrow keys, Enter and Escape are handled here and the highlighted index is
 * owned here, because `MentionPicker` is deliberately stateless: the same
 * state has to drive both the list and the keyboard.
 */
export function MentionTextarea({ value, onChange, people, rows = 4, placeholder, className }: {
  value: string; onChange: (v: string) => void;
  people: { id: string | number; name: string; role?: string; avatar?: string | null }[];
  rows?: number; placeholder?: string; className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = React.useState<string | null>(null);
  const [at, setAt] = React.useState(0);
  const [active, setActive] = React.useState(0);

  const matches = query == null ? []
    : people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  const scan = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([\w'’-]*)$/);
    if (!m) { setQuery(null); return; }
    setQuery(m[2]);
    setAt(caret - m[2].length - 1);
    setActive(0);
  };

  const pick = (p: { id: string | number; name: string }) => {
    const el = ref.current;
    const caret = el ? el.selectionStart : value.length;
    const next = value.slice(0, at) + "@" + p.name + " " + value.slice(caret);
    onChange(next);
    setQuery(null);
    const to = at + p.name.length + 2;
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(to, to); });
  };

  return (
    <div className={cn("relative", className)}>
      <Textarea ref={ref} value={value} rows={rows} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); scan(e.target.value, e.target.selectionStart); }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + matches.length) % matches.length); }
          else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[active]); }
          else if (e.key === "Escape") setQuery(null);
        }}
        onBlur={() => setQuery(null)} />
      {matches.length > 0 && (
        <MentionPicker className="absolute start-0 top-full z-20 mt-1 w-64"
          people={matches} query={query ?? ""} activeIndex={active} onPick={pick} />
      )}
    </div>
  );
}
