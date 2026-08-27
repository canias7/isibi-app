/**
 * Structured data — what puts opening hours, a price and a star rating into a
 * Google result rather than just a blue link.
 *
 * `dangerouslySetInnerHTML` is the correct way to write a JSON-LD script and
 * the only one that works: React escapes text children, so `{json}` inside a
 * `<script>` emits `&quot;` and the block is silently invalid.
 *
 * `<` is escaped in the output, because a business name containing `</script>`
 * would otherwise close the tag and inject markup — the one real hazard here,
 * and the reason the data is serialised rather than pasted.
 *
 * Only describe what is genuinely on the page. Marking up a rating the page
 * does not show is what gets a site's rich results turned off entirely.
 */
export function SeoJsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  let json: string;
  try { json = JSON.stringify(data); } catch { return null; }
  return (
    <script data-slot="seo-json-ld" type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, "\\u003c") }} />
  );
}
/** The one nearly every generated site wants: a business with an address and hours. */
export function localBusinessJsonLd(v: {
  name: string; url?: string; telephone?: string; email?: string; image?: string;
  address?: { street?: string; city?: string; postcode?: string; country?: string };
  openingHours?: string[];   // e.g. ["Tu-Sa 09:00-18:00"]
  priceRange?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: v.name,
    ...(v.url ? { url: v.url } : {}),
    ...(v.telephone ? { telephone: v.telephone } : {}),
    // A REAL schema.org LocalBusiness PROPERTY, and it was missing. Measured
    // live 2026-08-19: the generator wrote `email: "hello@…"` on a bindery's
    // home page, `tsc` refused it with TS2353, and because that page is
    // index.tsx — which salvage will not stub — the whole site fell back to
    // the placeholder. The model's instinct was right and the kit refused it,
    // which is the `fallbackSeed` and `useUpdateRow` class for the third time.
    ...(v.email ? { email: v.email } : {}),
    ...(v.image ? { image: v.image } : {}),
    ...(v.priceRange ? { priceRange: v.priceRange } : {}),
    ...(v.address ? {
      address: {
        "@type": "PostalAddress",
        ...(v.address.street ? { streetAddress: v.address.street } : {}),
        ...(v.address.city ? { addressLocality: v.address.city } : {}),
        ...(v.address.postcode ? { postalCode: v.address.postcode } : {}),
        ...(v.address.country ? { addressCountry: v.address.country } : {}),
      },
    } : {}),
    ...(v.openingHours?.length ? { openingHours: v.openingHours } : {}),
  };
}
