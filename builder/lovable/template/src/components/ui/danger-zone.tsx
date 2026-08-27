import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The irreversible actions, kept apart and behind a confirm.
 *
 * Separated visually because proximity to ordinary settings is how somebody
 * deletes an account while trying to change their email.
 */
export function DangerZone({ actions, title = "Danger zone", className }: {
  actions: { label: string; description: string; confirmTitle: string;
             confirmDescription: string; onConfirm: () => void }[];
  title?: string; className?: string;
}) {
  return (
    <section data-slot="danger-zone" className={cn("rounded-lg border border-destructive/30", className)}>
      <h3 className="border-b border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive">{title}</h3>
      <div className="divide-y divide-border">
        {actions.map((a) => (
          <div key={a.label} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{a.label}</div>
              <p className="text-sm text-muted-foreground">{a.description}</p>
            </div>
            <ConfirmDialog destructive confirmLabel={a.label}
              title={a.confirmTitle} description={a.confirmDescription} onConfirm={a.onConfirm}
              trigger={<Button size="sm" variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10">{a.label}</Button>} />
          </div>
        ))}
      </div>
    </section>
  );
}
