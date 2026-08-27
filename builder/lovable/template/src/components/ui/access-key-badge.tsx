import { useIsMac } from "@/components/ui/key-cap";
import { cn } from "@/lib/utils";
/**
 * The underlined letter on a menu item — but honest about the modifier.
 *
 * `accesskey` is the oldest keyboard feature in HTML and almost nobody shows it
 * correctly, because THE MODIFIER DIFFERS BY BROWSER: Alt on Windows Chrome,
 * Alt+Shift on Firefox, Ctrl+Option on Safari. An underlined letter alone tells
 * a reader a key exists and not how to press it, which is why the tradition
 * quietly died.
 *
 * So this renders the letter AND names the modifier for the platform, and the
 * `sr-only` text spells the whole combination out.
 *
 * It underlines the letter INSIDE the label rather than appending a badge,
 * which is the convention people already read — and it matches only the FIRST
 * occurrence, so "Save" with key "a" underlines the a in Save rather than every
 * a on the page.
 *
 * A letter that does not appear in the label renders the label unchanged and
 * puts the key in the announcement, instead of silently dropping it.
 */
export function AccessKeyBadge({ label, accessKey, className }: {
  label: string;
  /** The single character bound with the accesskey attribute. */
  accessKey: string;
  className?: string;
}) {
  const mac = useIsMac();
  const modifier = mac ? "Control Option" : "Alt";
  const i = label.toLowerCase().indexOf(accessKey.toLowerCase());

  return (
    <span data-slot="access-key-badge" className={cn(className)}>
      {i >= 0 ? (
        <>
          <span aria-hidden>{label.slice(0, i)}</span>
          <span aria-hidden className="underline underline-offset-2">{label[i]}</span>
          <span aria-hidden>{label.slice(i + 1)}</span>
        </>
      ) : (
        <span aria-hidden>{label}</span>
      )}
      <span className="sr-only">{label}, shortcut {modifier} {accessKey.toUpperCase()}</span>
    </span>
  );
}
