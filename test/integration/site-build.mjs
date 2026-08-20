// The site build-service, driven exactly as the Worker drives it.
//
// GENERATOR.md's definition of done is `tsc --noEmit` clean and `vite build`
// succeeding, and this is that assertion made repeatable: a page in the shape the
// generator is told to emit goes in, a publishable dist comes out. It also proves
// the typecheck is a real gate rather than a step that runs and is ignored — a
// page with a type error has to come back as a failure, not as a bundle.
//
// Runs builder/build-server.mjs against a sandbox copy of the template, the same
// way the container does. Needs the template's dependencies installed:
//
//   cd builder/lovable/template && npm ci
//   node test/integration/site-build.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePages } from "../../builder/page-gen.mjs";
// The REAL stub, not a copy of it. A hand-written imitation here would prove that
// some file compiles and say nothing about the one the salvage actually writes.
import { stubPage } from "../../builder/publish-pages.mjs";
import { oklchToRgb } from "../../builder/site-theme.mjs";
import { ALL_THEMES } from "../fixtures/themes.mjs";

// THE PAYLOADS BELOW USED TO NAME A THEME. The registry left the product on
// 2026-08-20 — the designer authors three anchor colours per site — so what the
// container takes is a palette. The 500 survive as fixtures and are still the
// right thing to drive this with: real hand-designed colours rather than three
// hex values invented here for the purpose.
//
// THE PALETTE ONLY, NEVER THE FIXTURE'S STYLE AXES, and that is the correction
// to the first draft. A theme row carries both, but in the product they are two
// separate authored things — the palette is `seeds` and the axes are the `style`
// patch. Spreading both meant a check that then set `style: { width: "wide" }`
// REPLACED the fixture's axes wholesale, so its two builds differed in more than
// the one axis under test and the comparison measured the wrong thing. A check
// that genuinely wants a world backdrop asks for it by name.
const asHex = ([L, C, H]) => {
  const [r, g, b] = oklchToRgb(L, C, H);
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};
// THE SITE'S OWN STYLE AXES, as an ordinary site would have authored them.
//
// Four checks below assert that an override REPLACES the site's own answer —
// its corner rules give way to a radius, its icon weight gives way to a heavier
// one, and an unusable patch leaves it standing. All four need the site to HAVE
// an answer, and the palette carries none: `style` is a separate authored thing
// in the product, so it has to be sent separately here too.
//
// These are `broadsheet`'s own, which is why they read as a real combination
// rather than three values picked to make a test pass.
const HOUSE_STYLE = { buttons: "sharp", inputs: "underline", icon: "fine", corner: "round" };

function themeAsSeeds(name) {
  const t = ALL_THEMES[name];
  if (!t) throw new Error("no fixture theme " + name);
  return { seeds: { name, paper: asHex(t.light.paper), ink: asHex(t.light.ink), accent: asHex(t.light.accent),
    dark: { paper: asHex(t.dark.paper), ink: asHex(t.dark.ink), accent: asHex(t.dark.accent) } } };
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");
const PORT = 8123;

let passed = 0, failed = 0;
const ok = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? "\n       -> " + String(extra).slice(0, 900) : ""}`); }
};

if (!fs.existsSync(path.join(TEMPLATE, "node_modules"))) {
  console.error("the template's dependencies are not installed — run `npm ci` in " + TEMPLATE);
  process.exit(1);
}

// ── the pages, in the shape the generator is told to emit ─────────────────────
// A different business from the reference page on purpose: this has to prove the
// template compiles what the RULES describe, not that one hand-written file still
// builds. Two routes, a display table listed, a collect table submitted to, all
// four list states, and the API's own error message on failure.
const INDEX = `import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export const Route = createFileRoute("/")({ component: Home });

type Drink = Row & { name: string; price: number | null; notes: string | null };

const enquiry = z.object({
  name: z.string().min(2, "Tell us your name"),
  email: z.string().email("We need an address to reply to"),
  message: z.string().min(4, "What would you like to ask?"),
});

type Enquiry = z.infer<typeof enquiry>;

function Home() {
  const drinks = useRows<Drink>("drinks", { order: "price", dir: "asc", limit: 20 });
  const create = useCreateRow("enquiries");

  const form = useForm<Enquiry>({
    resolver: zodResolver(enquiry),
    defaultValues: { name: "", email: "", message: "" },
  });

  const onSubmit = (values: Enquiry) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Thanks — we'll write back today.");
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Fold Coffee</h1>
      <p className="mt-2 text-muted-foreground">Slow coffee on the corner of Wick Lane.</p>
      <Link to="/menu" className="mt-4 inline-block text-sm underline">See the whole menu</Link>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Today</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {drinks.isPending && [0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          {drinks.isError && (
            <p className="text-sm text-destructive sm:col-span-2">Couldn't load the menu. Refresh and try again.</p>
          )}
          {drinks.data?.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">Nothing on today.</p>
          )}
          {drinks.data?.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-baseline justify-between text-base">
                  <span>{d.name}</span>
                  {d.price != null && <span className="tabular-nums">£{d.price}</span>}
                </CardTitle>
              </CardHeader>
              {d.notes && <CardContent className="text-sm text-muted-foreground">{d.notes}</CardContent>}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-medium">Ask us something</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Your name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="message" render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl><Textarea rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </main>
  );
}
`;

// DELIBERATELY AN INTERFACE, and that is the point of this page.
//
// `useRows` was `<T extends Row = Row>` until 2026-08-04, and `Row` intersects
// `Record<string, unknown>` — which an interface never satisfies, because only a
// type alias gets an implicit index signature. So this exact declaration, with
// every field present and an `id`, was TS2344 and the whole site published as
// the placeholder. Declaring an interface for a row is the most ordinary thing
// a TypeScript author does, so the fixture writes one; index.tsx keeps the
// alias form, and between them both spellings are held.
const MENU = `import { createFileRoute, Link } from "@tanstack/react-router";
import { useRows } from "@/lib/rows";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "The menu — Fold Coffee" },
      { property: "og:title", content: "The menu — Fold Coffee" },
      { name: "description", content: "Everything we pour, and what it costs." },
      { property: "og:description", content: "Everything we pour, and what it costs." },
    ],
  }),
  component: Menu,
});

interface Drink { id: number; name: string; price: number | null; notes: string | null }

function Menu() {
  const drinks = useRows<Drink>("drinks", { order: "name", dir: "asc" });
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/" className="text-sm underline">Back</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Menu</h1>
      <div className="mt-8 grid gap-4">
        {drinks.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        {drinks.isError && <p className="text-sm text-destructive">Couldn't load the menu.</p>}
        {drinks.data?.length === 0 && <Empty heading="Nothing listed yet" description="The menu goes up soon." />}
        {drinks.data?.map((d) => (
          <div key={d.id} className="flex items-baseline justify-between border-b border-border pb-2">
            <span>{d.name}</span>
            {d.price != null && <span className="tabular-nums text-muted-foreground">£{d.price}</span>}
          </div>
        ))}
      </div>
    </main>
  );
}
`;

// TANSTACK'S FLAT ROUTE FORM — a dot in the filename is a DIRECTORY SEPARATOR,
// so this file answers on `/about/team`.
//
// It is here because the mapping was read twice and the two readings diverged.
// The container computed its own file-to-URL rule and treated the dot as a
// literal character, so a page written this way was prerendered to `/about.team`
// — an address no route matches, meaning the real page got no snapshot and a
// junk file was written where nothing could reach it. Zero of the 318 family
// exemplars use the form, which is why it had never been seen rather than why it
// could not happen: it is the dominant shape in TanStack's own documentation, so
// it is what training data teaches.
//
// ONLY A REAL BUILD CAN PROVE THIS. `tsr generate` decides the actual route and
// `routeOf` decides what we prerender and publish in the manifest; a unit test
// can only check one of them against a fixture somebody wrote by hand, which is
// exactly how two readings agree with each other and with neither reality.
const TEAM = `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about/team")({ component: Team });

function Team() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">The people behind the counter</h1>
      <p className="mt-4 text-muted-foreground">Everyone here has pulled a shot before eight in the morning.</p>
    </main>
  );
}
`;

// The same page with one wrong type. tsc must refuse it; vite alone would not.
const BROKEN = INDEX.replace(
  'const drinks = useRows<Drink>("drinks", { order: "price", dir: "asc", limit: 20 });',
  'const drinks: number = useRows<Drink>("drinks", { order: "price", dir: "asc", limit: 20 });',
);

// ── a sandbox that looks like the container's /app ────────────────────────────
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "isibi-site-build-"));
// WORLD-READABLE, LIKE /app REALLY IS. `mkdtemp` gives 0700, and the image's
// /app is 0755 root-owned — so a sandbox left at 0700 is the one difference
// that makes the prerender's privilege drop untestable here: the dropped child
// cannot even READ the bundle, and the failure looks like the drop breaking the
// render rather than like a permission on a temp directory. A fixture LESS
// capable than the thing it stands in for hides bugs exactly as one that is
// more capable does.
fs.chmodSync(sandbox, 0o755);
let server = null;

/**
 * Which browser should the render check launch?
 *
 * `CHROMIUM_PATH` is what `render-check.mjs` reads, and in the image it is the
 * distro browser at /usr/bin/chromium. Everywhere else it has to be worked out,
 * and BOTH obvious answers are wrong — each was tried and measured:
 *
 *   Hardcode /opt/pw-browsers/chromium. That is this dev container's path and
 *   exists on no CI runner, so the launch aimed at a file that was not there:
 *   `site build` on main, 102 passed 6 failed, every one "Cannot find package"
 *   or a missing executable.
 *
 *   Leave it unset and let playwright-core resolve. It resolves BY EXACT
 *   REVISION, and the root playwright-core here (1.62.1) wants chromium 1234
 *   while this container has 1194 — measured: "Executable doesn't exist at
 *   .../chromium_headless_shell-1234/...". A resolver is only as good as the
 *   version agreement behind it.
 *
 * So: use an explicit path when one is given, fall back to the container's
 * revision-independent symlink ONLY IF IT IS REALLY THERE, and otherwise say
 * nothing and let playwright resolve — which is correct on a runner, where the
 * workflow pins playwright-core to the exact playwright that fetched the
 * browser. Checking the file exists is the whole difference between this and
 * the first version.
 */
function chromiumEnv() {
  if (process.env.CHROMIUM_PATH) return {};                       // already in process.env
  for (const p of ["/opt/pw-browsers/chromium", "/usr/bin/chromium"]) {
    if (fs.existsSync(p)) return { CHROMIUM_PATH: p };
  }
  return {};
}

const post = async (payload) => {
  const r = await fetch(`http://127.0.0.1:${PORT}/build`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  return r.json();
};

