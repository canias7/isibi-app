import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * Published or not, said in the words of the thing.
 *
 * THE LABEL IS THE OUTCOME, NOT THE MECHANISM. "Visible on your site" beats
 * "Published", which people read as "saved". The distinction matters most on the
 * screens where it is easiest to get wrong — a price list edited and saved but
 * never published is the classic.
 *
 * BOTH STATES ARE DESCRIBED, so the reader knows what turning it off does before
 * they do it. A bare switch leaves them to discover that hiding also removes it
 * from search results, or does not.
 *
 * `role="status"` on the description so the change is announced — a switch
 * flipping is visible, its consequence is not.
 */
export function VisibilityToggle({ visible, onChange, whenOn, whenOff, label = "Visible on your site", id, className }: {
  visible: boolean;
  onChange: (v: boolean) => void;
  /** What being on means. */
  whenOn?: string;
  whenOff?: string;
  label?: string; id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <p role="status" className="text-xs text-muted-foreground">
          {visible ? whenOn ?? "Anyone can find it." : whenOff ?? "Hidden — only you can see it."}
        </p>
      </div>
      <Switch id={id} checked={visible} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
