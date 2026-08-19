import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    // A NAME AND THE RIGHT AUTOFILL, both defaulted here rather than asked of
    // every caller.
    //
    // The visible boxes are `<div>`s; the real control is ONE input behind them,
    // and it has no label and no text of its own — so Chromium's accessibility
    // tree computed no name for it at all, on both components in this kit that
    // use it. "Edit text, blank" is what a screen reader announces at the moment
    // somebody is copying a code out of a text message.
    //
    // `one-time-code` is what lets iOS and Android offer the code from the SMS
    // above the keyboard, which is the single thing that makes this control
    // bearable on a phone. Both are `...props`-overridable, so a caller wanting
    // "Authenticator code" still says so.
    aria-label="One-time code"
    autoComplete="one-time-code"
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName,
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}
  />
));
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  // A SLOT PAST THE END IS AN EMPTY SLOT, not a crash. Destructuring
  // `slots[index]` directly throws on any index beyond `maxLength` — and
  // rendering one more `<InputOTPSlot />` than the length allows is the obvious
  // off-by-one for whoever writes the markup, page gone through the error
  // boundary rather than one box looking wrong. Upstream shadcn does it the
  // unguarded way; this is a deliberate divergence.
  const slot = inputOTPContext?.slots?.[index];
  const { char, hasFakeCaret, isActive } = slot ?? { char: null, hasFakeCaret: false, isActive: false };

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-e border-input text-sm shadow-sm transition-all first:rounded-s-md first:border-s last:rounded-e-md",
        isActive && "z-10 ring-1 ring-ring",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
