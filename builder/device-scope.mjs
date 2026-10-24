// ── PER-DEVICE EDITS (owner, 2026-10-24) ────────────────────────────────────
//
// One site, never a phone copy: a change may be meant for some screen sizes
// only, and it is made inside the same page with responsive rules. The router
// decides which devices from the customer's words (the preview's device is a
// hint; the words win), the lanes are told, and the code checks the result: the
// page is measured at the three widths before and after, and a device that was
// not asked for must come out unchanged, or nothing is published.
//
// ONE BREAKPOINT MAP, aligned with what the kit already uses. The kit's
// Tailwind v4 config declares no breakpoints of its own, so its defaults stand:
// `md` is 768px and `lg` is 1024px. The preview's buttons show 412px (phone),
// 860px (tablet) and the full width (desktop); every one of them falls inside
// its own band below. The render widths are the render check's own phone and
// desktop (375 and 1280, `VIEWPORTS` in `site-render.mjs`) plus the preview's
// tablet width.

export const DEVICES = Object.freeze(["phone", "tablet", "desktop"]);

export const DEVICE_BANDS = Object.freeze({
  phone: Object.freeze({ min: 0, max: 767, width: 375, height: 812 }),
  tablet: Object.freeze({ min: 768, max: 1023, width: 860, height: 1024 }),
  desktop: Object.freeze({ min: 1024, max: Infinity, width: 1280, height: 900 }),
});

/** The device a viewport width falls in. */
export function deviceOfWidth(w) {
  const n = Number(w);
  if (!Number.isFinite(n) || n < 0) return "";
  return DEVICES.find((d) => n >= DEVICE_BANDS[d].min && n <= DEVICE_BANDS[d].max) || "";
}

/**
 * THE DEVICES A CHANGE IS FOR, as the router's answer gave them: a proper
 * subset in canonical order, or null for ALL THREE (the default). Anything
 * that is not a list of known names is null too, and marked: a scope that
 * cannot be read never narrows a change and never reads as one device.
 */
export function readDevices(raw, mark = () => {}) {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || !raw.length || raw.some((d) => typeof d !== "string" || !DEVICES.includes(d))) {
    mark("devices-unread");
    return null;
  }
  const out = DEVICES.filter((d) => raw.includes(d));
  return out.length === DEVICES.length ? null : out;
}

/** The preview's device, sent by the page as a hint; "" when it is not one of the three. */
export function readDeviceHint(raw) {
  return typeof raw === "string" && DEVICES.includes(raw) ? raw : "";
}

/** The router's field. */
export const DEVICES_FIELD = {
  type: "array",
  items: { type: "string", enum: [...DEVICES] },
  description:
    "Only for intent \"edit\" or \"addon\": the screen sizes the change is for, when their words limit it to some of " +
    "them — phone, tablet, desktop. Leave it out when the change is for every screen, which is the usual case. The " +
    "screen they are previewing on is a hint only; what they wrote decides. When it matters and their words do not " +
    "say, ask (intent \"clarify\").",
};

/** One line for the router's request: the preview's device, as a hint. "" when none was sent. */
export function deviceHintLine(hint) {
  const d = readDeviceHint(hint);
  return d ? "They are previewing the site on the " + d + " view." : "";
}

const RANGE = {
  phone: "below 768px (no prefix, undone from md: up; or @media (max-width: 767px))",
  tablet: "768px to 1023px (md: but not lg:; or @media (min-width: 768px) and (max-width: 1023px))",
  desktop: "1024px and wider (lg:; or @media (min-width: 1024px))",
};

/**
 * WHAT A LANE IS TOLD ABOUT A SCOPED CHANGE: the devices, their widths, and
 * that the others must stay exactly as they are. "" for an unscoped change, so
 * every ordinary edit's request is byte-for-byte what it was.
 */
export function deviceNote(devices) {
  const list = Array.isArray(devices) ? DEVICES.filter((d) => devices.includes(d)) : [];
  if (!list.length || list.length === DEVICES.length) return "";
  const others = DEVICES.filter((d) => !list.includes(d));
  return "THIS CHANGE IS FOR " + list.join(" and ").toUpperCase() + " ONLY. Make it inside the same page with " +
    "responsive rules: " + list.map((d) => d + " is " + RANGE[d]).join("; ") + ". It may differ there as much as " +
    "they asked (size, spacing, order, showing or hiding, layout). At " + others.join(" and ") + " width the page " +
    "must look exactly as it does now; that is checked.";
}

