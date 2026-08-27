import { Link, useMatches } from "@tanstack/react-router";
import { SITE_LANGS } from "@/site-brand";
import { cn } from "@/lib/utils";

/**
 * The way to the site's other language.
 *
 * RENDERED BY `SiteHeader` ITSELF, never passed as a prop and never something a
 * page has to remember. A switcher the generator must add is one it eventually
 * forgets, and forgetting means a bilingual site whose second half is reachable
 * only by typing a URL — the `safe-image` and `spam-guard` rule, where the
 * guard that cannot be omitted is the one that works.
 *
 * IT RENDERS NOTHING ON A SITE WITH ONE LANGUAGE. `SITE_LANGS` is empty unless
 * the site really is multilingual, which is every site published before this and
 * the ordinary case after it, so nothing about an existing header changes.
 *
 * IT LINKS TO THE SAME PAGE, NOT TO THE OTHER LANGUAGE'S HOME. Somebody reading
 * the Spanish booking page who presses "English" wants the English booking page;
 * sending them to the front door makes them find their way back, which is the
 * kind of small rudeness that stops a feature being used.
 *
 * THIS REPLACED A DIFFERENT COMPONENT OF THE SAME NAME, and the replacement was
 * only safe because that one was reachable by nothing: a `value`/`onChange`
 * form-control picker, used by 0 of the 328 corpus pages, named in no rule and
 * in no exemplar — the on-disk-and-reachable-by-nothing shape this repo has
 * deleted 289 files over. A site with a real second language needs chrome, not a
 * `<select>`; if a settings-screen picker is ever wanted it is a new name.
 */
export function LangSwitch({ className }: { className?: string }) {
  const matches = useMatches();
  const raw = matches.length ? matches[matches.length - 1]?.pathname : "/";
  const path = typeof raw === "string" && raw.startsWith("/") ? raw.replace(/\/+$/, "") || "/" : "/";

  if (SITE_LANGS.length < 2) return null;

  // WHICH LANGUAGE THIS PAGE IS IN, matched on a WHOLE SEGMENT. `/eshop` is not
  // Spanish, and a `startsWith` here is the anchoring mistake the hostname
  // rewrite already recorded once.
  const seg = path.split("/").filter(Boolean)[0];
  const active = (seg && SITE_LANGS.find((l) => l.prefix === seg.toLowerCase())) || SITE_LANGS[0];
  // The address of this page WITHOUT a language on it, which is what every
  // other language's version is built from.
  const bare = active.prefix
    ? path === "/" + active.prefix
      ? "/"
      : path.slice(active.prefix.length + 1) || "/"
    : path;

  return (
    <nav data-slot="lang-switch" className={cn("flex items-center gap-2 text-sm", className)} aria-label="Language">
      {SITE_LANGS.map((l) => {
        const to = l.prefix ? (bare === "/" ? "/" + l.prefix : "/" + l.prefix + bare) : bare;
        const current = l.prefix === active.prefix;
        return (
          <Link
            key={l.prefix || l.lang}
            to={to}
            // `lang` AND `dir` ON THE LINK ITSELF. The label is written in the
            // language it offers — "العربية" inside an English page — so
            // without them a screen reader pronounces Arabic with an English
            // voice and the text runs the wrong way inside its own row.
            lang={l.lang}
            dir={l.dir}
            // NOT COLOUR ALONE for which one you are on: `aria-current` says it
            // to a screen reader and the WEIGHT AND UNDERLINE say it to
            // everyone, which is the same discipline the kit applies to status
            // everywhere else. The visible half is the one `current` really
            // drives; this attribute is belt-and-braces and says so.
            //
            // INERT TODAY, MEASURED RATHER THAN ASSUMED: `Link` sets
            // `aria-current="page"` on the active link itself, so removing this
            // line leaves the rendered HTML byte-identical — driven through the
            // real container and read off the served document, both languages.
            // It is inert by CONSTRUCTION rather than by luck, because the `to`
            // built for the current language is exactly this page's own path, so
            // router-active and `current` are the same predicate. Kept because
            // it is one component swap away from being the only thing carrying
            // this, and written as `page` rather than `true` so the source does
            // not claim an attribute value the DOM never shows.
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded px-1 hover:text-foreground",
              current ? "font-medium text-foreground underline underline-offset-4" : "text-muted-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
