import { cn } from "@/lib/utils";
/**
 * What a piece of information is used for — the specific list, not a category.
 *
 * PURPOSES, NOT CATEGORIES. "Marketing" is a bucket somebody has to guess at;
 * "to email you when your appointment is due" is a thing a person can agree or
 * object to. This is the difference between a consent notice that informs and
 * one that merely exists.
 *
 * ESSENTIAL PURPOSES ARE MARKED AND LISTED FIRST, because they are the ones
 * that cannot be declined and hiding them among optional ones makes the whole
 * list feel like a negotiation it is not.
 *
 * IT IS READ-ONLY, DELIBERATELY. Toggling belongs to `privacy-choice`; mixing
 * the explanation with the switches produces a panel where somebody changes a
 * setting while still reading what it does.
 *
 * A real `<ul>` with the essential marker as text — the same discipline as
 * everywhere else here, since this is content that gets printed into policies.
 */
export type Purpose = { id: string; text: string; essential?: boolean; detail?: string };

export function PurposeList({ purposes, title, essentialWord = "needed", className }: {
  purposes: Purpose[];
  title?: string;
  essentialWord?: string;
  className?: string;
}) {
  if (!purposes.length) return null;
  const sorted = [...purposes].sort((a, b) => Number(Boolean(b.essential)) - Number(Boolean(a.essential)));
  return (
    <div data-slot="purpose-list" className={cn("space-y-1", className)}>
      {title && <p className="text-sm font-medium">{title}</p>}
      <ul className="space-y-1 text-sm">
        {sorted.map((p) => (
          <li key={p.id} className="flex gap-2">
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            <span className="min-w-0">
              {p.text}
              {p.essential && <span className="ms-1.5 text-xs text-muted-foreground">{essentialWord}</span>}
              {p.detail && <span className="block text-xs text-muted-foreground">{p.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
