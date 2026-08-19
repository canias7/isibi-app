// The half of a site's identity that is only known AFTER the container has
// built it.
//
// THE SPLIT IS THE WHOLE DESIGN. `site-brand.ts` carries what is known at BUILD
// time — the slug, the name, the language, the mark, the logo — baked into the
// bundle, so nothing on the render path waits on anything. This carries what is
// only known at PUBLISH time: the description the designer wrote, the share
// image (which is chosen after photographs are bought), and the route/redirect
// manifest (which is a diff against the previous publish).
//
// That ordering is not incidental. `injectMeta` runs in the platform Worker
// after the container has produced the bundle, so a value it computes CANNOT be
// baked — the shell that used to be patched with it does not exist under Start,
// because the document is `__root.tsx` rendered per request. The one thing that
// bakes cleanly is exactly the set above, which is why the load-bearing field —
// the slug, without which a custom domain sends every data call to a DIFFERENT
// site — stays on the baked side and never depends on a read that can fail.
//
// MODULE SCOPE IS SAFE HERE, AND ONLY HERE. Sharing mutable state across
// requests in a Worker isolate is normally how one visitor's data reaches the
// next one's page. It cannot happen here because ONE DISPATCH SCRIPT SERVES
// EXACTLY ONE SITE — `scriptNameFor(slug)` mints a script per slug — so there is
// never a second site's meta for this isolate to confuse it with. Written down
// because the pattern reads dangerous and the reason it is not is a property of
// the deployment rather than of this file.

export type SiteMeta = {
  /** The one-sentence description the designer wrote. */
  description?: string;
  /** Absolute URL of the share image, or empty. */
  image?: string;
  /** This site's public origin, for `og:url`. */
  origin?: string;
  /**
   * Ownership-verification tags — Search Console, Bing, Pinterest, Facebook.
   *
   * ALREADY RESOLVED BY THE PLATFORM. `builder/site-verify.mjs` owns the list of
   * names that may be emitted and checks the token's shape, so what arrives here
   * is a pair to render rather than anything to decide about. A site cannot name
   * its own tag, which is the whole point of the split.
   */
  verify?: Array<{ name: string; content: string }>;
};

let meta: SiteMeta | null = null;

/** Called by the server entry once per isolate, before the render. */
export function setSiteMeta(next: SiteMeta | null): void {
  meta = next && typeof next === "object" ? next : null;
}

/**
 * What the document's head should say beyond what is baked in.
 *
 * `null` MEANS "NOTHING TO ADD", NEVER "SOMETHING IS WRONG". A site published
 * before this existed, an R2 blip, and a site whose designer wrote no
 * description all arrive here the same way, and in all three the right answer is
 * a page that renders with the tags it does have. A missing description costs a
 * plainer link preview; refusing to render costs the site.
 */
export function siteMeta(): SiteMeta | null {
  return meta;
}
