import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Continue with Google" and its siblings.
 *
 * NO BRAND LOGOS. Each provider's mark is licensed artwork with its own rules
 * about size, clear space and colour, and the ones served from a CDN put a
 * third-party request — and its cookies — on the sign-in page of every site
 * built here. The provider's NAME is what the person is looking for and it is
 * unambiguous without the mark.
 *
 * "Continue with", never "Sign in with" or "Sign up with". The button does both
 * and the person pressing it does not know which they are doing — an existing
 * account signs in, a new one is created, and picking either verb makes half
 * the visitors hesitate over whether they are about to make a second account.
 *
 * `last` marks the provider used last time, which is the single most useful
 * thing this row can say: the commonest failure here is somebody creating a
 * second account through a different provider and finding their bookings gone.
 * It needs no server call — it is in local storage.
 */
export function SsoButton({ provider, onClick, last, busy, disabled, className }: {
  provider: string;
  onClick: () => void;
  last?: boolean;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button data-slot="sso-button" type="button" onClick={onClick} disabled={busy || disabled}
      className={cn("relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
        last ? "border-foreground" : "border-border",
        "hover:bg-muted disabled:pointer-events-none disabled:opacity-60", className)}>
      <span>{busy ? `Opening ${provider}…` : `Continue with ${provider}`}</span>
      {last ? (
        <span className="absolute end-3 text-xs font-normal text-muted-foreground">Last used</span>
      ) : null}
    </button>
  );
}

export function SsoButtons({ providers, onChoose, lastUsed, busy, className }: {
  providers: string[];
  onChoose: (provider: string) => void;
  lastUsed?: string | null;
  busy?: string | null;
  className?: string;
}) {
  const ordered = lastUsed && providers.includes(lastUsed)
    ? [lastUsed, ...providers.filter((p) => p !== lastUsed)]
    : providers;
  return (
    <div data-slot="sso-buttons" className={cn("flex flex-col gap-2", className)}>
      {ordered.map((p) => (
        <SsoButton key={p} provider={p} last={p === lastUsed} busy={busy === p}
          disabled={!!busy && busy !== p} onClick={() => onChoose(p)} />
      ))}
    </div>
  );
}
