import { cn } from "@/lib/utils";
/**
 * What an embed is allowed to do inside somebody else's page.
 *
 * IT IS WRITTEN FOR THE PERSON HOSTING IT, not for us. Somebody pasting a
 * third-party iframe into their site is taking a risk, and the questions they
 * have — can it read my page, can it see my visitors, can it navigate them away
 * — are answerable in three lines and are answered nowhere.
 *
 * "IT CANNOT READ YOUR PAGE" IS THE SENTENCE THEY WANT. Same-origin policy
 * guarantees it, but almost nobody hosting an embed knows that, and stating it
 * is what gets the snippet pasted.
 *
 * REQUIRED PERMISSIONS ARE LISTED WITH THEIR REASON. An embed asking for camera
 * access with no explanation gets refused; "to scan a booking QR code" gets
 * allowed, and the honest ones have a reason.
 *
 * THE SANDBOX ATTRIBUTES ARE SHOWN where the caller supplies them, because a
 * cautious host wants to add their own and needs to know what would break.
 */
export function EmbedPermissions({ needs = [], cannot = [], sandbox, cookies, className }: {
  /** What it asks for, with reasons. */
  needs?: { what: string; why: string }[];
  /** Extra reassurances beyond the built-in ones. */
  cannot?: string[];
  /** The sandbox attribute value it requires. */
  sandbox?: string;
  /** What cookies it sets, if any. */
  cookies?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      <div>
        <p className="text-xs font-medium text-muted-foreground">It cannot</p>
        <ul className="space-y-0.5 text-xs">
          <li className="flex gap-2"><span aria-hidden="true">·</span><span>Read anything on your page</span></li>
          <li className="flex gap-2"><span aria-hidden="true">·</span><span>Change your page or move your visitors away from it</span></li>
          {cannot.map((c) => (
            <li key={c} className="flex gap-2"><span aria-hidden="true">·</span><span>{c}</span></li>
          ))}
        </ul>
      </div>
      {needs.length > 0 && (
        <div>
          <p className="text-xs font-medium">It asks for</p>
          <ul className="space-y-0.5 text-xs">
            {needs.map((n) => (
              <li key={n.what} className="flex gap-2">
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span>{n.what} <span className="text-muted-foreground">— {n.why}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {cookies && <p className="text-xs text-muted-foreground">Cookies: {cookies}</p>}
      {sandbox && (
        <p className="text-xs text-muted-foreground">
          Needs at least <code className="font-mono text-foreground">sandbox="{sandbox}"</code> if you sandbox it.
        </p>
      )}
    </div>
  );
}
