import { NavList } from "@/components/ui/nav-list";
import { cn } from "@/lib/utils";
export type NavSection = { title?: string; items: { label: string; href: string; icon?: React.ReactNode }[] };
/** Grouped navigation down the side. Lighter than `sidebar`, which is an app shell. */
export function SideNav({ sections, active, className }: {
  sections: NavSection[]; active?: string; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <div className="mb-1.5 px-3 text-xs uppercase tracking-widest text-muted-foreground">{s.title}</div>}
          <NavList items={s.items} active={active} />
        </div>
      ))}
    </div>
  );
}