// ── THE MEASUREMENT ──────────────────────────────────────────────────────────
//
// WHY A LAYOUT FINGERPRINT AND NOT PIXELS. Two renders of the same page in two
// container runs differ in pixels for reasons that are not the change: font
// hinting, image decode, an animation caught mid-frame. A DOM dump is too
// strict the other way: a page writer that wraps a block in `hidden md:block`
// adds an element at every width while nothing a visitor sees moved. So the
// fingerprint is what a visitor sees, per width: every RENDERED element that
// shows something (its own text, a picture, a control, a background or a
// border), in document order, with its position and size from the layout
// (offset boxes, which ignore transforms, so an entrance animation is not a
// difference) and the styles that paint it. Wrappers that show nothing are
// left out, and so is the words' content: words are one site's, shared by
// every device, and a change in their length moves the boxes anyway.

export const MAX_LAYOUT_ITEMS = 3000;

/** Run inside the page (`page.evaluate(layoutProbe, cap)`): `{ n, digest }`. */
export function layoutProbe(cap) {
  const hash = (s, h = 2166136261) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const SHOWS = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "IFRAME", "INPUT", "TEXTAREA", "SELECT", "BUTTON", "PICTURE", "HR"]);
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META"]);
  const max = Number(cap) > 0 ? Number(cap) : 3000;
  let all = 2166136261, n = 0;
  const els = document.body ? document.body.querySelectorAll("*") : [];
  for (const el of els) {
    if (n >= max) break;
    const tag = String(el.tagName || "").toUpperCase();
    if (SKIP.has(tag)) continue;
    // The nearest laid-out box: an SVG's own children have none.
    let box = el;
    while (box && !(box instanceof HTMLElement)) box = box.parentElement;
    if (!box) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") continue;
    if (box.offsetParent === null && getComputedStyle(box).position !== "fixed" && box !== document.body) continue;
    const own = Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim());
    const painted = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
    const pictured = cs.backgroundImage && cs.backgroundImage !== "none";
    const bordered = ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs["border" + s + "Width"]) > 0 && cs["border" + s + "Style"] !== "none");
    if (!(own || SHOWS.has(tag) || painted || pictured || bordered)) continue;
    let x = 0, y = 0;
    for (let p = box; p; p = p.offsetParent) { x += p.offsetLeft; y += p.offsetTop; }
    const sig = [tag, x, y, box.offsetWidth, box.offsetHeight, cs.color, cs.backgroundColor, pictured ? "img" : "", cs.fontSize, cs.fontWeight, cs.fontFamily, cs.textAlign, bordered ? cs.borderTopColor : ""].join("|");
    all = hash("," + hash(sig).toString(36), all);
    n++;
  }
  return { n, digest: all.toString(36) };
}

/**
 * The fingerprints of one render, read back off the wire: a list of
 * `{ route, device, n, digest }`. Anything else is dropped; null when nothing
 * readable is left.
 */
export function readLayout(raw) {
  if (!Array.isArray(raw)) return null;
  const out = raw.filter((x) => x && typeof x === "object" && typeof x.route === "string" && DEVICES.includes(x.device) &&
    typeof x.digest === "string" && x.digest && Number.isInteger(x.n) && x.n >= 0)
    .map((x) => ({ route: x.route, device: x.device, n: x.n, digest: x.digest }));
  return out.length ? out : null;
}

/**
 * THE GUARD. `before` is the layout the site was published with, `after` this
 * publish's, `devices` what the change was for (null: all, nothing to check).
 *
 * For every route either render has, at every device NOT asked for, the two
 * fingerprints must be equal. A route or a device read on one side only is
 * UNKNOWN, never equal: cannot-tell never reads as unchanged.
 *
 * `{ ok, changed, unknown, touched }`: `changed` the devices not asked for that
 * moved, `unknown` those that could not be compared, `touched` the asked-for
 * devices that did change somewhere (the reply's fact).
 */
