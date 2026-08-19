import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * The masthead of a printed document.
 *
 * `print:fixed` is deliberately NOT used — a fixed header repeats over the
 * content on every page in most browsers rather than reserving space for
 * itself. This prints once, at the top, which is what a letter actually
 * wants.
 */
export function Letterhead({ name, logo, lines, contact, className }: {
  name: string; logo?: string | null; lines?: string[];
  contact?: { label: string; value: string }[]; className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4", className)}>
      <div className="flex items-center gap-3">
        {logo && <SafeImage src={logo} alt="" className="h-10 w-auto object-contain" />}
        <div>
          <p className="font-semibold">{name}</p>
          {lines?.map((l) => <p key={l} className="text-xs text-muted-foreground">{l}</p>)}
        </div>
      </div>
      {contact?.length ? (
        <dl className="text-end text-xs">
          {contact.map((c) => (
            <div key={c.label} className="flex justify-end gap-2">
              <dt className="text-muted-foreground">{c.label}</dt><dd>{c.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
