/**
 * RENAMING A SITE, WITHOUT MOVING ONE BYTE OF IT (owner's call, 2026-08-29:
 * "yeah do the alias one").
 *
 * ── WHY AN ALIAS AND NOT A MOVE ─────────────────────────────────────────────
 *
 * A slug is the key to five Supabase tables, seven R2 prefixes and one script in
 * the dispatch namespace. A "real" rename copies all of that under a new key and
 * deletes the old — and R2 has no rename, so that copy is a loop of PUTs with no
 * transaction around it. A copy that dies halfway leaves the site half at each
 * address and there is nothing to roll back to.
 *
 * AND THE MOVE NEEDS EVERYTHING THIS NEEDS ANYWAY. Whichever way it is built,
 * the platform must remember that the old name belongs to this site:
 *
 *   * the old address has to keep working — customers print it, link it, and
 *     since 2026-08-29 we generate QR CODES pointing at it; and
 *   * the old name has to stay CLAIMED, or the next person to build
 *     `shoeroom-1` takes over an address a live site is still redirecting from.
 *
 * So the alias record is the whole feature and the copy is pure added risk.
 * Nothing moves, nothing can half-fail, and a rename is reversible.
 *
 * ── THE ONE PERMANENT CONSEQUENCE, STATED ONCE ──────────────────────────────
 *
 * THE STORAGE SLUG AND THE PUBLIC ADDRESS CAN NOW DIFFER, and nothing anywhere
 * may assume they are equal. `slug` continues to mean the storage key — every
 * R2 prefix, every table, the dispatch script, and `SITE_SLUG` baked into the
 * page (which is what addresses the site's own API, so it MUST stay the storage
 * key). `publicName` is what a visitor types and what the site calls itself.
 *
 * The one place that distinction is load-bearing rather than cosmetic is the
 * canonical link and `og:url`: those are read per request out of the R2
 * sidecar's `origin`, so a sidecar computed from the storage slug tells every
 * crawler that the site's real address is the old one — the "a wrong canonical
 * is worse than none" case __root.tsx already argues. TWO HOPS CARRY IT, and
 * until 2026-09-02 neither existed: the publish spine derives the sidecar's
 * origin from the public name (`publicUrlFor` in worker.js), so every later
 * publish keeps the new address; and the rename lane patches that one key the
 * moment the alias is current — no container, nothing a lost lease can leave
 * half-done. The first live rename (run 17) found both missing: the branch
 * republished, the spine baked the storage slug, and the consumer died in the
 * compile, so the new address served the old canonical.
 *
 * ── FORGETTING AN OLD NAME (owner, 2026-09-02: "i want that") ──────────────
 *
 * The permanent redirect is the DEFAULT, and the owner may end it: "forget the
 * old address X" deletes X's row, so the address stops answering (a 404 that
 * is never cached) and the name is free for anyone. Its own step, never a side
 * effect of a rename, because once somebody else takes the name it cannot be
 * undone. `RENAME_TOOL.forget` carries it, instead of `name`; `readForget`
 * reads it; the lane deletes by alias AND slug AND not-current in one request
 * that hands back what it removed. The storage name is the one label a deleted
 * row cannot make disappear — see `resolveAlias`'s fourth case.
 */

/** How long a name may be, matching the build-time slug filter. */
export const MAX_ALIAS = 80;

/**
 * The table, as the code expects it.
 *
 * EXPORTED SO A GUARD CAN READ IT, because this repo has no migration runner —
 * tables are created by hand, so the schema and the code that reads it are two
 * copies of one fact with nothing holding them together. A test asserting the
 * columns this module actually uses appear here is the thinnest possible
 * version of that rope.
 *
 * `current` IS ENFORCED BY A PARTIAL UNIQUE INDEX rather than by us. Exactly one
 * live name per site, decided by Postgres — two rows claiming to be a site's
 * current address is a state no application check can be trusted to prevent
 * under concurrency, and it would present as the address flapping between two
 * names depending on which row came back first.
 */
export const ALIAS_SQL = `
create table if not exists site_aliases (
  alias      text primary key,
  slug       text not null,
  uid        uuid not null,
  current    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists site_aliases_slug on site_aliases (slug);
create unique index if not exists site_aliases_one_current on site_aliases (slug) where current;
alter table site_aliases enable row level security;
`;

/**
 * A NAME AS IT WOULD BE STORED, or null.
 *
 * The same shape the build filter accepts, because an alias becomes a hostname
 * label and a `/s/<name>/` path: anything this admits, DNS and the router must
 * both admit too. A leading or trailing hyphen is refused here even though the
 * build filter historically allowed it — `siteHostFor` answers null for such a
 * slug, so admitting one would mint a name with no pretty address at all, which
 * is the one thing a rename cannot be for.
 */
