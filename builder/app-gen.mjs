// THE APP WRITER (2026-10-21, phase C of docs/plans/2026-10-21-expo-apps.md).
//
// A site's pages are written for TanStack Start with the site kit; an app's
// screens are written for Expo Router with the APP kit (`app-builder/expo/`).
// Everything before this — the chat, the router, the design step, the database —
// is the site's own process (owner, 2026-10-20: "everything the same as the
// site"). This module is the one place an app differs: what the model is told,
// the one tool it answers, and how the design's look becomes the app's
// `theme.json`.

import { readExpoRequest } from "../app-builder/expo-preview.mjs";

/** The tool the app writer answers: the app's files, and nothing else. */
export const WRITE_APP_TOOL = {
  name: "write_app",
  description: "Write the phone app's files: its tab layout, one file per tab screen, and any shared data or components.",
  input_schema: {
    type: "object",
    properties: {
      files: {
        type: "array",
        description: "Every file of the app. `app/(tabs)/_layout.tsx` and one screen per tab are required.",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "app/(tabs)/_layout.tsx, app/(tabs)/index.tsx, app/(tabs)/<tab>.tsx, app/<screen>.tsx, lib/<name>.ts or components/<name>.tsx" },
            source: { type: "string", description: "The whole file, TypeScript + React Native." },
          },
          required: ["path", "source"],
        },
      },
    },
    required: ["files"],
  },
};

/**
 * THE KIT, AS THE MODEL READS IT. Every export of `components/app/index.ts`
 * with its props, held to the kit by `test/app-gen.test.mjs` so a component
 * added to the kit and not named here (or named here and not in the kit) fails.
 */
export const APP_KIT_API = [
  ["AppTabs", "AppTabs({ tabs: { name: string; title: string; icon: TabIcon }[] }) — THE tab bar. app/(tabs)/_layout.tsx is exactly `export default function TabLayout() { return <AppTabs tabs={[…]} />; }`. name is the screen file in app/(tabs)/ ('index' is the first tab). 3 to 5 tabs. TabIcon is one of: home menu shop basket order book hours map info profile chat heart star search gallery."],
  ["Screen", "Screen({ children, bar?: ReactNode }) — every tab screen's body: the app's background, scrolling, padded, with gaps. `bar` is pinned above the tab bar (the screen's main action)."],
  ["Title", "Title({ children }) — the big title at the top of a screen."],
  ["Heading", "Heading({ children }) — a section heading inside a screen."],
  ["Body", "Body({ children, soft?: boolean }) — ordinary text; soft for the quieter line under a title."],
  ["Button", "Button({ label: string; onPress?: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean }) — full width; one primary per screen."],
  ["ListRow", "ListRow({ title: string; subtitle?: string; right?: string; image?: string | null; onPress?: () => void }) — a tappable row; image null shows the soft placeholder, undefined shows none."],
  ["Group", "Group({ children }) — rows that belong together in one rounded block."],
  ["GroupRow", "GroupRow({ label: string; value?: string; strong?: boolean; last?: boolean }) — a row inside a Group; last on the final one."],
  ["Chips", "Chips({ options: string[]; value: string; onChange: (v: string) => void }) — a filter or a small choice."],
  ["Card", "Card({ title: string; subtitle?: string; image?: string | null; width?: number }) — a picture card; put several in <ScrollView horizontal contentContainerClassName=\"gap-3\">."],
  ["Badge", "Badge({ label: string; tone?: 'plain' | 'good' })."],
  ["Thumb", "Thumb({ src?: string | null; size?: number; label?: string }) — a picture or the soft placeholder."],
  ["Stepper", "Stepper({ value: number; onChange: (n: number) => void; min?: number; max?: number }) — − n +."],
  ["Toggle", "Toggle({ label: string; value: boolean; onChange: (v: boolean) => void })."],
  ["BottomSheet", "BottomSheet({ open: boolean; onClose: () => void; children }) — slides up from the bottom; a basket, a confirmation."],
  ["OpenNow", "OpenNow({ hours: Opening[] }) — the open-now badge from the phone's clock."],
  ["HoursList", "HoursList({ hours: Opening[] }) — the week, today lit."],
  ["openState", "openState(hours: Opening[], now?: Date) => { open: boolean; words: string }."],
  ["theme", "theme — the app's colours as values, for a prop that takes a colour."],
];

