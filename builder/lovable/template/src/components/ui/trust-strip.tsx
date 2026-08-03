import { cn } from "@/lib/utils";
/**
 * Three or four reassurances in a row — returns, delivery, support.
 *
 * `columns` EXISTS FOR THE SAME REASON IT DOES ON `testimonial-grid` AND
 * `gallery`: Tailwind's breakpoints are the VIEWPORT's, not the parent's, so a
 * fixed `sm:grid-cols-3` still makes three inside a half-width column on a wide
 * screen — three ~100px columns wrapping "Checkable on the register" to five
 * words a line. Measured on a real page. The caller knows how much room it has
 * and the CSS cannot.
 */
export function TrustStrip({ items, columns = 3, className }: {
  items: { icon?: React.ReactNode; title: string; description?: string }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns];
  return (
    <div className={cn("grid gap-6 border-y py-6", cols, className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-3">
          {it.icon && <span className="mt-0.5 text-muted-foreground [&_svg]:size-5">{it.icon}</span>}
          <div>
            <div className="text-sm font-medium">{it.title}</div>
            {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