export function cleanAlias(name) {
  if (typeof name !== "string") return null;
  // THE THREE TRANSFORMS THAT ARE READING RATHER THAN REWRITING: case, the
  // surrounding whitespace, and the separators a person types instead of a
  // hyphen. "Sunset Shoes" and "sunset_shoes" both plainly MEAN `sunset-shoes`.
  const read = name.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (!read) return null;

  // ── ANYTHING ELSE IS A REFUSAL, NOT A REPAIR ──────────────────────────────
  //
  // The first draft stripped every remaining character, which turned
  // "déjà vu café" into `dj-vu-caf` and "https://x" into `httpsx` — names the
  // customer did not ask for and would not recognise. On any other field a
  // silent tidy-up is a small rudeness; here it is PERMANENT, because the old
  // address 301s to whatever this returns for the rest of the site's life.
  //
  // So a name carrying anything outside [a-z0-9-] is refused whole and the
  // customer picks again — the same contract the favicon and the QR have, and
  // for the same reason: a refusal they can act on beats a result they cannot
  // undo. (Transliterating accents would be a kindness, but "café" → "cafe" is
  // a judgement about a business's name that we should not be making silently.)
  if (!/^[a-z0-9-]+$/.test(read)) return null;
  if (read.length > MAX_ALIAS) return null;
  // Two characters is not a name anybody asked for, and every one-or-two-letter
  // label is worth keeping free for the platform.
  if (read.length < 3) return null;
  return read;
}

/**
 * WHAT A HOSTNAME LABEL RESOLVES TO — the whole rule, as a pure function.
 *
 * `rows` is what the platform knows about this ONE label: null for "there is no
 * alias row", or `{ slug, current }`. `currentName` is the site's live public
 * name, needed only to build the redirect.
 *
 *   no row            → an ordinary site; the label IS the slug (every site
 *                       that has never been renamed, which is all 47 of them)
 *   row, current      → serve `slug` under this name
 *   row, not current  → an OLD name: 301 to whatever the site is called now
 *   no row, and the site this label names now lives under a DIFFERENT name
 *                     → GONE: the storage name was forgotten (see below)
 *
 * THE THIRD CASE IS THE FEATURE. A renamed site keeps answering at its old
 * address forever, which is what makes a rename safe to offer at all — until
 * the owner says otherwise (2026-09-02, "i want that"): FORGETTING an old name
 * deletes its row, so the address stops answering and the name is free. For an
 * old ALIAS that is the whole story (no row, no site under that slug, 404).
 * The storage name is the one label a deleted row cannot make disappear —
 * with no row it reads as an ordinary site — so the fourth case is told apart
 * by the one fact left: the site it names now answers to another name. The
 * caller passes that name, looked up by the label as a slug; equal to the
 * label, or unknown (cannot tell), and the label is served as it always was.
 */
export function resolveAlias(label, row, currentName) {
  const l = typeof label === "string" ? label.toLowerCase() : "";
  if (!l) return { slug: null, redirect: null };
  if (!row || typeof row !== "object") {
    const now = typeof currentName === "string" && currentName ? currentName.toLowerCase() : null;
    if (now && now !== l) return { slug: null, redirect: null, gone: true };
    return { slug: l, redirect: null };
  }
  const slug = typeof row.slug === "string" && row.slug ? row.slug.toLowerCase() : null;
  if (!slug) return { slug: l, redirect: null };
  if (row.current) return { slug, redirect: null };
  // An old name whose site's current name we could not establish still SERVES
  // rather than 404s. "We cannot tell what it is called now" must never read as
  // "there is no such site" — the address is live either way, and a redirect we
  // cannot build is worth less than a page we can.
  const to = typeof currentName === "string" && currentName ? currentName.toLowerCase() : null;
  return { slug, redirect: to && to !== l ? to : null };
}

/**
 * The two rows a rename writes, in the order they must be written.
 *
 * THE OLD NAME IS RECORDED FIRST AND THE NEW ONE MADE CURRENT SECOND, because
 * the failure between them has to be the harmless one. Old-recorded-only leaves
 * the site answering at its old address with no new name — exactly where it
 * started. The reverse would leave the new name live and the old one
 * unclaimed, free for a stranger to build over while the customer's printed
 * cards still point at it.
 *
 * A SITE'S FIRST RENAME HAS TO RECORD THE NAME IT WAS BORN WITH, which has no
 * row: until now it needed none, because a label with no row IS a slug. So the
 * first rename writes two rows and every later one writes two as well — the
 * previous current name is demoted rather than inserted.
 */
export function renameRows({ slug, uid, from, to }) {
  const s = typeof slug === "string" ? slug.toLowerCase() : "";
  const f = cleanAlias(from);
  const t = cleanAlias(to);
  if (!s || !f || !t || f === t) return null;
  return {
    // Every name this site has ever had, no longer current.
    demote: { slug: s, uid, alias: f, current: false },
    // …and the one it answers to now.
    promote: { slug: s, uid, alias: t, current: true },
  };
}

