import { cn } from "@/lib/utils";
/** The sign-in page shape: a mark, a title, the form, and a line underneath. */
export function CenteredForm({ brand, title, description, footer, className, children }: {
  brand?: React.ReactNode; title: string; description?: string;
  footer?: React.ReactNode; className?: string; children?: React.ReactNode;
}) {
  return (
    <div data-slot="centered-form" className={cn("grid min-h-svh place-items-center px-6 py-12", className)}>
      <div className="w-full max-w-sm">
        {brand && <div className="mb-6 flex justify-center">{brand}</div>}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground text-balance">{description}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
