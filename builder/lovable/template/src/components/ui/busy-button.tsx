import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
/**
 * A button that cannot be pressed twice.
 *
 * Disabling while in flight is the difference between one booking and three —
 * a customer who sees nothing happen presses again. The label changes too, so
 * the state is readable rather than only inferable from a spinner.
 */
export function BusyButton({ busy, busyLabel, children, disabled, ...props }:
  React.ComponentProps<typeof Button> & { busy?: boolean; busyLabel?: string }) {
  return (
    <Button {...props} disabled={busy || disabled} aria-busy={busy || undefined}>
      {busy && <Spinner />}
      {busy ? (busyLabel ?? children) : children}
    </Button>
  );
}
