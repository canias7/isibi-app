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

const MENU = `import { createFileRoute, Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/menu")({ component: Menu });

type Drink = Row & { name: string; price: number | null; notes: string | null };

function Menu() {
  const drinks = useRows<Drink>("drinks", { order: "name", dir: "asc" });
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/" className="text-sm underline">Back</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Menu</h1>
      <div className="mt-8 grid gap-4">
        {drinks.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        {drinks.isError && <p className="text-sm text-destructive">Couldn't load the menu.</p>}
        {drinks.data?.length === 0 && <p className="text-sm text-muted-foreground">Nothing listed yet.</p>}
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
  const built = await post({ files: { "index.tsx": INDEX, "menu.tsx": MENU }, slug: "fold-coffee", title: "Fold Coffee" });
  console.log(`  (${Math.round((Date.now() - t0) / 1000)}s)`);

  ok("the build succeeds", built.ok === true, built.stage + ": " + built.error);
  if (built.ok) {
    const names = Object.keys(built.files);
    ok("it produced an index.html", !!built.files["index.html"]);
    ok("it produced hashed js and css", names.some((n) => /^assets\/.*\.js$/.test(n)) && names.some((n) => /^assets\/.*\.css$/.test(n)), names.join(", "));
    ok("the html is the app shell, not a page of markup", /id="root"/.test(built.files["index.html"].t || ""));
    ok("the brand reached the title tag", /<title>Fold Coffee<\/title>/.test(built.files["index.html"].t || ""), (built.files["index.html"].t || "").slice(0, 200));

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
