import { cn } from "@/lib/utils";
/** A titled group of fields, for a form long enough to need dividing. */
export function FormSection({ title, description, className, children }: {
  title: string; description?: string; className?: string; children?: React.ReactNode;
}) {
  return (
    <section className={cn("grid gap-4 border-b pb-8 last:border-0 md:grid-cols-3", className)}>
      <div className="md:col-span-1">
        <h3 className="font-medium">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-4 md:col-span-2">{children}</div>
    </section>
  );
}
