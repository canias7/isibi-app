import { useEffect, useRef, useState } from "react";
import { siteSlug } from "@/lib/rows";

/**
 * Cloudflare Turnstile, mounted once for the whole site.
 *
 * NOT A KIT COMPONENT, AND THAT IS THE POINT. The obvious shape is a
 * `<SpamGuard />` the model drops into every public form — which asks it to
 * remember one more thing on every form of every page, and the first one it
 * forgets is a form with no protection on a site whose owner believes it is
 * protected. That is the same trap `safe-image` exists to close for pictures.
 * So it lives at the root, invisibly, and `useCreateRow` picks the token up.
 * The generator is never told this exists and never has to be.
 *
 * INERT UNLESS THE OWNER CONFIGURED IT. The site key is fetched once per page
 * load and is absent for almost every site, in which case nothing is rendered
 * and Cloudflare's script is never fetched. The key is PUBLIC by design — that
 * is what makes only half of this the platform's job; the secret that verifies
 * the token never leaves the Worker.
 *
 * `execution: "execute"` is deliberate: the challenge runs when the visitor is
 * about to submit rather than on page load, so a reader who never fills the
 * form in costs nothing and a token cannot go stale while they read.
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id?: string) => void;
  reset: (id?: string) => void;
  getResponse: (id?: string) => string | undefined;
};
const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Load Cloudflare's script once, however many times this mounts. */
let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (api()) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    // Rejecting rather than hanging matters: the submit path calls
    // `challenged()`, which needs a definite answer. A failed script leaves
    // `window.turnstile` undefined, no token is attached, and the Worker
    // refuses — which is the honest outcome of "we could not challenge you".
    s.onerror = () => { loading = null; reject(new Error("turnstile script")); };
    document.head.appendChild(s);
  });
  return loading;
}

export function SpamGuard() {
  const box = useRef<HTMLDivElement | null>(null);
  const [siteKey, setKey] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // One small same-origin GET, cached for a minute by the Worker's own
    // `cache-control`. It answers `{}` for every site with no protection, which
    // is what keeps this free for almost everybody.
    fetch(`/api/db/${siteSlug()}/turnstile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { siteKey?: string } | null) => { if (live && d?.siteKey) setKey(d.siteKey); })
      .catch(() => { /* unprotected is the normal case */ });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let live = true;
    loadScript()
      .then(() => {
        const t = api();
        if (!live || !t || !box.current || box.current.childElementCount) return;
        t.render(box.current, {
          sitekey: siteKey,
          // Managed by Cloudflare: silent for a visitor it trusts, an
          // interaction for one it does not. Deciding that ourselves is
          // guessing at something Cloudflare measures.
          appearance: "interaction-only",
          execution: "execute",
          // A token is single-use and expires. Refreshing on both means a
          // visitor who filled in a long form still has a live one at submit,
          // rather than being told to try again for no reason they can see.
          "refresh-expired": "auto",
          "error-callback": () => true,
        });
        // Start solving now, so a token is usually ready by the time somebody
        // presses submit. `interaction-only` keeps this invisible unless
        // Cloudflare actually wants a click.
        t.execute();
      })
      .catch(() => { /* nothing rendered; the Worker decides what that means */ });
    return () => { live = false; };
  }, [siteKey]);

  if (!siteKey) return null;
  // Centred and out of the flow: when Cloudflare does want an interaction the
  // visitor has to be able to see it, and it must not shift the page's layout
  // when it does not.
  return <div ref={box} className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2" />;
}
