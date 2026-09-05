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
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePages } from "../../builder/page-gen.mjs";
// The REAL stub, not a copy of it. A hand-written imitation here would prove that
// some file compiles and say nothing about the one the salvage actually writes.
import { stubPage } from "../../builder/publish-pages.mjs";
import { themeCss } from "../../builder/site-theme.mjs";
import { siteUrlFor } from "../../site-domains.mjs";
import { ALL_THEMES, resolveTheme } from "../fixtures/themes.mjs";

// THE PAYLOADS BELOW NAME A THEME AGAIN (2026-08-27). The registry left the
// product on 2026-08-20 and the seeds era's `asHex` converter stood here,
// turning a fixture theme's OKLCH palette into three hex seeds; the owner's
// call brought the registry back, the payload field is `theme`, and the
// container resolves the name itself — so these builds exercise the real
// mechanism and get the theme's FULL design rather than a palette-only
// approximation. The style-axes caution the old note recorded still applies
// one field over: a `style` patch beside the theme merges INTO it via
// `applyStyle`, which is exactly the product behaviour.
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
  // A NAME ON THE WIRE AGAIN (2026-08-27). This converted a registry theme to
  // three hex seeds for the seeds era; with the registry back in the product
  // the payload field is `theme` and the container resolves the name itself —
  // so the helper now exercises the REAL mechanism, and every build below gets
  // the theme's FULL design (all 18 axes) rather than the palette-only
  // approximation the seeds derivation produced. The name is kept so twenty
  // call sites read unchanged; the check that the fixture theme exists is kept
  // so a typo fails here rather than as a soft "no theme called" note.
  if (!ALL_THEMES[name]) throw new Error("no fixture theme " + name);
  return { theme: name };
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");
const PORT = 8123;

/**
 * How deeply nested is `at`? Zero means top level — for a CSS rule, UNLAYERED.
 *
 * That is the difference between the label guard beating the model's stylesheet
 * and losing to it exactly as the kit's own utility does, and no substring match
 * can answer it.
 *
 * COUNTED FROM THE START OF THE FILE, AND THE FIRST DRAFT WAS NOT. It walked
 * forward from the nearest `@layer` above the rule, which measures depth
 * RELATIVE TO THAT LANDMARK rather than absolutely — so it reported the guard
 * as nested in a bundle where it is not, and the assertion went red against
 * correct code. A brace count needs a known baseline and there is exactly one.
 * Measured against real Tailwind output: an appended rule lands at depth 0.
 *
 * Braces inside a string or a data URI would fool it either way. Not a real
 * hazard on a compiled Tailwind bundle (measured: the whole file balances), and
 * the alternative is a CSS parser for one ordering question.
 */
function braceDepthAt(src, at) {
  let depth = 0;
  for (let i = 0; i < at; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
  }
  return depth;
}

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
/**
 * A CALL TO ACTION SHAPED THE WAY THE KIT SHAPES ONE, plus a control that MUST
 * be reported.
 *
 * `<a class="bg-primary text-primary-foreground">` is how every CTA on every
 * site this platform builds is put together, and it is the element four live
 * builds blanked with a single blanket link rule. The label guard exists to keep
 * its words legible; this page is what proves it in a browser rather than in a
 * stylesheet.
 *
 * THE CONTROL IS THE HALF THAT MAKES THE ABSENCE MEAN ANYTHING. "The CTA was not
 * reported" is equally true of a guard that works and of a contrast pass that
 * looked at nothing — a vacuous clean, which this repo has already shipped once
 * in this very check. A paragraph painted its own background colour is a finding
 * the pass MUST produce, so the run says out loud that it was looking.
 */
const CTA_PAGE = `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/desk")({ component: Desk });

function Desk() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 space-y-6">
      <h1 className="text-3xl">Pennine Machines sales desk</h1>
      <p>Every deal in the pipeline, and the people behind them.</p>
      <a href="#book" className="inline-block rounded px-4 py-2 bg-primary text-primary-foreground">Book a chair now</a>
      <p style={{ background: "#0d1117", color: "#0d1117" }}>This sentence is deliberately invisible</p>
    </main>
  );
}
`;

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
// ── EVERY PACKAGE THE PAGE RULES PROMISE, COMPILED ──────────────────────────
//
// THE BUILD THAT PAID FOR THIS: run 80, `ashgrove-1`, 2026-08-30, 45 credits.
// The page rules tell the model "lucide-react icons, date-fns, recharts" and
// "`three` and `@react-three/fiber` are real dependencies", and a model finally
// took the 3D offer up. It wrote `import type { Group } from "three"` — the
// obvious thing when you hold a ref to a three object — and `tsc` refused:
// `three` ships NO type declarations and nothing had installed `@types/three`.
// The build died at typecheck and the site kept its placeholder.
//
// THE CAUSE WAS NOT THE MISSING TYPES. It was that FIVE packages were advertised
// in a prompt and NONE of them was ever compiled by anything:
//
//   fixtures importing them, before this ...... 0 of 5
//   real generated pages importing them ....... 0 of 324 (the 08-20 corpus)
//
// So all five were promises nobody had checked, and `three` simply happened to
// be the first one a model reached for. The other four are no better proven —
// they are just still unused. A package-list guard in the unit suite cannot
// close this: it checks that names appear in package.json, and the failure was
// a package that WAS in package.json and still could not be imported. Only a
// real `tsc` against the real template can tell the difference, which is what
// this harness is for.
//
// DELIBERATELY THE UNCOMFORTABLE IMPORTS: a TYPE from `three` (the exact line
// that failed), a `<Canvas>` with r3f's JSX intrinsics, a `recharts` chart, a
// `date-fns` call and a `lucide-react` icon. If any of the five ever loses its
// types or its install, this fails here — free, in CI — instead of on a
// customer's build, at ~45 credits a time.
const PROMISED_PAGE = `import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import type { Group } from "three";
import { Canvas } from "@react-three/fiber";
import { LineChart, Line, XAxis } from "recharts";
import { format } from "date-fns";
import { Hammer } from "lucide-react";

export const Route = createFileRoute("/promised")({ component: Promised });

const SALES = [{ m: "Jan", n: 4 }, { m: "Feb", n: 7 }];

function Promised() {
  const chair = useRef<Group>(null);
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 space-y-6">
      <h1 className="text-3xl">Every promise the page rules make</h1>
      <p className="text-muted-foreground">Made on {format(new Date(2026, 7, 30), "d MMMM yyyy")}</p>
      <Hammer className="size-5" aria-hidden />
      <div className="h-64">
        <Canvas>
          <ambientLight intensity={0.6} />
          <group ref={chair}>
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#8a6f4e" />
            </mesh>
          </group>
        </Canvas>
      </div>
      <LineChart width={320} height={160} data={SALES}>
        <XAxis dataKey="m" />
        <Line dataKey="n" />
      </LineChart>
    </main>
  );
}
`;

// ── A PAGE WITH REQUIRED SEARCH PARAMS MUST NOT BREAK THE KIT ───────────────
//
// THE BUILD THAT PAID FOR THIS: run 82, `ashgrove-1`, 2026-08-30, 18 credits
// (453 before, 435 after; nothing records a build's cost, so this is the ledger).
//
//   src/lib/error-page.tsx(44,14): error TS2741: Property 'search' is missing
//   in type '{ children: string; to: "/" }' but required in
//   MakeRequiredSearchParams<... Route<..., "/", "/">>
//
// The generated page was a configurator and put its timber and finish in the
// URL — `validateSearch` with REQUIRED fields on "/". TanStack then requires a
// `search` prop on every `<Link to="/">` in the whole app, INCLUDING two links
// in the kit that the model never saw and could not have fixed. The build died
// in a foreign file and salvage rightly refused to stub it: "the error is in a
// file the build didn't write".
//
// So a perfectly reasonable page could take the whole site down through a file
// it has no knowledge of. Both kit links are plain `href`s now, which do not
// participate in a route's search contract at all.
//
// THIS FIXTURE IS THE PROOF. It declares exactly that contract and asserts the
// build still succeeds — so if a `Link to="/"` ever returns to the kit, it
// fails here, free, instead of on a customer's build.
// ── THE ESCAPE HATCH NOTHING HAS EVER COMPILED ──────────────────────────────
//
// `tsx` is the way out of the 2,112-component kit: when the model searches it
// and comes up short, it declares a component and writes the source itself.
// Added 2026-08-29, fully wired — the Worker sends `parts`, the container writes
// them through `safePart` — and NOTHING HAS EVER COMPILED ONE. An audit of the
// container's 28 payload fields against everything this harness sends found
// `parts` had never been exercised.
//
// That is the run-80 shape exactly: `three` was declared, installed, present and
// correctly named in the prompt, and unimportable. Declared and usable are
// different questions, and only a real build answers the second.
//
// FOUR THINGS ONLY A BUILD CAN ANSWER, and each is a real failure mode:
//   • The file lands at `src/routes/-parts/<name>.tsx`. That directory does not
//     exist in a checkout — it is created inside the container mid-build — so no
//     local tsc has ever seen one.
//   • A page imports it as `@/routes/-parts/<name>`, which is what the directive
//     tells the model. If that alias does not resolve, every page using the
//     hatch fails to compile and the error blames the page.
//   • The `-` prefix is what stops it becoming a ROUTE, via
//     `routeFileIgnorePrefix: "-"` pinned in our own vite config rather than
//     inherited. If that ever stopped applying, a component would be published
//     as a page at `/-parts/<name>`.
//   • It must not be counted as a page. `parts` is a separate counter from
//     `wrote` on purpose: folding them together would let a build that returned
//     three components and no page publish as though it had a site.
const PART_SOURCE = `export function RunTally({ label, runs }: { label: string; runs: number[] }) {
  const total = runs.reduce((a, b) => a + b, 0);
  return (
    <div data-slot="run-tally" className="rounded-md border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{total}</p>
      <ul className="mt-2 flex gap-2 text-xs text-muted-foreground">
        {runs.map((r, i) => <li key={i} className="tabular-nums">{r}</li>)}
      </ul>
    </div>
  );
}
`;

// IMPORTED THE WAY THE DIRECTIVE SAYS TO, verbatim: `@/routes/-parts/<name>`.
// If `tsxDirective` ever changes that path this page stops compiling, which is
// the failure a model would hit and is the reason it is spelled here rather
// than resolved some other way.
const PART_USER = `import { createFileRoute } from "@tanstack/react-router";
import { RunTally } from "@/routes/-parts/run-tally";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl">The Washhouse</h1>
      <RunTally label="Washes this week" runs={[12, 9, 14]} />
    </main>
  );
}
`;

// ── THE TWO MARKS NOTHING HAS EVER BUILT ────────────────────────────────────
//
// `gif` and `qr` were added to the design step on 2026-08-29 with their
// scanners, their guards and a green suite. `test/site-marks.test.mjs` asserts
// THE CHAIN — that both reach the site and survive a later publish — by reading
// the modules. Nothing has ever COMPILED one.
//
// That is the exact gap that cost run 80. `three` was in package.json,
// installed, present, named correctly in the prompt, and still unimportable,
// because declared and usable are different questions and only a real `tsc`
// against the real template can tell them apart. Run 83 published the 3D scene
// and did NOT exercise either mark — the design step asked for neither — so
// both are still on the unproven side of that line.
//
// WHAT COULD ACTUALLY BREAK HERE, none of which a source read can see:
//   • `writeSiteBrand` writes the artwork to `public/animated.svg` and
//     `public/qr.svg` and puts only the PATH in the generated module. Vite has
//     to copy `public/` into `dist/client/`, and the publish has to sweep it.
//   • The generated `site-brand.ts` must still typecheck with the values in it.
//   • A page written the way `marksDirective` instructs must compile against
//     the generated module rather than the checked-in stub.
//
// The page below is written exactly as the directive tells the model to write
// it: `SITE_ANIMATED` guarded with an empty alt because it is decoration, the
// QR shown WITH its caption and `alt={SITE_QR_LABEL}`. If the binding names
// ever drift from what `writeSiteBrand` emits, this stops compiling — which is
// the failure the directive's own comment warns about ("a page that guesses
// `SITE_GIF` does not compile, and the failure blames the page").
//
// AND A SECOND CODE BY NAME (2026-09-03, owner: "it should carry more"). The
// first code keeps its old bindings — every page written before the list reads
// `SITE_QR` — and the second is reached through `SITE_QRS.<name>`, the record
// the container emits per code. Both halves have to compile against the
// generated module AND against the checked-in stub, which is why `SITE_QRS` is
// typed in both as a `Record<string, { src, label }>`: an unannotated `{}` would
// make `SITE_QRS.care` a type error in the stub and the page would fail
// standalone.
const MARKS_INDEX = `import { createFileRoute } from "@tanstack/react-router";
import { SITE_ANIMATED, SITE_QR, SITE_QR_LABEL, SITE_QRS } from "@/site-brand";

export const Route = createFileRoute("/")({ component: Marks });

function Marks() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl">Chairmakers</h1>
      {SITE_ANIMATED && <img src={SITE_ANIMATED} alt="" className="h-16 w-16" />}
      {SITE_QR && (
        <figure className="mt-8">
          <img src={SITE_QR} alt={SITE_QR_LABEL} className="h-40 w-40" />
          <figcaption className="mt-2 text-sm text-muted-foreground">{SITE_QR_LABEL}</figcaption>
        </figure>
      )}
      {SITE_QRS.care && (
        <figure className="mt-8">
          <img src={SITE_QRS.care.src} alt={SITE_QRS.care.label} className="h-40 w-40" />
          <figcaption className="mt-2 text-sm text-muted-foreground">{SITE_QRS.care.label}</figcaption>
        </figure>
      )}
    </main>
  );
}
`;