try {
  // Everything the image COPYs, minus what it reinstalls or regenerates.
  fs.cpSync(TEMPLATE, sandbox, {
    recursive: true,
    filter: (src) => !/(^|[\\/])(node_modules|dist)$/.test(src),
  });
  // node_modules is baked into the image layer; here it is borrowed by symlink so
  // the sandbox costs nothing to make.
  fs.symlinkSync(path.join(TEMPLATE, "node_modules"), path.join(sandbox, "node_modules"), "dir");
  // The two pristine copies the Dockerfile bakes. There were three: `.index-base.html`
  // went with the template's `index.html`, which TanStack Start does not build
  // from — the document is `__root.tsx`, rendered per request, so there is no
  // shell to keep a pristine copy of. Kept in step by `test/dockerfile.test.mjs`,
  // which asserts the image bakes exactly the bases the service restores from.
  fs.mkdirSync(path.join(sandbox, ".routes-base"), { recursive: true });
  fs.copyFileSync(path.join(sandbox, "src/routes/__root.tsx"), path.join(sandbox, ".routes-base/__root.tsx"));
  fs.copyFileSync(path.join(sandbox, "src/styles.css"), path.join(sandbox, ".styles-base.css"));
  fs.rmSync(path.join(sandbox, "src/routes/index.tsx"), { force: true });

  server = spawn("node", [path.join(ROOT, "builder", "build-server.mjs")], {
    env: { ...process.env, APP_DIR: sandbox, PORT: String(PORT), NODE_ENV: "production", ...chromiumEnv() },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write("  [build-service] " + d));

  // Wait for it to answer rather than sleeping a guessed interval.
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try { up = (await fetch(`http://127.0.0.1:${PORT}/health`)).ok; }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  ok("the build service answers /health", up);
  if (!up) throw new Error("build service never came up");

  console.log("\nbuilding a two-page site…");
  const t0 = Date.now();
  // `lang` rides on the main build rather than costing its own: it is a
  // property of the document every page's head is derived from, so the site
  // that is already being built is the honest place to read it back.
  const built = await post({ files: { "index.tsx": INDEX, "menu.tsx": MENU, "about.team.tsx": TEAM }, slug: "fold-coffee", title: "Fold Coffee", lang: "pt-BR", logo: "/u/fold-coffee/logo.png" });
  console.log(`  (${Math.round((Date.now() - t0) / 1000)}s)`);

  ok("the build succeeds", built.ok === true, built.stage + ": " + built.error);

  // THE SUB-STEP TIMINGS, from a real container rather than from a fake. The unit
  // guards prove the timings are declared, written and reported; only running the
  // thing proves the numbers are real. `tsc` grows with the whole kit whether or
  // not a page imports any of it, `vite` only pays for what is reachable — so
  // these two are the early warning that the kit has become expensive.
  console.log(`  routes ${built.routesMs}ms · tsc ${built.tscMs}ms · vite ${built.viteMs}ms · total ${built.ms}ms`);
  ok("the container reports its three sub-steps", [built.routesMs, built.tscMs, built.viteMs].every((n) => typeof n === "number" && n > 0),
    JSON.stringify({ routesMs: built.routesMs, tscMs: built.tscMs, viteMs: built.viteMs }));
  ok("and they add up to less than the total it reports", built.routesMs + built.tscMs + built.viteMs <= built.ms,
    `${built.routesMs}+${built.tscMs}+${built.viteMs} > ${built.ms}`);

  // ── EVERY ROUTE IS A REAL DOCUMENT ────────────────────────────────────────
  //
  // A published page used to be an empty `<div id="root">` plus a bundle. A link
  // preview fetches the HTML once and reads the head — it does not run the
  // bundle — so every page shared anywhere showed the home page's card, and a
  // crawler saw nothing without executing JavaScript.
  //
  // THE ASSERTION HAS TO BE ABOUT WORDS, not about a file existing or a string
  // being non-empty. React CATCHES a throw during a server render, silently
  // switches that subtree to client rendering, and returns 5.6 KB of markup with
  // no text in it and no exception anywhere — which is exactly what happened on
  // the first run here, on every route, because `siteSlug()` read `window`.
  // THERE IS NO PRERENDER STEP, and its assertions moved rather than vanished.
  //
  // This block checked that both routes were prerendered to real documents with
  // the page's own words in them — a check that had to be about WORDS, because
  // React catches a throw during a server render, silently switches that subtree
  // to client rendering, and returns 5.6 KB of markup with no text and no
  // exception anywhere. That happened here on the first run, on every route.
  //
  // Under Start the document is rendered per REQUEST from the script's own
  // bundle, so there is no build-time artefact to inspect — and the same
  // properties are asserted in the execution block below, against the bytes a
  // visitor really receives rather than a snapshot of them. The flat-route case
  // (`about.team.tsx` is `/about/team`) moved with them and is now proved by
  // ASKING THE ROUTER, which is a stronger form of the same agreement between
  // `tsr generate` and `routeOf`.
  ok("the build reports no prerender step, because there is none",
    built.prerendered === undefined && built.preMs === undefined,
    JSON.stringify({ prerendered: built.prerendered, preMs: built.preMs }) +
    " — an empty list would read as 'the prerender ran and produced nothing', which is the state that used to mean every page published blank");

  // ─────────────────────────────────────────── the site packaged as a Worker
  //
  // OFF BY DEFAULT, asserted first. Packaging is a second vite pass, and until
  // a dispatch namespace exists the script has nowhere to go — so a build that
  // did not ask for one must be byte-for-byte the build it was before. This is
  // the assertion that keeps landing it early honest.
  ok("a build that did not ask for a worker does not pay for one",
    built.worker == null && built.workerMs === undefined,
    JSON.stringify({ worker: built.worker, workerMs: built.workerMs }));

  // AND THEN THE REAL THING, through the real container. The whole point of
  // this file is that a bundler either produces a script or it does not, and
  // no amount of unit testing the packaging function can say which — the SSR
  // entry pulls in React, TanStack Router and every kit component a page
  // imports, and whether that survives one vite pass into a single file is a
  // fact about the bundler.
  const wpack = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU, "about.team.tsx": TEAM },
    slug: "fold-coffee", title: "Fold Coffee", worker: true,
  });
  const w = wpack.worker || {};
  ok("the site packages into a worker script", wpack.ok && w.ok === true, JSON.stringify({ ok: wpack.ok, why: w.why, stage: wpack.stage, error: String(wpack.error || "").slice(0, 300) }));
  if (w.ok) {
    // ONE FILE, AND NOTHING IMPORTED FROM OUTSIDE IT. The Workers runtime has
    // no loader, so any surviving import — relative OR bare — is a script that
    // cannot run.
    //
    // THE BARE HALF IS THE ONE THAT MATTERED. A first draft checked relative
    // imports only, and `vite build --ssr` externalises dependencies by
    // default, so the script came out importing React and TanStack from bare
    // specifiers and this assertion passed on a bundle that could never have
    // been uploaded. Caught by the SIZE check below, not by this one — a
    // number wrong by an order of magnitude is harder to satisfy by accident
    // than a pattern is.
    //
    // `node:` SPECIFIERS ARE THE EXCEPTION, AND THEY ARE NOT A HOLE. Start's
    // server imports `node:async_hooks` (its request-scoped storage) and
    // `node:stream` (the streaming SSR transform); workerd provides both behind
    // the `nodejs_compat` flag, which `site-dispatch.mjs` sets on every upload.
    // They are the runtime's own modules, not dependencies left unresolved —
    // and the distinction is exactly what this check is about, so it is drawn
    // here rather than by widening the assertion to "few enough imports".
    const specifiers = (w.code.match(/^\s*import[^;]*from\s*["']([^"']+)["']/gm) || [])
      .concat(w.code.match(/\brequire\(["'][^"']+["']\)/g) || [])
      .map((line) => (line.match(/["']([^"']+)["']/) || [])[1])
      .filter(Boolean);
    const unresolved = specifiers.filter((m) => !m.startsWith("node:"));
    ok("…as a single self-contained script, with nothing left to resolve",
      unresolved.length === 0, unresolved.slice(0, 4).join(" · "));
    // AND THE RUNTIME MODULES IT DOES KEEP ARE ONES THE FLAG COVERS. A `node:`
    // import outside that set would fail at STARTUP — workerd refuses an unknown
    // module before the first request — while the upload itself reports 200.
    const NODE_OK = ["node:async_hooks", "node:stream", "node:stream/web", "node:buffer", "node:util"];
    const strays = [...new Set(specifiers.filter((m) => m.startsWith("node:") && !NODE_OK.includes(m)))];
    ok("…and every node: module it keeps is one nodejs_compat provides",
      strays.length === 0, strays.join(" · ") + " — workerd refuses an unknown module at startup");
    // THE CONFIG IS REALLY BAKED IN. The slug decides which R2 prefix the
    // script serves assets from, so a bundle that dropped it is a site whose
    // every stylesheet 404s — and it would still "package successfully".
    ok("…carrying its own slug", w.code.includes("fold-coffee"), "the slug is the asset prefix; without it every asset 404s");
    ok("…and its own route list", w.code.includes("/about/team") && w.code.includes("/menu"),
      "routes decide 200-vs-404; a bundle without them cannot tell a real page from a typo");
    // THERE IS NO SHELL ANY MORE, and what replaced it needs its own check.
    //
    // This asserted the bundle carried `const SHELL = '<!doctype html>…'` — the
    // static document the render was spliced into. Under Start the document IS
    // the app: `__root.tsx` renders `<html>`, and the build emits no HTML file
    // at all. So the shell assertion has no subject.
    //
    // ITS PURPOSE SURVIVES AND IS WHAT IS ASSERTED INSTEAD. It existed to catch
    // the `[object Object]` class HERE, with a message naming it, rather than at
    // the execution block below where the symptom is an empty page: a bundle
    // that packages cleanly and serves fifteen literal characters as every
    // document. The equivalent under Start is that the bundle carries a real
    // renderer — the doctype it will emit, and Start's own handler.
    //
    // The predecessor of this check was VACUOUS for a year: it looked for
    // `<div id="root">`, which `entry.js` itself declared as the string it
    // searched the shell FOR, so it passed whatever the shell was. Anchored here
    // on things only a real render can need.
    ok("…and a renderer that emits a real document",
      /<!DOCTYPE html>/i.test(w.code),
      "the bundle emits no doctype — it cannot be producing a document");
    ok("…through Start's own request handler",
      /createStartHandler|startFetch/.test(w.code),
      "the bundle carries no Start handler — nothing would render");

    // THE CHECK THAT ACTUALLY CAUGHT THE EXTERNALS BUG. React, TanStack Router,
    // TanStack Query and every kit component a page imports cannot add up to a
    // small file — 17,647 bytes was the measured symptom of a bundle that
    // resolved none of them. The upper bound is the Workers script limit, so a
    // build that starts inlining something enormous is refused rather than
    // discovered at upload.
    ok("…and it is a plausible size for a bundled React app", w.bytes > 300_000 && w.bytes < 9_000_000,
      String(w.bytes) + " bytes — under 300k means the dependencies were externalised and it cannot run");
    // THE WORKER BUILD IS NOT PUBLISHED. `collectDist` ships everything under
    // `dist` wholesale, so an output directory inside it would put a copy of
    // every site's server code in the public bucket.
    ok("…and the worker build is not in the published files",
      !Object.keys(wpack.files || {}).some((n) => n.startsWith("dist-worker") || n.includes("site-worker-entry")),
      Object.keys(wpack.files || {}).filter((n) => /worker/i.test(n)).join(", "));

    // ── AND THEN IT IS RUN, which is the only check that could have caught the
    // one bug this whole block shipped with.
    //
    // Everything above is a fact about the FILE — its size, its imports, the
    // strings in it — and all of it passed on a bundle whose every response was
    // the literal fifteen characters `[object Object]`. Compiling is not
    // working: the same lesson as the 70 charts that typechecked and rendered
    // grey, and as `message-scroller`, which bundled and hard-crashed the page.
    //
    // NODE IS NOT WORKERD, so this is a ONE-WAY filter and is worth stating:
    // passing here does not prove the script runs on Cloudflare, and failing
    // here proves it does not. It costs about a second and needs no account.
    const bundleFile = path.join(sandbox, "bundle-under-test.mjs");
    fs.writeFileSync(bundleFile, w.code);
    let site = null;
    try { site = (await import("file://" + bundleFile)).default; }
    catch (e) { ok("the packaged script imports", false, String((e && e.message) || e)); }
    if (site) {
      ok("the packaged script imports and exports a fetch handler", typeof site.fetch === "function", typeof site.fetch);
      // A FAKE R2 HOLDING WHAT A PUBLISHED SITE HOLDS — and under Start that is
      // NOT a document per route. The build emits `dist/client` and
      // `dist/server` and no HTML at all: the document is rendered per request
      // from `__root.tsx`. So what the bucket holds is the assets, the meta
      // sidecar, and the liveness marker.
      //
      // THE FIXTURE HAD TO STOP BEING DOCUMENTS, and the property those
      // documents proved has not gone away — it moved. It used to be "this
      // route was served from its OWN file, not a baked copy of the home
      // page's", because `injectMeta` added the description and the Open Graph
      // tags at PUBLISH time and anything baked in the container was always the
      // version from before they existed. Now the head is composed per request
      // and the per-route content comes from the router, so what proves the same
      // thing is that two routes render DIFFERENT copy and the sidecar's
      // description reaches the head.
      // THE DESCRIPTION SHARES NO WORDS WITH ANY PAGE'S BODY, deliberately. It
      // rides in EVERY page's `og:description`, so a phrase used in both it and
      // the home page's copy makes the "this is not the home page" assertion
      // below unfalsifiable — which is exactly what a first draft did, using
      // "Wick Lane" for both.
      const META = {
        description: "A very short shop blurb", image: "https://x/og.png", origin: "https://fold-coffee.gofarther.app",
        // OWNERSHIP VERIFICATION, resolved to pairs by `site-verify.mjs` on the
        // platform side. This is the ONLY place the whole chain can be proved:
        // the module can be perfectly correct, the sidecar can carry it, and the
        // tag still never reaches a head — which is the shape this repo has
        // recorded a dozen times. A second pair, so "it emitted one" cannot pass
        // for "it emitted what it was given".
        verify: [
          { name: "google-site-verification", content: "GOOGLETOKEN0000000000000000000000000000000" },
          { name: "msvalidate.01", content: "BINGTOKEN123" },
        ],
      };
      const objs = {
        "sites/fold-coffee/assets/app.js": "console.log(1)",
        // THE LIVENESS MARKER. Its ABSENCE is the take-down — see the case
        // below, which is a regression this harness caught: under Start the
        // document renders from the bundle and needs no R2, so a site whose
        // files were wiped kept serving until the marker existed.
        "sites/fold-coffee/site.live": "1",
        "sitemeta/fold-coffee.json": JSON.stringify(META),
      };
      const rx = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const hasVerify = (h) => META.verify.every((v) =>
        new RegExp('name="' + rx(v.name) + '"[^>]*content="' + rx(v.content) + '"').test(h) ||
        new RegExp('content="' + rx(v.content) + '"[^>]*name="' + rx(v.name) + '"').test(h));
      const bucketOf = (o) => ({
        get: async (k) => (k in o
          ? { body: o[k], text: async () => o[k], writeHttpMetadata() {}, httpMetadata: {} } : null),
        head: async (k) => (k in o ? {} : null),
      });
      const bucket = bucketOf(objs);
      const call = (p, b = bucket) => site.fetch(new Request("https://fold-coffee.gofarther.app" + p), { SITES: b }, { waitUntil() {} });

      let home;
      try { home = await call("/"); } catch (e) { ok("the home page renders", false, String((e && e.stack) || e).slice(0, 600)); }
      if (home) {
        const html = await home.text();
        ok("the home page renders", home.status === 200 && /text\/html/.test(home.headers.get("content-type") || ""),
          home.status + " " + home.headers.get("content-type"));
        // A REAL DOCUMENT, which is what the shell assertion used to prove and
        // what the `[object Object]` bug produced fifteen characters instead of.
        ok("…as a complete document", /<!DOCTYPE html>/i.test(html) && /<\/html>/i.test(html),
          html.length + "-byte response: " + JSON.stringify(html.slice(0, 120)));
        // AND THE PAGE'S OWN WORDS, not just a frame. A SENTENCE ONLY THE PAGE
        // HAS: `Fold Coffee` is the brand, so it is in the `<title>` and would
        // pass with the render producing nothing at all — the same shape as the
        // vacuous shell assertion this block replaced.
        ok("…with the page's own markup in it", /Slow coffee on the corner/.test(html),
          html.length + " bytes and no page copy — the render produced nothing");
        // THE PUBLISH-TIME HALF OF THE HEAD, read out of the sidecar at request
        // time. `injectMeta` used to patch this into a built shell; there is no
        // shell, so a site that lost this loses its link preview silently.
        ok("…and the publish-time share tags from the sidecar",
          html.includes(META.description) && html.includes(META.image),
          "the sidecar never reached the head — every share of this site is a bare URL");
        // AND THE VERIFICATION TAGS. An owner who cannot prove the site is
        // theirs cannot be indexed, cannot see what they rank for, and cannot
        // run an ad against their own domain.
        ok("…and the ownership-verification tags", hasVerify(html),
          "a verification tag never reached the head — Search Console cannot prove this site");
      }

      // A ROUTE THE SITE HAS is a 200; one it does not is a 404. The status is
      // what stops a typo reading as a real address.
      const menu = await call("/menu");
      const menuHtml = await menu.text();
      ok("a declared route answers 200", menu.status === 200, String(menu.status));
      // ON EVERY PAGE, not only the home one. Search Console reads the tag off
      // whichever URL it was pointed at, so a site verified at its root and not
      // at /menu is one failed check away from being unverified.
      ok("…and it carries the verification tags too", hasVerify(menuHtml),
        "the verification is home-page only");
      // ITS OWN CONTENT, not the home page's. Serving one document for every
      // address is the bug the per-page work exists to prevent, and it is
      // invisible unless the fixture can tell two routes apart.
      // TWO SENTENCES ONLY THIS FIXTURE HAS, taken from the pages themselves
      // rather than invented. A first draft asserted copy ("Flat white") that
      // appears in NEITHER fixture, so it failed against a perfectly correct
      // render — the assertion was about a page I had not read.
      //
      // The menu page is a heading, a Back link and a data list; its rows come
      // from the API at runtime, so what it renders statically is "Back" and
      // "Menu". The home page's own sentence is the discriminator on the other
      // side: if `/menu` carried it, one document would be serving every
      // address, which is the failure this pair exists to catch.
      ok("…rendering its OWN page, not the home page's",
        /Menu<\/h1>/.test(menuHtml) && !/Slow coffee on the corner/.test(menuHtml),
        menuHtml.length + " bytes — " + (/Slow coffee on the corner/.test(menuHtml) ? "this is the home page" : "no menu heading"));

      // ── A SHARE OF THIS PAGE PREVIEWS AS THIS PAGE ────────────────────────
      //
      // The override mechanism EXISTED and nothing used it: 0 of 4 reference
      // pages and 0 of 324 exemplars declared a `head`, and PAGE_RULES never
      // mentioned it — so every address on every published site carried one
      // title, one description, and an og:url pointing at the root. A booking
      // page pasted into WhatsApp previewed as the home page.
      //
      // ONLY A REAL BUILD CAN SAY WHETHER A ROUTE'S head() BEATS THE ROOT'S.
      // Both are composed by the router at request time, so a unit test can
      // assert the rule is in the prompt and nothing more.
      ok("a page's OWN title reaches the head",
        /<title[^>]*>The menu — Fold Coffee<\/title>/.test(menuHtml),
        "the route's head() lost to the root's default — every page shares one title");
      ok("…and its own description, not the site's",
        menuHtml.includes("Everything we pour, and what it costs") && !menuHtml.includes(META.description),
        "the site description survived on a page that wrote its own — a share of /menu reads as the front page");
      // og:url IS COMPUTED, NOT WRITTEN BY THE PAGE. The root reads the matched
      // routes, so this is right for a page the model has never seen — and it
      // is what stops a crawler being told several addresses are one page.
      ok("…and og:url is THIS page's address",
        menuHtml.includes('property="og:url" content="' + META.origin + '/menu"'),
        "og:url is not the page's own address — every route claims to be the site root");
      if (home) {
        const homeHtml2 = await (await call("/")).text();
        ok("the home page keeps the site's own description, and the bare origin",
          homeHtml2.includes(META.description)
            && homeHtml2.includes('property="og:url" content="' + META.origin + '"'),
          "the home page is the ONE that must not override — its description was written for exactly this");
      }

      // THE FLAT FORM, AGAINST THE THING THAT DECIDES. `about.team.tsx` is
      // `/about/team`, and what makes this worth a real container is that
      // `tsr generate` is the authority on the route while `routeOf` is the
      // authority on what we publish — this is the only place the two are MADE
      // to agree rather than assumed to. It used to be checked against a
      // prerendered file; under Start it is checked by asking the router.
      const flat = await call("/about/team");
      ok("a route written in TanStack's flat form is served at its REAL address",
        flat.status === 200, String(flat.status) + " — the dot was read as a character, not a separator");
      const dotted = await call("/about.team");
      ok("…and nothing answers at the literal-dot address", dotted.status === 404, String(dotted.status));

      const nope = await call("/definitely-not-a-page");
      const nopeHtml = await nope.text();
      ok("an undeclared route answers 404, and still serves a page",
        nope.status === 404 && /<!DOCTYPE html>/i.test(nopeHtml), String(nope.status));
      // THE BRANDED NOT-FOUND, not TanStack's bare text. Without
      // `defaultNotFoundComponent` the visitor gets nine characters on a white
      // page — the render check literally measured it as `blank: only 9
      // characters` — with no site name and no way back.
      ok("…and it is the site's own not-found page, not nine bare characters",
        nopeHtml.length > 1000, nopeHtml.length + " bytes");

      // NOTHING PUBLISHED MEANS THE SITE IS GONE — the safety net for a script
      // removal that failed, which happened live twice. A delete wipes the files
      // and then drops the script; a rollback and the offline switch drop the
      // script and then change the files, so a script that outlives its own
      // deletion must not keep serving a site whose every trace has been erased.
      //
      // THIS CHECK CAUGHT A REAL REGRESSION, which is why it reads as it does.
      // The old entry served a DOCUMENT out of R2, so wiping the prefix made
      // every route 404 and that miss WAS the take-down — free, and lost the
      // moment Start started rendering from the script's own bundle. Measured
      // here as "200 — a deleted site is still serving", after unit tests and a
      // hand-driven execution check had both passed. `site.live` is the explicit
      // signal that replaced it.
      const gone = await call("/", bucketOf({}));
      ok("a site whose files are gone answers 404, whatever the script still is",
        gone.status === 404, String(gone.status) + " — a deleted site is still serving");

      // A THROW IS NOT A DELETION, and the difference decides whether an R2 blip
      // takes every published site on the platform down at once. Being wrong
      // toward "live" serves a page that should be gone for a few seconds.
      const blip = await call("/", {
        get: async () => { throw new Error("R2 unavailable"); },
        head: async () => { throw new Error("R2 unavailable"); },
      });
      ok("…but an R2 failure keeps the site up, degraded to no share preview",
        blip.status === 200, String(blip.status));

      // ASSETS COME OFF R2 rather than through the renderer — the cost decision
      // the entry makes, and the one that would silently stop being true.
      const asset = await call("/assets/app.js");
      ok("an asset is served from the bucket", asset.status === 200 && (await asset.text()) === "console.log(1)", String(asset.status));
      const missing = await call("/assets/gone.js");
      ok("…and a missing one is a 404, not a throw", missing.status === 404, String(missing.status));
    }
  }

  // REFUSED WITHOUT A SLUG rather than packaged with an empty one — a script
  // that cannot find its own assets renders a page and then looks broken,
  // which is worse than the static path it would have replaced.
  // THE FULL PAGE SET, not `index.tsx` alone. This file already records the
  // trap and I walked back into it: INDEX carries `<Link to="/menu">`, so
  // posting it by itself fails the TYPECHECK on a route that does not exist —
  // the build never reaches the worker step and the refusal being asserted
  // never happens. The assertion then reads as the refusal being broken.
  const noSlug = await post({ files: { "index.tsx": INDEX, "menu.tsx": MENU, "about.team.tsx": TEAM }, worker: true });
  ok("a worker is refused when there is no slug to serve assets from",
    noSlug.ok && noSlug.worker && noSlug.worker.ok === false && /slug/i.test(noSlug.worker.why || ""),
    JSON.stringify(noSlug.worker));

  // THE PRERENDER SANDBOX AND THE SNAPSHOT-WORDS CHECKS WERE HERE, and both
  // went with the step they were about.
  //
  // The sandbox one reported whether the render had dropped to an unprivileged
  // user, because "we thought this was sandboxed" is worse than knowing it is
  // not. The words one asserted each snapshot carried text a crawler can read —
  // a check that had to be about WORDS, because React catches a throw during a
  // server render, silently switches that subtree to client rendering, and
  // returns 5.6 KB of markup with no text and no exception anywhere.
  //
  // Under Start the document is rendered per REQUEST from the script's own
  // bundle: there is no child process to drop privileges for, and no snapshot to
  // read words out of. THE WORDS PROPERTY SURVIVED and is asserted in the
  // execution block above, against the bytes a visitor actually receives — which
  // is where it always belonged, since a snapshot could be wrong in a way the
  // live page was not.
  //
  // The privilege drop is a REAL LOSS and is worth naming rather than quietly
  // dropping: model-written page code now executes in the site's own Worker
  // isolate instead of a uid-dropped child. That is a different and stronger
  // sandbox — a Cloudflare isolate with no filesystem and no host — so the
  // protection did not go away, it moved somewhere the code cannot check.

  if (built.ok) {
    const names = Object.keys(built.files);
    // NO `index.html`, AND ITS ABSENCE IS THE ASSERTION. Start emits
    // `dist/client` and `dist/server` and no top-level document — measured on a
    // clean build — so a file here would mean `collectDist` is publishing the
    // wrong half, which puts every asset one directory too deep AND writes the
    // site's own server code into the PUBLIC bucket.
    ok("it produced no top-level document, because the document is rendered",
      !built.files["index.html"], "an index.html in the published files means the wrong dist half was collected");
    ok("it produced hashed js and css", names.some((n) => /^assets\/.*\.js$/.test(n)) && names.some((n) => /^assets\/.*\.css$/.test(n)), names.join(", "));
    // AND NOTHING FROM THE SERVER HALF. `dist/server/server.js` is the script
    // that renders the site; published, it would be a customer's server code in
    // a public bucket.
    ok("…and nothing from the server half", !names.some((n) => n.startsWith("server/") || n === "server.js"),
      names.filter((n) => /server/i.test(n)).join(", "));
    // THE BRAND REACHES THE TITLE, which used to be a fact about the shell's
    // `<title>` and is now a fact about the bundle: `writeSiteBrand` bakes
    // `SITE_NAME` and the root route renders it as the document's default title.
    // The RENDERED proof is in the execution block above; this is the build-time
    // half, and it is the one that fails if the container stops writing it.
    const brandJs = names.filter((n) => n.endsWith(".js")).map((n) => built.files[n].t || "").join("");
    ok("the brand reached the bundle as its title", brandJs.includes("Fold Coffee"),
      "SITE_NAME never reached the build — every page would be titled with the template's default");

    // ── the site's language, and its own mark ──────────────────────────────
    //
    // BOTH WERE HARDCODED IN THE TEMPLATE until 2026-08-12: every published
    // site declared `lang="en"` — so Chrome offered a Spanish shop's own
    // customers a translation of a page that was already Spanish — and every
    // one of them shipped the same generic favicon.
    //
    // ASSERTED ON THE PRERENDERED PAGES, not only on `index.html`. Each route
    // is rendered to its own file and every one of them carries a head; a check
    // that reads the shell alone passes while the pages a visitor actually
    // lands on say something else.
    // ASSERTED AS A PROPERTY, NOT A SPELLING. The first draft matched
    // `href="/icon.svg"` and went red on a correct build: the template sets vite
    // `base: "./"`, so every asset reference in the shell — the bundle and the
    // stylesheet included — is emitted relative. What matters is not how the
    // path is written but that it RESOLVES TO A FILE IN THE DIST; a head
    // pointing at a 404 is a broken icon, which is strictly worse than the
    // generic one it replaced.
    // THESE THREE RAN OVER NOTHING FOR THE WHOLE OF THE START MIGRATION. They
    // looped `Object.entries(built.files).filter(k.endsWith(".html"))`, and the
    // assertion forty lines above this one — "it produced no top-level document,
    // because the document is rendered" — says in as many words that the dist
    // contains no HTML at all. So three checks that read as covering the site's
    // language and its favicon iterated zero times and covered nothing, while
    // the harness's own count made them invisible: a loop that runs over an
    // empty collection contributes no checks to fail.
    //
    // MOVED TO WHERE THE DOCUMENT ACTUALLY EXISTS, which is a rendered response
    // out of the packaged worker — see the language-and-direction block further
    // down. What survives here is the build-time half, which is a real fact
    // about the dist and does not need a document to be asserted.
    ok("the build really does emit no HTML, which is why the head is asserted on a render",
      !Object.keys(built.files).some((k) => k.endsWith(".html")),
      Object.keys(built.files).filter((k) => k.endsWith(".html")).join(", "));
    const icon = (built.files["icon.svg"] || {}).t || "";
    ok("the mark is a self-contained svg", /<svg[\s\S]*<\/svg>$/.test(icon), icon.slice(0, 120));
    ok("the mark carries this site's initials", />FC</.test(icon), icon.slice(0, 200));

    // A LOGO ON A SITE WITH NO HEADER IS HARMLESS, and that is the only thing
    // this build can honestly say about one. These fixtures render no
    // `SiteChrome`, so nothing imports `site-brand.ts` and Vite tree-shakes it
    // out — the logo correctly does not reach the bundle at all. Two drafts of
    // an assertion here were wrong for that one reason: first demanding the
    // logo in the prerendered head, then demanding it in the JS. The proof that
    // it renders belongs on a page that has a header, and it lives in its own
    // build below. What matters here is that `logo` in the payload does not
    // disturb a site that never asked for one, which "the build succeeds"
    // above already covers.

    const js = names.filter((n) => n.endsWith(".js")).map((n) => built.files[n].t || "").join("");
    ok("the bundle talks to the tables the pages named", js.includes("drinks") && js.includes("enquiries"));

    // The router code-splits each route, so the entry NAMES the pages rather than
    // containing them. The production smoke test walks that link to prove a
    // published site reads its own database — assert the shape it relies on.
    // THE ROUTER CODE-SPLITS EACH ROUTE, so some chunk NAMES the others rather
    // than containing them. This used to find the entry by reading the shell's
    // `<script src>`; there is no shell, so it is asked of the published chunks
    // directly — which is the property the production smoke test walks anyway.
    const chunkNames = names.filter((n) => /^assets\/.*\.js$/.test(n));
    ok("some chunk names the lazy route chunks",
      chunkNames.some((n) => /["'][^"']*assets\/[A-Za-z0-9._-]+\.js["']/.test(built.files[n].t || "")),
      chunkNames.length + " js chunks and none references another — the routes are not code-split");
    ok("the bundle carries no route for the reference page's schema", !js.includes("duration_minutes"),
      "the template's own index.tsx leaked into a generated site");

    const bytes = names.reduce((n, k) => n + ((built.files[k].t || "").length || (built.files[k].b || "").length), 0);
    ok("the bundle is the expected order of magnitude", bytes > 100_000 && bytes < 4_000_000, bytes + " bytes");
  }

  console.log("\nbuilding a page with a type error…");
  const broken = await post({ files: { "index.tsx": BROKEN }, slug: "fold-coffee" });
  ok("a type error fails the build", broken.ok === false, JSON.stringify(broken).slice(0, 200));
  ok("and it is reported as a typecheck failure", broken.stage === "typecheck", broken.stage);
  ok("with the error a repair pass can act on", /is not assignable to type 'number'/.test(broken.error || ""), (broken.error || "").slice(0, 300));

  // tsconfig EXCLUDES src/components/charts, because it is a catalogue rather
  // than application code and typechecking all 70 on every build cost 3s a site.
  // (src/blocks was excluded for the same reason until it was deleted
  // 2026-07-31.) That is only acceptable while `exclude` keeps meaning "not in
  // the initial file list" rather than "never checked" — TypeScript still follows
  // an import into an excluded file.
  //
  // Asserted rather than trusted, because the failure is silent and expensive: if
  // exclusion ever became real, a generated page could import a broken chart, pass
  // the build, ship, and break in a visitor's browser — the exact compiles-then-
  // fails class the lint exists to prevent. A chart is broken in memory here; the
  // file on disk is never touched.
  console.log("\nimporting an EXCLUDED file that has a type error…");
  const chartRel = "src/components/charts/chart-bar-label.tsx";
  const chartAbs = path.join(sandbox, chartRel);
  ok("the excluded chart is really there to break", fs.existsSync(chartAbs), chartAbs);
  const chartWas = fs.readFileSync(chartAbs, "utf8");
  fs.writeFileSync(chartAbs, chartWas + '\nexport const _typeBomb: number = "not a number";\n');
  // BOTH routes, exactly like the successful build above. Posting index.tsx alone
  // leaves its <Link to="/menu"> pointing at a route that does not exist, which is
  // a second typecheck error — and with that present the "build failed" assertion
  // passes whether or not the chart was ever checked. Caught by mutation: making
  // the bomb type-correct still failed the build.
  const importsExcluded = await post({
    files: {
      "index.tsx": INDEX.replace(
        'export const Route = createFileRoute("/")({ component: Home });',
        'import { _typeBomb } from "@/components/charts/chart-bar-label";\nvoid _typeBomb;\nexport const Route = createFileRoute("/")({ component: Home });',
      ),
      "menu.tsx": MENU,
    },
    slug: "fold-coffee",
  });
  fs.writeFileSync(chartAbs, chartWas);
  ok("a type error inside an EXCLUDED but imported file still fails the build",
    importsExcluded.ok === false, JSON.stringify(importsExcluded).slice(0, 200));
  ok("and it is blamed on the excluded file, not the page",
    /chart-bar-label/.test(importsExcluded.error || ""), (importsExcluded.error || "").slice(0, 300));

  // ── the empty state, written the way the model actually writes it ───────────
  //
  // MEASURED, not imagined: on 2026-08-04 the page-gen eval scored 0/3, and all
  // eleven errors in the run were this one call. `DataList` takes
  // `empty={{title, description}}`, so carrying that shape onto the component
  // underneath is what a reasonable caller assumes — and shadcn's `Empty` was
  // compound-only, so every sample failed TS2322 and three sites in a row
  // published as the placeholder.
  //
  // Pinned here rather than left to the eval because the eval costs a real model
  // call and this costs nothing. BOTH forms are built: the props one is the
  // regression, and the compound one is what `DataList` itself still renders, so
  // a "fix" that traded one for the other would pass on half a test.
  console.log("\nbuilding the empty state both ways…");
  const EMPTY_PROPS = `import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@/components/ui/empty";
export const Route = createFileRoute("/")({ component: Home });
function Home() {
  return <Empty title="No teachers listed yet" description="Check back soon." />;
}
`;
  const EMPTY_COMPOUND = `import { createFileRoute } from "@tanstack/react-router";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
export const Route = createFileRoute("/")({ component: Home });
function Home() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No teachers listed yet</EmptyTitle>
        <EmptyDescription>Check back soon.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
`;
  const emptyProps = await post({ files: { "index.tsx": EMPTY_PROPS }, slug: "fold-coffee" });
  ok("<Empty title description /> compiles", emptyProps.ok === true,
    (emptyProps.stage || "") + ": " + String(emptyProps.error || "").slice(0, 300));
  // The title must reach the DOM as a heading. A div already has an HTML `title`,
  // so a version that merely ADDED `description` would compile here and render
  // the heading as a hover tooltip — passing this check while shipping nothing
  // the visitor can read. Asserted on the bundle for that reason.
  if (emptyProps.ok) {
    const js = Object.entries(emptyProps.files || {})
      .filter(([k]) => k.endsWith(".js")).map(([, v]) => v.t || "").join("");
    ok("and the title is rendered, not passed through as a div tooltip",
      js.includes("empty-title") && js.includes("No teachers listed yet"));
  }
  const emptyCompound = await post({ files: { "index.tsx": EMPTY_COMPOUND }, slug: "fold-coffee" });
  ok("the compound form DataList uses still compiles", emptyCompound.ok === true,
    (emptyCompound.stage || "") + ": " + String(emptyCompound.error || "").slice(0, 300));

  // The typeface, which until 2026-07-30 no generated site had at all: the
  // template declared neither --font-sans nor --font-heading, so every site
  // rendered in whatever the visitor's machine defaulted to.
  //
  // Asserted on the BUNDLE rather than on the response, because the response
  // saying "lora" and the CSS shipping Geist are indistinguishable from out here
  // — and that gap is exactly where a token nothing references hides.
  console.log("\nbuilding with a chosen typeface…");
  const withFont = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", fonts: { heading: "Playfair Display", body: "source sans 3" },
  });
  ok("a build with fonts succeeds", withFont.ok === true, JSON.stringify(withFont).slice(0, 200));
  ok("the response says which fonts were used",
    withFont.fonts && withFont.fonts.heading === "playfair-display" && withFont.fonts.body === "source-sans-3",
    JSON.stringify(withFont.fonts));
  {
    const css = Object.entries(withFont.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    ok("the bundled CSS sets --font-heading to the chosen face",
      /--font-heading:\s*"Playfair Display Variable"/.test(css), css.slice(0, 300));
    ok("and --font-sans to the chosen body face",
      /--font-sans:\s*"Source Sans 3 Variable"/.test(css), css.slice(0, 300));
    ok("the font FILES are actually in the bundle, not just named",
      Object.keys(withFont.files || {}).some((k) => /\.woff2?$/i.test(k)),
      Object.keys(withFont.files || {}).slice(0, 12).join(", "));
    // The whole reason fonts are written per build: importing all 24 statically
    // would ship every one of them to every site.
    const faces = Object.keys(withFont.files || {}).filter((k) => /\.woff2?$/i.test(k));
    // Two typefaces, but more than two files: a fontsource package ships one per
    // SUBSET (latin, latin-ext, cyrillic, vietnamese...) and the browser fetches
    // only what it needs. The number that matters is that it is nowhere near the
    // whole shortlist — importing all 24 statically would be hundreds.
    ok(`only the chosen faces are bundled (${faces.length} files, not all 24)`,
      faces.length > 0 && faces.length <= 40, faces.join(", "));
  }

  // A font nobody can supply must not fail the build — a site in the wrong
  // typeface is a far smaller problem than a site that did not publish.
  const badFont = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", fonts: { heading: "Helvetica", body: "Helvetica" },
  });
  ok("an impossible font falls back instead of failing the build", badFont.ok === true,
    JSON.stringify(badFont).slice(0, 200));
  ok("and it says so rather than silently substituting",
    !!(badFont.fonts && badFont.fonts.notes && badFont.fonts.notes.length),
    JSON.stringify(badFont.fonts));

  // ── ONE COLOUR, CHANGED ──────────────────────────────────────────────────
  //
  // Same class of check as the fonts above, and for the same reason: the
  // response saying a token was applied and the bundled CSS carrying it are two
  // different facts, and the gap between them is where a patch that is written
  // and then overwritten by the theme hides. Nothing but the BUNDLE can tell
  // them apart.
  console.log("\nbuilding with a colour override…");
  const withTokens = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    tokens: { background: "#ffcc00", foreground: "#0a0a0a" },
  });
  ok("a build with a colour override succeeds", withTokens.ok === true, JSON.stringify(withTokens).slice(0, 200));
  ok("the response says the override was applied",
    !!(withTokens.tokens && withTokens.tokens.applied), JSON.stringify(withTokens.tokens));
  {
    const css = Object.entries(withTokens.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // LIGHTNINGCSS MINIFIES THE COLOUR — `#ffcc00` ships as `#fc0`, and the
    // first draft of this assertion looked for the value it sent and reported
    // a working feature as broken. What is checked is the token and a value
    // that means the same colour, in either spelling.
    const HEX = "(?:#ffcc00|#fc0)";
    ok("the bundled CSS carries the chosen background",
      new RegExp("--background:\\s*" + HEX).test(css), css.slice(0, 200));
    // THE WHOLE MECHANISM IS THE ORDER. These are the same custom properties
    // the theme declares, so a patch written BEFORE the theme is silently
    // overwritten and the feature does nothing, with no error anywhere. Vite
    // minifies but preserves declaration order, so last-wins is checkable.
    const ours = [...css.matchAll(new RegExp("--background:\\s*" + HEX, "g"))].map((m) => m.index);
    const all = [...css.matchAll(/--background:\s*/g)].map((m) => m.index);
    ok("and it is the LAST --background in the stylesheet, so it wins",
      ours.length > 0 && all.every((i) => i <= Math.max(...ours)),
      `ours@${ours.join(",")} all@${all.join(",")}`);
    ok("the theme still applied alongside it", all.length > ours.length,
      `${all.length} --background declarations, ${ours.length} of them ours`);
  }

  // ── CORNERS ──────────────────────────────────────────────────────────────
  //
  // The one non-colour token, and the only place its behaviour is real: the
  // kit's seven sizes are DERIVED from `--radius` with `calc()`, so whether the
  // knob actually moves anything is a fact about the compiled bundle and not
  // about the module.
  console.log("\nbuilding with rounder corners…");
  const cornersKept = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"), style: HOUSE_STYLE, tokens: { background: "#ffcc00" },
  });
  const baseCss = Object.entries(cornersKept.files || {})
    .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
  const rounder = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"), style: HOUSE_STYLE, tokens: { radius: "1.5rem" },
  });
  ok("a build with a corner override succeeds", rounder.ok === true, JSON.stringify(rounder).slice(0, 200));
  {
    const css = Object.entries(rounder.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    ok("the bundled CSS carries the chosen radius", /--radius:\s*1\.5rem/.test(css), css.slice(0, 200));
    // THIS CHECK ASSERTED A PROPERTY THAT NO LONGER EXISTS, and correcting it is
    // more interesting than the check.
    //
    // `stripThemeRadius` was written because 280 of the 500 REGISTRY themes
    // hard-set `border-radius` on buttons and inputs as real rules, so a corner
    // change moved the cards and left every button square. The registry went on
    // 2026-08-20: a seeds-only theme emits ZERO border-radius rules (measured),
    // and the only remaining source is the customer's own `style` patch — which
    // `explicitRadiusCss` re-emits by design, because an explicit corner opinion
    // beats an implicit one. `RADIUS_AXES` is exactly `["buttons","inputs"]`,
    // which is exactly what gets re-emitted, so the strip is now a WASH in every
    // reachable case.
    //
    // So the honest assertion is the one below it: the radius reaches the
    // bundle, and the customer's own corner axis SURVIVES the strip. The count
    // comparison is kept as a measurement rather than a pass/fail, because a
    // future change that gives a site implicit corner rules again would make it
    // meaningful — and a silent 33-vs-33 is what told us it had stopped being.
    const count = (t) => (t.match(/border-radius\s*:/g) || []).length;
    console.log(`     (corner rules: ${count(css)} with a radius, ${count(baseCss)} without — ` +
      `equal is EXPECTED since the registry went; see the note above)`);
    ok("the customer's own corner axis survives the strip",
      /border-radius/.test(css),
      `the strip ate the customer's own buttons/inputs rules — ${count(css)} left`);
    ok("…while the framework's own reset survives", count(css) > 0, "every corner rule vanished, which is too many");
  }

  // The other half, and the one that protects every site already published:
  // with no radius asked for, the theme keeps its corners exactly as today.
  ok("a colour-only change leaves the theme's corners alone",
    /border-radius/.test(baseCss), "the theme's corner rules vanished on a build that never asked");

  // ── THE REST OF THE LOOK ─────────────────────────────────────────────────
  //
  // The twelve axes that are not colours, and the reason they cannot be a token
  // patch: three of them emit ordinary CSS RULES rather than custom properties,
  // and a rule cannot be overridden by writing `:root { --x: y }` after it. The
  // patch merges into the THEME OBJECT instead, so the emitters generate it —
  // which is a fact about the compiled bundle, not about the module.
  //
  // Everything here is measured against `broadsheet`, whose own answers are
  // buttons:sharp icon:fine density:tight. The patch names the opposites, so
  // nothing below can pass on a build where the patch did nothing.
  console.log("\nbuilding with a style patch…");
  const styled = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    style: { ...HOUSE_STYLE, buttons: "pill", icon: "heavy", density: "airy" },
  });
  ok("a build with a style patch succeeds", styled.ok === true, JSON.stringify(styled).slice(0, 200));
  {
    const css = Object.entries(styled.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // THE RULE AXIS IS THE ONE THAT MATTERS. `.lucide { stroke-width }` is not a
    // custom property, so its presence here is the whole argument for merging
    // into the theme rather than patching after it.
    ok("the bundled CSS carries a RULE the patch asked for",
      /stroke-width\s*:\s*2\.5/.test(css), css.slice(0, 200));
    ok("…and the theme's own answer for it is gone",
      !/stroke-width\s*:\s*1\.25/.test(css) && /stroke-width\s*:\s*1\.25/.test(baseCss),
      "the theme's own icon weight survived the override, or the control build never had it");
    // And a custom-property axis, minified either way by lightningcss — the
    // `#ffcc00` → `#fc0` trap one section up, in its leading-zero form.
    ok("…and a custom PROPERTY the patch asked for",
      /--spacing:\s*0?\.29rem/.test(css), css.slice(0, 200));
  }

  // A WHOLE AUTHORED LOOK, which is what a FIRST BUILD may now send. The cap
  // that bounds a revise at six is not applied there (see `MAX_STYLE_BUILD`),
  // so the widest patch the container can receive went from seven axes to
  // eighteen — and nothing had ever driven one that wide through a real
  // compile. Every axis is set to an option `broadsheet` does not already
  // carry, so a build where the patch did nothing cannot pass.
  console.log("\nbuilding with an eighteen-axis authored look…");
  const AUTHORED = {
    corner: "bevel", scale: "grand", tracking: "open", leading: "open", weight: "uniform",
    density: "airy", width: "wide", border: "bold", icon: "heavy", shadow: "offset",
    buttons: "pill", inputs: "filled", display: "accent", surface: "glass",
    backdrop: "glow", decor: "marble", ambient: "lively", skin: "tilt",
  };
  const authored = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"), style: AUTHORED,
  });
  ok("a build carrying every style axis at once succeeds", authored.ok === true,
    JSON.stringify(authored).slice(0, 200));
  {
    const css = Object.entries(authored.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // ONE ASSERTION PER LAYER, because they fail differently and a single check
    // on the stylesheet's LENGTH would pass with any of them silently dropped:
    // a custom property, an ordinary rule, the corner shape, and the world
    // layer. The world one is measured against `cornersKept`, which names four
    // axes and no world axis — so it is a real control for THIS marker rather
    // than a length comparison against a build that has a patch of its own.
    ok("…and a custom-property axis reached the stylesheet",
      /--spacing:\s*0?\.29rem/.test(css), css.slice(0, 200));
    ok("…and a rule axis did too", /stroke-width\s*:\s*2\.5/.test(css), css.slice(0, 200));
    ok("…and the corner shape", /corner-shape\s*:\s*bevel/.test(css), css.slice(0, 200));
    ok("…and the world layer, which only the widest patches can reach",
      /isibi-ambient/.test(css) && !/isibi-ambient/.test(baseCss),
      "either the ambient axis never reached the stylesheet, or the control build already had it");
  }

  // THE ONE PLACE TWO PATCHES COLLIDE, and it was a live bug before this: the
  // radius strip is a regex and cannot tell a theme's hard-set button radius
  // from the one the customer just asked for, so "rounder corners AND pill
  // buttons" got the first and silently lost the second.
  //
  // MEASURED AGAINST THE RADIUS-ONLY BUILD ABOVE rather than against a pattern.
  // `9999px` can legitimately come from Tailwind's own `rounded-full` if a page
  // happens to use it, which would make a bare match vacuous; the same build
  // with and without the axis is coupled to nothing in the fixtures.
  console.log("\nbuilding with a radius AND a corner axis…");
  const collide = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    tokens: { radius: "1.5rem" }, style: { ...HOUSE_STYLE, buttons: "pill" },
  });
  ok("a build asking for both succeeds", collide.ok === true, JSON.stringify(collide).slice(0, 200));
  {
    const css = Object.entries(collide.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    const rounderCss = Object.entries(rounder.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    const pills = (t) => (t.match(/9999px/g) || []).length;
    ok("the radius still applied", /--radius:\s*1\.5rem/.test(css), css.slice(0, 200));
    ok("AND the customer's own pill survived the strip",
      pills(css) > pills(rounderCss),
      `${pills(css)} with the axis, ${pills(rounderCss)} without — the strip ate it`);
  }

  // A patch that cannot be used must not fail a build that otherwise worked —
  // and must not reach the stylesheet, which is the same discipline the colour
  // parser follows for the same reason: this goes into CSS.
  const badStyle = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    // THE JUNK AND THE GOOD VALUE ARE DIFFERENT AXES, deliberately. The first
    // draft put `icon: ["heavy"]` over the house's own `icon: "fine"`, so there
    // was nothing left to survive and the check failed against a container doing
    // exactly the right thing. In the old world the theme ROW carried the icon
    // weight and the patch carried the junk — two separate places; there is no
    // theme row now, so the property that remains is that `parseStyle` drops the
    // bad axes of a patch and keeps its good ones.
    style: { ...HOUSE_STYLE, buttons: "0; } body { display: none", nope: "pill", scale: ["huge"] },
  });
  ok("an unusable style patch falls back instead of failing the build", badStyle.ok === true,
    JSON.stringify(badStyle).slice(0, 200));
  {
    const css = Object.entries(badStyle.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    ok("and nothing it contained reaches the stylesheet",
      !/body\s*\{[^}]*display\s*:\s*none/.test(css) && /stroke-width\s*:\s*1\.25/.test(css),
      "either the injection landed or a good axis in the same patch was thrown away with the junk");
  }

  // A patch that cannot be used must not fail a build that otherwise worked.
  const badToken = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", tokens: { background: "#fc0; } body { display: none", radius: "very round" },
  });
  ok("an unusable colour falls back instead of failing the build", badToken.ok === true,
    JSON.stringify(badToken).slice(0, 200));
  {
    const css = Object.entries(badToken.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // Named exactly. `!/2rem/` over a slice of a 200KB Tailwind bundle was a
    // check on whatever happened to be in the first 4,000 characters, which is
    // an assertion about Tailwind's output order and not about this feature.
    ok("and nothing it contained reaches the stylesheet",
      !/body\s*\{[^}]*display\s*:\s*none/.test(css) && !/--radius:\s*very/.test(css) &&
      !/site tokens/.test(css),
      css.slice(0, 200));
  }

  console.log("\nrejecting what must never be written…");
  const root = await post({ files: { "__root.tsx": "export const x = 1;" } });
  ok("the root layout cannot be overwritten", root.ok === false && /no valid route files/.test(root.error || ""), JSON.stringify(root).slice(0, 200));
  const esc = await post({ files: { "../../../etc/passwd.tsx": "export const x = 1;" } });
  ok("a path escaping src/routes is refused", esc.ok === false, JSON.stringify(esc).slice(0, 200));
  ok("nothing was written outside the sandbox", !fs.existsSync("/etc/passwd.tsx"));

  console.log("\nrebuilding to prove the routes are reset…");
  const solo = await post({ files: { "index.tsx": MENU.replace('createFileRoute("/menu")', 'createFileRoute("/")').replace("function Menu", "function Home").replace("component: Menu", "component: Home") }, slug: "fold-coffee" });
  ok("a rebuild with fewer pages succeeds", solo.ok === true, solo.stage + ": " + solo.error);
  ok("the previous build's extra route is gone", !fs.existsSync(path.join(sandbox, "src/routes/menu.tsx")));

  // ── two builds at once ──────────────────────────────────────────────────────
  //
  // The reset above proves builds do not leak SEQUENTIALLY, and says nothing at
  // all about two arriving together — which is the case that actually happens.
  // `getContainer(env.SITE_BUILD_CONTAINER)` takes no id, so every build on the
  // platform lands in ONE container, and the build handler wipes a shared
  // src/routes before writing. Interleaved, one build deletes the other's pages
  // and then publishes its own dist to the other's slug.
  //
  // Observed live 2026-07-29: the auth audit built a yoga studio and its
  // published site served the barber shop that the build smoke test was
  // compiling in the same second.
  console.log("\nbuilding two sites at once…");
  const page = (brand) => `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ component: Home });
function Home() { return <main><h1>${brand}</h1></main>; }`;
  const [a, b] = await Promise.all([
    post({ files: { "index.tsx": page("AURORA YOGA") }, slug: "conc-yoga", title: "Aurora Yoga" }),
    post({ files: { "index.tsx": page("FADE AND CO") }, slug: "conc-barber", title: "Fade and Co" }),
  ]);
  ok("both concurrent builds succeed", a.ok === true && b.ok === true,
    `a=${a.stage || "ok"}:${a.error || ""} b=${b.stage || "ok"}:${b.error || ""}`);
  if (a.ok && b.ok) {
    // collectDist returns {t: "<text>"} or {b: "<base64>"}, not raw strings —
    // joining the objects gives "[object Object]" and finds nothing, which reads
    // exactly like a corrupted build. It cost a round to notice.
    const js = (r) => Object.entries(r.files || {})
      .filter(([k]) => k.endsWith(".js"))
      .map(([, v]) => (v && typeof v === "object" ? v.t || "" : String(v)))
      .join("");
    const A = js(a), B = js(b);
    // Each build must get ITS OWN brand and, more importantly, must not carry
    // the other's. Publishing one customer's copy on another customer's domain
    // is the failure this is here to stop.
    ok("the first build carries its own content", A.includes("AURORA YOGA"), "missing its own brand");
    ok("the second build carries its own content", B.includes("FADE AND CO"), "missing its own brand");
    ok("neither build carries the OTHER site's content",
      !A.includes("FADE AND CO") && !B.includes("AURORA YOGA"),
      "one build was published with the other's pages — a cross-tenant content leak");

    // THE NEGATIVE, AND IT IS FREE HERE. Neither of these sends a `lang`, which
    // is the state of every site built before 2026-08-12: the attribute must be
    // LEFT ALONE rather than guessed at, or one deploy silently relabels every
    // existing site on the platform.
    // THE LANGUAGE IS IN THE BUNDLE NOW, not in a shell. `applyIdentity` used to
    // patch `<html lang>` with a regex; under Start `writeSiteBrand` bakes
    // `SITE_LANG` and `__root.tsx` renders it as a prop, so the negative is
    // asserted where the value now lives.
    // ASKED OF THE CONTAINER, NOT GREPPED OUT OF MINIFIED JS. A first draft
    // matched `"en"` and required `"es"|"fr"|"de"` to be absent — which is
    // meaningless against a minified bundle, where two-letter strings appear
    // everywhere, and it duly failed a correct build. `writeSiteBrand` returns
    // the value it wrote and the response carries it, so the honest question has
    // a direct answer.
    ok("a build that names no language keeps the one the template had",
      (a.brand || {}).lang === "en" && (b.brand || {}).lang === "en",
      JSON.stringify({ a: (a.brand || {}).lang, b: (b.brand || {}).lang }));
    // …and each still gets its OWN mark. The container is shared and long-lived,
    // so a mark written once and not cleared is one customer's icon on another's
    // tab — the same leak the content check above is here for, one file over.
    const mark = (r) => ((r.files || {})["icon.svg"] || {}).t || "";
    ok("each concurrent build gets its own mark", />AY</.test(mark(a)) && />FC</.test(mark(b)),
      `a=${(mark(a).match(/>([^<]*)<\/text>/) || [])[1]} b=${(mark(b).match(/>([^<]*)<\/text>/) || [])[1]}`);

    // NEITHER OF THESE SENT A LOGO, so neither may carry the one the build
    // before them did. The container writes `site-brand.ts` on every build for
    // exactly this reason — it is a long-lived process serving every site on
    // the platform, and a file left behind is one customer's logo on another's
    // header. Same leak the content check above is here for, one file over.
    ok("a build that sends no logo carries none",
      !A.includes("logo.png") && !B.includes("logo.png"),
      "the previous build's logo is still on disk and reached a site that never asked for one");
  }

  // ── the logo in a real header, server-rendered ───────────────────────────
  //
  // ITS OWN BUILD, on a page that uses `SiteChrome` — the fixtures above render
  // no header at all, so asserting on them passed for the wrong reason and then
  // failed for the right one.
  //
  // WHAT THIS PROVES THAT NOTHING ELSE CAN: the logo is present in the
  // PRERENDERED HTML. It is baked into the bundle by a generated module rather
  // than injected into the head, precisely so the server render has it — read
  // from an injected `<meta>` it would be absent in the snapshot and present
  // after hydration, which is a mismatch and a header that visibly flips from
  // the name to the logo on every page load.
  console.log("\nbuilding a site with a logo…");
  const CHROMED = `import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
export const Route = createFileRoute("/")({ component: Home });
function Home() {
  return (
    <SiteChrome name="Sharp Fade Barbers" links={[{ label: "Book", href: "/book" }]}>
      <main><h1>Walk-ins welcome</h1></main>
    </SiteChrome>
  );
}`;
  // ASKED FOR THE WORKER, because the proof has to be a RENDER. This block read
  // the prerendered `index.html` and there is none: the header is rendered per
  // request from the script's own bundle. Executing it is a stronger form of the
  // same assertion — "SERVER-RENDERED into the header" is what it always claimed
  // and now what it actually checks.
  const withLogo = await post({ files: { "index.tsx": CHROMED }, slug: "logo-site", title: "Sharp Fade Barbers", logo: "/u/logo-site/mark.png", worker: true });
  ok("a site using the site frame builds with a logo", withLogo.ok === true, withLogo.stage + ": " + withLogo.error);

  // A fake R2 carrying only what a document render needs: the liveness marker.
  // Without it the entry answers 404 for every route — which is the take-down
  // working, and would read here as the logo having vanished.
  const liveBucket = (slug) => ({
    get: async () => null,
    head: async (k) => (k === "sites/" + slug + "/site.live" ? {} : null),
  });
  // A dead bucket: nothing published, so the entry's take-down probe answers
  // 404. That is the state a FIRST build's script is uploaded into, and the
  // stamp has to survive it — see the assertion below.
  const deadBucket = () => ({ get: async () => null, head: async () => null });
  const serveOnce = async (build, slug, bucket) => {
    if (!build.ok || !build.worker || !build.worker.ok) return null;
    const f = path.join(sandbox, "logo-bundle-" + slug + "-" + Math.random().toString(36).slice(2) + ".mjs");
    fs.writeFileSync(f, build.worker.code);
    try {
      const app = (await import("file://" + f)).default;
      return await app.fetch(new Request("https://x.gofarther.app/"), { SITES: (bucket || liveBucket)(slug) }, { waitUntil() {} });
    } catch (e) { return new Response("IMPORT FAILED: " + String((e && e.message) || e), { status: 500 }); }
  };
  const renderHome = async (build, slug) => {
    const r = await serveOnce(build, slug);
    return r ? await r.text() : null;
  };

  const h = await renderHome(withLogo, "logo-site");
  if (h) {
    // NOT CALLED `img`. The block-scope scanner in `worker-imports.test.mjs`
    // reads the source as text, so a bare three-letter name that also appears
    // inside a regex literal (`/<img[^>]*>/` two assertions down) reads to it as
    // a use after the block closed — a ReferenceError that is not there. The
    // scanner is deliberately narrow rather than a parser, so the cheap fix is a
    // name that cannot collide with markup.
    const logoImg = (h.match(/<img[^>]*src="\/u\/logo-site\/mark\.png"[^>]*>/) || [""])[0];
    ok("the logo is SERVER-RENDERED into the header", !!logoImg, h.slice(0, 400));
    // The name is the ALT, so a failed image degrades to what every site shows
    // today rather than to an empty bar — and a crawler still reads the name.
    ok("…with the business name as its alt", /alt="Sharp Fade Barbers"/.test(logoImg), logoImg);
    // Unbounded, a wide wordmark pushes the nav off the right-hand edge and a
    // visitor cannot find the booking link.
    ok("…and a width bound, so it cannot push the nav off the page", /max-w-\[\d+px\]/.test(logoImg), logoImg);
  }

  const noLogo = await post({ files: { "index.tsx": CHROMED }, slug: "logo-site", title: "Sharp Fade Barbers", worker: true });
  const h2 = await renderHome(noLogo, "logo-site");
  if (h2) {
    ok("a site with no logo shows the name, exactly as before",
      h2.includes("Sharp Fade Barbers") && !/<img[^>]*mark\.png/.test(h2),
      "the previous build's logo survived into a site that sent none");
    // AND IT DRAWS NO RULES, which is the half that can rot silently: a later
    // edit restoring an unconditional `border-b` puts them back on every site
    // on the platform with the axis still present and every other check green.
    // The paired positive — a site that ASKS gets them — is in the laid-out
    // block below, and neither alone discriminates.
    ok("…and NOTHING that draws a line across the page, since it asked for none",
      !/<header[^>]*\bborder-b\b/.test(h2) && !/<footer[^>]*\bborder-t\b/.test(h2)
        // The band counts: no border is drawn, but a pale strip that ENDS is a
        // line to the eye, which is how the first attempt at this shipped
        // reporting "no rules" over a visible edge.
        && !/<header[^>]*bg-background\//.test(h2) && !/<header[^>]*\bsticky\b/.test(h2),
      ((h2.match(/<header[^>]*>/) || [""])[0] + " ~ " + (h2.match(/<footer[^>]*>/) || [""])[0]));
  }

  // ── THE FRAME'S ARRANGEMENT, WRITTEN THE WAY A PAGE REALLY WRITES IT ────────
  //
  // THE ONE THING ONLY A COMPILE CAN SHOW. `layout` is enum-shaped, and a page
  // holds its frame in a `const CHROME` object that it spreads — 261 of the 318
  // exemplars do exactly that — so the property widens to `string` and a CLOSED
  // literal union refuses it with TS2322. Measured against the real reference
  // pages before the type was opened: the whole site is lost to a failed
  // typecheck because somebody asked to centre their logo. The unit suite can
  // only read the type text; this is the shape the nav lane actually writes.
  console.log("\nbuilding a site whose CHROME carries a layout…");
  const LAID_OUT = `import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SafeImage } from "@/components/ui/safe-image";
export const Route = createFileRoute("/")({ component: Home });
const CHROME = {
  name: "Sharp Fade Barbers",
  links: [{ label: "Book", href: "/book" }],
  layout: { brand: "centre", width: "full", sticky: true, divider: true },
};
function Home() {
  return (
    <SiteChrome {...CHROME}>
      <main>
        <h1>Walk-ins welcome</h1>
        <SafeImage src="/u/laid-out/mo.jpg" alt="Mo at the chair" ratio="21/9" focus="top" />
        <SafeImage src="/u/laid-out/shop.jpg" alt="The shopfront" ratio="4/3" />
      </main>
    </SiteChrome>
  );
}`;
  const laidOut = await post({ files: { "index.tsx": LAID_OUT }, slug: "laid-out", title: "Sharp Fade Barbers", worker: true });
  ok("a const CHROME carrying a layout compiles", laidOut.ok === true, laidOut.stage + ": " + (laidOut.error || "").slice(0, 400));
  const h3 = await renderHome(laidOut, "laid-out");
  if (h3) {
    // ASSERTED ON WHAT THE ARRANGEMENT DOES, not on a class name: `sticky` is
    // the one axis whose absence is a real class in the markup, and `max-w-none`
    // is what "full" means to the frame. A render that carried the layout as
    // far as the props and dropped it there would still contain both defaults.
    // ASKED FOR IT, because `sticky` now defaults OFF — asserting the absence of
    // the default proves nothing about whether the layout was read at all.
    ok("…and the header IS sticky, so the layout reached the render",
      /<header[^>]*\bsticky\b/.test(h3), (h3.match(/<header[^>]*>/) || [""])[0]);
    // THE BAND TRAVELS WITH IT. A stuck header needs a surface or the wordmark
    // prints through the page's own headings — measured on a real scrolled
    // render. Which is also why neither defaults on: that surface ends in a
    // step, and the step is the line.
    ok("…and it carries the band that keeps it readable",
      /<header[^>]*bg-background\/85/.test(h3), (h3.match(/<header[^>]*>/) || [""])[0]);
    ok("…and it runs full width", /max-w-none/.test(h3), (h3.match(/<header[\s\S]{0,240}/) || [""])[0]);
    // THE RULES ARE OFF BY DEFAULT AND THIS SITE ASKED FOR THEM BACK.
    // Hardcoded until 2026-08-19, so no customer could remove them; now off
    // unless named. Only a real compile can say what the frame renders — it is
    // produced per request from the script's own bundle.
    ok("…and the divider it asked for is drawn",
      /<header[^>]*\bborder-b\b/.test(h3), (h3.match(/<header[^>]*>/) || [""])[0]);

    // ── WHICH PART OF A PHOTOGRAPH SURVIVES THE CROP ───────────────────────
    //
    // A CLASS THAT TAILWIND NEVER EMITS IS THE FAILURE ONLY A REAL BUILD CAN
    // SEE. `object-top` lives as a string literal in `safe-image.tsx`, so it is
    // only in the stylesheet while that file is being scanned — a change to the
    // content globs, or holding the map somewhere Tailwind does not read, drops
    // it silently and every framing change becomes a no-op the unit suite still
    // passes. Measured in a real browser before this shipped: the three
    // positions compute to 50% 0%, 50% 50% and 50% 100%, and the crop moves.
    const mo = (h3.match(/<img[^>]*mo\.jpg[^>]*>/) || [""])[0];
    const shop = (h3.match(/<img[^>]*shop\.jpg[^>]*>/) || [""])[0];
    ok("a picture asked to keep its top carries the class that does it", /object-top/.test(mo), mo);
    ok("…and one that was not asked is left alone", !!shop && !/object-(top|bottom|left|right)/.test(shop), shop);
    const css = Object.entries(laidOut.files || {})
      .filter(([n]) => n.endsWith(".css")).map(([, v]) => (v && v.t) || "").join("");
    ok("…and the stylesheet really defines it", /\.object-top\s*\{[^}]*object-position/.test(css),
      "object-top is in the markup and not in the CSS — the crop does not move");
  }

  // ── LIGHT OR DARK ──────────────────────────────────────────────────────────
  //
  // THE PAIR IS THE ASSERTION, and the surprising half is that the STYLESHEET
  // DOES NOT MOVE. `themeCss` has always emitted the theme's own designed dark
  // palette as a `.dark` block — 31 colour properties, drawn by whoever drew the
  // light half — into every site's stylesheet, and nothing ever applied it. So
  // all 500 themes shipped their dark half as dead CSS, "make my site dark" was
  // answered with a token patch that darkened the ground and left the buttons on
  // colours chosen for white paper, and the whole fix is ONE CLASS ON `<html>`.
  //
  // Two builds of a byte-identical payload differing only in `mode`: the CSS
  // has to come out the same and the document has to come out different. Either
  // one alone is satisfiable by a broken implementation — a build that ignored
  // `mode` entirely gives identical CSS, and one that regenerated a whole
  // second palette gives a different document.
  // ── ONE PAGE'S OWN TYPEFACE ─────────────────────────────────────────────
  //
  // A CSS CHANGE IS INVISIBLE TO `tsc`, TO VITE, TO THE LINT AND TO EVERY UNIT
  // TEST, which is the lesson of the 70 charts that typechecked perfectly and
  // rendered grey. So this reads the REAL compiled stylesheet: the scoped rule
  // has to be in it, the site's own font has to survive beside it, and the
  // @font-face for the page's family has to be declared.
  //
  // TWO BUILDS OF A BYTE-IDENTICAL PAYLOAD, differing only in `pageFonts` —
  // either check alone is satisfiable by a broken implementation. A build that
  // ignored the field gives a stylesheet with no scoped rule; one that applied
  // it site-wide gives one with no @theme font of its own left.
  console.log("\nbuilding a site with one page's own typeface…");
  const FONT_PAYLOAD = {
    files: { "index.tsx": CHROMED }, slug: "font-site", title: "Fold Coffee",
    fonts: { heading: "geist", body: "geist" }, worker: true,
  };
  const plainFonts = await post(FONT_PAYLOAD);
  const scopedFonts = await post({ ...FONT_PAYLOAD, pageFonts: { "/menu": { heading: "playfair-display", body: "geist" } } });
  ok("a build with no page typeface succeeds", plainFonts.ok === true,
    plainFonts.stage + ": " + (plainFonts.error || "").slice(0, 300));
  ok("a build with one succeeds too", scopedFonts.ok === true,
    scopedFonts.stage + ": " + (scopedFonts.error || "").slice(0, 300));
  const fcss = (b) => Object.entries(b.files || {}).filter(([n]) => n.endsWith(".css")).map(([, v]) => (v && v.t) || "").join("");
  const plainCss = fcss(plainFonts), scopedCss = fcss(scopedFonts);
  // THE SCOPED RULE IS REALLY IN THE COMPILED SHEET. Not "the container said so"
  // — the minifier has had its turn by now, and a second `:root` was proved dead
  // exactly here once before, shipping the default font while reporting the
  // chosen one.
  ok("the page's scope reaches the compiled stylesheet",
    /body\[data-page="\/menu"\]\{[^}]*--font-heading:/.test(scopedCss),
    scopedCss.length + " bytes and no scoped rule");
  ok("…and the family it names is in it",
    /Playfair/i.test(scopedCss), "the page's typeface was resolved to nothing");
  // AND THE SITE'S OWN FONT SURVIVES BESIDE IT, or this scoped a page by
  // re-fonting the whole site, which is the opposite of what was asked.
  ok("the site's own typeface is untouched",
    /--font-heading:\s*"Geist/.test(scopedCss),
    "the site's heading font was replaced rather than scoped");
  // A SITE THAT DOES NOT USE THIS IS BYTE-IDENTICAL to before it existed.
  ok("a site with no page typeface has no scoped rule at all",
    plainCss.length > 1000 && !/data-page/.test(plainCss),
    plainCss.length + " bytes, data-page present: " + /data-page/.test(plainCss));

  // ── HOW WIDE THE PAGE RUNS ──────────────────────────────────────────────
  //
  // THE MOST REPEATED LAYOUT VALUE ON EVERY SITE, and it had no knob: all 324
  // corpus pages carry a `max-w-*`, 1,224 of them, and `density` deliberately
  // leaves container widths alone (its own comment says so). So "it's too narrow
  // on a big screen" was a `tweak` per page.
  //
  // THIS HAS TO RUN AGAINST A REAL BUILD, not a unit test, because the whole
  // question is whether a second `:root` beats the one Tailwind's own `@theme`
  // emits — same specificity, decided by source order after the minifier has had
  // its turn. A second `:root` was proved DEAD exactly here once before.
  console.log("\nbuilding the same site at three page widths…");
  const W_PAYLOAD = { files: { "index.tsx": CHROMED }, slug: "width-site", title: "Fold Coffee", ...themeAsSeeds("noir") };
  const stdW = await post(W_PAYLOAD);
  const wideW = await post({ ...W_PAYLOAD, style: { width: "wide" } });
  ok("a build with no width axis succeeds", stdW.ok === true, stdW.stage + ": " + (stdW.error || "").slice(0, 300));
  ok("a build with one succeeds too", wideW.ok === true, wideW.stage + ": " + (wideW.error || "").slice(0, 300));
  const wcss = (b) => Object.entries(b.files || {}).filter(([n]) => n.endsWith(".css")).map(([, v]) => (v && v.t) || "").join("");
  const stdCss = wcss(stdW), wideCss = wcss(wideW);
  // THE LAST DECLARATION IS THE ONE THE BROWSER USES. Reading the first would
  // find Tailwind's own and be true whatever we emitted.
  const lastContainer = (css, step) => {
    const all = [...css.matchAll(new RegExp("--container-" + step + ":\\s*([^;}]+)", "g"))];
    return all.length ? all[all.length - 1][1].trim() : null;
  };
  ok("the override WINS in the compiled stylesheet",
    lastContainer(wideCss, "6xl") === "84.96rem",
    "6xl is " + lastContainer(wideCss, "6xl") + " — the second :root was dropped or outranked");
  // THE READING COLUMN MUST NOT MOVE. Measured over the corpus, 4xl and up are
  // page shells 100% of the time and 2xl is 9% — pulling a 65-character
  // paragraph to 90 is the opposite of what "make it wider" asks for.
  ok("…and the reading column is untouched",
    lastContainer(wideCss, "2xl") === lastContainer(stdCss, "2xl"),
    JSON.stringify([lastContainer(stdCss, "2xl"), lastContainer(wideCss, "2xl")]));
  // A SITE THAT NEVER ASKED FOR THIS IS BYTE-IDENTICAL to before it existed —
  // one declaration, Tailwind's own.
  ok("a site with no width axis has exactly one declaration",
    (stdCss.match(/--container-6xl:/g) || []).length === 1 && lastContainer(stdCss, "6xl") === "72rem",
    (stdCss.match(/--container-6xl:/g) || []).length + " declarations, last " + lastContainer(stdCss, "6xl"));

  // ── AND THE HEADING COLOUR, WHICH WAS DEAD ──────────────────────────────
  //
  // THIS IS THE CHECK THAT WAS MISSING. The axis targeted `.font-heading`, a
  // class in 0 of 2,112 kit files and 0 of 324 corpus pages — so Tailwind, which
  // only generates a utility something uses, emitted no rule at all, and "put
  // our brand colour in the headings" was stored, reported as applied, and
  // changed nothing on any site. Every unit test passed throughout, because a
  // unit test reads the string the module returns and not what the compiler did
  // with it. Only a real build can tell those apart.
  console.log("\nbuilding a site with brand-coloured headings…");
  const D_PAYLOAD = { files: { "index.tsx": CHROMED }, slug: "display-site", title: "Fold Coffee", ...themeAsSeeds("citrus") };
  const inkB = await post({ ...D_PAYLOAD, style: { display: "ink" } });
  const accB = await post({ ...D_PAYLOAD, style: { display: "accent" } });
  ok("an ink build succeeds", inkB.ok === true, inkB.stage + ": " + (inkB.error || "").slice(0, 300));
  ok("an accent build succeeds", accB.ok === true, accB.stage + ": " + (accB.error || "").slice(0, 300));
  const dcss = (b) => Object.entries(b.files || {}).filter(([n]) => n.endsWith(".css")).map(([, v]) => (v && v.t) || "").join("");
  const inkCss = dcss(inkB), accCss = dcss(accB);
  // A REAL ELEMENT, not a class that may never be generated. That is the whole
  // difference between this axis working and the two years it did not.
  ok("the heading rule reaches the compiled stylesheet and names an ELEMENT",
    /(^|[},;])\s*h1[^{]*\{[^}]*color:\s*var\(--display\)/.test(accCss),
    "no element-anchored heading colour in " + accCss.length + " bytes");
  ok("…and the accent it names is really declared", /--display:\s*oklch/.test(accCss),
    "the colour token was never emitted");
  // `ink` IS THE ORDINARY PAGE and must emit nothing, or every site carries a
  // rule it never asked for.
  ok("an ink site has no heading-colour rule at all", !/--display:/.test(inkCss),
    "ink emitted a display colour");

  // ── AND THE DIVIDER, WHICH WAS LIGHTER THAN THE PAGE ────────────────────
  //
  // Reported by the owner pointing at the two rules above a footer (2026-08-19).
  // `paletteFor` derives --border as the PAPER stepped toward the ink, and under
  // a backdrop the page is no longer the paper — the root opens to 0.35 and the
  // wash darkens it by more than the step — so the "darker" divider landed
  // LIGHTER than the ground and read as a white streak. Measured down a real
  // citrus page: ground L 0.792 at the top to 0.945 at the bottom, --border at
  // 0.875. On 57 of 57 shortlist themes with a world.
  //
  // The unit suite asserts the derivation; only a real build can say whether the
  // override SURVIVES compilation. It is a second :root, so it wins on source
  // order alone — and this repo has already shipped one of those that a minifier
  // dropped, reporting the chosen font while serving the default.
  console.log("\nbuilding a site whose dividers sit on a background wash…");
  const B_PAYLOAD = { files: { "index.tsx": CHROMED }, slug: "border-site", title: "Fold Coffee" };
  // The WORLD is what this check is about, so it is asked for by name rather
  // than inherited from a fixture — `citrus` happens to declare `backdrop: wash`
  // and `noir` declares none, which is why those two are the pair.
  const washB = await post({ ...B_PAYLOAD, ...themeAsSeeds("citrus"), style: { backdrop: "wash" } });
  const plainB = await post({ ...B_PAYLOAD, ...themeAsSeeds("noir") });   // no backdrop at all
  ok("a build on a world theme succeeds", washB.ok === true, washB.stage + ": " + (washB.error || "").slice(0, 300));
  ok("a build on a plain theme succeeds", plainB.ok === true, plainB.stage + ": " + (plainB.error || "").slice(0, 300));
  const bcss = (b) => Object.entries(b.files || {}).filter(([n]) => n.endsWith(".css")).map(([, v]) => (v && v.t) || "").join("");
  const wshCss = bcss(washB), plnCss = bcss(plainB);
  // THE LAST DECLARATION IN `:root` IS THE ONE THE BROWSER USES, and both
  // halves matter. Reading the FIRST finds the template's own shadcn base and
  // is true whatever we emitted; reading the last in the FILE finds the `.dark`
  // block, which answers a different question — that one failed against
  // perfectly correct code on this check's first run.
  const lastRootBorder = (css) => {
    let v = null;
    for (const m of css.matchAll(/:root[^{]*\{([^}]*)\}/g)) {
      const d = [...m[1].matchAll(/--border:\s*([^;}]+)/g)].pop();
      if (d) v = d[1].trim();
    }
    return v;
  };
  // THE MINIFIER REWRITES `0.4117` AS `41.17%` — measured, and the first draft
  // of this parser read that as a bare number and compared 41.17 < 0.8.
  const okl = (v) => {
    const m = /oklch\(\s*([\d.]+)(%?)/.exec(v || "");
    return m ? Number(m[1]) / (m[2] ? 100 : 1) : null;
  };
  const wshL = okl(lastRootBorder(wshCss));
  ok("the world override WINS in the compiled stylesheet",
    wshL !== null && wshL < 0.8,
    "last :root --border is " + lastRootBorder(wshCss) + " (L " + wshL + ") — the second :root was dropped or outranked");
  // A PLAIN THEME MUST BE UNTOUCHED. For it the paper really is the ground, so
  // the palette's own derivation is already right; one deploy must not restyle
  // the 90 themes that never had this bug.
  ok("…and a theme with no world keeps the palette's own divider",
    (plnCss.match(/--border:/g) || []).length === (wshCss.match(/--border:/g) || []).length - 2,
    "plain " + (plnCss.match(/--border:/g) || []).length + " vs wash " + (wshCss.match(/--border:/g) || []).length +
    " — expected exactly two more (:root and .dark) on the world theme");
  // AND THE DARK HALF, which had the mirrored bug — 56 of 84 world themes drew a
  // divider DARKER than a dark page, so it has to LIGHTEN there.
  //
  // ASSERTED ON THE VALUE, not on there being a `.dark --border` at all: the
  // palette declares one too, so "a --border exists inside a .dark block" is
  // true whether or not the override survived — it passed on every run where
  // the override was in fact missing. citrus's dark palette is L 0.31 and the
  // override is L 0.41, so the floor between them is what discriminates.
  let darkL = null;
  for (const m of wshCss.matchAll(/\.dark[^{]*\{([^}]*)\}/g)) {
    const d = [...m[1].matchAll(/--border:\s*([^;}]+)/g)].pop();
    if (d) darkL = okl(d[1].trim());
  }
  ok("…and the dark block gets its own, lightened away from a dark page",
    darkL !== null && darkL > 0.35,
    "last .dark --border is L " + darkL + " — the palette's own 0.31, so the override did not survive");

  console.log("\nbuilding the same site light and dark…");
  const MODE_PAYLOAD = { files: { "index.tsx": CHROMED }, slug: "mode-site", title: "Nightshift Records", ...themeAsSeeds("noir"), worker: true };
  const lightBuild = await post({ ...MODE_PAYLOAD, mode: "light" });
  const darkBuild = await post({ ...MODE_PAYLOAD, mode: "dark" });
  ok("a light build succeeds", lightBuild.ok === true, lightBuild.stage + ": " + (lightBuild.error || "").slice(0, 300));
  ok("a dark build succeeds", darkBuild.ok === true, darkBuild.stage + ": " + (darkBuild.error || "").slice(0, 300));
  // THE CONTAINER'S OWN ANSWER, so a caller can tell what it got rather than
  // inferring it. `light` is what an unrecognised value and an absent one both
  // become, which is what makes this safe against every site built before it.
  ok("the container reports which it drew", (lightBuild.brand || {}).mode === "light" && (darkBuild.brand || {}).mode === "dark",
    JSON.stringify([(lightBuild.brand || {}).mode, (darkBuild.brand || {}).mode]));
  const cssOf = (b) => Object.entries(b.files || {}).filter(([n]) => n.endsWith(".css")).map(([, v]) => (v && v.t) || "").join("");
  const lightCss = cssOf(lightBuild), darkCss = cssOf(darkBuild);
  ok("the stylesheet is BYTE-IDENTICAL — the dark palette was always there",
    lightCss.length > 1000 && lightCss === darkCss,
    `${lightCss.length} vs ${darkCss.length} bytes`);
  // AND IT REALLY IS A SECOND PALETTE rather than the same colours under
  // another selector. Without this the assertion above is satisfied by a theme
  // whose dark block says nothing, and the class would apply to nothing.
  // THE LAST OF EACH, WHICH IS THE THEME'S OWN. Measured on a real compiled
  // stylesheet: there are FOUR `--background` declarations, because the
  // template's shadcn base palette is emitted before the theme's. So a regex
  // taking the FIRST match compares the base light against the base dark —
  // true whatever theme was built, and the assertion passes without ever
  // touching the thing it names. Later wins, so the last pair is the pair a
  // visitor actually sees, which is the same source-order rule the colour
  // override two blocks up already rests on.
  //
  // AT THIS INDENT DELIBERATELY. `worker-imports.test.mjs` walks brace depth as
  // TEXT to find where a block-scoped name goes out of scope, so `[^}]` in a
  // regex on an INDENTED `const` line drives its depth negative on that line
  // and every later use reads as a ReferenceError that is not there — measured,
  // both declarations were flagged. Its own threshold skips declarations at the
  // top of a script, which these genuinely are. A first attempt at appeasing it
  // instead rewrote this to slice from `indexOf(":root")`, which finds
  // Tailwind's own preamble thousands of characters before any palette and
  // returned two empty strings — green here, red in CI, on an assertion that
  // had been passing. Contorting correct code to satisfy a lint is how that
  // happens.
  const rootBgs = [...lightCss.matchAll(/:root\s*\{[^}]*--background:\s*([^;}]+)/g)].map((m) => m[1].trim());
  const darkBgs = [...lightCss.matchAll(/\.dark\s*\{[^}]*--background:\s*([^;}]+)/g)].map((m) => m[1].trim());
  ok("…and the `.dark` block carries a DIFFERENT background from `:root`",
    rootBgs.length > 0 && darkBgs.length > 0 && rootBgs[rootBgs.length - 1] !== darkBgs[darkBgs.length - 1],
    JSON.stringify([rootBgs, darkBgs]));
  // AND IT IS THE THEME'S PALETTE THAT WINS, not the template's base. Without
  // this the check above is satisfied by the shadcn defaults on a build whose
  // theme never reached the stylesheet at all.
  ok("…and it is the THEME's palette that has the last word",
    rootBgs.length >= 2 && darkBgs.length >= 2, JSON.stringify([rootBgs.length, darkBgs.length]));
  const lightDoc = await renderHome(lightBuild, "mode-site");
  const darkDoc = await renderHome(darkBuild, "mode-site");
  if (lightDoc && darkDoc) {
    // ON `<html>`, NOT `<body>`. The variant is `&:is(.dark *)` — a DESCENDANT
    // of `.dark` — so the class has to sit above everything it is meant to
    // reach, and `<body>` already carries the per-page colour scope.
    ok("the dark site's document carries the class on <html>",
      /<html[^>]*class="[^"]*\bdark\b/.test(darkDoc), (darkDoc.match(/<html[^>]*>/) || [""])[0]);
    ok("…and the light one does not", !/<html[^>]*\bdark\b/.test(lightDoc), (lightDoc.match(/<html[^>]*>/) || [""])[0]);
    // The rest of the document is the same site. A `mode` that reached the
    // document by regenerating it would show up here.
    ok("…and they are otherwise the same page",
      darkDoc.replace(' class="dark"', "").length === lightDoc.length,
      `${lightDoc.length} vs ${darkDoc.length} bytes`);
  }

  // ── THE LANGUAGE, THE DIRECTION AND THE MARK, ON A REAL DOCUMENT ───────────
  //
  // ASSERTED ON A RENDER BECAUSE THERE IS NOWHERE ELSE. These were checked over
  // the dist's `.html` files until 2026-08-19 and the dist has none — so the
  // loop ran zero times and three assertions about the site's own language and
  // its own favicon covered nothing at all, invisibly, because an empty loop
  // contributes no checks to fail.
  //
  // AND THE DIRECTION IS THE HALF THAT NEEDED A NEW CASE. `normalizeLang` has
  // accepted `ar` since it was written and NOTHING set `dir`, so a brief in
  // Arabic produced a site correctly DECLARED Arabic and laid out left to right.
  // The kit is on logical utilities now, which makes one attribute enough — and
  // that attribute is what this proves, through the real container and the real
  // packaged worker rather than by reading the source.
  console.log("\nbuilding a site whose language reads right to left…");
  const rtlBuild = await post({
    files: { "index.tsx": CHROMED }, slug: "rtl-site",
    title: "Sharp Fade Barbers", lang: "ar", worker: true,
  });
  ok("a site in a right-to-left language builds", rtlBuild.ok === true, rtlBuild.stage + ": " + rtlBuild.error);
  ok("the container derives the direction from the language",
    (rtlBuild.brand || {}).lang === "ar" && (rtlBuild.brand || {}).dir === "rtl",
    JSON.stringify(rtlBuild.brand));
  const rtlDoc = await renderHome(rtlBuild, "rtl-site");
  if (rtlDoc) {
    const tag = (rtlDoc.match(/<html[^>]*>/) || [""])[0];
    ok("…and the document declares it, beside the language", /\bdir="rtl"/.test(tag) && /\blang="ar"/.test(tag), tag);
    // THE MARK, on the one surface that has a head. `base: "./"` means every
    // asset reference is emitted relative, so what matters is not how the path
    // is written but that it RESOLVES TO A FILE THIS BUILD PUBLISHED — a head
    // pointing at a 404 is a broken icon, strictly worse than the generic one.
    const link = (rtlDoc.match(/<link[^>]*rel="icon"[^>]*>/) || [""])[0];
    const href = ((link.match(/href="([^"]+)"/) || [])[1] || "").replace(/^\.?\//, "");
    ok("the icon in the head is a file this build actually published", !!href && !!rtlBuild.files[href], link);
    ok("…and it is not the template's shared favicon", href !== "favicon.svg", link);
  }
  // AND THE LEFT-TO-RIGHT CONTROL, or every assertion above passes on a build
  // that hardcodes rtl. `CHROMED` sends no language, so this is the state every
  // site published before this change is in.
  const ltrDoc = await renderHome(noLogo, "logo-site");
  if (ltrDoc) {
    ok("a site that names no language reads left to right",
      /\bdir="ltr"/.test((ltrDoc.match(/<html[^>]*>/) || [""])[0]),
      (ltrDoc.match(/<html[^>]*>/) || [""])[0]);
  }

  // ── WHICH BUILD IS THIS SITE SERVING? ───────────────────────────────────────
  //
  // An accepted upload is not a live script — measured twice live, where a read
  // 0.2s after a publish came back with the previous build's document — so the
  // platform waits for this header before calling a publish done. Nothing but
  // executing a real bundle can prove the header is there, which is the same
  // reason `[object Object]` as a whole document survived every static check.
  const stampOf = async (build, slug, bucket) => {
    const r = await serveOnce(build, slug, bucket);
    return r ? r.headers.get("x-site-build") : null;
  };
  const stamp1 = await stampOf(withLogo, "logo-site");
  const stamp2 = await stampOf(noLogo, "logo-site");
  ok("a served page says which build answered", !!stamp1 && stamp1.length > 4, JSON.stringify(stamp1));
  // THE PROPERTY THE WAIT RESTS ON. Equal stamps make the confirmation
  // vacuous — it would match the OLD script instantly and every publish would
  // report itself live while still serving the build before it, which is the
  // exact bug being fixed, wearing a green tick.
  ok("…and two builds of one site do not share a stamp", !!stamp2 && stamp1 !== stamp2, stamp1 + " vs " + stamp2);
  // THE CONTAINER'S ANSWER AND THE SITE'S ANSWER ARE THE SAME STRING. The
  // platform waits for `worker.build` and the site returns `x-site-build`, and
  // nothing else joins them — if they disagree the wait never confirms, on
  // every publish, and the only symptom is the lag it exists to remove.
  ok("…and it is the stamp the container reported with the script",
    !!(withLogo.worker && withLogo.worker.build) && withLogo.worker.build === stamp1,
    JSON.stringify({ reported: withLogo.worker && withLogo.worker.build, served: stamp1 }));
  // ON A SITE THAT IS NOT PUBLISHED YET, which is what a FIRST build's script
  // is uploaded into: the take-down probe answers 404 until the files land. A
  // document-only stamp would be invisible on exactly the build that most needs
  // confirming, so the wait would time out on every new site.
  const stampDead = await stampOf(withLogo, "logo-site", deadBucket);
  ok("…and on a site whose files are not there yet", stampDead === stamp1, JSON.stringify(stampDead));
  // ── a link to a page that does not exist ─────────────────────────────────────
  //
  // PROVEN AS A CHAIN, not as a regex. The unit test asserts validatePages rewrites
  // the href; the claim that matters is that the SITE BUILDS, and only the real
  // container can say that. Free — no model call.
  //
  // Measured live 2026-08-04: the generator wrote seven pages, the cap kept six,
  // and the dropped one was the one two others linked to. TanStack generates a
  // UNION of the routes that exist, so the link was TS2322 and the whole site
  // published as its data model.
  console.log("\na link to a page that was never written…");
  {
    const route = (path, body) => `import { createFileRoute, Link } from "@tanstack/react-router";
  export const Route = createFileRoute("${path}")({ component: P });
  function P() { return <main><h1>Hi</h1>${body}</main>; }`;

    const raw = [
      { path: "index.tsx", source: route("/", '<Link to="/menu">Menu</Link><Link to="/account">Account</Link>') },
      { path: "menu.tsx", source: route("/menu", '<Link to="/">Home</Link>') },
    ];

    // THE NEGATIVE FIRST, or this test passes for the wrong reason. Posting the
    // pages exactly as the model wrote them must FAIL — if it does not, the fix is
    // guarding against something that was never broken.
    const before = await post({
      files: Object.fromEntries(raw.map((p) => [p.path, p.source])),
      slug: "dangling-before", title: "Dangling",
    });
    ok("the unfixed pages really do fail to compile", before.ok === false && before.stage === "typecheck",
      `${before.stage || "ok"}: ${String(before.error || "").slice(0, 200)}`);
    ok("and it fails on the link, not on something else",
      /account/.test(String(before.error || "")), String(before.error || "").slice(0, 200));

    // …then the same pages through validatePages, which is what production does.
    const v = validatePages({ pages: raw.map((p) => ({ ...p })) });
    ok("validatePages reports the rewrite rather than doing it silently",
      v.problems.some((x) => /\/account/.test(x)), JSON.stringify(v.problems));
    const after = await post({
      files: Object.fromEntries(v.pages.map((p) => [p.path, p.source])),
      slug: "dangling-after", title: "Dangling",
    });
    ok("the rewritten pages compile and publish", after.ok === true,
      `${after.stage || "ok"}: ${String(after.error || "").slice(0, 300)}`);
    ok("and the surviving link still points at the real page",
      Object.entries(after.files || {}).filter(([k]) => k.endsWith(".js"))
        .map(([, x]) => (x && typeof x === "object" ? x.t || "" : String(x))).join("").includes("/menu"),
      "the live route was rewritten too");
  }

  // ── what a row VALUE is, proved by compiling ────────────────────────────────
  //
  // `Row` is the most load-bearing type the generator writes against, and the
  // date prop has now failed in two consecutive evals wearing two different
  // types: first `unknown`, then `string | number | boolean` once `created_at`
  // was named and `updated_at` was not. A source-reading test cannot catch that
  // — the failure is type SEMANTICS, and only a compiler has an opinion.
  //
  // The page is the one the CRM sample actually wrote, reduced to the lines
  // that failed.
  console.log("\nwhat a row value is…");
  {
    const rowPage = (tail) => `import { createFileRoute } from "@tanstack/react-router";
  import type { Row } from "@/lib/rows";
  export const Route = createFileRoute("/")({ component: P });
  type Deal = Row & { title: string; value: string | null; stage: string | null };
  type Activity = { who: string; what: string; at: string | number | Date };
  function P() {
    const deal = {} as Deal;
    const activity: Activity[] = [
      { who: "System", what: \`Deal "\${deal.title}" created\`, at: deal.created_at ?? new Date().toISOString() },
      { who: "Team", what: \`In \${deal.stage ?? "New"}\`, at: deal.updated_at ?? deal.created_at ?? new Date().toISOString() },
    ];
    ${tail}
    return <main><h1 key={deal.id}>{deal.title}{activity.length}</h1></main>;
  }`;

    const good = await post({ files: { "index.tsx": rowPage("") }, slug: "rowtype-ok", title: "Row" });
    ok("a timestamp column can be handed to something expecting a date", good.ok === true,
      `${good.stage || "ok"}: ${String(good.error || "").slice(0, 240)}`);

    // THE NEGATIVE, or this passes for the wrong reason. If `Row`'s index
    // signature ever became `any`, the check above would go green while every
    // undeclared column silently lost its type — which is the state that made
    // `usePublicRows` uncallable and `row.id` undefined at runtime.
    const loose = await post({
      files: { "index.tsx": rowPage("const s: string = deal.some_column_nobody_declared;\n    void s;") },
      slug: "rowtype-loose", title: "Row",
    });
    ok("and an undeclared column is still a union, not `any`",
      loose.ok === false && loose.stage === "typecheck",
      `${loose.stage || "ok"}: ${String(loose.error || "").slice(0, 240)}`);
  }

  // ── the two shapes an edit can be written in ────────────────────────────────
  //
  // `useCreateRow` takes the columns bare, so `{ id, values: {...} }` is the
  // natural guess for an edit — and the eval recorded it FOUR times in five runs
  // as `Type '{ stage: string; }' is not assignable to 'string | number |
  // boolean | null | undefined'`, because `values` was read as a column name.
  // Both shapes compile now. Only a real build can say so: this is a generic
  // whose branches resolve against the row type.
  {
    const editPage = (call) => `import { createFileRoute } from "@tanstack/react-router";
import { useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/")({ component: P });
type Deal = Row & { title: string; stage: string | null };
function P() {
  const update = useUpdateRow<Deal>("deals");
  return <main><Button onClick={() => ${call}}>Save</Button></main>;
}`;

    const spread = await post({ files: { "index.tsx": editPage('update.mutate({ id: 1, stage: "won" })') }, slug: "edit-spread", title: "Edit" });
    ok("an edit written with the columns bare compiles", spread.ok === true,
      `${spread.stage || "ok"}: ${String(spread.error || "").slice(0, 240)}`);

    const nested = await post({ files: { "index.tsx": editPage('update.mutate({ id: 1, values: { stage: "won" } })') }, slug: "edit-nested", title: "Edit" });
    ok("…and one written with the columns under `values` compiles too", nested.ok === true,
      `${nested.stage || "ok"}: ${String(nested.error || "").slice(0, 240)}`);

    // THE NEGATIVE, or both pass on a signature that stopped checking anything.
    //
    // NOT "a column the row does not have": `Row` carries an index signature, so
    // an unknown column name has ALWAYS been accepted here and the data API drops
    // it server-side. Asserting that would have failed for a reason predating
    // this change — measured, and the first draft of this check did exactly that.
    //
    // What must still be refused is an OBJECT in a column, which is the original
    // error this fix is about: `values` is a legitimate key now, and a nested
    // object anywhere else is still not a row value.
    const bogus = await post({ files: { "index.tsx": editPage('update.mutate({ id: 1, stage: { nested: "x" } })') }, slug: "edit-bogus", title: "Edit" });
    ok("…while an object in a column is still refused",
      bogus.ok === false && bogus.stage === "typecheck",
      `${bogus.stage || "ok"}: ${String(bogus.error || "").slice(0, 240)}`);
  }

  // ── the salvage stub ────────────────────────────────────────────────────────
  //
  // A page that does not compile is replaced by `stubPage` and the container runs
  // again, so one bad file costs one page instead of the whole site. Two things
  // have to hold and only a real build can say so.
  //
  // THE SECOND IS THE ONE THE DESIGN EXISTS FOR. Every other page's `<Link
  // to="/menu">` is typed against the generated route tree, so DELETING the
  // failing page turns one broken file into a compile error on every page that
  // links to it — which is why the stub keeps the route rather than dropping it.
  // `INDEX` links to /menu, so posting it beside a stubbed menu drives exactly
  // that. Asserted against the real tree, because `tsr generate` is the only
  // thing that knows what a route id has to spell.
  {
    const broken = await post({
      // A REAL type error, not a suspicious-looking one. The first draft added an
      // unused member to the interface, which is perfectly legal — it compiled,
      // and the "before" assertion failed while claiming the salvage was untested.
      files: {
        "index.tsx": INDEX,
        "menu.tsx": MENU.replace(
          'const drinks = useRows<Drink>("drinks", { order: "name", dir: "asc" });',
          'const drinks: number = useRows<Drink>("drinks", { order: "name", dir: "asc" });',
        ),
      },
      slug: "salvage-before", title: "Salvage",
    });
    ok("a site with one bad page fails outright before the stub",
      broken.ok === false && broken.stage === "typecheck",
      `${broken.stage || "ok"}: ${String(broken.error || "").slice(0, 240)}`);
    ok("and the failure names the page, which is what salvagePlan reads",
      /menu\.tsx\(\d+,\d+\)/.test(String(broken.error || "")),
      String(broken.error || "").slice(0, 240));

    const salvaged = await post({
      files: { "index.tsx": INDEX, "menu.tsx": stubPage("menu.tsx") },
      slug: "salvage-after", title: "Salvage",
    });
    ok("the stub compiles and the site publishes with the good pages intact",
      salvaged.ok === true, `${salvaged.stage || "ok"}: ${String(salvaged.error || "").slice(0, 400)}`);
    ok("…and index.tsx's link to the stubbed route still typechecks",
      salvaged.ok === true && !/menu/.test(String(salvaged.error || "")),
      String(salvaged.error || "").slice(0, 240));
    if (salvaged.ok) {
      // FROM THE BUNDLE, NOT FROM A DOCUMENT. This joined every published `.html`
      // and looked for the stub's sentence; there are no published documents any
      // more, so it searched an empty string and failed against a build that had
      // stubbed the page perfectly well. The stub's copy is compiled INTO the
      // route chunk, which is where the property now lives — and the RENDERED
      // proof of the same thing is the execution block above, where a stubbed
      // route is served like any other.
      const html = Object.entries(salvaged.files || {})
        .filter(([n]) => /\.js$/.test(n)).map(([, v]) => String(v.t || "")).join("\n");
      ok("and the stub says so on the page rather than rendering blank",
        /isn't finished yet|isn&#x27;t finished yet|isn&apos;t finished yet/.test(html),
        html.slice(0, 300));
    }
  }

  /* ---------------------------------------- 1.t: the check that LOOKS at it */
  //
  // THE ONLY THING THAT CAN VALIDATE THE PROBE. `test/site-render.test.mjs`
  // drives the judgement with literal objects and proves every threshold; it
  // cannot prove that a real browser on a real page produces those numbers at
  // all. This can, and it is $0 — no model call, no Neon project, no publish.
  //
  // THE FIRST ASSERTION IS THE IMPORTANT ONE. A check that flags a good page is
  // strictly worse than no check, because it teaches everyone to ignore it — so
  // the page we hold up as correct has to come back with NOTHING. The three
  // below it then prove the check can still fail, or a clean run means nothing.
  {
    // BOTH PAGES, and posting INDEX alone is a trap this repo has already
    // recorded and I walked straight back into: its `<Link to="/menu">` is typed
    // against the generated route tree, so on its own the build dies at the
    // TYPECHECK and never reaches a browser at all. The failure then reads as
    // "the render check did not run", which sends the reader at the wrong layer.
    const good = await post({ files: { "index.tsx": INDEX, "menu.tsx": MENU }, slug: "render-good", title: "Render" });
    const r = good.render;
    // NAMES THE STAGE. The first draft of this line said only "no render report
    // on the response" and cost a hunt through the harness for a fixture bug.
    ok("the render check ran at all", r && r.ok === true,
      r ? `ok=${r.ok} ${String(r.error || "")}`
        : `no render report — build ${good.ok ? "ok" : "failed at " + good.stage}: ${String(good.error || "").slice(0, 200)}`);
    if (r && r.ok) {
      ok("…and looked at both widths", r.checked >= 2, `checked ${r.checked}`);
      // Named individually, because "it found 3 things" is not diagnosable and
      // the whole point of this run is to calibrate against a page we believe in.
      ok("A GOOD PAGE IS REPORTED CLEAN — no false alarms on the reference page",
        (r.findings || []).length === 0,
        (r.findings || []).map((f) => `${f.route}@${f.viewport} ${f.kind}: ${f.detail}`).join(" | "));
    }

    // Blank: renders a valid, empty document. Compiles, bundles, publishes —
    // and is exactly the site nothing else in the pipeline has an opinion about.
    const blank = await post({
      files: { "index.tsx": `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: B });\nfunction B() { return <div />; }\n` },
      slug: "render-blank", title: "Blank",
    });
    // A page with no words does not survive the PRERENDER either (it refuses to
    // snapshot a body with no text), so either layer catching it is the right
    // outcome — what must never happen is a blank site reported as fine.
    const blankCaught = (blank.render && (blank.render.findings || []).some((f) => f.kind === "blank"))
      || (blank.prerenderSkipped || []).some((s) => /rendered no text/.test(s));
    ok("a page that renders nothing is caught rather than published silently", blankCaught,
      JSON.stringify({ findings: (blank.render && blank.render.findings) || [], skipped: blank.prerenderSkipped || [] }).slice(0, 300));

    // Overflow at 375, which is the width nothing in this pipeline had ever
    // rendered — and the width most of a barber shop's visitors are on.
    const wide = await post({
      files: { "index.tsx": `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: W });\nfunction W() { return <div><h1>Our services and prices</h1><div style={{ width: 900 }}>A table of prices that is far too wide for a phone screen to hold</div></div>; }\n` },
      slug: "render-wide", title: "Wide",
    });
    const spill = ((wide.render && wide.render.findings) || []).filter((f) => f.kind === "overflow");
    ok("a page that scrolls sideways on a phone is caught", spill.length > 0,
      JSON.stringify((wide.render && wide.render.findings) || []).slice(0, 300));
    ok("…and only on the phone, because 900px fits a desktop perfectly well",
      spill.length > 0 && spill.every((f) => f.viewport === "phone"),
      spill.map((f) => f.viewport).join(",") || "none");

    // A throw AFTER hydration: the server render succeeds, the page publishes,
    // and it breaks in front of a visitor. Nothing else in the build path can
    // see this — it typechecks, it bundles, and the prerender is clean.
    const boom = await post({
      files: { "index.tsx": `import { createFileRoute } from "@tanstack/react-router";\nimport { useEffect } from "react";\nexport const Route = createFileRoute("/")({ component: E });\nfunction E() { useEffect(() => { throw new Error("kaboom from the client"); }, []); return <div><h1>Sharp Fade Barbers</h1><p>We are open Tuesday to Saturday for cuts and beard trims.</p></div>; }\n` },
      slug: "render-throw", title: "Throw",
    });
    ok("a page that throws only in the browser is caught, which nothing else in the pipeline can see",
      ((boom.render && boom.render.findings) || []).some((f) => f.kind === "threw" || f.kind === "logged"),
      JSON.stringify({ ok: boom.ok, stage: boom.stage, findings: (boom.render && boom.render.findings) || [] }).slice(0, 400));

    // ── AND THE ONE THAT NEEDS A CLICK ───────────────────────────────────────
    //
    // The see-through modal shipped on EVERY site and was found by a person
    // tapping a hamburger on a phone. A static render cannot see it — the panel
    // does not exist until somebody opens it — so this is the only assertion in
    // the repo that proves the overlay pass works end to end: a real kit Sheet,
    // a real click on a real Radix trigger, and the panel measured after it
    // opens. BOTH DIRECTIONS, because a check that only ever reports is
    // indistinguishable from one that always reports.
    const sheetPage = (bg) => `import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Sharp Fade Barbers</h1>
      <p className="mt-2">Open Tuesday to Saturday for cuts, fades and beard trims in Leeds.</p>
      <Sheet>
        <SheetTrigger asChild><Button variant="outline" aria-label="Open menu">Menu</Button></SheetTrigger>
        <SheetContent side="left"${bg}>
          <SheetTitle>Menu</SheetTitle>
          <nav className="mt-4 grid gap-2"><span>Home</span><span>Book</span></nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
`;
    const glassy = await post({
      files: { "index.tsx": sheetPage(' style={{ backgroundColor: "rgba(255,255,255,0.35)" }}') },
      slug: "render-seethrough", title: "Sheet",
    });
    const seen = ((glassy.render && glassy.render.findings) || []).filter((f) => f.kind === "seethrough");
    ok("A SEE-THROUGH MENU IS CAUGHT — which needs a real click, and nothing else in the pipeline clicks",
      seen.length > 0,
      JSON.stringify({ ok: glassy.ok, stage: glassy.stage, findings: (glassy.render && glassy.render.findings) || [] }).slice(0, 400));
    ok("…and it says how see-through it actually is", seen.length > 0 && /\d+% opaque/.test(seen[0].detail),
      seen.length ? seen[0].detail : "none");

    // The SAME page with the kit's own styling. `sheet.tsx` uses `bg-popover`
    // specifically because of this bug, so an untouched panel must come back
    // clean — otherwise the check would flag the fix.
    const solid = await post({ files: { "index.tsx": sheetPage("") }, slug: "render-solid", title: "Sheet" });
    // GATED ON THE CHECK HAVING RUN, and that is not belt-and-braces. This is
    // the one assertion here whose pass condition is an ABSENCE, and `[].every()`
    // is true — so with the browser missing it reported the kit's panel clean
    // while the render check was returning `ok:false` two assertions above.
    // Measured: it passed in CI on the run where nothing rendered at all.
    // A negative assertion has to prove the observer was alive first.
    ok("…and the kit's own panel, which was FIXED to bg-popover, is reported clean",
      !!(solid.render && solid.render.ok === true)
        && (solid.render.findings || []).every((f) => f.kind !== "seethrough"),
      JSON.stringify({ ok: solid.render && solid.render.ok, findings: (solid.render && solid.render.findings) || [] }).slice(0, 300));

    // ── TEXT OVER A PHOTOGRAPH ───────────────────────────────────────────────
    //
    // The contrast pass read `backgroundColor` only, so a hero with a picture, a
    // `from-black/60` scrim and white text walked past both — a gradient sets no
    // background COLOUR — reached `body`, and measured white on white.
    // MEASURED IN A REAL BROWSER before the fix: 1:1 on the single most common
    // hero there is, reported to the customer as text that is nearly invisible,
    // on the build and on every edit lane. The colour lint cannot see it either
    // (`TAILWIND_PALETTE` lists no `white` or `black`).
    //
    // BOTH SHAPES, because the ancestor fix covers only half: the kit's own
    // `CoverImage` puts the scrim and the caption as SIBLINGS, and the family
    // exemplars nest the caption inside the gradient. Measured, each reported
    // 1:1 independently.
    const heroPage = (wrap) => `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <div className="relative h-80 overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%228%22 height=%228%22><rect width=%228%22 height=%228%22 fill=%22%23888%22/></svg>')] bg-cover" />
      ${wrap}
    </div>
  );
}
`;
    const caption = '<div className="absolute left-6 bottom-6 text-white"><h1 className="text-4xl font-semibold">Sharp Fade Barbers</h1><p className="mt-2">Walk in or book a chair online today, seven days a week.</p></div>';
    const nested = await post({
      files: { "index.tsx": heroPage('<div className="absolute inset-0 bg-gradient-to-t from-black/60">' + caption + "</div>") },
      slug: "render-hero-nested", title: "Hero",
    });
    const flat = await post({
      files: { "index.tsx": heroPage('<div className="absolute inset-0 bg-gradient-to-t from-black/60" />' + caption) },
      slug: "render-hero-sibling", title: "Hero",
    });
    // GATED ON THE CHECK HAVING RUN — the same reason the panel assertion above
    // is. This pass condition is an ABSENCE, and with no browser it is trivially
    // satisfied while the check reports nothing at all.
    for (const [what, r] of [["nested in the scrim", nested], ["a sibling of the scrim", flat]]) {
      const bad = ((r.render && r.render.findings) || []).filter((f) => f.kind === "contrast");
      ok(`white hero text over a photograph is NOT reported (${what})`,
        !!(r.render && r.render.ok === true) && bad.length === 0,
        JSON.stringify({ ok: r.ok, render: r.render && r.render.ok, findings: bad }).slice(0, 300));
    }

    // …AND THE CHECK STILL REPORTS TEXT NOBODY CAN READ. Without this the fix
    // above is indistinguishable from switching the contrast pass off.
    const faint = await post({
      files: { "index.tsx": `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: P });\nfunction P() { return <div className="bg-white p-10"><p className="text-[#ededed] text-base">Walk in or book a chair online today, seven days a week at our Leeds shop.</p></div>; }\n` },
      slug: "render-faint", title: "Faint",
    });
    ok("…and text nobody can read is STILL reported, so the fix is not the check switched off",
      ((faint.render && faint.render.findings) || []).some((f) => f.kind === "contrast"),
      JSON.stringify((faint.render && faint.render.findings) || []).slice(0, 300));
  }

} catch (e) {
  failed++;
  console.log("\nUNCAUGHT: " + ((e && (e.stack || e.message)) || e));

} finally {
  if (server) { try { server.kill("SIGKILL"); } catch {} }
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch {}
}


console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
