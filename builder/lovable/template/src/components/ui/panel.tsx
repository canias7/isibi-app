import { cn } from "@/lib/utils";
/** A titled box. Lighter than `card` — no shadow, no padding round the header. */
export function Panel({ title, actions, footer, className, children }: {
  title?: string; actions?: React.ReactNode; footer?: React.ReactNode;
  className?: string; children?: React.ReactNode;
}) {
  return (
    <section data-slot="panel" className={cn("overflow-hidden rounded-lg border", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
      {footer && <footer className="border-t bg-muted/30 px-4 py-2.5 text-sm">{footer}</footer>}
    </section>
  );
}
