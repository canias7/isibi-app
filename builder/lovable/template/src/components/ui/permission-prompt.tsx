import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The generic ask-before-the-browser-asks panel, for any permission.
 *
 * ONE COMPONENT FOR EVERY PERMISSION, because the shape of the problem is
 * identical for camera, microphone, notifications and clipboard: the browser
 * prompt fires once, a reflexive refusal is permanent, and only a reason given
 * beforehand makes the difference. The specific ones in this kit
 * (`camera-access`, `location-access`, `notification-access`) are this with the
 * right words already filled in.
 *
 * DENIED IS TERMINAL AND SAYS SO HONESTLY. Once blocked, only browser settings
 * can undo it — a retry button there sends somebody round a loop, so it is
 * replaced by what actually helps: the fallback.
 *
 * THE FALLBACK IS ALWAYS OFFERED, in every state including denied. A permission
 * flow whose refusal path is a dead end is one that pressures rather than asks.
 *
 * `unavailable` IS SEPARATE FROM `denied`, because "your browser cannot do
 * this" and "you said no" need different sentences — and telling somebody to
 * check settings that have no entry for it is a waste of their time.
 */
export function PermissionPrompt({ title, reason, state, onAsk, fallback, askLabel = "Allow", className }: {
  title: string;
  /** Why it is needed — one sentence. */
  reason: string;
  state: "ask" | "asking" | "denied" | "granted" | "unavailable";
  onAsk: () => void;
  /** The way to carry on without it. */
  fallback?: React.ReactNode;
  askLabel?: string;
  className?: string;
}) {
  if (state === "granted") return null;
  return (
    <div data-slot="permission-prompt" className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm">{reason}</p>
      {state === "denied" && (
        <p className="text-xs text-muted-foreground">
          This is blocked for this site. Only your browser settings can turn it back on.
        </p>
      )}
      {state === "unavailable" && (
        <p className="text-xs text-muted-foreground">Your browser does not offer this.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {(state === "ask" || state === "asking") && (
          <Button type="button" size="sm" onClick={onAsk} disabled={state === "asking"}>
            {state === "asking" ? "Waiting for your browser…" : askLabel}
          </Button>
        )}
        {fallback}
      </div>
    </div>
  );
}
