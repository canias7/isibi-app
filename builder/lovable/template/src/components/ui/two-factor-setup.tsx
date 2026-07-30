import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
/**
 * Turning on an authenticator app.
 *
 * The typed secret is shown next to the QR code, not instead of it — a phone
 * cannot photograph the screen it is standing in front of, which is exactly
 * the case when somebody is setting this up on that same phone.
 */
export function TwoFactorSetup({ secret, qrSrc, code, onCodeChange, onVerify, error, busy, className }: {
  secret: string; qrSrc?: string | null; code: string; onCodeChange: (v: string) => void;
  onVerify: () => void; error?: string | null; busy?: boolean; className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <ol className="space-y-4 text-sm">
        <li>
          <p className="font-medium">1. Scan this with your authenticator app</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {qrSrc && <img src={qrSrc} alt="Setup QR code" className="size-36 rounded border border-border bg-background p-1" />}
            <div>
              <p className="text-xs text-muted-foreground">Or type this code in:</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-sm tracking-wider">
                {secret}<CopyButton value={secret} label="Copy setup key" />
              </p>
            </div>
          </div>
        </li>
        <li>
          <p className="font-medium">2. Enter the six digits it shows</p>
          <div className="mt-2">
            <InputOTP maxLength={6} value={code} onChange={onCodeChange}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </li>
      </ol>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={onVerify} disabled={busy || code.length < 6}>
        {busy ? "Checking…" : "Turn on"}
      </Button>
    </div>
  );
}
