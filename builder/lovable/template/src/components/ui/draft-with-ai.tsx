import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The button that fills a field in for you, with the field's own current
 * contents treated as something to protect.
 *
 * IT WARNS BEFORE OVERWRITING WORK. Pressing "draft this" after typing three
 * paragraphs and watching them vanish is the single worst thing this pattern
 * does, and it is entirely avoidable: when `hasContent` is set the button asks
 * once. There is no undo inside a textarea after a React state change, so the
 * confirmation is the only protection there is.
 *
 * `busy` DISABLES AND SAYS SO. A generation takes seconds, and a button that
 * looks pressable during it gets pressed again — which on a metered API is a
 * second charge for a result nobody will see.
 *
 * The label stays a verb ("Draft with AI"), never "✨". An icon-only button
 * here is a mystery on first encounter and unreachable by anybody using a
 * screen reader who has not met the pattern.
 */
export function DraftWithAi({ onDraft, hasContent, busy, label = "Draft with AI", replaceWarning = "This will replace what you have written. Continue?", size = "sm", className }: {
  onDraft: () => void;
  /** True when the target field already has something in it. */
  hasContent?: boolean;
  busy?: boolean;
  label?: string;
  replaceWarning?: string;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Button type="button" variant="outline" size={size} disabled={busy}
      className={cn("gap-1.5", className)}
      onClick={() => {
        if (hasContent && !window.confirm(replaceWarning)) return;
        onDraft();
      }}>
      <Sparkles className="size-3.5" aria-hidden="true" />
      {busy ? "Writing…" : label}
    </Button>
  );
}