const SEARCHY_INDEX = `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Chair,
  validateSearch: (s: Record<string, unknown>): { timber: string; finish: string } => ({
    timber: String(s.timber ?? "oak"),
    finish: String(s.finish ?? "oil"),
  }),
});

function Chair() {
  const { timber, finish } = Route.useSearch();
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl">The Ashgrove</h1>
      <p className="text-muted-foreground">{timber}, {finish}</p>
    </main>
  );
}
`;

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

  // NO PROVIDER KEYS, DELIBERATELY, AND THIS HARNESS MUST NEVER HAVE ANY.
  //
  // The service can make a real model call now (`POST /model`), and this file
  // runs on every push. `{ ...process.env }` would hand it whatever the runner
  // happens to carry, so a checked-in test could start spending real money the
  // day a key lands in that environment — silently, because a working call
  // looks exactly like a working test.
  //
  // Cleared rather than merely unset, so the emptiness is a PROPERTY of this
  // spawn rather than of whichever machine it runs on. The /model check below
  // reads the named refusal that produces, which costs nothing and still drives
  // every layer between the socket and the provider.
  // WORKER_DIR IS THE REPOSITORY (2026-09-05): the image lays the Worker's own
  // module graph out under /app/worker as the job runtime, and this checkout
  // IS that tree, so the service's startup check imports the real worker.js
  // and `/job/run` below spawns the real runner.
  server = spawn("node", [path.join(ROOT, "builder", "build-server.mjs")], {
    env: {
      ...process.env, APP_DIR: sandbox, PORT: String(PORT), NODE_ENV: "production", ...chromiumEnv(),
      WORKER_DIR: ROOT,
      ANTHROPIC_API_KEY: "", XAI_API_KEY: "",
    },
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

  // ── THE JOB RUNNER'S DOOR, THROUGH THE REAL SERVICE (2026-09-05) ─────────
  //
  // `POST /job/run` is how a queued edit comes to run INSIDE the site's
  // container: the Worker's consumer fires the launch and returns, and this
  // service spawns the Worker's own module (the `worker/` tree in the image;
  // this checkout, here) under the loader with the launch on stdin. FREE, and
  // whole: a launch with no secrets runs the real consumer to its own named
  // refusal — the claim is first, and the RPC helper refuses before any fetch
  // without the service key — so nothing reaches Supabase, R2 or a provider,
  // and every hop between the socket and the consumer is exercised.
  {
    const post = (body) => fetch(`http://127.0.0.1:${PORT}/job/run`, { method: "POST", headers: { "content-type": "application/json" }, body });
    const bad = await post("not a launch");
    const badBody = await bad.json().catch(() => ({}));
    ok("POST /job/run refuses a launch it cannot read, 400, before any child is started",
      bad.status === 400 && badBody.ok === false && /not JSON/.test(String(badBody.error)), `status ${bad.status} ${JSON.stringify(badBody).slice(0, 120)}`);
    const id = "harness_" + Date.now().toString(36);
    const launch = { v: 1, kind: "edit", id, gateway: { url: "https://gofarther.dev/api/job/" + id, token: "harness" }, secrets: {}, buildPort: PORT };
    const r = await post(JSON.stringify(launch));
    const j = await r.json().catch(() => ({}));
    ok("…and takes one it can: 200 {ok, id, pid} — the launch is running, the caller is free to go",
      r.status === 200 && j.ok === true && j.id === id && j.pid > 0, `status ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
    // The child is the real runner: the Worker imported under the loader, the
    // consumer run to its refusal, one done line, exit 0. Read back off the
    // service's own record of the job.
    let job = null;
    for (let i = 0; i < 450; i++) {
      job = await (await fetch(`http://127.0.0.1:${PORT}/job/${id}`)).json().catch(() => null);
      if (job && job.state !== "running") break;
      await new Promise((res) => setTimeout(res, 200));
    }
    ok("…and the child ran the Worker's consumer to its end: done, exit 0",
      job && job.state === "done" && job.code === 0, JSON.stringify(job).slice(0, 400));
    ok("…with the consumer's own refusal in the job's tail — no service key, so no claim, no network",
      job && Array.isArray(job.tail) && job.tail.some((l) => /no-service-key/.test(l)), JSON.stringify(job && job.tail).slice(0, 400));
    ok("…and the done line names the job", job && job.tail && job.tail.some((l) => l.includes('"job":"' + id + '"') && l.includes('"done":true')), JSON.stringify(job && job.tail).slice(0, 400));
    // Busy is released with the child: a container is held under a running
    // job and not a moment longer.
    const busy = await (await fetch(`http://127.0.0.1:${PORT}/busy`)).json().catch(() => ({}));
    ok("…and the container is not held busy after it", busy && !busy.busy, JSON.stringify(busy).slice(0, 120));
    const gone = await fetch(`http://127.0.0.1:${PORT}/job/no_such_job_1`);
    ok("GET /job/<id> answers 404 for a job this service never ran", gone.status === 404, `status ${gone.status}`);
  }

  // ── THE CONTAINER CAN MAKE THE MODEL CALL, DRIVEN ──────────────────────────
  //
  // Page generation is moving here because a queue consumer is capped at
  // fifteen minutes and a container has no fixed maximum runtime. Everything
  // between the socket and the provider is exercised: routing, the body parse,
  // the queue, the call, and the error SHAPE the Worker reads back.
  //
  // FREE, AND THAT IS WHY IT CAN LIVE IN A CHECK THAT RUNS ON EVERY PUSH. With
  // no key the call refuses BY NAME before a request is made — no DNS, no TLS,
  // no tokens, nothing billable. The refusal is the assertion.
  {
    const r = await fetch(`http://127.0.0.1:${PORT}/model`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ req: { model: "claude-sonnet-5", messages: [] }, callMs: 5000 }),
    });
    const m = await r.json().catch(() => ({}));
    ok("POST /model is routed at all — not the bottom 404", r.status === 200, `status ${r.status}`);
    ok("…and it reached the model call, refusing by name because no key is set",
      m && m.ok === false && /ANTHROPIC_API_KEY is not set/.test(String(m.message)), JSON.stringify(m).slice(0, 200));
    // NO SYNTHESISED STATUS. `upstream` on the build route is documented as
    // "the numeric status from the model API and nothing else", so a key we
    // forgot to set must not come back looking like a provider that answered.
    ok("…with no provider status, because no provider answered", m && m.status === null, `status field ${JSON.stringify(m && m.status)}`);

    // BOTH PROVIDERS, because `DEFAULT_PICKER` is grok — a check that proved
    // only the Anthropic branch would say nothing about the one every build
    // actually uses, and the two branches refuse in different places.
    const x = await fetch(`http://127.0.0.1:${PORT}/model`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ req: { model: "grok-4.6", messages: [] }, callMs: 5000 }),
    }).then((r) => r.json()).catch(() => ({}));
    ok("…and the xAI branch is reached too, not only Anthropic's",
      x && x.ok === false && /XAI_API_KEY is not set/.test(String(x.message)), JSON.stringify(x).slice(0, 200));

    const bad = await fetch(`http://127.0.0.1:${PORT}/model`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    ok("a /model call with no request in it is refused rather than sent", bad.status === 400);

    // A FAILED CALL MUST RELEASE ITS QUEUE SLOT. `/model` runs through
    // `oneAtATime` so the busy counter can see it — and a rejection leaking a
    // permanent +1 would make this container report busy for the rest of its
    // life, so `onActivityExpired` would never reclaim it and it would bill
    // until Cloudflare recycled it. Three failures have just been driven, so a
    // leak here is worth three.
    const busy = await fetch(`http://127.0.0.1:${PORT}/busy`).then((r) => r.json()).catch(() => null);
    ok("…and three failed /model calls left the queue empty, not permanently busy",
      busy && busy.busy === false && busy.jobs === 0, JSON.stringify(busy));
  }

  // ── FIRE AND STORE, DRIVEN ──────────────────────────────────────────────────
  //
  // The half that lets the Worker stop waiting: `/model/start` answers with an
  // id and works in the background, `/model/result` says whether it is done. A
  // unit test can read the source and cannot see whether either route is
  // ROUTED — which is the layer this repo has recorded twelve dead features in.
  //
  // FREE FOR THE SAME REASON THE BLOCK ABOVE IS: with no key the call refuses
  // by name before a request is made. The refusal is the assertion.
  //
  // WHAT THIS CANNOT SHOW, stated: the job fails in about two milliseconds
  // here, so "the response came back before the work finished" is not
  // observable — that was measured by hand against a real round trip and is
  // held in the suite by composition (see container-model-async.test.mjs).
  {
    const started = await fetch(`http://127.0.0.1:${PORT}/model/start`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ req: { model: "grok-4.6", messages: [] }, callMs: 5000 }),
    }).then((r) => r.json()).catch(() => ({}));
    // THE ANSWER IS AN ID AND NOT THE MODEL'S REPLY. That difference IS the
    // route: hand back an answer and it is the synchronous path renamed, with
    // the fifteen-minute consumer cap binding exactly as before.
    ok("POST /model/start is routed, and answers with a job id rather than the reply",
      started && started.ok === true && typeof started.id === "string" && started.id.length > 8 && !("answer" in started),
      JSON.stringify(started).slice(0, 200));

    // Poll it the way the Worker will. Bounded, because a route that never
    // settles must fail here rather than hang the check.
    let result = null;
    for (let i = 0; i < 50; i++) {
      result = await fetch(`http://127.0.0.1:${PORT}/model/result?id=${encodeURIComponent(started.id || "")}`)
        .then((r) => r.json()).catch(() => null);
      if (result && result.state !== "pending") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    ok("…and the fired job really ran, refusing by name because no key is set",
      result && result.state === "failed" && /XAI_API_KEY is not set/.test(String(result.message)),
      JSON.stringify(result).slice(0, 200));
    // No synthesised status, the same rule the synchronous route already keeps:
    // `upstream` is documented as the provider's number and nothing else, so a
    // key we forgot to set must not arrive looking like a provider that
    // answered — `retryHere` reads exactly this to decide whether tokens are
    // already spent.
    ok("…with no provider status, because no provider answered",
      result && result.status === null, `status field ${JSON.stringify(result && result.status)}`);

    // A QUEUE DELIVERS AT LEAST ONCE. A duplicated resume message must find the
    // same answer rather than "unknown job" — which reads as the container
    // having been recycled, and would throw away a generation that finished.
    const again = await fetch(`http://127.0.0.1:${PORT}/model/result?id=${encodeURIComponent(started.id || "")}`)
      .then((r) => r.json()).catch(() => null);
    ok("…and reading it a second time gives the same answer — a finished job is not deleted on read",
      again && again.state === "failed" && again.message === result.message, JSON.stringify(again).slice(0, 120));

    // UNKNOWN IS ITS OWN ANSWER. A caller told "pending" for work this
    // container no longer has polls until its own deadline for an answer
    // nobody is producing.
    const gone = await fetch(`http://127.0.0.1:${PORT}/model/result?id=not-a-real-job`)
      .then((r) => r.json()).catch(() => null);
    ok("an id this container does not have reads as unknown, never as pending",
      gone && gone.state === "unknown", JSON.stringify(gone));

    const noReq = await fetch(`http://127.0.0.1:${PORT}/model/start`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    ok("a /model/start with no request in it is refused rather than queued", noReq.status === 400);

    // The fired job must release its lane exactly as an awaited one does. It is
    // the same `oneAtATime`, but nothing here awaits it — so a leak would be
    // invisible until this container claimed to be busy for the rest of its
    // life and `onActivityExpired` stopped reclaiming it.
    const busyAfter = await fetch(`http://127.0.0.1:${PORT}/busy`).then((r) => r.json()).catch(() => null);
    ok("…and a fired-and-forgotten job still released its queue slot when it settled",
      busyAfter && busyAfter.busy === false && busyAfter.jobs === 0, JSON.stringify(busyAfter));
  }

  // ── THE ANSWER LEAVES THE CONTAINER'S MEMORY, DRIVEN ────────────────────────
  //
  // `MODEL_JOBS` is a Map in ONE instance's memory. Cloudflare does not promise
  // that instance survives a ten-minute generation, and run 40's resume was told
  // `unknown` for work it had no way to recover. So the container POSTs the
  // answer back the moment it has one.
  //
  // A SOURCE READ CANNOT SEE THAT IT REALLY LEAVES. `sendModelReport` can be
  // perfectly correct and called from neither branch — the wiring layer this
  // repo has recorded twelve dead features in — so this stands up a real HTTP
  // server, fires a real job at it, and asserts what ARRIVED.
  //
  // FREE, and free for the same reason the block above is: with no key the call
  // refuses by name before a request is made. What is under test is the report,
  // and a FAILURE is exactly the report shape most likely to be forgotten —
  // reported only on success, a container that failed and was then recycled
  // looks identical to one that lost the work, so the resume buys another
  // generation to be told the same thing.
  {
    const seen = [];
    const sink = http.createServer((rq, rs) => {
      let body = "";
      rq.on("data", (c) => { body += c; });
      rq.on("end", () => {
        seen.push({ method: rq.method, url: rq.url, token: rq.headers["x-gen-report"] || "", body });
        rs.writeHead(200, { "content-type": "application/json" });
        rs.end('{"ok":true}');
      });
    });
    await new Promise((r) => sink.listen(0, "127.0.0.1", r));
    const sinkPort = sink.address().port;
    const TOKEN = "0123456789abcdef0123456789abcdef";
    // THE ROW'S HALF (stage 2c): the fire names the build's job and a beat
    // address, and the report must carry the job and the generation id back,
    // which is what lets the Worker release the row's lease. The beat itself
    // cannot be seen here — the generation refuses in milliseconds and the
    // timer is cleared with it — so the beat's send is read out of the source
    // by test/build-jobs.test.mjs; what this proves is the report's half of
    // the binding, on the real wire.
    const JOB = "fedcba9876543210fedcba9876543210";
    try {
      const started = await fetch(`http://127.0.0.1:${PORT}/model/start`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          req: { model: "grok-4.6", messages: [] },
          callMs: 5000,
          report: {
            url: `http://127.0.0.1:${sinkPort}/api/site/genresult`, token: TOKEN,
            job: JOB, beat: `http://127.0.0.1:${sinkPort}/api/site/genbeat`, beatMs: 5000,
          },
        }),
      }).then((r) => r.json()).catch(() => ({}));
      ok("a fire carrying a report destination is accepted like any other",
        started && started.ok === true && typeof started.id === "string", JSON.stringify(started).slice(0, 160));

      // Bounded, because a report that never arrives must FAIL here rather than
      // hang the run — and "it never arrived" is the exact bug being guarded.
      for (let i = 0; i < 50 && !seen.length; i++) await new Promise((r) => setTimeout(r, 100));
      ok("…and the container POSTed the answer back out of its own memory", seen.length === 1,
        `${seen.length} reports arrived`);

      const rep = seen[0] || {};
      ok("…as a POST, carrying the token in a header rather than the path",
        rep.method === "POST" && rep.token === TOKEN && !String(rep.url).includes(TOKEN),
        `${rep.method} ${rep.url} token=${rep.token ? "present" : "absent"}`);

      // THE SHAPE IS THE POLL'S. `resumeDecision` must not be able to tell a
      // stored answer from a live one, and `retryHere` reads `status` and `kind`
      // to decide whether money was spent — a key we forgot to set must not
      // arrive looking like a provider that answered.
      let sent = null;
      try { sent = JSON.parse(rep.body || ""); } catch { sent = null; }
      ok("…and a FAILURE is reported, not only a success",
        sent && sent.state === "failed" && /XAI_API_KEY is not set/.test(String(sent.message)),
        JSON.stringify(sent).slice(0, 200));
      ok("…with no provider status, so the resume reads it as a call that was never made",
        sent && sent.status === null, `status ${JSON.stringify(sent && sent.status)}`);
      // AND IT NAMES THE JOB AND THE GENERATION (stage 2c), so the Worker can
      // bind the report to the build's row and release the lease it holds.
      ok("…and it names the job it was fired for and the generation that answered",
        sent && sent.job === JOB && sent.gen === started.id,
        `job ${JSON.stringify(sent && sent.job)} gen ${JSON.stringify(sent && sent.gen)} (started ${started.id})`);
      // A REPORT IS NOT A BEAT: nothing arrived at the beat address, because
      // the generation settled before the first tick and the timer went with it.
      ok("…and no beat arrived for a generation that settled at once",
        seen.every((s) => !String(s.url).includes("genbeat")), `${seen.filter((s) => String(s.url).includes("genbeat")).length} beats`);

      // AND IT IS STILL IN MEMORY TOO. The report is a second copy rather than a
      // handover: a Worker that could not be reached must leave the in-memory
      // answer collectable, which is the fallback the whole design rests on.
      const still = await fetch(`http://127.0.0.1:${PORT}/model/result?id=${encodeURIComponent(started.id || "")}`)
        .then((r) => r.json()).catch(() => null);
      ok("…and the answer is still readable from the container as well",
        still && still.state === "failed", JSON.stringify(still).slice(0, 120));

      // A FIRE WITH NO REPORT IS UNCHANGED, which is what makes this safe to
      // deploy: every build fired before this existed carries no destination and
      // must behave exactly as it did.
      const before = seen.length;
      const bare = await fetch(`http://127.0.0.1:${PORT}/model/start`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ req: { model: "grok-4.6", messages: [] }, callMs: 5000 }),
      }).then((r) => r.json()).catch(() => ({}));
      for (let i = 0; i < 20; i++) {
        const st = await fetch(`http://127.0.0.1:${PORT}/model/result?id=${encodeURIComponent(bare.id || "")}`)
          .then((r) => r.json()).catch(() => null);
        if (st && st.state !== "pending") break;
        await new Promise((r) => setTimeout(r, 100));
      }
      ok("a fire with no report destination sends nothing, and does not throw",
        seen.length === before, `${seen.length - before} unexpected reports`);
    } finally {
      await new Promise((r) => sink.close(r));
    }
  }

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
      // THE ORIGIN COMES FROM THE REAL PRODUCER, never a hand-typed string.
      // It was `"https://fold-coffee.gofarther.app"` — and `siteUrlFor`, the
      // only thing that ever writes this field, returns it WITH a trailing
      // slash. That one missing character made this harness certify a head that
      // was emitting `https://fold-coffee.gofarther.app//menu` as the og:url and
      // the canonical of every route but the home page. A fixture that does not
      // produce the shape the pipeline produces is the trap this file has
      // recorded before; the fix is to stop having a second copy of what an
      // origin looks like.
      const META = {
        description: "A very short shop blurb", image: "https://x/og.png", origin: siteUrlFor("fold-coffee", "https://" + "gofarther.app"),
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
      // THE EXPECTED ADDRESS IS BUILT THE WAY A URL IS BUILT, not by gluing
      // strings — `META.origin` really ends in a slash now (that is what
      // `siteUrlFor` returns) and `META.origin + "/menu"` would assert the very
      // double slash this leg exists to catch.
      const pageUrl = (here) => META.origin.replace(/\/+$/, "") + (here || "/");
      ok("…and og:url is THIS page's address",
        menuHtml.includes('property="og:url" content="' + pageUrl("/menu") + '"'),
        "og:url is not the page's own address — every route claims to be the site root");
      if (home) {
        const homeHtml2 = await (await call("/")).text();
        ok("the home page keeps the site's own description, and the bare origin",
          homeHtml2.includes(META.description)
            && homeHtml2.includes('property="og:url" content="' + pageUrl("") + '"'),
          "the home page is the ONE that must not override — its description was written for exactly this");

        // ── the head-tag pack (2026-08-28) ────────────────────────────────────
        //
        // Only a render can prove these: the tags are composed by `__root.tsx`
        // at request time, so a unit test can read the template's source and
        // nothing more. Asserted on /menu as well as / — the per-page half is
        // the point of the canonical.
        ok("og:site_name is the business's name, on every page",
          homeHtml2.includes('property="og:site_name" content="Fold Coffee"')
            && menuHtml.includes('property="og:site_name" content="Fold Coffee"'),
          "og:site_name is missing — Slack and Discord show the raw hostname above every card");
        // THE CANONICAL, from the SAME address og:url speaks. A site with a
        // custom domain serves at TWO hostnames; without this a search engine
        // reads them as duplicate sites and splits the ranking.
        const canonOf = (h) => (((h.match(/<link[^>]*rel="canonical"[^>]*>/) || [""])[0]).match(/href="([^"]+)"/) || [])[1] || "";
        ok("the canonical names THIS page's address",
          canonOf(homeHtml2) === pageUrl("") && canonOf(menuHtml) === pageUrl("/menu"),
          JSON.stringify({ home: canonOf(homeHtml2), menu: canonOf(menuHtml) }));
        // AND IT IS A WELL-FORMED URL, asserted separately from its value. The
        // equality above is only as good as the address the test computes; this
        // one asks the URL parser, which cannot be talked into agreeing with a
        // wrong expectation. `//menu` parses as a PROTOCOL-RELATIVE address —
        // a crawler reads it as the host `menu`, so the canonical points at a
        // different site entirely rather than at a wrong page of this one.
        ok("every address the head claims is a real url with the route's own path",
          [[homeHtml2, "/"], [menuHtml, "/menu"]].every(([h, want]) => {
            const c = canonOf(h);
            const u = (h.match(/property="og:url" content="([^"]+)"/) || [])[1] || "";
            return c && u && c === u
              && !/[^:]\/\//.test(c)
              && new URL(c).pathname === want
              && new URL(c).host === new URL(META.origin).host;
          }),
          JSON.stringify({ home: canonOf(homeHtml2), menu: canonOf(menuHtml) }));
        ok("og:locale speaks the site's language", homeHtml2.includes('property="og:locale" content="en"'),
          "no og:locale — an unfurler guesses the language of every preview");
        // The tint: this build sent no theme, and the paper such a site really
        // renders is the template's own white — the same answer `cardColors`
        // gives the card.
        ok("the mobile browser's tint is the paper the site renders",
          homeHtml2.includes('name="theme-color" content="#ffffff"'),
          "no theme-color — the browser bar stays grey over the site's own paper");
        // The home-screen icon: this build drew initials, so the link must be
        // there AND point at a file this build published (the rtl icon check's
        // own rule — a head pointing at a 404 is worse than no link).
        const touchLink = (homeHtml2.match(/<link[^>]*rel="apple-touch-icon"[^>]*>/) || [""])[0];
        const touchHref = ((touchLink.match(/href="([^"]+)"/) || [])[1] || "").replace(/^\.?\//, "");
        ok("the home-screen icon is linked, at a file this build published",
          !!touchHref && !!wpack.files[touchHref], touchLink || "no apple-touch-icon link in the head");
        // THE DIMENSIONS ARE THE CARD'S ALONE. This sidecar's image is an owner
        // upload, so no size may be claimed — some unfurlers crop to the
        // declared box — while the alt still rides.
        ok("an owner upload's og:image claims no dimensions",
          !homeHtml2.includes("og:image:width") && !homeHtml2.includes("og:image:height"),
          "dimensions were claimed for an image whose size nobody knows");
        ok("…but still carries an alt", homeHtml2.includes('property="og:image:alt" content="Fold Coffee"'),
          "no og:image:alt — a screen reader gets nothing for the card");
        // …and the composed card's ARE claimed: same script, a sidecar whose
        // image is the card, so the gate is proved in both directions. A FRESH
        // IMPORT, because the entry reads the sidecar ONCE PER ISOLATE by
        // design (`loaded` in server.ts — one dispatch script serves one site),
        // so the instance above has already cached the upload-shaped meta; the
        // query string is Node's fresh-isolate equivalent.
        // `pageUrl`, not `META.origin + "..."` — the origin ends in a slash, so
        // gluing a path onto it builds the very double-slash address this leg
        // was extended to catch. The card is a real published file at the site
        // root, so its URL is composed exactly the way a page's is.
        const cardSide = { ...objs, "sitemeta/fold-coffee.json": JSON.stringify({ ...META, image: pageUrl("/card.png") }) };
        const site2 = (await import("file://" + bundleFile + "?cardmeta")).default;
        const cardDoc = await (await site2.fetch(new Request("https://fold-coffee.gofarther.app/"), { SITES: bucketOf(cardSide) }, { waitUntil() {} })).text();
        ok("the composed card's og:image claims its pinned size",
          cardDoc.includes('property="og:image:width" content="1200"')
            && cardDoc.includes('property="og:image:height" content="630"'),
          "the card's dimensions never reached the head — the first share reflows instead of rendering instantly");
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
    // …and that build sent NO `favicon`, so the initials above are ALSO the
    // fallback leg of the designer-drawn mark (2026-08-28): `cleanFavicon` of
    // an absent answer refuses, the `||` falls through, and the report says so.
    ok("a build with no designed mark reports none", (built.brand || {}).favicon === false,
      JSON.stringify((built.brand || {}).favicon));

    // ── the composed share card (2026-08-28) ────────────────────────────────
    //
    // Only a real build can prove the compose: the unit suite reads the source
    // and cannot see whether a browser really rasterised anything. The PNG's
    // own header is the assertion — a file of the wrong size, or one that is
    // not a PNG at all, is a card no unfurler will show.
    const cardB64 = ((built.files || {})["card.png"] || {}).b || "";
    ok("every build composes a share card into its dist", !!cardB64,
      "no card.png in the dist — the compose step did not run or did not land");
    if (cardB64) {
      const png = Buffer.from(cardB64, "base64");
      ok("…and it is a real PNG", png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        png.subarray(0, 8).toString("hex"));
      ok("…at the exact size every unfurler wants", png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630,
        png.readUInt32BE(16) + "x" + png.readUInt32BE(20));
      ok("…and big enough to be a rendered card rather than a blank", png.length > 5000, png.length + " bytes");
    }
    ok("the response says the card was made", built.card === true, JSON.stringify(built.card));

    // ── the home-screen icon, rasterised from the tab's own mark (2026-08-28) ─
    //
    // Same argument as the card one block up: only a real build can prove a
    // browser rasterised anything, and the PNG's own header is the assertion.
    // This build drew initials, which is exactly the case the rasterise exists
    // for — an SVG mark iOS cannot read, made into the PNG it can.
    const touchB64 = ((built.files || {})["apple-touch-icon.png"] || {}).b || "";
    ok("a build with a local mark rasterises a home-screen icon into its dist", !!touchB64,
      "no apple-touch-icon.png in the dist — the baked link 404s on every page");
    if (touchB64) {
      const tpng = Buffer.from(touchB64, "base64");
      ok("…and it is a real PNG at the touch size",
        tpng.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          && tpng.readUInt32BE(16) === 180 && tpng.readUInt32BE(20) === 180,
        tpng.subarray(0, 8).toString("hex") + " " + tpng.readUInt32BE(16) + "x" + tpng.readUInt32BE(20));
      // A size floor, the card's rule: an all-white square (the mark lost, the
      // paper alone) compresses to almost nothing.
      ok("…and big enough to carry the mark rather than bare paper", tpng.length > 800, tpng.length + " bytes");
    }
    ok("the response says the touch icon was made", built.touchIcon === true, JSON.stringify(built.touchIcon));
    ok("…and the brand report carries the decision the link was baked from", (built.brand || {}).touch === true,
      JSON.stringify((built.brand || {}).touch));

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

  // ── the designer-drawn mark, through the real container (2026-08-28) ─────
  //
  // The unit suite proves `cleanFavicon` and the merge; what it structurally
  // cannot prove is that the container WRITES the model's mark — the wiring
  // layer twelve features have died in. One build, a distinctive mark: the
  // bytes in `icon.svg` must be the CLEANED document (our root — a model that
  // omits `xmlns` has drawn a file that renders as nothing — and the model's
  // own shapes verbatim), and the report must say the designer drew it. The
  // fallback leg needs no second build: the FC initials above are a build with
  // no `favicon` at all, and a refused one takes the same `||` fallthrough.
  console.log("\nbuilding a site whose designer drew the mark…");
  const DRAWN = '<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b3d2e"/>' +
    '<path d="M18 40 L32 16 L46 40 Z" fill="#f2e9d8"/></svg>';
  const DRAWN_WM = '<svg viewBox="0 0 240 64"><rect width="240" height="64" rx="8" fill="#0b3d2e"/>' +
    '<path d="M20 44 V20 h8 l10 16 10-16 h8 v24 h-7 V33 l-8 12 h-6 l-8-12 v11 z" fill="#f2e9d8"/></svg>';
  const withMark = await post({
    files: { "index.tsx": MENU.replace('createFileRoute("/menu")', 'createFileRoute("/")').replace("function Menu", "function Home").replace("component: Menu", "component: Home") },
    slug: "favicon-site", title: "Poulson's", favicon: DRAWN, wordmark: DRAWN_WM,
  });
  ok("a site with a designed mark builds", withMark.ok === true, withMark.stage + ": " + withMark.error);
  {
    const m = ((withMark.files || {})["icon.svg"] || {}).t || "";
    ok("the designer's mark is what the site ships", m.includes('d="M18 40 L32 16 L46 40 Z"'), m.slice(0, 200));
    ok("…under OUR root: the namespace and size a bare model answer omits",
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="64" height="64" viewBox="0 0 64 64">/.test(m),
      m.slice(0, 120));
    ok("…and not the initials the same title would have drawn", !/>P</.test(m), m.slice(0, 200));
    ok("the report says the designer drew it", (withMark.brand || {}).favicon === true,
      JSON.stringify((withMark.brand || {}).favicon));
    // …and the WORDMARK, its sibling (same owner's call): the drawn logo lands
    // as its own file at its own aspect — the header constrains by height, so
    // the intrinsic 240×64 is what makes `w-auto` lay it out wide — and the
    // bundle's SITE_LOGO points at it.
    const wm = ((withMark.files || {})["logo.svg"] || {}).t || "";
    ok("the designer's wordmark is what the header gets", wm.includes('d="M20 44 V20'), wm.slice(0, 160));
    ok("…at the drawing's own aspect, under OUR root",
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="240" height="64" viewBox="0 0 240 64">/.test(wm),
      wm.slice(0, 120));
    ok("the report says the wordmark was drawn", (withMark.brand || {}).wordmark === true,
      JSON.stringify((withMark.brand || {}).wordmark));
    // NO bundle assertion here, on purpose: this fixture renders no
    // `SiteChrome`, so Vite tree-shakes `site-brand.ts` and `/logo.svg` is
    // correctly absent from the JS — the logo comment further up records the
    // same wrong draft twice for the `logo` field. The proof that the header
    // GETS the drawn wordmark is a render, on the chrome-using build below.

    // A build that DREW a wordmark takes the drawn-mark path through the card
    // compose — presence is what a harness can honestly assert (which artwork
    // is in the pixels is not readable from bytes).
    ok("a wordmark build composes its card too", !!(((withMark.files || {})["card.png"] || {}).b),
      "the drawn-wordmark path through the compose did not land a card");
  }

  // ── A TYPE ERROR SHIPS NOW (2026-08-30, owner) ─────────────────────────────
  //
  // Owner: "I want it to ship as it is, dont matter if its anything broken, even
  // after is reviewed by the compiler" — the standing rule applied to the last
  // gate still enforcing the opposite.
  //
  // THE FACT THAT MAKES IT SAFE, measured rather than assumed: `tsc --noEmit` is
  // a gate WE impose. Vite strips types with esbuild and never checks them, so a
  // tree tsc refuses still bundles. Proved on the exact page that killed runs 84
  // and 85 — tsc exit 2 (TS2322), vite exit 0, 2186 modules, 6.95s.
  //
  // FOUR PAID BUILDS DIED HERE IN ONE DAY (runs 80, 82, 84, 85), every one a
  // TYPE error, every one leaving a charged customer on a placeholder. This case
  // is the one that would have caught that, and it was asserting the behaviour
  // that caused it.
  console.log("\nbuilding a page with a type error…");
  const broken = await post({ files: { "index.tsx": BROKEN }, slug: "fold-coffee" });
  ok("A TYPE ERROR NO LONGER STOPS THE SITE — it builds and ships", broken.ok === true,
    "stage=" + broken.stage + " error=" + String(broken.error || "").slice(0, 300));
  // AND IT IS NOT SWALLOWED, which is the other half and the one a wiring trap
  // eats: the site shipping while nobody is told it is shaky is not the outcome
  // asked for.
  ok("…and the typecheck's verdict rides out on the response",
    /is not assignable to type 'number'/.test(broken.typeErrors || ""),
    (broken.typeErrors || "(no typeErrors field)").slice(0, 300));
  ok("…and the build really produced a bundle rather than an empty pass",
    Object.keys(broken.files || {}).some((n) => n.endsWith(".js")),
    Object.keys(broken.files || {}).slice(0, 6).join(", ") || "(no files)");

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
  // TYPE ERRORS STOPPED FAILING THE BUILD (2026-08-30) — they ride out on
  // `typeErrors` beside `ok: true`. The property here is UNCHANGED and still
  // worth asserting: this code does not typecheck, and the compiler names the
  // right thing. Only the field it is read from moved. Re-anchored rather than
  // deleted, because "the build failed" was the INSTRUMENT, never the point.
  ok("a type error inside an EXCLUDED but imported file is still REPORTED",
    !!importsExcluded.typeErrors, JSON.stringify(importsExcluded).slice(0, 200));
  ok("and it is blamed on the excluded file, not the page",
    /chart-bar-label/.test(importsExcluded.typeErrors || ""), (importsExcluded.typeErrors || "").slice(0, 300));

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
    // THE STRIP IS GONE (2026-08-22) AND WHAT THIS CHECKS IS ITS REPLACEMENT.
    //
    // `stripThemeRadius` dropped every `border-radius` a theme emitted whenever
    // a customer named a radius, then `explicitRadiusCss` put `buttons` and
    // `inputs` back. Its whole case was the 500-theme REGISTRY, deleted
    // 2026-08-20 — a seeds-only theme emits ZERO corner rules of its own, so
    // the only ones left were the ones the AXES wrote, i.e. the customer's own
    // explicit answer, which it was deleting to make room for the customer's
    // own token.
    //
    // AND IT HAD BECOME A LIVE BUG once every axis became authorable: the
    // re-emit list was `["buttons","inputs"]`, so an AUTHORED `corner` beside a
    // radius token was stripped and never restored.
    //
    // What decides it now is the cascade, and only a real build can show that:
    // the axis rules are UNLAYERED and Tailwind's `--radius` derivations are
    // utilities in `@layer utilities`, so BOTH have to be in the sheet and the
    // axis has to win where it applies. A unit test reads the string a module
    // returns; it cannot see what Lightning CSS and the layer order did with it.
    const count = (t) => (t.match(/border-radius\s*:/g) || []).length;
    ok("the customer's own corner axis is in the sheet beside the radius",
      count(css) > 0,
      `no corner rule at all survived — ${count(css)} in the bundle`);
  }

  // The other half, and the one that protects every site already published:
  // with no radius asked for, the theme keeps its corners exactly as today.
  ok("a colour-only change leaves the theme's corners alone",
    /border-radius/.test(baseCss), "the theme's corner rules vanished on a build that never asked");

  // NO CUSTOM PROPERTY MAY HOLD THE WORD `undefined`, and this is the check that
  // was missing rather than the radius one.
  //
  // `cornerCss` emitted `:root { --radius: ${theme.radius} }` and a seeds theme
  // has no radius, so every site built between 2026-08-20 and 2026-08-21 shipped
  // `--radius: undefined`. It is a VALID declaration — a custom property accepts
  // any token sequence — so nothing errored anywhere: it typechecked, it bundled,
  // it published, and 3580 unit tests were green. It failed at SUBSTITUTION,
  // where every derived step is `calc(var(--radius) ± Npx)`, and the measured
  // result in a real browser was `border-radius: 0px` on every button and every
  // card of every site, whatever the corner axis said.
  //
  // Asserted over the whole compiled bundle rather than on `--radius`, because
  // the interesting class is "a theme property the seeds change stopped
  // supplying" and there is no reason the next one would be this token.
  {
    const bad = [...baseCss.matchAll(/(--[\w-]+)\s*:\s*([^;}]*\b(?:undefined|NaN|\[object Object\])[^;}]*)/g)]
      .map((m) => m[1] + ": " + m[2].trim());
    ok("no custom property in the bundle holds `undefined`", bad.length === 0,
      bad.slice(0, 6).join(" · ") || "none");
  }

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

  // AN AUTHORED VALUE ON A WORLD AXIS — the model writing its own CSS instead of
  // naming one of the six options (owner's call, 2026-08-22). Only a real build
  // can prove this: a CSS change is invisible to `tsc`, to vite, to the lint and
  // to every unit test — the grey-charts lesson — and the whole path was cut in
  // THREE places when it was written, each of them a hop a module test at either
  // end cannot see.
  console.log("\nbuilding with an AUTHORED backdrop…");
  // THE `var()` IS `--muted`, NOT `--primary`, AND THAT IS A MEASUREMENT.
  // `broadsheet`'s brand colour is oklch L 0.30 — near-black — and
  // `worldWorstGround` takes the DARKEST stop wherever it sits, so any wash
  // containing it drops the quiet ink to 4.1:1 and the legibility gate refuses
  // the whole thing. Measured; the first draft of this fixture did exactly that
  // and the run reported the wash missing from the stylesheet, which is the gate
  // working rather than the path being broken. A light palette token proves the
  // same two things — that a token resolves, and that the literal is what ships
  // — without fighting a floor this theme cannot clear.
  // THE DARK HALF LEADS WITH A HEX FOR THE SAME REASON THE LIGHT ONE DOES, and
  // the two runs it took to learn that are the point. It was two `oklch()`
  // stops, and Lightning CSS DOWNLEVELS a colour it thinks the build's targets
  // cannot take: measured through the real compiler, `oklch(0.26 0.05 62)`
  // becomes a `#351e07` fallback plus `lab(13.9817% 9.90278 17.9453)` in a
  // second declaration, and the string `oklch` is nowhere in the rule. So an
  // assertion pinned to `oklch(…)` describes a stylesheet this build never
  // produces — the `41.17%`-for-`0.4117` class, FOURTH instance in this repo,
  // and the SECOND in this one check, whose neighbour four lines up already
  // says to assert a stop the compiler has no other form for.
  //
  // A hex with no shorter form is that stop: driven both ways, `#2b1a07`
  // survives byte-for-byte with modern targets AND with downlevelled ones, in
  // the fallback declaration and the modern one alike. The oklch stop STAYS
  // beside it, so the parser is still exercised end to end on a colour
  // notation a model would really write — it just is not what the value is
  // recognised by.
  const OWN_WASH = {
    light: ["linear-gradient(155deg, #f4dfc6 0%, var(--muted) 45%, #ffffff 100%)"],
    dark: ["linear-gradient(155deg, #2b1a07 0%, oklch(0.14 0.02 62) 100%)"],
  };
  const own = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    style: { ...HOUSE_STYLE, backdrop: OWN_WASH },
  });
  ok("a build carrying an authored backdrop succeeds", own.ok === true, JSON.stringify(own).slice(0, 200));
  {
    const css = Object.entries(own.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // THE LITERAL THE MODEL WROTE, in the mode it wrote it for. Lightning CSS
    // may rewrite `#ffffff` and the whitespace, so the stop that is asserted is
    // one it has no shorter form for.
    ok("…and the light wash the model wrote is in the stylesheet",
      /#f4dfc6/i.test(css), css.slice(0, 300));
    // THE DARK STOP IS ASSERTED ON WHAT SURVIVES NORMALISATION, NOT ON ITS
    // SPELLING — and it took two runs and two wrong answers to land on one.
    // The first pinned `oklch(0.26 0.05 62)`; Lightning CSS emits `oklch(26%
    // .05 62)`, the lightness becoming a percentage. The second allowed both of
    // those and still failed, because with this build's targets the compiler
    // does not emit `oklch` here AT ALL — see the fixture's own note above. A
    // hex with no shorter form is the one thing measured to survive every path.
    const darkStop = /#2b1a07\b/i;
    // AND IT MUST BE IN A `.dark` RULE, or "the value is somewhere in the file"
    // passes on a build that wrote the dark wash into `body` and left `.dark
    // body` carrying the light one — which is the failure this check exists for.
    //
    // SCOPED TO THE RULE THAT CARRIES THE STOP, not to "any .dark rule with a
    // background-image". `worldCss` emits two others that would satisfy the
    // looser form on essentially every build — the surface gloss (`.dark
    // [data-slot=card]…{ background-image: linear-gradient(165deg, oklch(1 0 0
    // / .1) …) }`) and `.dark body::after` — so the condition would have been
    // nearly vacuous. Caught by reading what the emitter really writes, which is
    // the same discipline that was missing from the assertion above it.
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const carrying = rules.filter((r) => darkStop.test(r[2].replace(/\s+/g, " ")));
    ok("…and the dark one, which is a SEPARATE authored value",
      carrying.length > 0 && carrying.some((r) => r[1].includes(".dark")),
      // THE DETAIL PRINTS THE RULE THIS CHECK IS ABOUT, and its second draft is
      // why. It listed the oklch stops present anywhere in the file — which on
      // any build is Tailwind's own palette, in source order, so the first eight
      // are the same eight whatever happened here. It said "the value is not in
      // the file" and left the two causes that need OPPOSITE fixes looking
      // identical: the dark half never reached the stylesheet, or it reached it
      // in a form this assertion does not recognise. The rule itself separates
      // them in one line.
      (carrying.length
        ? "found in: " + carrying.map((r) => r[1].trim()).join(" | ")
        : "the authored dark stop is in NO rule. " + (() => {
            // `r[1]` IS `([^{}]+)`, so it cannot hold a brace — the first draft
            // took `.split("}").pop()` off it, which could never do anything,
            // and the literal `"}"` drove the block-scope scanner's brace count
            // negative and made it report a ReferenceError on the next line
            // that is not there. Fixed by dropping the redundant step rather
            // than by hiding the character: the scan is deliberately not a
            // parser, and a false alarm on correct code is what this repo rates
            // worse than the miss.
            const dark = rules.filter((r) => /(^|[,\s])\.dark\s+body\s*$/.test(r[1].trim()));
            return dark.length
              ? "`.dark body` IS in the sheet, carrying: " + dark.map((r) => r[2]).join(" || ")
              : "and there is no `.dark body` rule at all — the dark half never reached the stylesheet";
          })()).slice(0, 500));
    // `var(--primary)` IS RESOLVED, NOT PASSED THROUGH, and that is the whole
    // reason the parser exists: an unresolved token is a stop whose colour we
    // cannot read, so the contrast floor it was measured against is unprovable.
    // The site's own brand colour is what has to be there.
    // SCOPED TO THE AUTHORED LAYER, never every `background-image` in the sheet.
    // Tailwind emits `.bg-gradient-to-r{background-image:linear-gradient(var(
    // --tw-gradient-stops))}` and friends, so a whole-file scan for `var(` is
    // satisfied by utilities that have nothing to do with this and reports a
    // failure that is not there.
    // NOT `own` — THAT NAME IS THE BUILD RESPONSE, DECLARED OUTSIDE THIS BLOCK.
    //
    // A second `const own` here shadows it for the WHOLE block, so `own.files`
    // eleven lines up becomes a read of THIS binding in its temporal dead zone:
    // `ReferenceError: Cannot access 'own' before initialization`, on every run.
    // `node --check` passes it and no unit test can see it — the `vidRefN` class,
    // seventh recorded instance, and it took a real CI run to find.
    const ownLayer = (css.match(/background-image:[^;}]*f4dfc6[^;}]*/g) || []).join("\n");
    ok("…and a var() in it resolved to this site's own palette, never shipped as a var()",
      ownLayer.length > 0 && !/var\(/.test(ownLayer),
      ownLayer.slice(0, 300) || "the authored layer is not in the stylesheet at all");
    // …AND THE GATE REALLY RUNS HERE. A wash whose darkest stop leaves no room
    // for legible quiet text must be refused BY THE CONTAINER and said so in
    // the notes it already carries back — without this the three checks above
    // pass equally well on a build that simply accepts everything.
    const bad = await post({
      files: { "index.tsx": INDEX, "menu.tsx": MENU },
      slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
      style: { ...HOUSE_STYLE, backdrop: { light: OWN_WASH.light.map((l) => l.replace("var(--muted)", "var(--primary)")), dark: OWN_WASH.dark } },
    });
    const badCss = Object.entries(bad.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    ok("an illegible wash is refused rather than published", !/f4dfc6/i.test(badCss), badCss.slice(0, 200));
    ok("…and the container says so, with the ratio, in the notes it carries back",
      JSON.stringify(bad.theme || bad.notes || {}).includes("4.5") ||
      JSON.stringify(bad).includes("under the 4.5 it needs"),
      JSON.stringify({ theme: bad.theme, notes: bad.notes }).slice(0, 300));
    // THE CONTROL, and the first draft of it was `x === x` — a check that cannot
    // fail, which this repo rates worse than none because it is the one that
    // says a broken thing works. What discriminates is that the SAME template
    // built WITHOUT the authored patch does not carry the model's own colour, so
    // nothing but the authored path can have put it there.
    ok("…and the control build, which authored nothing, does not carry it",
      !/#f4dfc6/i.test(baseCss), "the literal is in a build that never asked for it");
  }

  // THE INTERACTIVE AXES, through a real Tailwind build. Everything else the
  // theme emits is a value; these are RULES with pseudo-classes, an @supports
  // and two @media blocks, and a minifier is entitled to rewrite all of it —
  // so what the module returns is a different claim from what a browser gets.
  console.log("\nbuilding with the interactive axes…");
  const reactive = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    style: { ...HOUSE_STYLE, motion: "brisk", hover: "lift", focus: "bold", reveal: "rise", transition: "rise" },
  });
  ok("a build carrying the interactive axes succeeds", reactive.ok === true,
    JSON.stringify(reactive).slice(0, 200));
  {
    const css = Object.entries(reactive.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // THE VALUE, NOT THE SPELLING. This was `/--site-duration:\s*120ms/` and
    // went red against a perfectly correct build: Lightning CSS normalises
    // `120ms` to `.12s`, so a check pinned to the source form describes a
    // stylesheet that is never produced. The same class as `41.17%` for
    // `0.4117` one feature over — read the number and compare it.
    const dur = /--site-duration:\s*([\d.]+)(ms|s)/.exec(css);
    ok("the transition survived the build",
      !!dur && Math.round(+dur[1] * (dur[2] === "s" ? 1000 : 1)) === 120,
      dur ? dur[0] : "no --site-duration in the bundle at all");
    ok("…and the hover rule is inside the touch guard",
      /@media\s*\(hover:\s*hover\)/.test(css) && /:hover/.test(css), css.slice(0, 200));
    ok("…and the focus ring is on :focus-visible", /:focus-visible/.test(css), css.slice(0, 200));
    ok("…and the reveal is behind @supports", /@supports[^{]*animation-timeline/.test(css), css.slice(0, 200));
    // THE ONE THAT MATTERS. A minifier may merge selector lists, so this is
    // asserted on the COMPILED output rather than only on the module's: a bare
    // member in a :hover list matches ALWAYS, which is every button on the site
    // permanently raised. It shipped that way for one draft.
    //
    // A FLAT `split(",")` IS WRONG HERE AND IT FALSE-ALARMED ON THE FIRST RUN,
    // which is the fourth time this repo has written one where a depth-aware
    // splitter was needed. Tailwind emits arbitrary variants as escaped class
    // names — `.has-\[\>a\,button\]\:x:hover` carries a `\,` INSIDE the
    // selector — so a naive split cut it into `.has-\[\>a\` and reported two
    // perfectly correct kit rules as bare. A check that cries wolf on correct
    // code is worse than the miss it prevents.
    const splitSel = (sel) => {
      const out = [];
      let cur = "", depth = 0, quote = "";
      for (let i = 0; i < sel.length; i++) {
        const c = sel[i];
        if (c === "\\") { cur += c + (sel[i + 1] || ""); i++; continue; }
        if (quote) { cur += c; if (c === quote) quote = ""; continue; }
        if (c === '"' || c === "'") { quote = c; cur += c; continue; }
        if (c === "[" || c === "(") depth++;
        else if (c === "]" || c === ")") depth = Math.max(0, depth - 1);
        else if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
        cur += c;
      }
      out.push(cur);
      return out;
    };
    const bare = [];
    for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      const sel = m[1].trim();
      if (!/:hover|:focus-visible/.test(sel) || sel.startsWith("@")) continue;
      for (const part of splitSel(sel)) if (!/:hover|:focus-visible/.test(part)) bare.push(part.trim());
    }
    ok("…and no selector in a hover or focus rule matches without the pseudo",
      bare.length === 0, "these match always: " + bare.slice(0, 4).join(" | "));
    // THE PAGE TRANSITION, and it is checked HERE rather than only in the unit
    // suite because the minifier is the layer that decides whether it survives:
    // `::view-transition-*` is a pseudo-element neither the kit nor Tailwind
    // ever emits, so it is exactly the shape a stylesheet compiler could drop
    // or rewrite without anything else in the build noticing.
    ok("the page transition survived the build", /::view-transition-new\(root\)/.test(css),
      "no view-transition rule in the compiled bundle");
    // AND ITS REDUCED-MOTION ANSWER SUPPRESSES rather than omits — the polarity
    // that is the opposite of every other interactive axis. Dropping our rule
    // there leaves the BROWSER'S own cross-fade standing, so a visitor who
    // asked for less motion would get more of it than one who did not.
    //
    // READ OUT OF THE BLOCK, NOT MATCHED AS A LINE. Lightning CSS SPLITS a
    // selector list into one rule per selector — measured — so a pattern
    // written against the source's `old(root), new(root) { … }` describes a
    // stylesheet that is never produced. What has to hold is that BOTH pseudos
    // are switched off inside that block, however it chose to write them.
    //
    // AND IT IS NOT THE FIRST SUCH BLOCK. Tailwind emits its own
    // `motion-reduce:*` utilities under exactly this at-rule, on EVERY build
    // including one with no transition axis at all — measured, 203 characters
    // of it — so a check that takes the first match reads a block that has
    // nothing to do with this feature and reports the same verdict either way.
    // The block wanted is the one that mentions the pseudo-elements.
    let rmBlock = "", rmAt = -1;
    for (const m of css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)) {
      let d = 0, i = css.indexOf("{", m.index);
      for (let j = i; j < css.length; j++) {
        if (css[j] === "{") d++;
        else if (css[j] === "}" && --d === 0) {
          const b = css.slice(i, j);
          if (b.includes("view-transition")) { rmBlock = b; rmAt = m.index; }
          break;
        }
      }
      if (rmBlock) break;
    }
    const offIn = (pseudo) => new RegExp(`::view-transition-${pseudo}\\(root\\)[^{}]*\\{[^{}]*animation:\\s*none`).test(rmBlock);
    ok("…and reduced motion suppresses it, rather than leaving the browser's own",
      !!rmBlock && offIn("old") && offIn("new"),
      rmAt < 0 ? "no reduced-motion block at all" : "the block does not switch both pseudos off: " + rmBlock.slice(0, 200));
    // AND THE ROUTER'S HALF, which no amount of CSS can substitute for: without
    // the flag there is no transition to animate and the whole axis is a rule
    // nothing ever triggers.
    //
    // AGAINST A CONTROL, because `startViewTransition` is in the ROUTER LIBRARY
    // on every build ever made — a bare grep for it is satisfied by a site with
    // the axis switched off, which is the vacuous-assertion shape this repo has
    // shipped more than once. `rounder` above carries no transition axis, so
    // the two bundles differing IS the flag.
    //
    // AND IT IS A MINIFIED VARIABLE, NOT A LITERAL — measured: the bundle says
    // `defaultViewTransition:IE` and elsewhere `IE=!0`, with the SAME name on
    // both builds, so comparing the two references would report a site that
    // asked and a site that did not as identical. Resolved to its definition,
    // which is the only reading that can tell them apart.
    const flagIn = (r) => {
      const js = Object.entries(r.files || {})
        .filter(([k]) => k.endsWith(".js")).map(([, v]) => v.t || "").join("\n");
      const m = /defaultViewTransition:\s*([^,}\s]+)/.exec(js);
      if (!m) return null;
      if (!/^[A-Za-z_$][\w$]*$/.test(m[1])) return m[1];
      const id = m[1].replace(/\$/g, "\\$");
      const def = new RegExp(`(?:^|[^.\\w$])${id}\\s*=\\s*([^,;)\\s]+)`).exec(js);
      return def ? def[1] : m[1];
    };
    const onFlag = flagIn(reactive), offFlag = flagIn(rounder);
    ok("…and the router was told to start one", /^(!0|true)$/.test(String(onFlag)),
      "the compiled bundle asks for a view transition as " + onFlag);
    ok("…and a site that did NOT ask for one still does not", /^(!1|false)$/.test(String(offFlag)),
      "a site with no transition axis carries " + offFlag);
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
  // ── THE MODEL'S OWN CSS, THROUGH A REAL TAILWIND BUILD ────────────────────
  //
  // The enums left `design_schema` on 2026-08-22 (owner's call: "no names, i
  // just want the model to write its own css"), and the unit suite can only
  // read the string a module RETURNS. Whether that string survives Lightning
  // CSS is a different claim, and this feature is exactly the shape that gets
  // rewritten: arbitrary declarations from outside the kit, inside guards the
  // compiler is entitled to reorder, normalise or merge.
  //
  // THREE SHAPES IN ONE BUILD, because they fail differently. A DECLARATION
  // BLOCK could lose its guard; a RAMP is a number interpolated into a token
  // and could land with the wrong unit; a REFUSED block must leave the axis's
  // own default standing rather than nothing at all — that last one is the
  // difference between a site that ignored one instruction and a site with no
  // hover state, no focus ring and square corners.
  console.log("\nbuilding with the model's own CSS on every shape…");
  const authoredBuild = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    style: {
      ...HOUSE_STYLE,
      // A declaration block, on the axis whose guard matters most.
      hover: "transform: translateY(-7px); box-shadow: 0 14px 30px -16px oklch(0 0 0 / 0.34)",
      focus: "outline-width: 5px; outline-style: dashed",
      // A ramp, on the two whose units differ from each other.
      icon: { width: 2.85 },
      motion: { ms: 417, ease: "ease-in-out" },
      // AND ONE THE ENGINE MUST REFUSE, in the same build: `display` is not a
      // property `hover` owns, and a page whose cards vanish is not a look.
      skin: "display: none",
    },
  });
  ok("a build carrying the model's own CSS succeeds", authoredBuild.ok === true, JSON.stringify(authoredBuild).slice(0, 200));
  {
    const css = Object.entries(authoredBuild.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // THE DECLARATION, AND ITS GUARD. Either alone proves nothing: the rule
    // without the media query is every button on the site stuck raised after a
    // tap on a phone, and the media query without the rule is an empty block.
    // A BRACE SCAN, NOT A NEWLINE. The first draft ended the block at `\n}` and
    // reported "there is no @media (hover: hover) block" on a build that has
    // one — Lightning CSS emits it minified, so there is no newline before the
    // close. The `41.17%`-for-`0.4117` class again: a pattern written against
    // the SOURCE's formatting describes a stylesheet that is never produced.
    const blockAfter = (text, at) => {
      const open = text.indexOf("{", at);
      if (open < 0) return "";
      let d = 0;
      for (let i = open; i < text.length; i++) {
        if (text[i] === "{") d++;
        else if (text[i] === "}") { d--; if (!d) return text.slice(open + 1, i); }
      }
      return "";
    };
    // EVERY `@media (hover: hover)` BLOCK, NEVER THE FIRST ONE — and its first
    // run is why. Tailwind emits its own for the `group-hover:*` utilities, so
    // `css.search(...)` found `.group-hover\:pointer-events-auto{…}` and
    // reported the authored rule missing from a stylesheet that carries it.
    // That is the trap this repo already recorded on the transition axis, where
    // `@media (prefers-reduced-motion: reduce)` appears on every build for the
    // same reason: **a guard the framework also uses cannot be located by
    // taking the first match.**
    const guards = [];
    for (const m of css.matchAll(/@media\s*\(hover:\s*hover\)/g)) guards.push(blockAfter(css, m.index));
    ok("an authored hover block reached the compiled stylesheet",
      /translateY\(-7px\)/.test(css), css.length ? "no translateY(-7px) in " + css.length + " chars" : "no css at all");
    ok("…and it is still inside the touch guard",
      guards.some((b) => /translateY\(-7px\)/.test(b)),
      guards.length
        ? guards.length + " hover guards, none carrying it: "
          + guards.map((b) => b.slice(0, 60)).join(" || ").slice(0, 300)
        : "there is no @media (hover: hover) block at all");
    ok("…and the authored focus ring is still on :focus-visible",
      new RegExp(":focus-visible[^{}]*\\{[^{}]*(outline-width:\\s*5px|outline:[^;}]*5px)").test(css)
        || (/:focus-visible/.test(css) && /outline-width:\s*5px|outline:[^;}]*\b5px/.test(css)),
      "no 5px outline on a :focus-visible rule");
    // THE RAMPS, READ AS NUMBERS. Lightning CSS normalises `417ms` to `.417s`
    // — the `41.17%`-for-`0.4117` class, which this repo has now walked into
    // three times, once in the guard written for it — so the VALUE is compared
    // rather than the spelling.
    ok("an authored icon stroke reached the stylesheet", /stroke-width:\s*2\.85/.test(css),
      (css.match(/stroke-width:[^;}]*/g) || ["none at all"]).slice(0, 3).join(" | "));
    const dur = /--site-duration:\s*([\d.]+)(ms|s)/.exec(css);
    ok("an authored duration reached it, whatever the compiler spelled it",
      !!dur && Math.round(+dur[1] * (dur[2] === "s" ? 1000 : 1)) === 417,
      dur ? dur[0] : "no --site-duration in the bundle");
    // THE REFUSAL, AND THE THING THAT MAKES IT SAFE. `display: none` is not a
    // property `skin` owns, so the block is dropped — and the axis has to fall
    // back to its own default rather than to nothing, or one bad answer costs
    // the whole look.
    // QUOTING-AGNOSTIC, and it had to become so: Lightning CSS UNQUOTES every
    // attribute selector, so `[data-slot="card"]` is a spelling the compiler
    // never emits and this negative assertion could not have fired against any
    // bundle. It passed for as long as it existed. Measured while adding the
    // late surfaces — 94 attribute selectors in one bundle, every one unquoted.
    ok("a refused block does NOT reach the stylesheet",
      !/\[data-slot=["']?card["']?\][^{}]*\{[^{}]*display:\s*none/.test(css),
      "an unowned property was emitted onto the card selector");
    // …and the check can SEE the card selector at all, or the line above is
    // green because it is looking at nothing. A negative assertion has to prove
    // its observer is alive first.
    ok("…and the card hook really is in the bundle for that to mean anything",
      /\[data-slot=["']?card["']?\]/.test(css),
      "no card selector in the stylesheet — the refusal check above is vacuous");
    // AND THE AXES AROUND IT ARE UNTOUCHED, which is the property this layer
    // CAN see. `styleDropped`/`styleNote` are composed in the WORKER — the
    // container is handed a patch and reports `styleUsed`, the enum map — so
    // asserting them here would be testing a layer that never had them, which
    // is the wrong-layer mistake this repo keeps recording. What the container
    // decides is whether one refusal costs the rest of the look, and
    // `site-style.test.mjs` holds the reporting half.
    ok("…and the site's own axes are still standing beside the refusal",
      new RegExp(HOUSE_STYLE.buttons === "sharp" ? "border-radius:\\s*0" : "border-radius").test(css),
      "a refused block took the site's own button shape with it");
    // AND THE REST OF THE BUILD IS UNHARMED, which is the property a refusal
    // must have: the four axes that read clean are all still there.
    ok("…and one refused axis did not cost the four that were fine",
      /translateY\(-7px\)/.test(css) && /stroke-width:\s*2\.85/.test(css) && !!dur,
      "a refusal took working axes down with it");
  }

  // A RADIUS TOKEN AND AN AUTHORED CORNER IN ONE BUILD — the exact combination
  // the deleted strip ate. `corner` is AUTHORED rather than named, because that
  // is what made it reachable: with the enums `corner` emitted no radius rule of
  // its own, so the re-emit list `["buttons","inputs"]` covered everything that
  // could be lost. Measured before the removal: the authored corner's rule went
  // into the sheet, the strip took it out, and nothing put it back.
  console.log("\nbuilding with a radius AND a corner axis…");
  const collide = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    tokens: { radius: "1.5rem" },
    style: { ...HOUSE_STYLE, buttons: "pill", corner: "border-radius: 18px" },
  });
  ok("a build asking for both succeeds", collide.ok === true, JSON.stringify(collide).slice(0, 200));
  {
    const css = Object.entries(collide.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    const rounderCss = Object.entries(rounder.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    const pills = (t) => (t.match(/9999px/g) || []).length;
    ok("the radius still applied", /--radius:\s*1\.5rem/.test(css), css.slice(0, 200));
    ok("AND the customer's own pill is there beside it",
      pills(css) > pills(rounderCss),
      `${pills(css)} with the axis, ${pills(rounderCss)} without`);
    // THE AUTHORED CORNER, which is the half that was silently lost. All three
    // have to be in one stylesheet: the token the kit derives from, the button
    // rule, and the corner rule — nothing arbitrating between them any more.
    ok("…AND the authored corner, which the strip used to eat",
      /border-radius:\s*18px/.test(css),
      "an authored corner beside a radius token is gone from the bundle again");
  }

  // ── THE WHOLE STYLESHEET, WRITTEN BY THE MODEL ────────────────────────────
  //
  // Five look fields became one `css` string on 2026-08-23 (owner's call), and
  // every claim about it is a claim about the COMPILED bundle rather than about
  // a module's return value. This repo has shipped three separate features that
  // were correct in a unit test and dead in the stylesheet — a second `:root`
  // the minifier proved dead, a `.font-heading` selector Tailwind never emitted,
  // and a quoted attribute selector Lightning CSS unquotes — and every one was
  // found by running the real compiler.
  //
  // FOUR CLAIMS, EACH FAILING DIFFERENTLY: the rules land at all; they land
  // LAST, which is the whole compatibility story; a family the sheet names is
  // really bundled, or the site ships in the wrong typeface reporting success;
  // and a page scope survives, which is the only way one page can look
  // different now that `tokensPage` is gone.
  console.log("\nbuilding with the model's own stylesheet…");
  const OWN_SHEET = [
    // `--primary` and `--muted-foreground` are the SAME colour on purpose, and
    // `--primary-foreground` is its opposite — see the blanket link rule at the
    // foot of this sheet for what that pair is for.
    ":root{--background:#0d1117;--foreground:#e8eef5;--font-sans:\"Lora\",Georgia,serif;"
      + "--primary:#e8eef5;--primary-foreground:#0d1117;--muted-foreground:#e8eef5}",
    ".dark{--background:#05070a;--foreground:#f4f8fc}",
    "body{font-family:var(--font-sans);letter-spacing:.011em}",
    // A MARKER THAT ONLY THIS SHEET CAN PRODUCE. The first draft used
    // `text-transform:uppercase` on the reasoning that nothing in the kit emits
    // it on a heading — measured on the control build, and it is there: Tailwind
    // ships an `uppercase` utility and the kit uses it. So the control passed
    // for the wrong reason and the positive check could have too. A custom
    // property with a name nothing else in the world uses cannot be confused
    // with anything, which is what a marker is for.
    "h1,h2,h3{--isibi-own-sheet:1;text-transform:uppercase}",
    'body[data-page="/menu"]{--background:#2b1c0f}',
    // ── THE LIVE BUG, WRITTEN THE WAY FOUR REAL BUILDS WROTE IT ─────────────
    //
    // "links are quiet" is an ordinary opinion and this is an ordinary way to
    // say it. It is also unlayered, and Tailwind's utilities are not — so it
    // beat `.text-primary-foreground` and painted every call to action its own
    // fill. Photographed on runs 34, 47 and 48: `rgb(28,27,25)` on itself.
    //
    // The three tokens above it make the collision DETERMINISTIC rather than
    // dependent on whatever the stored theme derived: the fill and the quiet
    // ink are the same colour, so an unguarded label is exactly 1:1, while
    // every other muted word on the page stays light on a dark ground and
    // produces no collateral finding.
    "a,nav a{color:var(--muted-foreground)}",
    // ── RUN 51'S SHELL RULE, VERBATIM ───────────────────────────────────────
    //
    // The first hooked build aimed a desk grid at `site-chrome` — the shell
    // whose children are header, page and footer STACKED — and grid
    // auto-placement dealt them into columns: brand clipped in a 216px
    // column, footer crushed into the same gutter, measured live on
    // northgroup-15. SHELL_GUARD's doubled selector (0,2,0) outranks this
    // (0,1,0) wherever each lands, so the rule ships and never wins.
    "[data-slot=site-chrome]{display:grid;grid-template-columns:13.5rem 1fr}",
  ].join("\n");
  // THE FIVE PROMISED PACKAGES, compiled by the real container before anything
  // else in this block — see PROMISED_PAGE for the build that paid for it.
  {
    // ITS OWN index.tsx, LINKING NOWHERE. The first cut paired PROMISED_PAGE
    // with the shared `INDEX`, which links to `/menu` — a file this payload does
    // not send — so the generated route union rejected the link and the build
    // failed on ROUTING, saying nothing at all about the five packages. A
    // fixture that fails for a reason other than the one it is testing is worse
    // than no fixture: it reports a red that sends the next reader elsewhere.
    const promised = await post({
      files: {
        "index.tsx": `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ component: H });
function H() { return <main><h1>Promised imports</h1></main>; }
`,
        "promised.tsx": PROMISED_PAGE,
      },
      slug: "promised-imports", ...themeAsSeeds("broadsheet"),
    });
    ok("every package the page rules promise actually compiles", promised.ok === true,
      "stage=" + promised.stage + " error=" + String(promised.error || "").slice(0, 400));
    // AND THE FAILURE IS NAMED WHEN IT COMES. A bare `ok === false` on this
    // build would send the next session hunting through five packages; the
    // typecheck error names the one that broke, so it is surfaced rather than
    // collapsed into "the promised imports failed".
    if (!promised.ok) {
      ok("…and the promised-import failure names which package broke",
        /three|recharts|date-fns|lucide|fiber/.test(String(promised.error || "")),
        String(promised.error || "").slice(0, 400));
    }
  }

  // THE tsx ESCAPE HATCH, THROUGH A REAL BUILD. See PART_SOURCE for why none of
  // this is answerable by reading the modules.
  {
    const parted = await post({
      files: { "index.tsx": PART_USER },
      parts: [{ name: "run-tally", source: PART_SOURCE }],
      slug: "own-parts", ...themeAsSeeds("broadsheet"),
    });
    ok("A COMPONENT THE MODEL WROTE ITSELF COMPILES — `parts` had never been built",
      parted.ok === true,
      "stage=" + parted.stage + " error=" + String(parted.error || "").slice(0, 400));

    if (parted.ok) {
      const names = Object.keys(parted.files || {});
      const js = Object.entries(parted.files || {})
        .filter(([k]) => k.endsWith(".js")).map(([, v]) => v.t || "").join("\n");

      // IT IS REALLY IN THE BUNDLE. The page could have compiled with the import
      // shaken out if the component were unused, which would pass the first
      // assertion while proving nothing about the hatch.
      ok("…and the component's own markup reaches the bundle",
        js.includes("run-tally") || js.includes("Washes this week"),
        names.filter((n) => n.endsWith(".js")).join(", ").slice(0, 160) || "(no js)");

      // AND IT IS NOT A ROUTE. This is what `routeFileIgnorePrefix: "-"` buys,
      // pinned in our vite config rather than inherited — a component published
      // at `/-parts/run-tally` would be a page the customer never asked for, in
      // their nav and their sitemap.
      const asRoute = names.filter((n) => /(^|\/)-?parts\//.test(n) || /run-tally/.test(n));
      ok("…and it is NOT published as a route of its own", asRoute.length === 0,
        asRoute.slice(0, 4).join(", ") || "(none — correct)");

      // NOR IN THE SITEMAP, which is the same mistake one layer out: a component
      // listed there is a URL we are telling crawlers to fetch.
      const sm = Object.entries(parted.files || {})
        .filter(([k]) => k.endsWith("sitemap.xml")).map(([, v]) => v.t || "").join("");
      ok("…nor listed in sitemap.xml", !/run-tally|parts/.test(sm),
        sm.slice(0, 200) || "(no sitemap emitted)");

      // AND THE RENDER CHECK DOES NOT OPEN IT AS A PAGE (task #44, 2026-09-04).
      // `routePaths()` offered every `-parts/` component as a route; the check
      // got the router's 404 and reported a page that threw, on every addon
      // reply on fretwork-1 from run 22 to run 36. Read off the report a real
      // browser produced, because that is the only reader of `routePaths()`.
      const rr = parted.render && Array.isArray(parted.render.findings) ? parted.render.findings : [];
      const asParts = rr.filter((f) => /^\/-parts\//.test(String((f && f.route) || "")));
      ok("…and the render check does not open it as a route", parted.render && parted.render.ok !== false && asParts.length === 0,
        asParts.length ? JSON.stringify(asParts.slice(0, 2)) : ("render ok=" + String(parted.render && parted.render.ok) + " findings=" + rr.length));
    }
  }

  // ── A HYDRATION MISMATCH NAMES ITSELF (task #80, 2026-09-04) ───────────────
  //
  // Runs 34 and 36 reported `/es threw: Minified React error #418` and nothing
  // that said which text. Only a real page in a real browser can prove the
  // whole chain — React reports the mismatch as a page error, the harness keeps
  // the served document, the probe finds the node, the finding carries the two
  // strings — so it is proved here with a page that disagrees with itself on
  // purpose: one sentence on the server, another in the browser.
  {
    const HYDRATE_INDEX = `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ component: Page });
function Page() {
  const side = typeof window === "undefined" ? "written on the server" : "written in the browser";
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">A page that disagrees with itself</h1>
      <p>This sentence was {side}.</p>
      <p>Enough other words follow so that the check reads a real page rather than a blank one, and the only difference between the two renders is the sentence above.</p>
    </main>
  );
}
`;
    const hy = await post({ files: { "index.tsx": HYDRATE_INDEX }, slug: "hydrate-diff", ...themeAsSeeds("broadsheet") });
    ok("A PAGE THAT HYDRATES DIFFERENTLY STILL BUILDS — the mismatch is a finding, never a refusal", hy.ok === true,
      "stage=" + hy.stage + " error=" + String(hy.error || "").slice(0, 300));
    if (hy.ok) {
      const found = hy.render && Array.isArray(hy.render.findings) ? hy.render.findings : [];
      const threw = found.filter((f) => f && f.kind === "threw" && f.route === "/");
      ok("…and the browser reports the mismatch as a thrown error on /", hy.render && hy.render.ok !== false && threw.length > 0,
        "render ok=" + String(hy.render && hy.render.ok) + " findings=" + JSON.stringify(found.slice(0, 3)).slice(0, 400));
      const named = threw.find((f) => /written on the server/.test(String(f.detail)) && /written in the browser/.test(String(f.detail)));
      ok("…and the finding NAMES the two texts, the server's and the browser's", !!named,
        threw.map((f) => f.detail).join(" | ").slice(0, 400) || "(no threw finding on /)");
      ok("…as a hydration mismatch by name, not a React error number and a link", !!threw.find((f) => /hydration mismatch/.test(String(f.detail)) && !/react\.dev/.test(String(f.detail))),
        threw.map((f) => f.detail).join(" | ").slice(0, 300));
    }
  }

  // ── THE LANDMARK MAP, THROUGH A REAL BROWSER (2026-08-31) ─────────────────
  //
  // `landmarkProbe` runs inside the page, so it is one of the few things in this
  // repo the unit suite structurally cannot reach: it needs a DOM, no DOM
  // library is installed, and splitting its logic into testable helpers is
  // impossible because `page.evaluate` SERIALISES the function — it cannot call
  // anything at module scope. Duplicating the logic to test it would be two
  // lists of the same thing, which this repo has paid for more than any other
  // mistake.
  //
  // So it is proved here, where a real Chromium really opens the built site.
  // A mutation sweep found three properties of it completely unguarded — an
  // anchor dressed as a button, selector uniqueness, and invisible elements —
  // and every one of them is a way the map lies to the model that reads it.
  {
    // THE FILE THIS SUITE ALREADY BUILDS EVERYWHERE ELSE. A page written just
    // for this case would be a fixture whose shape the pipeline never produces,
    // and `INDEX` carries buttons, headings and a form — exactly the elements a
    // customer names by sight.
    const lm = await post({ files: { "index.tsx": INDEX }, slug: "landmark-map", ...themeAsSeeds("broadsheet") });
    ok("A SITE BUILDS AND ITS LANDMARKS ARE CAPTURED", lm.ok === true && Array.isArray(lm.render && lm.render.landmarks),
      "stage=" + lm.stage + " error=" + String(lm.error || "").slice(0, 300));
    if (lm.ok && lm.render && Array.isArray(lm.render.landmarks)) {
      const marks = lm.render.landmarks;
      // A FLOOR FIRST. Every assertion below is about what the rows CONTAIN, and
      // `[].every(...)` is `true` — an empty map would pass all of them while
      // proving the opposite. This repo's vacuous-observer trap.
      ok("…and the map is not empty, so the checks below observe something", marks.length > 0,
        "landmarks=" + marks.length);
      ok("…every row carries a selector, which is the only column that must be right",
        marks.length > 0 && marks.every((m) => m && typeof m.selector === "string" && m.selector),
        JSON.stringify(marks.filter((m) => !(m && m.selector)).slice(0, 3)));
      ok("…every row carries a stable name and the route it was found on",
        marks.length > 0 && marks.every((m) => m.name && m.route),
        JSON.stringify(marks.filter((m) => !(m.name && m.route)).slice(0, 3)));
      // NAMES ARE UNIQUE, or two rows describe themselves identically and the
      // model cannot tell which control the customer meant — the exact
      // ambiguity the map exists to remove.
      const names = marks.map((m) => m.name);
      ok("…and no two landmarks share a name", new Set(names).size === names.length,
        names.filter((n, i) => names.indexOf(n) !== i).join(", ") || "-");
      // AND THE ROLE RULE THE OWNER ASKED FOR: an anchor the kit dresses as a
      // button reads as a BUTTON, because that is the word a customer uses.
      // Skipped rather than failed when the fixture has no such control, since a
      // page without one proves nothing either way.
      const dressed = marks.filter((m) => m.tag === "a" && /button|site-link/.test(m.slot || ""));
      if (dressed.length) {
        ok("…and an anchor the kit draws as a button READS as a button",
          dressed.every((m) => m.role === "button"),
          JSON.stringify(dressed.map((m) => [m.name, m.tag, m.slot, m.role]).slice(0, 3)));
      }

      // ── SELECTORS ARE DISTINCT, which is what UNIQUENESS looks like from out
      // here. The probe tests each candidate against the real DOM and demands it
      // match exactly one element; if that check were relaxed to "matches at
      // least one", the two anchors the kit stamps `data-slot="button"` would
      // both be offered as `[data-slot="button"]` — one selector, two rows,
      // pointing at each other. Then "change the header button" moves three
      // controls, which is the failure the map exists to prevent.
      //
      // A sweep found this completely unguarded.
      const sels = marks.map((m) => m.selector);
      ok("…and no two landmarks share a selector, so each really addresses one element",
        new Set(sels).size === sels.length,
        sels.filter((x, i) => sels.indexOf(x) !== i).slice(0, 3).join(" | ") || "-");

      // ── AND NOTHING INVISIBLE IS OFFERED. A control a visitor cannot see is
      // not what "the button in the header" means, and aiming an edit at one
      // spends a credit somewhere nobody will ever look.
      //
      // THE KIT SHIPS THE PERFECT PROBE FOR THIS: `SiteChrome` renders a
      // visually-hidden "Skip to content" link on every page — a real anchor,
      // zero-sized, present in the DOM of every site this platform builds. If
      // the visibility filter stops working it is the first thing through.
      ok("…and the kit's visually-hidden skip link is NOT offered as a landmark",
        !marks.some((m) => /skip to content/i.test(m.text || "")),
        JSON.stringify(marks.filter((m) => /skip to content/i.test(m.text || "")).slice(0, 2)));
    }
  }

  // BOTH MARKS, THROUGH A REAL BUILD. See MARKS_INDEX for why this is not
  // covered by the source-level chain test in test/site-marks.test.mjs.
  {
    // DERIVED FROM THE REAL PRODUCERS, never hand-typed. `qrSvg` is the only
    // thing that draws a QR here and `cleanGif` is the only thing that admits an
    // animated mark, so a fixture written by hand would be a second copy of what
    // their output looks like — and two copies drift in silence. That is this
    // repo's fixture-shape trap, which has already shipped a wrong canonical URL
    // for a day.
    //
    // The container takes the QR as `[{ name, svg, label }]` — which is what the
    // Worker's `qrPayload` hands it after turning the designed list of
    // `{ name, points, label }` into drawings (one `{ svg, label }` before
    // 2026-09-03, which the container still reads as one code named `qr` —
    // the second case below sends exactly that). Sending that shape is what
    // makes this the Worker's real payload rather than a shape only this test
    // produces.
    const { qrSvg } = await import("../../builder/site-qr.mjs");
    const { cleanGif } = await import("../../builder/site-favicon.mjs");
    const drawn = qrSvg("https://ashgrove-1.gofarther.app/c/AG-0161");
    const drawn2 = qrSvg("https://ashgrove-1.gofarther.app/care");
    const mark = cleanGif('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="8" fill="#2b2118"/>' +
      '<g fill="none" stroke="#d8c9a8" stroke-width="4" stroke-linecap="round">' +
      '<path d="M20 44V26h24v18"><animate attributeName="opacity" values="1;0.35;1" dur="2.4s" ' +
      'repeatCount="indefinite"/></path><path d="M20 30h24"/></g></svg>');

    // THE PRODUCERS THEMSELVES FIRST. If either refused, every assertion below
    // would be testing a build that was sent nothing — passing while proving
    // nothing, which is this repo's vacuous-assertion trap.
    ok("the QR producer drew something to send", typeof drawn.svg === "string" && drawn.svg.length > 100,
      "why=" + String(drawn.why || "-"));
    ok("…and a second, different code for the list", typeof drawn2.svg === "string" && drawn2.svg !== drawn.svg,
      "why=" + String(drawn2.why || "-"));
    ok("the animated mark was admitted by the real scanner", typeof mark.svg === "string" && mark.svg.length > 50,
      "why=" + String(mark.why || "-"));

    const marks = await post({
      files: { "index.tsx": MARKS_INDEX },
      slug: "both-marks", ...themeAsSeeds("broadsheet"),
      gif: mark.svg,
      qr: [
        { name: "qr", svg: drawn.svg, label: "Scan for the care guide" },
        { name: "care", svg: drawn2.svg, label: "Scan for the chair's own page" },
      ],
    });
    ok("A SITE CARRYING AN ANIMATED MARK AND TWO QR CODES BUILDS — no list had ever been compiled",
      marks.ok === true,
      "stage=" + marks.stage + " error=" + String(marks.error || "").slice(0, 400));

    if (marks.ok) {
      const names = Object.keys(marks.files || {});
      // THE ARTWORK REACHES THE PUBLISHED OUTPUT. `writeSiteBrand` puts only a
      // PATH in the generated module, so the files have to survive Vite's copy
      // of `public/` and the publish sweep. A build that compiles and ships
      // neither file is a page pointing at two 404s — which looks fine in every
      // log and is broken on the screen.
      ok("…and the animated mark is in the published files",
        names.some((n) => n.endsWith("animated.svg")), names.filter((n) => n.endsWith(".svg")).join(", ") || "(no svg)");
      ok("…and so is the first QR, under the file every older page points at", names.some((n) => n.endsWith("qr.svg")),
        names.filter((n) => n.endsWith(".svg")).join(", ") || "(no svg)");
      ok("…and the second, under its own name", names.some((n) => n.endsWith("qr-care.svg")),
        names.filter((n) => n.endsWith(".svg")).join(", ") || "(no svg)");

      // AND THE PAGE REALLY REFERENCES THEM, which is the half a file listing
      // cannot answer: the two could ship while the page that was supposed to
      // show them compiled its guards away.
      const js = Object.entries(marks.files || {})
        .filter(([k]) => k.endsWith(".js")).map(([, v]) => v.t || "").join("\n");
      ok("…and the built page points at all three paths",
        js.includes("/animated.svg") && js.includes("/qr.svg") && js.includes("/qr-care.svg"),
        "animated=" + js.includes("/animated.svg") + " qr=" + js.includes("/qr.svg") + " care=" + js.includes("/qr-care.svg"));
      ok("…and both QR captions survived as the images' alt text",
        js.includes("Scan for the care guide") && js.includes("Scan for the chair's own page"), "a caption not found in the bundle");
    }

    // THE OLD SINGLE-CODE PAYLOAD, which every Worker before the list sent and
    // which a Worker deployed before the container rolls still sends for the
    // 15–20 minutes the two are apart: read as one code named `qr`, so the
    // page's `SITE_QR` keeps its file and `SITE_QRS.care` is honestly absent.
    const legacy = await post({
      files: { "index.tsx": MARKS_INDEX },
      slug: "one-mark", ...themeAsSeeds("broadsheet"),
      qr: { svg: drawn.svg, label: "Scan for the care guide" },
    });
    ok("a site sent the pre-list single QR still builds", legacy.ok === true,
      "stage=" + legacy.stage + " error=" + String(legacy.error || "").slice(0, 400));
    if (legacy.ok) {
      const names = Object.keys(legacy.files || {});
      const js = Object.entries(legacy.files || {})
        .filter(([k]) => k.endsWith(".js")).map(([, v]) => v.t || "").join("\n");
      ok("…and serves it under the file it always had", names.some((n) => n.endsWith("qr.svg")) && js.includes("/qr.svg"),
        names.filter((n) => n.endsWith(".svg")).join(", ") || "(no svg)");
      ok("…and ships no file for a code it was not sent", !names.some((n) => n.endsWith("qr-care.svg")),
        names.filter((n) => n.endsWith(".svg")).join(", "));
    }
  }

  // A page whose route REQUIRES search params — run 82's killer. See SEARCHY_INDEX.
  {
    const searchy = await post({
      files: { "index.tsx": SEARCHY_INDEX },
      slug: "required-search", ...themeAsSeeds("broadsheet"),
    });
    ok("a page with REQUIRED search params does not break the kit's own links",
      searchy.ok === true,
      "stage=" + searchy.stage + " error=" + String(searchy.error || "").slice(0, 300));
    // NAMED WHEN IT BREAKS. The whole cost of run 82 was that the error pointed
    // at a file nobody had touched, so the useful half is WHICH file failed.
    if (!searchy.ok) {
      ok("…and it says the failure is in a kit file rather than the page",
        /error-page|book\.tsx|src\/lib|src\/components/.test(String(searchy.error || "")),
        String(searchy.error || "").slice(0, 300));
    }
  }

  const sheetBuild = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU, "desk.tsx": CTA_PAGE },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"), style: HOUSE_STYLE,
    // The pair the Worker now derives per payload — `themeFontPair("broadsheet")`.
    fonts: { heading: "noto-serif", body: "source-sans-3" },
    css: OWN_SHEET, cssFonts: ["lora"],
  });
  ok("a build carrying the model's own stylesheet succeeds", sheetBuild.ok === true,
    JSON.stringify(sheetBuild).slice(0, 300));
  {
    const css = Object.entries(sheetBuild.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // 1. THE RULES LAND. `text-transform` is chosen because nothing in the kit,
    //    the theme or Tailwind's own base emits it on a heading, so a match is
    //    the model's sheet and cannot be something else in the bundle.
    ok("the model's own rules reach the compiled stylesheet",
      /--isibi-own-sheet:\s*1/.test(css), css.slice(0, 200));
    // 2. AND THEY LAND LAST, which is what makes this compatible with every site
    //    published before it. Those store `seeds`, `style` and `tokens`, and are
    //    republished through this same container on every cheap edit — so their
    //    writers still run and the model's sheet simply has the last word. The
    //    other order is the whole feature silently doing nothing, which is the
    //    exact failure the per-page font override already shipped once.
    //    THE MODEL'S SHEET DECLARES THREE OF THEM — light, dark and the page
    //    scope — so "ours" is a SET of values rather than one, and the first
    //    draft of this compared one against all three and reported a working
    //    override as broken. What has to hold is that no declaration that is NOT
    //    the model's comes after the model's FIRST one: that is the ordering, and
    //    it is the same assertion whichever of ours happens to be last.
    //    LIGHTNINGCSS MINIFIES A COLOUR (`#ffcc00` ships as `#fc0`), so each is
    //    matched in either spelling — the trap the token check above records.
    const MINE = /^(?:#0d1117|#05070a|#2b1c0f|#0D1117|#05070A|#2B1C0F)$/i;
    const decls = [...css.matchAll(/--background:\s*([^;}]+)/g)]
      .map((m) => ({ at: m.index, v: m[1].trim() }));
    const ours = decls.filter((d) => MINE.test(d.v));
    const theirs = decls.filter((d) => !MINE.test(d.v));
    ok("…and every stored-theme --background comes BEFORE the model's, so the model's wins",
      ours.length === 3 && theirs.length > 0 && theirs.every((d) => d.at < ours[0].at),
      `ours=${ours.map((d) => d.at + ":" + d.v).join(" ")} theirs=${theirs.map((d) => d.at + ":" + d.v).join(" ")}`);
    ok("…and the stored theme still applied underneath it", theirs.length > 0,
      `${decls.length} --background declarations, ${ours.length} of them the model's`);
    // 3. THE TYPEFACE IS A FILE, AND IT TAKES TWO FACTS TO SAY SO. A
    //    `font-family` with nothing behind it falls back SILENTLY — the browser
    //    says nothing and the build reports the family it asked for — which is
    //    the failure `site-fonts.mjs` is written around, arriving through the one
    //    field with no font picker in front of it.
    //
    //    THE FIRST DRAFT OF THIS CHECKED ONE OF THE TWO AND WAS RIGHT TO GO RED.
    //    It looked for `Lora Variable` in the compiled CSS and found nothing, and
    //    the reason was not the free-CSS field: `import "@fontsource-variable/…"`
    //    from `fonts.ts` emits every woff2 as an asset and puts ZERO `@font-face`
    //    in `dist/client` or `dist/server`, so the files were there and nothing
    //    told the browser to use them. True of the template's own `geist` default
    //    too — every published site. `writeFonts` now `@import`s the package from
    //    `styles.css` as well, which is the mechanism the template already uses
    //    for `tw-animate-css`, and both halves below hold.
    //
    //    THE RULE AND THE FILE FAIL DIFFERENTLY, so they are asserted apart: the
    //    rule can be present with the asset missing (a url pointing at nothing)
    //    and the asset can be present with no rule (exactly the bug above).
    //    `Lora Variable`, NOT `Lora`, AND THAT IS WHAT MAKES IT DISCRIMINATE:
    //    the model's own sheet says `font-family: "Lora"`, so matching `Lora`
    //    would be satisfied by the sheet we just appended and prove nothing at
    //    all about bundling. @fontsource declares the face as `Lora Variable`, a
    //    spelling only the package can produce.
    ok("a family the stylesheet names gets a real @font-face",
      /@font-face[^}]*Lora Variable/i.test(css),
      (css.match(/@font-face[^}]{0,160}/g) || []).slice(0, 2).join(" | ").slice(0, 400)
        || "no @font-face in the bundle at all");
    ok("…and its font file is published beside it",
      Object.keys(sheetBuild.files || {}).some((k) => /(^|\/)lora[^/]*\.woff2$/i.test(k)),
      Object.keys(sheetBuild.files || {}).filter((k) => /\.woff2$/i.test(k)).join(" ") || "no woff2 at all");
    // 4. A PAGE SCOPE SURVIVES THE COMPILER. This is the only way one page can
    //    look different now that `tokensPage` is gone, and the selector is
    //    exactly the shape Lightning CSS is known to rewrite: it UNQUOTES
    //    attribute selectors, measured at 94 in one bundle, so an assertion
    //    written with the quotes describes a stylesheet that is never emitted.
    ok("a page-scoped rule survives the compiler",
      /body\[data-page=["']?\/menu["']?\]/.test(css),
      (css.match(/body\[data-page[^{]*/g) || []).join(" | ").slice(0, 200) || "no data-page rule at all");

    // 5. ── THE LABEL GUARD ────────────────────────────────────────────────
    //
    // A BUTTON'S WORDS MAY NOT BE ITS OWN FILL. Asserted here rather than only
    // in a unit test because the claim is about the COMPILED bundle: Tailwind
    // and Lightning CSS both rewrite what they are given, and this repo has
    // shipped three look features that were correct in a module and dead in the
    // stylesheet — including one whose selector Tailwind never emitted at all.
    // THE RULE HAS AN IDENTICAL TWIN, AND ANY FIRST-MATCH READ IS VACUOUS.
    // Tailwind emits its OWN `.text-primary-foreground{color:var(--primary-foreground)}`
    // — byte-identical to the guard — inside `@layer utilities` whenever a page
    // uses the class, and the CTA page does. Measured under the mutant: with the
    // guard DELETED, a bare `.test()` for the rule stayed green on the twin, and
    // a `search()`-based depth read judged the twin's depth (1) rather than the
    // guard's (0). So every claim below is made about the set of occurrences,
    // keyed by the one thing that tells them apart: brace depth. Ours is the
    // unlayered one — depth 0 — which is also the whole mechanism, since inside
    // a layer it would lose to the model's blanket rule exactly as the kit's
    // own utility does.
    const hits = [...css.matchAll(/\.text-primary-foreground\s*\{\s*color:\s*var\(--primary-foreground\)\s*\}/g)]
      .map((m) => ({ at: m.index, depth: braceDepthAt(css, m.index) }));
    const unlayered = hits.filter((h) => h.depth === 0);
    ok("the label guard reaches the compiled stylesheet UNLAYERED — the layered twin does not count",
      unlayered.length >= 1,
      hits.length ? "occurrences " + JSON.stringify(hits) : "no such rule anywhere in the bundle");
    // …AND THE LAYERED TWIN IS REALLY THERE, or "unlayered" is a distinction
    // about a bundle where the word means nothing and the check above proves
    // less than it reads.
    ok("…beside the kit's own layered copy, which is what it must outrank",
      /@layer\s+utilities\s*\{/.test(css) && hits.some((h) => h.depth > 0),
      "layers " + ((css.match(/@layer[^{;]*[;{]/g) || []).slice(0, 3).join(" ") || "none")
        + " · occurrences " + JSON.stringify(hits));
    // …AND BEFORE THE MODEL'S OWN RULES, so a sheet that aims at the label class
    // itself still wins — a design decision rather than the accident this
    // guards, and the reason the `css` field's promise (YOUR RULES ARE WRITTEN
    // LAST) is still literally true.
    const mineAt = css.search(/--isibi-own-sheet/);
    ok("…and before the model's own rules, which keeps a deliberate label rule in charge",
      unlayered.length >= 1 && mineAt > 0 && unlayered[0].at < mineAt,
      `unlayered guard at ${unlayered.length ? unlayered[0].at : "-"}, the model's sheet at ${mineAt}`);
    // ── THE SHELL GUARD, AGAINST RUN 51'S OWN RULE ──────────────────────────
    //
    // Both sides must be in the file or the win is claimed over an absent
    // opponent: the model's re-grid (in OWN_SHEET above) and our doubled
    // selector, unlayered at depth 0. The win itself is cascade arithmetic —
    // (0,2,0) beats (0,1,0) among unlayered rules whatever the order — and
    // was measured as a computed `display: flex` in a real browser when the
    // guard landed.
    const shellHits = [...css.matchAll(/\[data-slot=site-chrome\]\[data-slot=site-chrome\]\s*\{[^}]*display:\s*flex/g)]
      .map((m) => ({ at: m.index, depth: braceDepthAt(css, m.index) }));
    ok("the SHELL GUARD reaches the compiled stylesheet unlayered, doubled selector intact",
      shellHits.some((h) => h.depth === 0),
      shellHits.length ? "occurrences " + JSON.stringify(shellHits) : "no doubled shell rule anywhere in the bundle");
    ok("…and the model's re-grid of the shell is really in the file, losing rather than absent",
      /\[data-slot=site-chrome\]\s*\{[^}]*display:\s*grid/.test(css),
      "run 51's rule vanished from the fixture sheet — the guard is winning a fight nobody is having");

    // ── THE THEME IS A NAME AGAIN, AND THE FULL DESIGN LANDS (2026-08-27) ──
    //
    // The seeds era rendered a palette-only approximation of a theme; the
    // registry's return means `writeTheme("broadsheet")` renders the WHOLE
    // hand-designed object — palette plus the 18 axes. The palette half is
    // already held by the ordering checks above (the "theirs" declarations ARE
    // the theme's); this is the axes half, which no seeds build could produce:
    // the theme's own `--radius` must reach the compiled bundle.
    //
    // TWO MINIFIER TRAPS IN ONE CHECK, both caught by this check's own first
    // run reporting a working seam as broken. The bundle holds the TEMPLATE'S
    // `--radius: .625rem` first and the theme's later — later wins, so the
    // LAST declaration is the one a visitor gets, and the first draft read the
    // FIRST (the site-dark lesson exactly). And broadsheet's radius is `0rem`,
    // which Lightning rewrites as bare `0` — a `([\d.]+)rem` pattern cannot
    // see it at all (the 41.17%-for-0.4117 trap, third instance). So: every
    // declaration collected, the last compared, values parsed unit-blind, and
    // NaN is never coalesced to 0 — an absent declaration must not equal a
    // zero-radius theme.
    const themed = themeCss(resolveTheme("broadsheet"));
    const radOf = (s) => parseFloat(String(s).replace(/^--radius:\s*/, ""));
    const wantRadius = radOf((themed.match(/--radius:\s*[^;}]+/) || [])[0]);
    const radDecls = css.match(/--radius:\s*[^;}]+/g) || [];
    const lastRadius = radOf(radDecls[radDecls.length - 1]);
    ok("the theme's own axes land — its radius is the bundle's LAST word on it",
      Number.isFinite(wantRadius) && radDecls.length >= 2 && lastRadius === wantRadius,
      `theme says ${wantRadius}, bundle declares ${JSON.stringify(radDecls)}`);
    // AND THE RESPONSE SAYS SO BY NAME — the id, not the label, because the id
    // is what the Worker sent and what a reply can act on.
    ok("the response reports the theme applied, by its registry id",
      sheetBuild.theme && sheetBuild.theme.applied === true && sheetBuild.theme.theme === "broadsheet",
      JSON.stringify(sheetBuild.theme));
    // AND THE THEME'S OWN PAIR IS BUNDLED. The payload carries the pair the
    // Worker derives (`themeFontPair("broadsheet")` = noto-serif +
    // source-sans-3), and a pair that reaches the wire without an @font-face
    // behind it is a site shipping the default face while reporting the
    // theme's — the exact silent fallback `site-fonts.mjs` is written around.
    ok("the theme's recommended heading face gets a real @font-face",
      /@font-face[^}]*Noto Serif/i.test(css),
      (css.match(/@font-face[^}]{0,120}/g) || []).slice(0, 3).join(" | ").slice(0, 360) || "no @font-face at all");
  }

  // ── AND IT HOLDS IN A BROWSER, WHICH IS THE ONLY THING THAT DECIDES ───────
  //
  // Everything above is text in a file. What a visitor sees is the cascade
  // resolving, and the guard rests on ONE property of it: among rules that are
  // equally unlayered, a class (0,1,0) beats a bare element (0,0,1) whatever
  // the source order. The render check already opens every page in a real
  // browser and measures contrast, so the proof costs no new machinery.
  {
    const found = (sheetBuild.render && sheetBuild.render.findings) || [];
    const invisible = found.filter((f) => f.kind === "contrast" && /deliberately invisible/.test(f.detail || ""));
    // THE OBSERVER FIRST. An absence asserted over a pass that never ran is the
    // vacuous clean this exact check has already shipped once.
    ok("the contrast pass really looked at the page carrying the button",
      sheetBuild.render && sheetBuild.render.ok === true && invisible.length > 0,
      `render ok=${sheetBuild.render && sheetBuild.render.ok} findings=${JSON.stringify(found).slice(0, 300)}`);
    const blanked = found.filter((f) => f.kind === "contrast" && /Book a chair now/.test(f.detail || ""));
    ok("A BUTTON'S LABEL SURVIVES A BLANKET LINK RULE — the run-34 defect, closed",
      blanked.length === 0,
      blanked.map((f) => `${f.route}@${f.viewport} ${f.detail}`).join(" | "));
  }

  // AND A BUILD THAT SENDS NONE IS UNCHANGED — the half that makes this safe to
  // deploy. Without it every assertion above passes on a container that appends
  // the model's sheet unconditionally, which on a site built before this existed
  // is a stylesheet with nothing in it appended to a working design.
  {
    const none = await post({
      files: { "index.tsx": INDEX, "menu.tsx": MENU },
      slug: "fold-coffee", ...themeAsSeeds("broadsheet"), style: HOUSE_STYLE,
    });
    const css = Object.entries(none.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    ok("a build with no stylesheet of its own carries none of it",
      !/--isibi-own-sheet/.test(css) && !/body\[data-page/.test(css) && !/Lora Variable/i.test(css)
        && !Object.keys(none.files || {}).some((k) => /lora/i.test(k)),
      css.slice(0, 200));
    // AND IT STILL GETS ITS OWN TYPEFACE, which is the half that stops the font
    // fix reading as "fonts work now" when what it might mean is "the site's own
    // pair stopped being emitted". `geist` is the template's default pair and
    // arrives through exactly the same `@import`.
    ok("…while its own pair is still bundled with a rule to load it",
      /@font-face[^}]*Geist Variable/i.test(css)
        && Object.keys(none.files || {}).some((k) => /geist[^/]*\.woff2$/i.test(k)),
      (css.match(/@font-face[^}]{0,120}/g) || []).slice(0, 2).join(" | ").slice(0, 300) || "no @font-face at all");
    ok("…and the container says so rather than claiming it applied",
      !none.css, JSON.stringify(none.css || null).slice(0, 200));
  }

  // ── AND AN UNKNOWN THEME NAME FAILS SOFT, BY NAME ─────────────────────────
  //
  // The Worker validates through `FIELD_KEEPS.theme` before storing, so
  // reaching the container with a name the registry refuses means version skew
  // or a hand-written payload — and either way the site's data layer is live
  // and its pages compiled, so the build must succeed on the default look and
  // SAY WHICH NAME it could not resolve, because "the site kept the default
  // look" alone is a note nobody can act on.
  {
    const skew = await post({
      files: { "index.tsx": INDEX, "menu.tsx": MENU },
      slug: "fold-coffee", theme: "zzz-nonesuch", style: HOUSE_STYLE,
    });
    ok("a theme the registry refuses does not cost the build",
      skew.ok === true, JSON.stringify(skew).slice(0, 200));
    ok("…and the refusal names the name",
      skew.theme && skew.theme.applied === false
        && (skew.theme.notes || []).some((n) => /zzz-nonesuch/.test(n)),
      JSON.stringify(skew.theme));
  }

  // ── THE FIVE LATE SURFACES ────────────────────────────────────────────────
  // Only a real build can answer the two things that matter here, and both are
  // invisible to the unit suite: whether Tailwind COMPILES `bg-(--scrim)` into a
  // rule that reads the token, and whether the token is in the sheet for it to
  // read. A module test sees the string an emitter returned; it cannot see the
  // compiler deciding not to emit a class nothing uses, which is exactly how
  // the `display` axis was dead for as long as it was.
  //
  // THREE OF THESE ASSERTIONS WERE WRONG ON THEIR FIRST RUN AND THE ENGINE WAS
  // RIGHT ALL THREE TIMES. Recorded here because each is a shape this repo
  // keeps paying for, and the corrected forms below only make sense against it:
  //
  //   1. `\[data-slot="photo"\]` — LIGHTNING CSS UNQUOTES ATTRIBUTE SELECTORS.
  //      Measured: 94 of them in one bundle, every one `[data-slot=photo]`. So
  //      the quoted form is a spelling the compiler never emits, and the axis
  //      was reported missing while its rule was in the sheet. The `41.17%`-for-
  //      `0.4117` class again — and that one is here too: `--scrim` lands as
  //      `oklch(9.37% .0087 59.15/.72)`, a percentage where the emitter wrote a
  //      fraction, which is why nothing below reads a lightness back as a number.
  //   2. `#000` — `background-color:#0000` appears 10 times in EVERY build and
  //      is TRANSPARENT, not black: a four-digit hex whose last digit is alpha.
  //      A false alarm on correct code, which this harness may not produce.
  //   3. "a site that asked for none has none" — the KIT emits two of the five
  //      shapes itself. `native-select.tsx` carries `selection:bg-primary`, so
  //      `::selection{background-color:var(--primary)}` is in every bundle; and
  //      Tailwind v4 ships `accent-*` UTILITIES, so `.accent-background{accent-
  //      color:…}` is too. Both are indistinguishable from our own `brand`
  //      option by content alone — so the control build below asks for options
  //      the kit cannot produce, and the leak check reads the SELECTOR.
  console.log("\nbuilding with the five late surfaces…");
  const late = await post({
    files: { "index.tsx": INDEX, "menu.tsx": MENU },
    slug: "fold-coffee", ...themeAsSeeds("broadsheet"),
    // `invert` RATHER THAN `brand`, deliberately: the kit's own `selection:bg-primary`
    // compiles to byte-identical output to our `brand` option, so `brand` here
    // could never tell the axis from the utility. `invert` names a pair the kit
    // never writes.
    style: { ...HOUSE_STYLE, scrim: "heavy", selection: "invert", controls: "brand", imagery: "mono", link: "accent" },
  });
  ok("a build asking for all five succeeds", late.ok === true, JSON.stringify(late).slice(0, 200));
  {
    const css = Object.entries(late.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    const plainCss = Object.entries(rounder.files || {})
      .filter(([k]) => k.endsWith(".css")).map(([, v]) => v.t || "").join("\n");
    // Quoting-agnostic, for the reason in (1) above.
    const slot = (name) => new RegExp("\\[data-slot=[\"']?" + name + "[\"']?\\]");
    const scrimsIn = (t) => [...t.matchAll(/--scrim:\s*([^;}]+)/g)].map((m) => m[1].trim());

    // THE TOKEN, IN BOTH BLOCKS, ON EVERY SITE. A `--scrim` in `:root` only
    // leaves every dark site's overlay reading whatever the light block set,
    // which is the wrong colour rather than none.
    const scrims = scrimsIn(css);
    ok("`--scrim` is emitted for both modes", scrims.length >= 2, "found " + scrims.length + ": " + scrims.join(" | "));
    ok("…and it is translucent, or it is a black rectangle rather than a shade",
      scrims.every((v) => /\/\s*\.?[\d.]+\s*\)/.test(v)), scrims.join(" | "));

    // THE CLASS TAILWIND HAD TO COMPILE. `bg-(--scrim)` is v4's arbitrary-value
    // syntax; if it did not compile, the overlay has NO background at all and
    // every dialog on the site opens with the page fully visible behind it —
    // which typechecks, bundles, publishes and looks like the panel is broken.
    ok("Tailwind compiled the overlay class into a rule that reads the token",
      /background-color:\s*var\(--scrim\)/.test(css),
      "the overlay's background never reached the stylesheet — every dialog opens with no shade");
    // …AND NOTHING ELSE PAINTS IT. The flat `bg-black/80` it replaced would show
    // up as a literal background on whatever rule reaches the overlay.
    //
    // IT DOES NOT LOOK FOR AN `[data-slot=overlay]` RULE, and my first draft did
    // — which failed against a perfectly correct bundle. That hook exists for the
    // AXIS; the overlay's ordinary background comes from the Tailwind UTILITY the
    // kit writes, so a site that has not asked for `scrim: blur` has no such rule
    // at all and should not. What is true either way is that every rule painting
    // this overlay names the token.
    {
      const painters = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, sel, body]) => /background-color:\s*var\(--scrim\)/.test(body)
          || /\[data-slot=["']?overlay["']?\]/.test(sel));
      const literal = painters.filter(([, , body]) =>
        /background(-color)?:\s*(#[0-9a-f]{3,8}|rgba?\(|black\b)/i.test(body));
      ok("…and the overlay is painted from the token, by nothing else",
        painters.length >= 1 && literal.length === 0,
        painters.length ? "a literal paints the overlay: " + literal.map((m) => m[0]).join(" | ").slice(0, 160)
          : "nothing in the sheet paints the overlay at all — the class did not compile");
    }

    // THE OTHER FOUR, each on the hook it selects.
    ok("the selection axis reached the sheet", /::selection\s*\{[^}]*var\(--foreground\)/.test(css),
      "no inverted ::selection rule — the axis is stored and invisible");
    ok("the controls axis reached the sheet", /:root\s*\{[^}]*accent-color:\s*var\(--primary\)/.test(css),
      "no accent-color at the root — native checkboxes still wear the operating system's");
    // `grayscale(1)` MINIFIES TO `grayscale()`, which means the same thing, so
    // the check asks for the function rather than its argument.
    ok("the imagery axis reached the photo hook",
      new RegExp(slot("photo").source + "[^{]*\\{[^}]*filter:\\s*grayscale").test(css),
      "no filter on the photo hook — the axis is stored and invisible");
    ok("the link axis reached the prose hook",
      /a\.underline[^{]*\{[^}]*color:\s*var\(--link\)/.test(css) && /--link:/.test(css),
      "no prose-link rule, or no --link token for it to read");

    // AND NONE OF IT IS THERE ON A SITE THAT NEVER ASKED. Every assertion above
    // passes just as well against an engine that emits all five unconditionally
    // — which would re-style every existing customer on their next typo fix.
    //
    // `--scrim` IS DELIBERATELY NOT IN THIS LIST: the token is part of the
    // palette now, so it is on every site by design and its absence would be
    // the bug. What the axis moves is the ALPHA, checked separately below.
    ok("a build that asked for none of them has none of them",
      !/::selection\s*\{[^}]*var\(--foreground\)/.test(plainCss) &&
      !/:root\s*\{[^}]*accent-color:/.test(plainCss) &&
      !new RegExp(slot("photo").source + "[^{]*\\{[^}]*filter:").test(plainCss) &&
      !/--link:/.test(plainCss),
      "one of the four is on by default — every published site changes on its next unrelated edit");
    // …and the scrim axis really moved the alpha rather than doing nothing.
    //
    // IT READS THE LAST PAIR, NOT THE FIRST, and that ordering IS the mechanism
    // rather than an accident of parsing: the palette emits `--scrim` in the
    // `:root`/`.dark` blocks on every site, and the axis RE-EMITS it after them,
    // so a five-build carries four declarations (`.72 .72 .9 .9`) and source
    // order is what makes the axis win. My first draft compared them positionally
    // and read the palette's own value against itself — measured `.72 vs .72` on
    // a bundle where the override was sitting two declarations further down.
    {
      const alphaOf = (t) => scrimsIn(t).map((v) => (v.match(/\/\s*(\.?[\d.]+)/) || [])[1]).filter(Boolean);
      const heavy = alphaOf(css), dim = alphaOf(plainCss);
      const last2 = (a) => a.slice(-2).map(Number);
      ok("the scrim axis re-emits the token after the palette, heavier",
        heavy.length > dim.length && dim.length >= 2 &&
        last2(heavy).length === 2 && last2(heavy).every((h, i) => h > last2(dim)[i]),
        `heavy ${heavy.join(",")} against dim ${dim.join(",")}`);
    }
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
  // ── THIS TEST WAS NEVER MEASURING WHAT ITS NAME SAID (found 2026-08-30) ────
  //
  // It asserted `ok === false` and passed for years — but NOT because the path
  // was refused. `safeRoute("../../../etc/passwd.tsx")` returns
  // `"etc/passwd.tsx"`: it STRIPS the traversal rather than rejecting it, so the
  // file was written INSIDE `src/routes` and the build then failed at the
  // TYPECHECK, because `export const x = 1;` is not a route module. The old
  // assertion was reading a type error and calling it a path refusal.
  //
  // Removing the typecheck gate is what exposed it, which is the useful half:
  // a test whose verdict comes from a layer it does not name will keep passing
  // long after the thing it claims to guard has moved.
  //
  // THE REAL PROPERTY IS CONTAINMENT, and it holds: nothing reaches outside
  // `src/routes`, whatever the model names its file. That is what is asserted
  // now — directly, on the published output, rather than inferred from a
  // failure somewhere else.
  // A REAL index.tsx BESIDE IT, so the build actually runs and there is a
  // published file list to inspect. Without one `!wrote` short-circuits and the
  // containment claim is never exercised — the assertion would pass over nothing.
  const esc = await post({ files: {
    "../../../etc/passwd.tsx": "export const x = 1;",
    "index.tsx": `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/")({ component: H });
function H() { return <main><h1>Contained</h1></main>; }
`,
  } });
  const escaped = Object.keys(esc.files || {}).filter((n) => /(^|\/)etc\//.test(n) || n.includes(".."));
  ok("a path escaping src/routes cannot reach outside it", escaped.length === 0,
    escaped.slice(0, 4).join(", ") || JSON.stringify(esc).slice(0, 160));
  ok("nothing was written outside the sandbox", !fs.existsSync("/etc/passwd.tsx"));

  console.log("\nrebuilding to prove the routes are reset…");
  const solo = await post({ files: { "index.tsx": MENU.replace('createFileRoute("/menu")', 'createFileRoute("/")').replace("function Menu", "function Home").replace("component: Menu", "component: Home") }, slug: "fold-coffee", wordmark: "text" });
  ok("`text` is a full wordmark answer: nothing is drawn and the header keeps the name in type",
    !((solo.files || {})["logo.svg"]) && (solo.brand || {}).wordmark === false,
    JSON.stringify({ file: !!(solo.files || {})["logo.svg"], wordmark: (solo.brand || {}).wordmark }));
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
  const withLogo = await post({ files: { "index.tsx": CHROMED }, slug: "logo-site", title: "Sharp Fade Barbers", logo: "/u/logo-site/mark.png",
    // A drawn wordmark rides the SAME payload, so this build is also the
    // precedence proof: the owner's uploaded file wins and the drawn one is
    // never written — a model must not outrank a person.
    wordmark: '<svg viewBox="0 0 200 64"><rect width="200" height="64" fill="#111"/></svg>',
    worker: true });
  ok("a site using the site frame builds with a logo", withLogo.ok === true, withLogo.stage + ": " + withLogo.error);
  ok("the owner's uploaded logo beats the drawn wordmark",
    (withLogo.brand || {}).wordmark === false && !((withLogo.files || {})["logo.svg"]),
    JSON.stringify({ wordmark: (withLogo.brand || {}).wordmark, file: !!(withLogo.files || {})["logo.svg"] }));

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

  // ── the DRAWN wordmark in the same real header ────────────────────────────
  //
  // The favicon-site build proves the container writes the file; only a render
  // can prove the header GETS it — its fixture has no chrome, so `site-brand.ts`
  // is tree-shaken there and asserting on its bundle was the same wrong draft
  // the logo comment above records twice. Same chrome page, no owner logo, a
  // drawn mark: SITE_LOGO must come out of the SERVED header as `/logo.svg`
  // with the name as the alt.
  console.log("\nbuilding a site whose designer drew the wordmark…");
  const HDR_WM = '<svg viewBox="0 0 240 64"><rect width="240" height="64" rx="8" fill="#0b3d2e"/>' +
    '<path d="M20 44 V20 h8 l10 16 10-16 h8 v24 h-7 V33 l-8 12 h-6 l-8-12 v11 z" fill="#f2e9d8"/></svg>';
  const wmSite = await post({ files: { "index.tsx": CHROMED }, slug: "wordmark-site", title: "Sharp Fade Barbers",
    wordmark: HDR_WM, worker: true });
  ok("a chrome site with a drawn wordmark builds", wmSite.ok === true, wmSite.stage + ": " + wmSite.error);
  ok("…and its dist carries the drawn file", (((wmSite.files || {})["logo.svg"] || {}).t || "").includes('d="M20 44 V20'),
    Object.keys(wmSite.files || {}).filter((n) => n.endsWith(".svg")).join(", "));
  const hw = await renderHome(wmSite, "wordmark-site");
  if (hw) {
    const wmImg = (hw.match(/<img[^>]*src="\/logo\.svg"[^>]*>/) || [""])[0];
    ok("the drawn wordmark is SERVER-RENDERED into the header", !!wmImg, hw.slice(0, 400));
    ok("…with the business name as its alt, so a failed image degrades to the name",
      /alt="Sharp Fade Barbers"/.test(wmImg), wmImg);
  }

  const noLogo = await post({ files: { "index.tsx": CHROMED }, slug: "logo-site", title: "Sharp Fade Barbers", worker: true });
  const h2 = await renderHome(noLogo, "logo-site");
  if (h2) {
    ok("a site with no logo shows the name, exactly as before",
      h2.includes("Sharp Fade Barbers") && !/<img[^>]*mark\.png/.test(h2),
      "the previous build's logo survived into a site that sent none");
    // The build directly above DREW a wordmark into the shared container's
    // public/, so this site's dist is the per-build cleanup proof: drop the
    // `rmSync(logoSvgPath)` and wordmark-site's mark ships in logo-site's dist.
    ok("…and the previous build's DRAWN wordmark did not leak into this dist",
      !((noLogo.files || {})["logo.svg"]),
      "wordmark-site's logo.svg survived into logo-site — the per-build rm is gone");
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

  // ── LIGHT OR DARK IS A COLOUR, AND COLOUR IS `css` ─────────────────────────
  //
  // THIS HEADER STOOD OVER A BLOCK 200 LINES BELOW IT and described a `mode`
  // field that no longer exists — kept and corrected rather than deleted,
  // because a stale comment is the one that gets believed. What it said: the
  // theme's own dark palette shipped as a `.dark` block on every site and
  // nothing ever applied it, so the fix was ONE CLASS ON `<html>`.
  //
  // THAT WAS TRUE OF A REGISTRY OF 500 HAND-DRAWN THEMES AND OUTLIVED IT. With
  // the model writing the whole stylesheet, `mode` and `css` are two answers to
  // one question — the field arrives at property 16 and the sheet at 9, so a
  // model that has already written near-black values on `:root` can then be
  // asked again and say "light", and the container applies both. A dark site is
  // dark values on `:root` now; the assertions that used to prove the class
  // prove its ABSENCE, which is the half that rots.
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

  console.log("\nbuilding a site on a theme with a dark half…");
  const MODE_PAYLOAD = { files: { "index.tsx": CHROMED }, slug: "mode-site", title: "Nightshift Records", ...themeAsSeeds("noir"), worker: true };
  const lightBuild = await post({ ...MODE_PAYLOAD });
  // THE SECOND BUILD SENDS THE DELETED FIELD ON PURPOSE. `mode` was a field for
  // three days and a caller somewhere may still carry it; what has to hold is
  // that it is INERT — same stylesheet, same document — rather than half-read.
  const darkBuild = await post({ ...MODE_PAYLOAD, mode: "dark" });
  ok("a build succeeds", lightBuild.ok === true, lightBuild.stage + ": " + (lightBuild.error || "").slice(0, 300));
  ok("…and one still carrying the deleted `mode` field succeeds too", darkBuild.ok === true, darkBuild.stage + ": " + (darkBuild.error || "").slice(0, 300));
  // THE CONTAINER REPORTS NO MODE, which is the inverse of what stood here and
  // is the half that rots. `mode` was deleted because it was a SECOND way to
  // decide a colour the stylesheet already decides — a field beside `css` that
  // says "dark" gives the model two answers to one question and the container
  // applies both. An absence has to be asserted or it comes back as a tidy-up.
  ok("the container reports no mode at all", (lightBuild.brand || {}).mode === undefined && (darkBuild.brand || {}).mode === undefined,
    JSON.stringify([(lightBuild.brand || {}).mode, (darkBuild.brand || {}).mode]));
  const cssOf = (b) => Object.entries(b.files || {}).filter(([n]) => n.endsWith(".css")).map(([, v]) => (v && v.t) || "").join("");
  const lightCss = cssOf(lightBuild), darkCss = cssOf(darkBuild);
  ok("the stylesheet does not move — the dark palette was always in it",
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
    // NOTHING BAKES A CLASS ON `<html>` ANY MORE, and this is the assertion the
    // whole deletion rests on. A baked `.dark` is a look the STYLESHEET did not
    // choose: `:root` says what the site is, and a model writing near-black
    // values there is how a dark site is expressed now — proved two blocks up,
    // where the model's own `:root{--background:#0d1117}` reaches the compiled
    // sheet and wins. A class on top of that is a SECOND opinion, and when the
    // two disagree the class silently wins over what the model wrote.
    ok("no build bakes a dark class onto <html>",
      !/<html[^>]*\bdark\b/.test(darkDoc) && !/<html[^>]*\bdark\b/.test(lightDoc),
      JSON.stringify([(lightDoc.match(/<html[^>]*>/) || [""])[0], (darkDoc.match(/<html[^>]*>/) || [""])[0]]));
    // AND THE DELETED FIELD MOVES NOTHING ELSE — not merely the class. Half-read
    // is the failure this is written against: a caller still sending `mode` must
    // get the site its stylesheet describes and nothing else.
    //
    // THE TIMESTAMP IS NEUTRALISED, AND THAT WAS MEASURED RATHER THAN ASSUMED.
    // A first draft demanded byte-identity and failed at EQUAL LENGTH (3873 vs
    // 3873), which is the shape of a fixed-width value moving. Rendering ONE
    // build twice separates a per-BUILD leak from a per-REQUEST value
    // completely, and it is per-request: TanStack serialises each router match
    // as `{i:"__root__",u:1787486551694,s:"success"}` and that `u` is
    // `Date.now()` at render. Two renders of the same build differ, so no
    // cross-build byte comparison can ever hold — the assertion was wrong, not
    // the code, and the length-only comparison that stood here was deliberate.
    //
    // `\d{10,}` IS THE NARROWEST THING THAT WORKS, and it was checked: with it
    // the two documents are identical, so nothing else moves. It cannot hide
    // what this is for either — a class, a colour, a token or an asset hash
    // (`WQmi5Cd-`, mixed alphanumeric) all survive it untouched.
    const settled = (s) => s.replace(/\d{10,}/g, "N");
    ok("…and the deleted field moves nothing but the SSR timestamp",
      settled(darkDoc) === settled(lightDoc),
      `${lightDoc.length} vs ${darkDoc.length} bytes, and they still differ once the timestamp is settled`);
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

  // ── THE SCRIPT READS ITS OWN PREFIX (stage 7, 2026-09-05) ─────────────────
  //
  // A publish stages its dist under `builds/<slug>/<version>/client/` and the
  // version is baked beside the build id, so the script serves THAT prefix and
  // falls back one hop to its parent's — or to the legacy `sites/<slug>/` when
  // there is none. Only executing a real bundle against a bucket can prove
  // the keys it builds, which is the same reason the stamp is proven here.
  console.log("\nbuilding a site that knows which version it is…");
  const VER = "00000000001000-aaaaaa", PARENT = "00000000000500-bbbbbb";
  const versioned = await post({ files: { "index.tsx": CHROMED }, slug: "ver-site", title: "Sharp Fade Barbers", worker: true, version: VER, parent: PARENT });
  ok("a site with a version builds", versioned.ok === true, versioned.stage + ": " + versioned.error);
  ok("…and the container reports the version beside the script's stamp",
    !!(versioned.worker && versioned.worker.version === VER), JSON.stringify(versioned.worker && { build: versioned.worker.build, version: versioned.worker.version }));
  // A bucket laid out the way a staged build is: one asset under the own
  // prefix, one only under the parent's, the live marker where it always was.
  const layoutBucket = (slug) => {
    const keys = new Map([
      ["builds/" + slug + "/" + VER + "/client/assets/own.js", "own"],
      ["builds/" + slug + "/" + PARENT + "/client/assets/old.js", "old"],
      ["sites/" + slug + "/assets/legacy.js", "legacy"],
    ]);
    const obj = (k) => (keys.has(k) ? { body: keys.get(k), writeHttpMetadata() {}, async text() { return keys.get(k); } } : null);
    return { get: async (k) => obj(k), head: async (k) => (k === "sites/" + slug + "/site.live" ? {} : null) };
  };
  const serveAt = async (build, slug, bucket, pathname) => {
    if (!build.ok || !build.worker || !build.worker.ok) return null;
    const f = path.join(sandbox, "ver-bundle-" + Math.random().toString(36).slice(2) + ".mjs");
    fs.writeFileSync(f, build.worker.code);
    try {
      const app = (await import("file://" + f)).default;
      return await app.fetch(new Request("https://x.gofarther.app" + pathname), { SITES: bucket(slug) }, { waitUntil() {} });
    } catch (e) { return new Response("IMPORT FAILED: " + String((e && e.message) || e), { status: 500 }); }
  };
  const vHome = await serveAt(versioned, "ver-site", layoutBucket, "/");
  ok("a served page says which version answered", !!vHome && vHome.headers.get("x-site-version") === VER, vHome && vHome.headers.get("x-site-version"));
  const vOwn = await serveAt(versioned, "ver-site", layoutBucket, "/assets/own.js");
  ok("an asset is served from the script's OWN prefix", !!vOwn && vOwn.status === 200 && (await vOwn.text()) === "own", vOwn && vOwn.status);
  const vOld = await serveAt(versioned, "ver-site", layoutBucket, "/assets/old.js");
  ok("…and a chunk the previous build had is served from the PARENT's prefix — the one fallback hop",
    !!vOld && vOld.status === 200 && (await vOld.text()) === "old", vOld && vOld.status);
  const vLegacy = await serveAt(versioned, "ver-site", layoutBucket, "/assets/legacy.js");
  ok("…and never from the legacy prefix when a parent exists", !!vLegacy && vLegacy.status === 404, vLegacy && vLegacy.status);
  const vMiss = await serveAt(versioned, "ver-site", layoutBucket, "/assets/none.js");
  ok("…and a file nobody has is a 404", !!vMiss && vMiss.status === 404, vMiss && vMiss.status);
  // The versionless script — every site published before this — is untouched:
  // no version header, the legacy prefix, no fallback.
  const legacyHome = await serveAt(withLogo, "logo-site", layoutBucket, "/");
  ok("a versionless script sends no version header", !!legacyHome && legacyHome.headers.get("x-site-version") === null, legacyHome && legacyHome.headers.get("x-site-version"));
  const legacyAsset = await serveAt(withLogo, "logo-site", layoutBucket, "/assets/legacy.js");
  ok("…and reads the legacy prefix exactly as before", !!legacyAsset && legacyAsset.status === 200 && (await legacyAsset.text()) === "legacy", legacyAsset && legacyAsset.status);
  // A version that is not one bakes as none: the script must never build a
  // key out of a string the Worker did not mint.
  const junkVer = await post({ files: { "index.tsx": CHROMED }, slug: "ver-site", title: "Sharp Fade Barbers", worker: true, version: "../current", parent: "x" });
  ok("a malformed version bakes as none", junkVer.ok === true && !(junkVer.worker && junkVer.worker.version), JSON.stringify(junkVer.worker && junkVer.worker.version));
  const junkHome = await serveAt(junkVer, "ver-site", layoutBucket, "/");
  ok("…and that script sends no version header", !!junkHome && junkHome.headers.get("x-site-version") === null, junkHome && junkHome.headers.get("x-site-version"));
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
    ok("the unfixed pages really do fail to typecheck", !!before.typeErrors,
      `${before.stage || "ok"}: ${String(before.typeErrors || "").slice(0, 200)}`);
    ok("and it fails on the link, not on something else",
      /account/.test(String(before.typeErrors || "")), String(before.typeErrors || "").slice(0, 200));

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
      !!loose.typeErrors,
      `${loose.stage || "ok"}: ${String(loose.typeErrors || "").slice(0, 240)}`);
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
    ok("…while an object in a column is still refused by the types",
      !!bogus.typeErrors,
      `${bogus.stage || "ok"}: ${String(bogus.typeErrors || "").slice(0, 240)}`);
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
    ok("a site with one bad page still reports the type error", !!broken.typeErrors,
      `${broken.stage || "ok"}: ${String(broken.typeErrors || "").slice(0, 240)}`);
    ok("and the report names the page, which is the shape salvagePlan reads",
      /menu\.tsx\(\d+,\d+\)/.test(String(broken.typeErrors || "")),
      String(broken.typeErrors || "").slice(0, 240));

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
