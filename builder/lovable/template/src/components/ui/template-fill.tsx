import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Start from a saved answer instead of an empty form.
 *
 * It FILLS, it does not lock. A template is a starting point and every field
 * stays editable afterwards — the version that disables the fields it touched
 * turns "usually a 45-minute skin fade" into "always", and the person who needs
 * the exception cannot express it.
 *
 * A template applied over work already typed is reported, with a count, because
 * silently replacing what somebody wrote is the one thing that makes this
 * feature frightening to press. The confirmation is inline rather than a
 * dialog: a dialog for "this will replace 2 fields" is more interruption than
 * the fact deserves.
 *
 * `onApply` gets the whole value object, so the caller decides what merging
 * means. This component does not know which of its fields are empty.
 */
export function TemplateFill<T extends Record<string, unknown>>({
  templates, onApply, current, label = "Start from", className,
}: {
  templates: { key: string; name: React.ReactNode; hint?: React.ReactNode; values: T }[];
  onApply: (values: T) => void;
  current?: T;
  label?: React.ReactNode;
  className?: string;
}) {
  const [pending, setPending] = React.useState<string | null>(null);

  const overwrites = (t: T) => {
    if (!current) return 0;
    return Object.keys(t).filter((k) => {
      const c = current[k];
      return c != null && c !== "" && String(c) !== String(t[k]);
    }).length;
  };

  const choose = (key: string) => {
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    if (overwrites(t.values) > 0 && pending !== key) { setPending(key); return; }
    setPending(null);
    onApply(t.values);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button key={t.key} type="button" onClick={() => choose(t.key)}
            className={cn("cursor-pointer rounded-md border px-2.5 py-1.5 text-left text-xs hover:bg-muted",
              pending === t.key ? "border-foreground bg-muted" : "border-border")}>
            <span className="block font-medium">{t.name}</span>
            {t.hint ? <span className="block text-muted-foreground">{t.hint}</span> : null}
          </button>
        ))}
      </div>
      {pending ? (
        <p aria-live="polite" className="text-xs">
          That replaces{" "}
          <strong className="tabular-nums">
            {overwrites(templates.find((t) => t.key === pending)!.values)}
          </strong>{" "}
          {overwrites(templates.find((t) => t.key === pending)!.values) === 1 ? "field" : "fields"} you have already filled in.{" "}
          <button type="button" onClick={() => choose(pending)}
            className="cursor-pointer font-medium underline underline-offset-2">Apply anyway</button>
          {" · "}
          <button type="button" onClick={() => setPending(null)}
            className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">Keep what I have</button>
        </p>
      ) : null}
    </div>
  );
}
