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

export const Route = createFileRoute("/menu")({ component: Menu });

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

// The same page with one wrong type. tsc must refuse it; vite alone would not.
const BROKEN = INDEX.replace(
  'const drinks = useRows<Drink>("drinks", { order: "price", dir: "asc", limit: 20 });',
  'const drinks: number = useRows<Drink>("drinks", { order: "price", dir: "asc", limit: 20 });',
);

// ── a sandbox that looks like the container's /app ────────────────────────────
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "isibi-site-build-"));
let server = null;

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
  // The two pristine copies the Dockerfile bakes.
  fs.mkdirSync(path.join(sandbox, ".routes-base"), { recursive: true });
  fs.copyFileSync(path.join(sandbox, "src/routes/__root.tsx"), path.join(sandbox, ".routes-base/__root.tsx"));
  fs.copyFileSync(path.join(sandbox, "index.html"), path.join(sandbox, ".index-base.html"));
  fs.copyFileSync(path.join(sandbox, "src/styles.css"), path.join(sandbox, ".styles-base.css"));
  fs.rmSync(path.join(sandbox, "src/routes/index.tsx"), { force: true });

  server = spawn("node", [path.join(ROOT, "builder", "build-server.mjs")], {
    env: { ...process.env, APP_DIR: sandbox, PORT: String(PORT), NODE_ENV: "production" },
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
  const built = await post({ files: { "index.tsx": INDEX, "menu.tsx": MENU }, slug: "fold-coffee", title: "Fold Coffee", lang: "pt-BR", logo: "/u/fold-coffee/logo.png" });
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
  console.log(`  prerender ${built.preMs}ms → ${JSON.stringify(built.prerendered)}${(built.prerenderSkipped || []).length ? " skipped " + JSON.stringify(built.prerenderSkipped) : ""}`);
  ok("both routes were prerendered", Array.isArray(built.prerendered) && ["/", "/menu"].every((p) => built.prerendered.includes(p)),
    JSON.stringify({ done: built.prerendered, skipped: built.prerenderSkipped }));
  if (built.ok && built.files) {
    const home = (built.files["index.html"] || {}).t || "";
    const menu = (built.files["menu.html"] || {}).t || "";
    ok("a second page exists as its own document", menu.length > 0, Object.keys(built.files).filter((n) => n.endsWith(".html")).join(", "));
    const wordsIn = (html) => ((html.match(/<div id="root">([\s\S]*)<\/div>/) || [])[1] || "")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    for (const [name, html] of [["index.html", home], ["menu.html", menu]]) {
      const words = wordsIn(html);
      console.log(`  ${name}: ${words.length} chars of readable text`);
      // A LOW BAR ON PURPOSE, and the number is the point. The failure this
      // guards is 5.6 KB of markup containing ZERO words — the client-render
      // fallback — so "any words at all" is what separates a working prerender
      // from that. Set higher it fails on a legitimately thin page, which is the
      // next assertion's job to bound instead.
      ok(`${name} carries words a crawler can read`, words.length > 6, JSON.stringify(words.slice(0, 120)));
      ok(`${name} did not fall back to client rendering`, !/Switched to client rendering/.test(html));
      // The snapshot must still load the SAME bundle as the shell, or a page is
      // a photograph of a site that no longer exists.
      ok(`${name} still loads the built bundle`, /<script[^>]+src="\.\/assets\//.test(html), html.slice(0, 200));
    }
    // WHAT A PRERENDER CAN AND CANNOT CAPTURE, pinned rather than left to be
    // rediscovered. The home page has written copy and comes out substantial;
    // the menu page is `<Link>Back</Link>`, an `<h1>`, and then a data list, so
    // it prerenders to "Back Menu" and nothing else — measured, not estimated.
    // Rows arrive from the data API at runtime, so a page that is ENTIRELY a
    // list has almost no snapshot, and that is correct: a snapshot of somebody
    // else's rows would go stale the moment they edited a price.
    // Measured on this fixture: home 122 chars, menu 9. Both pages here are
    // mostly data lists, which is why the home page is not larger — the
    // template's own reference page, which carries real written copy, prerenders
    // to 28 KB of HTML. The bar is set from what was measured, with headroom,
    // rather than from what would be nice.
    ok("a page with written copy prerenders more than a bare list", wordsIn(home).length > 60, String(wordsIn(home).length));
    ok("and a page that is only a data list prerenders to little — the known limit",
      wordsIn(menu).length < 40, JSON.stringify(wordsIn(menu)));
  }

  if (built.ok) {
    const names = Object.keys(built.files);
    ok("it produced an index.html", !!built.files["index.html"]);
    ok("it produced hashed js and css", names.some((n) => /^assets\/.*\.js$/.test(n)) && names.some((n) => /^assets\/.*\.css$/.test(n)), names.join(", "));
    ok("the html is the app shell, not a page of markup", /id="root"/.test(built.files["index.html"].t || ""));
    ok("the brand reached the title tag", /<title>Fold Coffee<\/title>/.test(built.files["index.html"].t || ""), (built.files["index.html"].t || "").slice(0, 200));

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
    for (const [name, html] of Object.entries(built.files).filter(([k]) => k.endsWith(".html"))) {
      const h = html.t || "";
      ok(`${name} declares the site's own language`, /<html[^>]*\blang="pt-BR"/.test(h),
        (h.match(/<html[^>]*>/) || [""])[0]);
      const link = (h.match(/<link[^>]*rel="icon"[^>]*>/) || [""])[0];
      const href = ((link.match(/href="([^"]+)"/) || [])[1] || "").replace(/^\.?\//, "");
      ok(`${name}'s icon is a file this build actually published`, !!href && !!built.files[href], link);
      ok(`${name} no longer ships the template's shared favicon`, href !== "favicon.svg", link);
    }
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
    const entry = ((built.files["index.html"].t || "").match(/src="([^"]+\.js)"/) || [])[1] || "";
    const entryJs = (built.files[entry.replace(/^\.\//, "")] || {}).t || "";
    ok("the entry chunk names the lazy route chunks", /["']\.\/[A-Za-z0-9._-]+\.js["']/.test(entryJs), entry);
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
    slug: "fold-coffee", theme: "broadsheet",
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
    slug: "fold-coffee", theme: "broadsheet", tokens: { background: "#ffcc00" },
  });
  const baseCss = Object.entries(cornersKept.files || {})
    .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
  const rounder = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", theme: "broadsheet", tokens: { radius: "1.5rem" },
  });
  ok("a build with a corner override succeeds", rounder.ok === true, JSON.stringify(rounder).slice(0, 200));
  {
    const css = Object.entries(rounder.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    ok("the bundled CSS carries the chosen radius", /--radius:\s*1\.5rem/.test(css), css.slice(0, 200));
    // 280 of the 500 themes hard-set `border-radius` on buttons and inputs as
    // real rules; with those left in place a corner change moved the cards and
    // left every button square.
    // COUNTED, not pattern-matched against a selector. The first draft looked
    // for `button…{…border-radius}` and flagged TAILWIND'S OWN preflight reset
    // — nothing to do with the theme — so it failed on a build that was
    // working. Comparing the same theme built with and without a radius
    // measures exactly the thing, and is coupled to no theme's selectors.
    const count = (t) => (t.match(/border-radius\s*:/g) || []).length;
    ok("and the theme's own corner rules gave way to it",
      count(css) < count(baseCss), `${count(css)} border-radius rules with an override, ${count(baseCss)} without`);
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
    slug: "fold-coffee", theme: "broadsheet",
    style: { buttons: "pill", icon: "heavy", density: "airy" },
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
    slug: "fold-coffee", theme: "broadsheet",
    tokens: { radius: "1.5rem" }, style: { buttons: "pill" },
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
    slug: "fold-coffee", theme: "broadsheet",
    style: { buttons: "0; } body { display: none", nope: "pill", icon: ["heavy"] },
  });
  ok("an unusable style patch falls back instead of failing the build", badStyle.ok === true,
    JSON.stringify(badStyle).slice(0, 200));
  {
    const css = Object.entries(badStyle.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    ok("and nothing it contained reaches the stylesheet",
      !/body\s*\{[^}]*display\s*:\s*none/.test(css) && /stroke-width\s*:\s*1\.25/.test(css),
      "either the injection landed or the theme's own icon weight was replaced by junk");
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
    const shell = (r) => ((r.files || {})["index.html"] || {}).t || "";
    ok("a build that names no language keeps the one the template had",
      /<html[^>]*\blang="en"/.test(shell(a)), (shell(a).match(/<html[^>]*>/) || [""])[0]);
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
      !shell(a).includes("logo.png") && !shell(b).includes("logo.png"),
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
  const withLogo = await post({ files: { "index.tsx": CHROMED }, slug: "logo-site", title: "Sharp Fade Barbers", logo: "/u/logo-site/mark.png" });
  ok("a site using the site frame builds with a logo", withLogo.ok === true, withLogo.stage + ": " + withLogo.error);
  if (withLogo.ok) {
    const h = (withLogo.files["index.html"] || {}).t || "";
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

  const noLogo = await post({ files: { "index.tsx": CHROMED }, slug: "logo-site", title: "Sharp Fade Barbers" });
  if (noLogo.ok) {
    const h = (noLogo.files["index.html"] || {}).t || "";
    ok("a site with no logo shows the name, exactly as before", h.includes("Sharp Fade Barbers") && !/<img[^>]*mark\.png/.test(h),
      "the previous build's logo survived into a site that sent none");
  }
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
      const html = Object.entries(salvaged.files || {})
        .filter(([n]) => n.endsWith(".html")).map(([, v]) => String(v.t || "")).join("\n");
      ok("and the stub says so on the page rather than rendering blank",
        /isn't finished yet|isn&#x27;t finished yet|isn&apos;t finished yet/.test(html),
        html.slice(0, 300));
    }
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
