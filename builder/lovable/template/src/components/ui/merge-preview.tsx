import { cn } from "@/lib/utils";
/**
 * What you will actually get if you merge.
 *
 * The missing step in every merge flow: people are asked to choose between two
 * versions and then find out what the combination looks like AFTERWARDS, at
 * which point it is already saved.
 *
 * UNRESOLVED CONFLICTS ARE COUNTED AT THE TOP AND THE PREVIEW IS MARKED
 * INCOMPLETE. A preview that quietly renders the merged result while three
 * fields are still undecided is showing a document that will not exist, and it
 * is the most convincing possible way to be wrong.
 *
 * Each unresolved field is NAMED rather than counted alone. "3 fields still to
 * decide" sends somebody hunting; naming them is the difference between a
 * warning and an instruction.
 *
 * The result is `whitespace-pre-wrap`, since the thing being merged is usually
 * text whose line breaks are the point.
 */
export function MergePreview({ result, unresolved, className }: {
  /** The merged result as it stands. */
  result: string;
  /** Fields still to decide. Empty means the preview is complete. */
  unresolved?: string[];
  className?: string;
}) {
  const pending = unresolved ?? [];
  return (
    <div data-slot="merge-preview" className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-sm font-medium">
          {pending.length ? "Preview — not final" : "Preview"}
        </p>
        {pending.length > 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            {pending.length} still to decide: {pending.join(", ")}
          </p>
        )}
      </div>
      <div className={cn("rounded-md border p-3 text-sm whitespace-pre-wrap",
        pending.length ? "border-dashed border-border text-muted-foreground" : "border-border")}>
        {result}
      </div>
    </div>
  );
}
