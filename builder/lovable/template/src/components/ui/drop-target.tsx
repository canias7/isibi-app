import { cn } from "@/lib/utils";
/**
 * Where you can let go.
 *
 * A drop zone is invisible until something is dragged over it, which is exactly
 * backwards: the reader needs to know a target exists BEFORE they pick anything
 * up, or they drag around the screen hunting for a reaction. It is outlined at
 * rest and filled while hovered.
 *
 * `over` is a prop rather than internal state, and that is deliberate — HTML
 * drag events fire `dragleave` when the pointer crosses onto a CHILD element,
 * so a component tracking its own hover flickers on anything with content
 * inside it. The caller counts enter and leave, which is the only reliable fix.
 *
 * IT ALSO ACCEPTS A CLICK. Drag is unreachable for plenty of people, so the
 * zone doubles as a button when `onPick` is given — the same pattern every file
 * upload uses, applied to every other kind of drop.
 *
 * `aria-disabled` rather than removal when it will not accept: a target that
 * vanishes mid-drag reflows the page under the pointer.
 */
export function DropTarget({ label, hint, over, disabled, onPick, children, className }: {
  label: string;
  hint?: string;
  /** True while a drag is over it. Counted by the caller. */
  over?: boolean;
  disabled?: boolean;
  /** Makes it clickable as well as droppable. */
  onPick?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const Tag = onPick && !disabled ? "button" : "div";
  return (
    <Tag
      {...(onPick && !disabled ? { type: "button" as const, onClick: onPick } : {})}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-6 text-center",
        over && !disabled ? "border-foreground bg-muted" : "border-border",
        disabled && "opacity-50",
        onPick && !disabled && "cursor-pointer hover:bg-muted/50",
        className,
      )}>
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {children}
    </Tag>
  );
}
