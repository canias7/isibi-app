import { cn } from "@/lib/utils";
/**
 * Every problem, listed at the top, each one a link to its field.
 *
 * On a long form the errors are otherwise below the fold and the submit looks
 * like it did nothing. Focuses itself so a screen reader reads the list.
 */
export function FormErrorSummary({ errors, title = "Please fix the following", className }: {
  errors: { field: string; message: string }[]; title?: string; className?: string;
}) {
  if (errors.length === 0) return null;
  return (
    <div data-slot="form-error-summary" role="alert" tabIndex={-1}
      className={cn("rounded-lg border border-destructive/40 px-4 py-3", className)}>
      <p className="text-sm font-medium text-destructive">{title}</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {errors.map((e) => (
          <li key={e.field}>
            <a href={"#" + e.field} className="underline underline-offset-4">{e.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
