import { cn } from "@/lib/utils";

/** Eyebrow + title + description. The top of nearly every section on a site. */
export function SectionHeader({
  eyebrow, title, description, align = "left", className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div data-slot="section-header" className={cn("flex flex-col gap-2", align === "center" && "items-center text-center", className)}>
      {eyebrow && (
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</span>
      )}
      <h2 className="text-3xl font-semibold tracking-tight text-balance">{title}</h2>
      {description && (
        <p className={cn("text-muted-foreground text-balance", align === "center" ? "max-w-2xl" : "max-w-prose")}>
          {description}
        </p>
      )}
    </div>
  );
}
