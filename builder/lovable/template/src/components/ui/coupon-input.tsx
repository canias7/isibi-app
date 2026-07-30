import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { cn } from "@/lib/utils";
/** A discount code. Uppercases as you type, because codes always are. */
export function CouponInput({ onApply, applied, error, busy, className }: {
  onApply: (code: string) => void; applied?: string | null;
  error?: string | null; busy?: boolean; className?: string;
}) {
  const [code, setCode] = React.useState("");
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex gap-2">
        <Input value={code} placeholder="Discount code" aria-label="Discount code"
          className="uppercase" autoCapitalize="characters" spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Button type="button" variant="outline" disabled={!code || busy} onClick={() => onApply(code)}>
          {busy ? "Checking…" : "Apply"}
        </Button>
      </div>
      {error ? <InlineAlert tone="error">{error}</InlineAlert>
        : applied ? <InlineAlert tone="success">{applied} applied.</InlineAlert> : null}
    </div>
  );
}
