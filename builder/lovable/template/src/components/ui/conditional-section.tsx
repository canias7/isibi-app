import { cn } from "@/lib/utils";
/**
 * A block of fields that only applies sometimes.
 *
 * IT UNMOUNTS RATHER THAN HIDES. A hidden fieldset is still submitted, still
 * validated and still reachable by Tab — which is how a form refuses to submit
 * because of a required field nobody can see. Removing it from the tree is the
 * only version that behaves.
 *
 * IT SAYS WHY IT APPEARED. A section materialising after a radio button is
 * disorienting; "Because you said you're VAT registered" ties the cause to the
 * effect and stops people wondering what they did.
 *
 * `role="status"` on the reason, so its arrival is announced — a section
 * appearing mid-form is silent to a screen reader otherwise.
 */
export function ConditionalSection({ when, because, children, className }: {
  /** Render only when true. */
  when: boolean;
  /** Why it is showing — "you said you're VAT registered". */
  because?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!when) return null;
  return (
    <section data-slot="conditional-section" className={cn("flex flex-col gap-2 border-s-2 border-border ps-4", className)}>
      {because && (
        <p role="status" className="text-xs text-muted-foreground">Because {because}</p>
      )}
      {children}
    </section>
  );
}
