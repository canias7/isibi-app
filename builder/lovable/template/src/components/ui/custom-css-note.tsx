import { cn } from "@/lib/utils";
/**
 * The warning that belongs beside a custom-CSS box.
 *
 * IT SAYS THE PRODUCT WILL BREAK IT, and that is the honest part nobody writes.
 * Custom CSS targets class names that are generated, and the next deploy
 * renames them — so a customer's careful styling silently stops working, and
 * they report it as a regression. Saying so up front turns that into an
 * expected cost.
 *
 * IT DISTINGUISHES SUPPORTED HOOKS FROM EVERYTHING ELSE. Where the product
 * offers stable classes or custom properties, those survive; naming them
 * channels people towards the half that will keep working.
 *
 * IT IS NOT COVERED BY SUPPORT, and that is stated rather than discovered
 * during an incident. A page broken by a customer's own CSS looks exactly like
 * a product bug from the outside.
 *
 * NO SYNTAX HIGHLIGHTING AND NO EDITOR HERE — this is the note, the caller
 * supplies the textarea. `code-block` already refused shiki for the same
 * reason: a megabyte for something a settings page uses once.
 */
export function CustomCssNote({ stableHooks = [], scope, className }: {
  /** Class names or properties that will not change. */
  stableHooks?: string[];
  /** Where it applies — "your published site only". */
  scope?: string;
  className?: string;
}) {
  return (
    <div data-slot="custom-css-note" className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      {scope && <p>This applies to {scope}.</p>}
      <p>
        <span className="text-foreground">Anything you style here can break when we update.</span>{" "}
        Class names are generated and change without notice, and a page broken by custom CSS is not something we can
        fix for you.
      </p>
      {stableHooks.length > 0 && (
        <p>
          These will not change, so prefer them:{" "}
          {stableHooks.map((h, i) => (
            <span key={h}>
              {i > 0 && ", "}
              <code className="font-mono text-foreground">{h}</code>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
