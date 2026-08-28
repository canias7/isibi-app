/**
 * WHAT A SITE LOOKS LIKE, STORED WHERE THE SITE IS SERVED FROM.
 *
 * Six things decide the appearance of a published site: the look object, the
 * model's own stylesheet, the logo, the tab icon, the search-console tags and
 * the translation cache. Every one of them lived in `_meta` — a key-value table
 * inside the site's OWN Neon database — beside the things that are genuinely
 * about a database: the schema, the auth endpoint, the data API, the jobs.
 *
 * NONE OF THE SIX IS A ROW. They are config for the compiled output, and the
 * compiled output is in R2: `sites/<slug>/` is what the public is served, and
 * the site's own Worker script fetches every byte it serves out of that bucket
 * (`site-dispatch.mjs` binds it, `template/src/server.ts` reads it). So the look
 * was filed one tier down from the thing it describes.
 *
 * THAT MISFILING IS THE ONLY REASON A FRONTEND-ONLY SITE NEEDS A DATABASE.
 * A site with no form, no booking and no members has nothing to keep in
 * Postgres — and could not be built without one, because the publish path has to
 * put the stylesheet somewhere and `_meta` was the only somewhere there was.
 *
 * ONE OBJECT PER SITE, NOT SIX. The read sites want all of them at once (the
 * publish spine reads every one on every cheap edit), so six keys is six round
 * trips where the `_meta` query was one. `config/<slug>.json` is one get.
 *
 * A READ THAT THROWS IS NOT AN EMPTY CONFIG, and that distinction is the whole
 * safety property. It was learned by losing it: until 2026-08-14 the publish
 * spine's look read swallowed its own error and fell through, so one transient
 * blip during ANY cheap edit republished the live site with no theme, no
 * stylesheet, default fonts and its SLUG as its title — told the customer the
 * edit succeeded, and archived the stripped version to history. `ok: false`
 * means the caller must refuse; a read that SUCCEEDS with nothing stored is the
 * legitimate never-configured state and proceeds.
 *
 * THE NEON FALLBACK IS A MIGRATION RAMP AND IS READ-ONLY. Every site published
 * before this has its six values in `_meta` and nothing in R2, so a miss falls
 * back and backfills — the shape `site-routing.mjs` already uses for the same
 * reason, where the fallback makes an empty store slow rather than wrong.
 * Nothing here ever writes back to Neon: one writer, or the two stores drift and
 * whichever is read first wins.
 *
 * A plain module with no bindings — the caller supplies the get, the put and the
 * legacy read — so every decision here is driven in the unit suite with a fake
 * store and no database anywhere near it.
 */

/**
 * The one key. Deliberately NOT under `sites/<slug>/`: that prefix is what the
 * public is served, and a customer's stylesheet-in-progress, their unpublished
 * verification tokens and their translation cache are not public files. It joins
 * `source/`, `backups/`, `versions/`, `orphans/` and `jobs/` as a private one.
 */
export const CONFIG_KEY = (slug) => "config/" + String(slug) + ".json";

/**
 * The fields, in one place, so the readers and the fallback cannot disagree
 * about what a config is. One added here reaches both halves at once.
 *
 * `share` is the owner's chosen link-preview picture (2026-08-28): the BASENAME
 * of one of their own uploads, or "" for "let the platform pick". A basename
 * rather than a URL, because the origin a site serves at can change (a custom
 * domain arrives, the zone moves) and a stored absolute URL would go stale with
 * it — the reader re-derives the address and re-validates the file against the
 * live upload list on every use, so a deleted file falls back rather than
 * 404ing the preview.
 */
export const CONFIG_FIELDS = ["look", "css", "logo", "icon", "verify", "langStrings", "share"];

/**
 * What each field was called in `_meta`. The `site_` prefix earned its keep
 * there — that table also holds `schema`, `auth_info` and `jobs`, so the config
 * needed marking off. In a file that IS the config it is a stutter, so the names
 * are short here and this map is the ONE place the correspondence lives.
 */
export const LEGACY_META = {
  look: "site_look",
  css: "site_css",
  logo: "site_logo",
  icon: "site_icon",
  verify: "site_verify",
  langStrings: "site_lang_strings",
  // `share` has NO legacy name, deliberately: it postdates the `_meta` era, so
  // no site ever stored one there and a fallback key would be a search for a
  // row that cannot exist. The filter below is what keeps its absence out of
  // the legacy SELECT — an unfiltered map would interpolate 'undefined' into
  // the IN list.
};

/** Every key `_meta` holds a config value under, for the fallback's SELECT. */
export const LEGACY_KEYS = CONFIG_FIELDS.map((f) => LEGACY_META[f]).filter(Boolean);

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * The shape every caller gets, present or absent.
 *
 * The absent value per field is what the call sites already use — `null` for the
 * three objects, `""` for the three strings — so "was anything stored" stays
 * answerable per field (`if (!priorLook && !priorCss)` is a real gate in the
 * look lane) without a second flag to keep in step.
 */
export function emptyConfig() {
  return { look: null, css: "", logo: "", icon: "", verify: null, langStrings: null, share: "" };
}