export function compareLayouts(before, after, devices) {
  const asked = Array.isArray(devices) ? DEVICES.filter((d) => devices.includes(d)) : [];
  if (!asked.length || asked.length === DEVICES.length) return { ok: true, changed: [], unknown: [], touched: [], checked: false };
  const b = readLayout(before) || [], a = readLayout(after) || [];
  const key = (x) => x.route + "\u0000" + x.device;
  const bm = new Map(b.map((x) => [key(x), x])), am = new Map(a.map((x) => [key(x), x]));
  const routes = [...new Set([...b, ...a].map((x) => x.route))];
  const changed = new Set(), unknown = new Set(), touched = new Set();
  if (!routes.length) for (const d of DEVICES) if (!asked.includes(d)) unknown.add(d);
  for (const r of routes) {
    for (const d of DEVICES) {
      const x = bm.get(r + "\u0000" + d), y = am.get(r + "\u0000" + d);
      const same = x && y ? x.digest === y.digest && x.n === y.n : null;
      if (asked.includes(d)) { if (same === false) touched.add(d); continue; }
      if (same === null) unknown.add(d);
      else if (same === false) changed.add(d);
    }
  }
  const order = (s) => DEVICES.filter((d) => s.has(d));
  return { ok: !changed.size && !unknown.size, changed: order(changed), unknown: order(unknown), touched: order(touched), checked: true };
}

/** The refusal a failed guard is published as: nothing written, the reason in facts. */
export function deviceRefusal(verdict, devices) {
  const asked = DEVICES.filter((d) => (devices || []).includes(d));
  const changed = verdict.changed || [], unknown = verdict.unknown || [];
  return {
    ok: false, error: "device-scope", ours: false,
    devices: { asked, changed, unknown },
    detail: changed.length
      ? "the change also altered the " + changed.join(" and ") + " view, which was not asked for"
      : "the " + unknown.join(" and ") + " view could not be compared with how it was",
  };
}

// ── PER-DEVICE WISHES IN A FIRST BUILD (2026-10-24, device-scope-build) ─────
//
// A description may scope part of the site to some screen sizes ("on phones
// show a short menu"). The DESIGNER reads that, never a keyword rule: its tool
// has an optional `devices` list of `{ devices, wish }`, left out when nothing
// was scoped (the usual case). The writers are then told each wish with the
// devices' widths; an unscoped build appends nothing, so every writer request
// is byte-for-byte what it was.

export const MAX_DEVICE_WISHES = 6;

/** The design tool's field. */
export const DEVICE_WISHES_FIELD = {
  type: "array",
  maxItems: MAX_DEVICE_WISHES,
  description:
    "Only when the customer's description limits part of the site to some screen sizes (phone, tablet, desktop): one " +
    "entry per such wish, with the screen sizes it is for and the wish in a short sentence of your own. Leave it out " +
    "when nothing is limited to a screen size, which is the usual case; a wish for every screen is not one of these.",
  items: {
    type: "object",
    properties: {
      devices: { type: "array", items: { type: "string", enum: [...DEVICES] } },
      wish: { type: "string" },
    },
    required: ["devices", "wish"],
  },
};

/**
 * The wishes, read off the designer's answer: `[{ devices, wish }]`, each a
 * proper subset in canonical order with a non-empty wish, or null when none
 * is readable. An entry for all three devices is not scoped and is dropped.
 */
export function readDeviceWishes(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const x of raw.slice(0, MAX_DEVICE_WISHES)) {
    if (!x || typeof x !== "object" || typeof x.wish !== "string" || !x.wish.trim()) continue;
    const devices = readDevices(x.devices);
    if (!devices) continue;
    out.push({ devices, wish: x.wish.trim().slice(0, 300) });
  }
  return out.length ? out : null;
}

/** What the writers are told: "" for none, so an unscoped build is unchanged. */
export function deviceWishesNote(wishes) {
  const list = readDeviceWishes(wishes);
  if (!list) return "";
  return "SCREEN-SIZE WISHES. One site for every screen: make each of these inside the same page with responsive " +
    "rules, and give every other screen size the page as the rest of the brief describes.\n" +
    list.map((w) => "- FOR " + w.devices.join(" and ").toUpperCase() + " ONLY (" +
      w.devices.map((d) => d + " is " + RANGE[d]).join("; ") + "): " + w.wish).join("\n");
}

/** The reply's fact: which device-specific wishes the build applied. "" for none. */
export function deviceWishesFact(wishes) {
  const list = readDeviceWishes(wishes);
  if (!list) return "";
  return "Screen-size wishes applied: " + list.map((w) => w.wish + " (" + w.devices.join(" and ") + " only)").join("; ") + ".";
}
