// THE HEADERS EVERY PUBLISHED SITE PAGE CARRIES (2026-10-28), in one place so
// the front door (which now calls each site's Worker directly) and the platform
// (which still serves the coming-soon page and the workspace address) cannot
// disagree. Lifted out of `harden()` in worker.js unchanged.
export function publishedSiteCsp(appZone) {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://cloudflareinsights.com",
    "frame-src 'self' https://www.openstreetmap.org https://www.google.com https://maps.google.com https://www.youtube-nocookie.com https://player.vimeo.com https://challenges.cloudflare.com",
    "base-uri 'self'",
    // THE BUILDER'S PREVIEW IS NOW CROSS-ORIGIN: a site is on its own domain,
    // so `'self'` alone would block the workspace's preview pane; the app's two
    // hosts are named, and nobody else may frame a customer's site.
    "frame-ancestors 'self' https://" + appZone + " https://www." + appZone,
  ].join("; ");
}

/** The site-page headers set on `h` (a Headers), as `harden` sets them. */
export function setPublishedSiteHeaders(h, appZone) {
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Content-Security-Policy", publishedSiteCsp(appZone));
  h.delete("X-Frame-Options");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return h;
}