/** Coerce anything into the shape above. A wrong type reads as absent. */
function normalize(raw) {
  const o = isObj(raw) ? raw : {};
  return {
    look: isObj(o.look) ? o.look : null,
    css: typeof o.css === "string" ? o.css : "",
    logo: typeof o.logo === "string" ? o.logo : "",
    icon: typeof o.icon === "string" ? o.icon : "",
    verify: isObj(o.verify) ? o.verify : null,
    langStrings: isObj(o.langStrings) ? o.langStrings : null,
    share: typeof o.share === "string" ? o.share : "",
  };
}

/**
 * Parse a stored object. `null` means UNREADABLE, never empty.
 *
 * A corrupt object is refused rather than routed around: R2 writes are whole and
 * strongly consistent, so garbage there is something having written garbage —
 * a bug to surface loudly, not to paper over by publishing the site stripped,
 * which is the exact failure the throwing-read rule exists to prevent.
 */
export function readConfig(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!isObj(parsed)) return null;
  return normalize(parsed);
}

/** What gets written. Normalised first, so a bad patch cannot store a bad shape. */
export function writeConfig(config) {
  return JSON.stringify(normalize(config));
}

/**
 * `_meta` rows into a config.
 *
 * `_meta.v` is TEXT, so the three object-shaped fields arrive as JSON strings and
 * each needs its own parse. TOLERATED PER FIELD, exactly as the call sites do
 * today: a bad `site_verify` row is no verification and a bad `site_lang_strings`
 * is a cold cache — neither is a reason to lose the other five.
 *
 * `found` is what separates "this site has nothing stored" from "this site has a
 * config", which the caller needs in order to decide whether to backfill.
 */
export function fromMetaRows(rows) {
  const out = emptyConfig();
  let found = false;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.k !== "string") continue;
    const field = CONFIG_FIELDS.find((f) => LEGACY_META[f] === r.k);
    if (!field || r.v == null) continue;
    if (field === "css" || field === "logo" || field === "icon") {
      if (typeof r.v === "string") { out[field] = r.v; found = true; }
      continue;
    }
    try {
      const parsed = JSON.parse(r.v);
      if (isObj(parsed)) { out[field] = parsed; found = true; }
    } catch { /* a bad row is one lost field, not a failed publish */ }
  }
  return { config: out, found };
}

/**
 * Merge a patch over a config. ABSENT MEANS UNCHANGED — the rule every edit lane
 * in this codebase already runs on — so a lane naming one field cannot silently
 * drop the other five.
 *
 * `undefined` is the only absence. `null` and `""` are real values a caller may
 * want to store, because taking a logo off is an edit somebody makes.
 */
export function withConfig(prior, patch) {
  const base = normalize(prior);
  const p = isObj(patch) ? patch : {};
  const out = { ...base };
  for (const f of CONFIG_FIELDS) if (p[f] !== undefined) out[f] = p[f];
  return normalize(out);
}

/**
 * Read a site's config, falling back to `_meta` for a site built before this.
 *
 * `deps.get(key)` answers the stored text or null, and THROWS if it could not
 * look. `deps.legacy()` is optional and answers `_meta` rows; a site with no
 * database supplies none, which is the whole point of the change this enables.
 *
 * Returns `{ ok, config, from }`. `from` is `"r2"`, `"legacy"` or `"none"`, and
 * exists so a caller can say which happened rather than reporting the same
 * answer for two different states.
 */
export async function loadConfig(deps, slug) {
  const key = CONFIG_KEY(slug);
  let text = null;
  try {
    text = await deps.get(key);
  } catch (e) {
    return { ok: false, why: "store", error: String((e && e.message) || e), config: emptyConfig(), from: "none" };
  }

  if (text != null) {
    const config = readConfig(text);
    if (!config) {
      return { ok: false, why: "unreadable", error: "the stored config could not be parsed", config: emptyConfig(), from: "r2" };
    }
    return { ok: true, config, from: "r2" };
  }

  // NOTHING IN R2. Either a site built before this, or one that has never stored
  // anything. Only the database can tell them apart, and a site without one is
  // by construction the second.
  if (typeof deps.legacy !== "function") return { ok: true, config: emptyConfig(), from: "none" };

  let rows;
  try {
    rows = await deps.legacy();
  } catch (e) {
    // CANNOT TELL, so refuse — the same answer the R2 throw gets, and for the
    // same reason. Falling through to an empty config here would republish an
    // existing site stripped of its entire design on a transient blip.
    return { ok: false, why: "legacy", error: String((e && e.message) || e), config: emptyConfig(), from: "none" };
  }
  const { config, found } = fromMetaRows(rows);
  if (!found) return { ok: true, config: emptyConfig(), from: "none" };

  // BACKFILL, BEST-EFFORT. The read has already succeeded, so a failed write
  // costs one more fallback next time and nothing else — never the read. Never
  // written back to Neon: R2 is the one writer from here on.
  if (typeof deps.put === "function") {
    try { await deps.put(key, writeConfig(config)); } catch (e) { /* slow next time, never wrong */ }
  }
  return { ok: true, config, from: "legacy" };
}

/**
 * Write a site's config.
 *
 * Takes the WHOLE config rather than reading-modifying-writing, because every
 * call site already loaded it at the top of the same handler — so this adds no
 * round trip, and the read-to-write window is exactly the one those handlers
 * already have rather than a second, wider one hidden in here.
 */
export async function saveConfig(deps, slug, config) {
  try {
    await deps.put(CONFIG_KEY(slug), writeConfig(config));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
