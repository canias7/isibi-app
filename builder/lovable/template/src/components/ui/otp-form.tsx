import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { InlineAlert } from "@/components/ui/inline-alert";
import { cn } from "@/lib/utils";
/**
 * The code from an email or a text.
 *
 * Submits itself once the last digit lands — making somebody type six digits and
 * then reach for a button is a step nobody wants.
 */
export function OtpForm({ length = 6, onSubmit, onResend, busy, error, sentTo, className }: {
  length?: number; onSubmit: (code: string) => void; onResend?: () => void;
  busy?: boolean; error?: string | null; sentTo?: string; className?: string;
}) {
  const [code, setCode] = React.useState("");
  return (
    <form data-slot="otp-form" className={cn("flex flex-col items-center gap-4", className)}
      onSubmit={(e) => { e.preventDefault(); onSubmit(code); }}>
      {sentTo && <p className="text-sm text-muted-foreground">We sent a code to {sentTo}.</p>}
      <InputOTP maxLength={length} value={code}
        onChange={(v) => { setCode(v); if (v.length === length) onSubmit(v); }}>
        <InputOTPGroup>
          {Array.from({ length }, (_, i) => <InputOTPSlot key={i} index={i} />)}
        </InputOTPGroup>
      </InputOTP>
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      <BusyButton type="submit" busy={busy} busyLabel="Checking…" disabled={code.length < length}>Continue</BusyButton>
      {onResend && (
        <button type="button" onClick={onResend}
          className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4">Send it again</button>
      )}
    </form>
  );
}