/** What the app writer is told, after the design. */
export const APP_WRITER_RULES = `YOU ARE WRITING A REAL PHONE APP: Expo Router + React Native + NativeWind (Tailwind classes on React Native components). Not a website.

THE FILES
- app/(tabs)/_layout.tsx: exactly <AppTabs tabs={[...]} /> with 3 to 5 tabs, the home screen first (name "index").
- app/(tabs)/<name>.tsx: one screen per tab, each \`export default function\`, each wrapped in <Screen>.
- lib/data.ts: the business's content (products, prices, services, hours) as typed constants, used by the screens. Real, specific content from the brief — never lorem ipsum, never "Item 1".
- Optional: app/<name>.tsx for a screen that opens on top of the tabs (router.push("/<name>")), components/<name>.tsx for your own small pieces.
- Nothing else. Never write components/app/* (the kit), package.json, app.json or any config.

IMPORTS
- import { ... } from "@/components/app" — the kit, listed below. Use it for everything it covers.
- import { router } from "expo-router" for navigation; import { useState } from "react";
- React Native primitives from "react-native": View, Text, Pressable, ScrollView, Image, TextInput, FlatList.
- No other packages. No <div>, <span>, <a>, <img>, <button> — this is not the web. Text must always sit inside <Text>.

STYLING
- className with Tailwind classes, and ONLY these colours: bg-paper bg-card bg-primary bg-accent bg-good, text-ink text-soft text-primary text-on-primary text-good, border-line, border-primary. They come from the app's theme; never write a hex colour.
- rounded-app for the app's corner; gap-*, p-*, flex-row, items-center, justify-between, flex-1 for layout.
- Tap targets at least 44pt tall. One primary Button per screen. Prices like "£4.50".

APP, NOT WEBSITE
- No hero banners, no footers, no "visit our website", no navigation menu besides the tab bar.
- Lists of rows, cards in a sideways row, grouped settings-style blocks, chips to filter, steppers for quantities, a BottomSheet to review and confirm.
- A screen does one thing: Home (what matters today + the main action), a list (products, services, menu), the action (order, book), info (hours, where, contact).

TYPESCRIPT
- strict mode: type your state (useState<Record<string, number>>({})), no implicit any, no unused imports that do not exist.

THE KIT ("@/components/app")
`;

/** The whole instruction: the rules, then every kit export with its props. */
export function appWriterSystem() {
  return APP_WRITER_RULES + APP_KIT_API.map(([n, d]) => "- " + n + ": " + d.replace(/^\S+\(/, n + "(")).join("\n") + "\n\nType: Opening = { day: number (0 Sunday … 6 Saturday); open: \"HH:MM\"; close: \"HH:MM\" }.\n";
}

/** The writer's answer as files, or `{ error }` — checked by the same reader the app builder uses. */
export function appFilesFrom(answer) {
  const input = answer && typeof answer === "object" ? answer : null;
  const files = input && Array.isArray(input.files) ? input.files : null;
  if (!files) return { error: "the writer gave no files" };
  const r = readExpoRequest({ baseUrl: "/app-preview/check/" + "0".repeat(32), files });
  return r.error ? { error: r.error } : { files: r.files };
}

// ── THE LOOK, AS THE APP'S THEME ────────────────────────────────────────────
const HEX6 = /^#[0-9a-fA-F]{6}$/;
function toHex(c) {
  if (typeof c !== "string") return null;
  const s = c.trim();
  if (HEX6.test(s)) return s.toLowerCase();
  const short = s.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
  if (short) return ("#" + short[1] + short[1] + short[2] + short[2] + short[3] + short[3]).toLowerCase();
  const rgb = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);
  if (rgb) return "#" + [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("");
  return null;
}
function lum(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function mix(a, b, t) {
  const p = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, "0")).join("");
}

/** The app's theme defaults: the kit's own warm neutral. */
export const DEFAULT_APP_THEME = { paper: "#f6efe4", card: "#ffffff", ink: "#2b2118", soft: "#7a6a58", line: "#e6dacb", primary: "#8a4b1e", onPrimary: "#ffffff", accent: "#ebd9c1", good: "#2e8b3d", radius: 14 };

/**
 * THE DESIGN'S COLOURS AS THE APP'S `theme.json`. `palette` is whatever the
 * design step settled (`background`, `foreground`, `primary`, `card`, `muted…`,
 * `border`, `accent`, CSS-variable style names with or without `--`); anything it
 * cannot read keeps the default, so a theme is always whole and always valid.
 */
export function appThemeFrom(palette, radiusPx) {
  const p = palette && typeof palette === "object" ? palette : {};
  const pick = (...names) => { for (const n of names) { const v = toHex(p[n] ?? p["--" + n]); if (v) return v; } return null; };
  const t = { ...DEFAULT_APP_THEME };
  const paper = pick("background", "paper", "bg");
  const ink = pick("foreground", "ink", "text");
  const primary = pick("primary", "brand", "accent-strong");
  if (paper) t.paper = paper;
  if (ink) t.ink = ink;
  if (primary) t.primary = primary;
  // NOTHING READ, NOTHING DERIVED: the kit's own theme stands whole, rather than
  // colours mixed from defaults that no design chose.
  if (!paper && !ink && !primary) {
    if (Number.isFinite(radiusPx) && radiusPx >= 0) t.radius = Math.min(32, Math.round(radiusPx));
    return t;
  }
  t.card = pick("card", "surface", "popover") || (lum(t.paper) > 0.5 ? "#ffffff" : mix(t.paper, "#ffffff", 0.08));
  t.soft = pick("muted-foreground", "mutedForeground", "soft") || mix(t.ink, t.paper, 0.45);
  t.line = pick("border", "line", "input") || mix(t.ink, t.paper, 0.85);
  t.accent = pick("accent", "secondary", "muted") || mix(t.primary, t.paper, 0.78);
  t.onPrimary = pick("primary-foreground", "primaryForeground", "on-primary") || (lum(t.primary) > 0.45 ? "#111111" : "#ffffff");
  if (Number.isFinite(radiusPx) && radiusPx >= 0) t.radius = Math.min(32, Math.round(radiusPx));
  return t;
}