/**
 * Why a requested name cannot be used, or null when it can.
 *
 * ONE FUNCTION, SO THE LANE AND THE ROUTE CANNOT DISAGREE. The reasons are
 * sentences a customer reads, because every one of them needs a different next
 * move from them and "that name is taken" for a name that is merely malformed
 * sends them looking for a conflict that does not exist.
 */
export function aliasRefusal(requested, { taken = false, same = false, reserved = false, live = false, stranger = false } = {}) {
  const clean = cleanAlias(requested);
  if (!clean) {
    return "That name will not work as a web address — it needs at least 3 characters, letters, numbers and hyphens only.";
  }
  if (same) return "That is already the site's address.";
  if (reserved) return "That name is reserved by the platform. Try another.";
  if (taken) return "That name is already taken by another site. Try another.";
  // The two ways a FORGET can be wrong, each its own next move: the name is
  // the address the site answers at now (rename first), or it is not one of
  // this site's old addresses at all (nothing to forget).
  if (live) return "That is the address the site answers at now. Give it a new address first, then forget this one.";
  if (stranger) return "That is not one of this site's old addresses, so there is nothing to forget.";
  return null;
}

/**
 * PULLING THE NEW NAME OUT OF WHAT THE CUSTOMER SAID.
 *
 * ITS OWN TOOL, IN THIS MODULE, for the reason the edit lanes have theirs: the
 * wording is written for somebody CHANGING an address, and nothing about a first
 * build's slug field belongs in it. One property, nothing required — a message
 * the model cannot read a name out of answers nothing, and that is a refusal we
 * can explain rather than a guess we cannot undo.
 *
 * NOTHING IS GUESSED HERE. Every other lane on this platform biases toward
 * acting, because a wrong edit is visible and undoable. A rename is neither: the
 * old address 301s forever after, so a name invented from a vague message is a
 * permanent redirect nobody asked for. This is the second place — after the
 * `pages` verb — where the bias inverts.
 */
export const RENAME_TOOL = {
  name: "new_address",
  description: "Say what the customer wants done with their site's web address, if they said: a new address, or an old one to forget.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "The NEW address they asked for — just the name, not the whole URL: for \"rename it to Sunset Shoes\" " +
          "answer `sunset-shoes`, for \"can it be at bakery.gofarther.app\" answer `bakery`. Lower case, words " +
          "joined by hyphens.\n" +
          "ONLY IF THEY SAID ONE. If they asked to rename the site without saying what to, or you are picking " +
          "between two readings of what they meant, answer NOTHING. Do not invent a name from the business's " +
          "own name and do not tidy up a name they gave you — the old address redirects to the new one " +
          "permanently, so a guess here is a permanent redirect nobody asked for.",
      },
      // FORGETTING AN OLD ADDRESS (owner, 2026-09-02). The other thing a
      // customer says about their address after a rename: make the old one
      // stop working. Its own property rather than a verb beside `name`, so
      // one answer cannot rename and forget at once — and, like `name`, only
      // when they said WHICH: forgetting frees the name for anyone to take.
      forget: {
        type: "string",
        description:
          "An OLD address of this site they want to stop working — for \"forget the old address\", \"drop the old " +
          "name\", \"stop crookes-guitar working\": the old name, lower case, hyphens. It must be one of the old " +
          "addresses listed, and it is INSTEAD of `name`, never both. ONLY IF THEY NAMED IT, or the site has " +
          "exactly one old address and they plainly mean that one; otherwise answer NOTHING — a forgotten " +
          "address stops working at once and the name is free for anyone to claim.",
      },
    },
    required: [],
  },
};

/** One call, cached tool, the customer's words. Mirrors `editRequest`. */
export function renameRequest({ message, current, former, model }) {
  const old = Array.isArray(former) ? former.filter((n) => typeof n === "string" && n).map((n) => "`" + n + "`") : [];
  return {
    model,
    max_tokens: 200,
    tools: [{ ...RENAME_TOOL, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: "new_address" },
    messages: [{ role: "user", content:
      "Their site's address today is `" + String(current || "") + "`.\n" +
      // THE OLD NAMES, so a forget can be checked against something and a
      // vague "drop the old one" is answerable only when there is one.
      (old.length ? "Its old addresses, which still send people to it: " + old.join(", ") + ".\n" : "It has no old addresses.\n") +
      "\nWhat they asked for:\n" +
      String(message || "").slice(0, 2000) }],
  };
}

/** The name the model answered, or null. `null` and absent are both nothing. */
export function readRename(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const v = use && use.input && typeof use.input === "object" ? use.input.name : undefined;
  return typeof v === "string" ? cleanAlias(v) : null;
}

/** The old address the model said to forget, or null. Same reading rules as the name. */
export function readForget(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const v = use && use.input && typeof use.input === "object" ? use.input.forget : undefined;
  return typeof v === "string" ? cleanAlias(v) : null;
}
