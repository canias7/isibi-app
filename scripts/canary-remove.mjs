// ── TEST 5's ACCEPTANCE: A PAGE TAKEN OFF, JUDGED BY WHAT THE OPERATIONS DID ──
//
// Run 47 (2026-09-27) printed "UI MODE PASSED: 2 messages sent" and its job went
// green. Both messages got a reply, the composer came back each time and
// nothing was blocked — and the menu edit had answered `look/no-change`, the
// removal had been refused `kept`, and the site was byte for byte what it was.
// Two replies are not a removal (owner, 2026-09-28).
//
// So the page-removal scenario passes only on what its operations did, each read
// from its own record:
//   * the menu message's job stored a menu success whose menu has no link to
//     the page;
//   * the removal's job stored a success that removed exactly that page file;
//   * both published, in order, and the after-read saw the last version;
//   * the stored source lost that page file and nothing else — every other
//     page changed only inside its menu, which lost exactly that one link;
//   * no other page links to the old address any more;
//   * the old address sends a visitor to the home page (a 301 on the site's
//     own origin).
//
// Everything here is pure: the canary reads, this module decides.
import { navSlots } from "../builder/site-nav.mjs";

/** The menus a page's source carries, read by the menu rung's own reader. */
export function menusOf(src) {
  return navSlots([{ path: "x.tsx", source: String(src || "") }]).map((s) => s.items);
}

/** The source with every menu array's interior blanked: what a menu edit must not move. */
export function outsideMenus(src) {
  let out = String(src || "");
  for (const s of navSlots([{ path: "x.tsx", source: out }]).sort((a, b) => b.at - a.at)) {
    out = out.slice(0, s.at) + "<menu>" + out.slice(s.to);
  }
  return out;
}

const byPath = (list) => new Map((Array.isArray(list) ? list : []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source || "")]));

/**
 * The old address, read without following redirects. A 301 on the site's own
 * origin whose location is the home page is the one right answer: the platform
 * redirects every route the last publish had and this one has not.
 */
export function addressVerdict(res, origin) {
  if (!res || !Number.isInteger(res.status)) return { ok: false, why: "the old address was not read" };
  if (res.status !== 301) return { ok: false, why: `the old address answered ${res.status}, not a 301 to the home page` };
  // An EMPTY location resolves to the origin itself, which would read as the
  // home page — so a 301 that names nowhere is refused before it is resolved.
  const loc = typeof res.location === "string" ? res.location.trim() : "";
  let to = null;
  try { to = loc ? new URL(loc, origin) : null; } catch { to = null; }
  if (!to) return { ok: false, why: "the redirect names no location" };
  if (to.origin !== new URL(origin).origin || to.pathname !== "/") return { ok: false, why: `the redirect goes to ${to.href}, not ${origin}/` };
  return { ok: true, why: "" };
}

/**
 * THE VERDICT, one check per operation. `replies` are the two jobs' stored
 * replies in message order (the page's own reading under `x-gf-edit: final`);
 * `before` and `after` are the canary's source reads; `address` is the old
 * address read without following redirects.
 */
export function removalVerdict({ spec, replies, chain, before, after, address, origin }) {
  const checks = [];
  const add = (name, ok, why) => checks.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const [menu, removal] = Array.isArray(replies) ? replies : [];
  const href = spec.link.href;

  add(`message 1's job stored a menu success whose menu has no link to ${href}`,
    menu && menu.ok === true && menu.layer === "nav" && Array.isArray(menu.links) && !menu.links.some((l) => l && l.href === href),
    menu ? `ok ${menu.ok}, layer ${menu.layer || "-"}, ${menu.error ? "error " + menu.error : "links " + JSON.stringify(menu.links || null)}` : "no stored reply was read");
  add(`message 2's job stored a success that removed exactly ${spec.page}`,
    removal && removal.ok === true && Array.isArray(removal.removed) && removal.removed.length === 1 && removal.removed[0] === spec.page,
    removal ? `ok ${removal.ok}, ${removal.error ? "error " + removal.error : "removed " + JSON.stringify(removal.removed || null)}` : "message 2 was not sent, or no stored reply was read");
  add("both messages published, in order, and the after-read saw the last version",
    !!(chain && chain.verified === true && chain.links === 2),
    chain ? (chain.verified ? `${chain.links} publish(es), not 2` : chain.why) : "the chain was not read");

  const b = byPath(before && before.pages);
  const a = byPath(after && after.pages);
  const kept = [...b.keys()].filter((p) => p !== spec.page).sort();
  const complete = !!(before && before.complete === true && after && after.complete === true);
  add("both source reads are complete", complete, "a store read did not answer, so an absence proves nothing");
  add(`the stored source lost ${spec.page} and no other page`,
    complete && b.has(spec.page) && !a.has(spec.page) && JSON.stringify([...a.keys()].sort()) === JSON.stringify(kept),
    `before ${JSON.stringify([...b.keys()].sort())}, after ${JSON.stringify([...a.keys()].sort())}`);
  const partsSame = JSON.stringify(before && before.parts) === JSON.stringify(after && after.parts);
  add("the stored components are byte for byte what they were", complete && partsSame, "the component list or a body changed");

  const moved = [];
  for (const p of kept) {
    const was = b.get(p), now = a.get(p);
    if (now === undefined) { moved.push(`${p} is gone`); continue; }
    if (outsideMenus(now) !== outsideMenus(was)) moved.push(`${p} changed outside its menu`);
    const want = menusOf(was).map((items) => items.filter((it) => it.href !== href));
    if (JSON.stringify(menusOf(now)) !== JSON.stringify(want)) moved.push(`${p}'s menu is not its old menu less ${spec.link.label}`);
  }
  add(`every other page changed only in its menu, which lost exactly the ${spec.link.label} link`, complete && !moved.length, moved.join("; "));
  // THE PAGE'S OWN FILE names its own route, and is judged by the check above;
  // this one asks whether any OTHER page still sends a visitor there.
  const linking = [...a.entries()].filter(([p, s]) => p !== spec.page && s.includes(JSON.stringify(href))).map(([p]) => p);
  add(`no other page links to ${href} any more`, complete && !linking.length, `still named by ${linking.join(", ")}`);

  const addr = addressVerdict(address, origin);
  add(`${href} sends a visitor to the home page`, addr.ok, addr.why);
  return { ok: checks.every((c) => c.ok), checks };
}
