// The usage notes handed to the model on a repair, and the guard that stops them
// lying.
//
// A note that disagrees with the component is WORSE than no note: the model
// follows it, tsc refuses the page, and the repair pass — the very thing these
// notes exist to make work — is spent making the same mistake again. So nothing
// here is hand-written and nothing here is allowed to drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, render, extract } from "../builder/gen-component-api.mjs";
import { COMPONENT_API } from "../builder/component-api.mjs";
import { importedComponentApi, repairPrompt, pagesPrompt, UI_COMPONENTS } from "../builder/page-gen.mjs";

const UI_DIR = "builder/lovable/template/src/components/ui";

test("the committed notes match what the components actually take", () => {
  // The whole point. Re-derive from the files and require byte equality with
  // what is committed — so changing a prop and forgetting to regenerate fails
  // here rather than in somebody's published site.
  const fresh = render(build());
  const committed = fs.readFileSync("builder/component-api.mjs", "utf8");
  assert.equal(fresh, committed,
    "builder/component-api.mjs is stale — run `node builder/gen-component-api.mjs`");
});

test("every documented component is a real one, and the count is sane", () => {
  const known = new Set(UI_COMPONENTS);
  for (const name of Object.keys(COMPONENT_API)) {
    assert.ok(known.has(name), `${name} has notes but is not in UI_COMPONENTS`);
    assert.ok(fs.existsSync(path.join(UI_DIR, name + ".tsx")), `${name}.tsx does not exist`);
  }
  // Ours are the ones with no training data behind them, and they are the ones
  // that need describing. A collapse to a handful means the extractor broke.
  assert.ok(Object.keys(COMPONENT_API).length > 400,
    `only ${Object.keys(COMPONENT_API).length} components documented — the extractor has regressed`);
});

test("the extractor survives a generic and an arrow type", () => {
  // Both of these silently produced WRONG output on the first run, and neither
  // failed loudly: `DataList<T>` was skipped entirely (a regex expecting `(`
  // straight after the name) and every prop after the first `() => void` was
  // dropped (`>` counted as a closing bracket, driving depth negative). The
  // result looked like a perfectly good, shorter signature.
  const generic = extract(`export function DataList<T>({ query, children }: {
    query: { isPending: boolean };
    children: (row: T, index: number) => React.ReactNode;
  }) {`);
  assert.equal(generic.length, 1, "a generic component must not be skipped");
  assert.deepEqual(generic[0].props.map((p) => p.split(":")[0]), ["query", "children"]);

  const arrows = extract(`export function X({ a, b, c }: {
    a: string; b?: () => void; c?: () => void;
  }) {`);
  assert.deepEqual(arrows[0].props.map((p) => p.split(/[?:]/)[0]), ["a", "b", "c"],
    "props after an arrow type must survive");
});

test("optionality and defaults are carried, because both change the call", () => {
  const got = extract(`export function X({ a, b = 5, c }: { a: string; b?: number; c?: "sm" | "lg" }) {`);
  const line = got[0].props.join(", ");
  assert.match(line, /a: string/);
  assert.match(line, /b\?: number = 5/, "a default tells the model it may omit the prop");
  assert.match(line, /c\?: "sm" \| "lg"/, "a small union is worth its tokens — the caller must pick one");
});

test("className is dropped, because all 500 take it", () => {
  const got = extract(`export function X({ a, className }: { a: string; className?: string }) {`);
  assert.deepEqual(got[0].props, ["a: string"]);
  // And it is stated once, where it belongs.
  const prompt = repairPrompt("a cafe", { tables: [] },
    [{ path: "index.tsx", source: 'import { ReviewStars } from "@/components/ui/review-stars";' }],
    ["boom"], "Cafe");
  assert.match(prompt, /takes\s*\nclassName|also takes\s+className/i);
});

test("a repair is given the props of what the page imported, and nothing else", () => {
  const pages = [{
    path: "index.tsx",
    source: `import { ReviewStars } from "@/components/ui/review-stars";
             import { DataList } from "@/components/ui/data-list";
             import { Button } from "@/components/ui/button";`,
  }];
  const api = importedComponentApi(pages);
  assert.match(api, /^review-stars — ReviewStars\(value: number/m, "the imported one is described");
  assert.match(api, /^data-list — DataList\(/m);
  // `button` is shadcn's: standard HTML props, thousands of real examples in
  // training. Describing it spends tokens to tell the model what it knows.
  assert.ok(!/^button —/m.test(api), "shadcn primitives are left out");
  // And the 400-odd it did NOT import must not be in there, or this costs the
  // 12,600 tokens the whole design exists to avoid.
  assert.ok(!/availability-grid/.test(api), "only what the page imported");
  assert.ok(api.split("\n").length <= 3);
});

test("a build that never imported one of ours adds nothing at all", () => {
  const api = importedComponentApi([{ path: "index.tsx", source: 'import { Button } from "@/components/ui/button";' }]);
  assert.equal(api, null);
  const prompt = repairPrompt("a cafe", { tables: [] },
    [{ path: "index.tsx", source: 'import { Button } from "@/components/ui/button";' }], ["boom"], "Cafe");
  assert.ok(!/THE EXACT PROPS/.test(prompt), "no empty section when there is nothing to say");
});

test("the notes are only on the repair, never on the first call", () => {
  // The first call is every build; the repair is the minority that went wrong.
  // Put these on the first call and the saving becomes a cost on every site.
  const plain = pagesPrompt("a cafe", { tables: [] }, "Cafe");
  assert.ok(!/THE EXACT PROPS/.test(plain), "the first-pass prompt must stay lean");
  assert.ok(!/ReviewStars\(value/.test(plain), "no signatures on the first pass");
});

test("the four APIs that were actually got wrong are now stated", () => {
  // Not invented failures — these are the four I guessed wrong in one sitting
  // while writing a demo page against components I had written hours earlier.
  // If the model has one line of names and one retry, it will do the same.
  assert.match(COMPONENT_API["review-stars"], /value: number/);     // guessed `rating`
  assert.match(COMPONENT_API["upload-progress"], /name: string, percent: number/);  // guessed `items`
  assert.match(COMPONENT_API["storage-bar"], /used: number, total: number/);        // guessed `cap`/`tier`
  assert.match(COMPONENT_API["comment-thread"], /root: React\.ReactNode/);          // guessed `comments`
});

test("a number price is FORMATTED as money, never concatenated", () => {
  // Found by looking at a farm shop, not by any test: `currency + r.price`
  // rendered 3.2 as "£3.2" and 4200 as "£4200". Wrong on every site this kit
  // has ever built, on the component its own header calls "the single most
  // common shape on a site this platform builds" — and invisible to tsc, to
  // vite, to the lint and to every other check here, because a wrong money
  // format compiles perfectly.
  //
  // Asserted on the SOURCE rather than by rendering, because the failure was a
  // string concatenation and that is exactly what a source read can see.
  const src = fs.readFileSync(
    path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui/price-list.tsx"), "utf8");
  assert.ok(!/currency\s*\+\s*r\.price/.test(src),
    "PriceList concatenates a raw number onto the symbol again — 3.2 renders as £3.2");
  assert.match(src, /toLocaleString\(/, "PriceList no longer formats its number at all");
  assert.match(src, /Number\.isInteger\(n\)\s*\?\s*0\s*:\s*2/,
    "the whole-vs-fractional rule is gone: a menu wants £12, and £3.2 is not a price");
  // The rule itself, evaluated rather than restated — a regex over the source
  // proves the code is there and not that it is right.
  const fmt = (n, currency = "£", locale = "en-GB") =>
    currency + n.toLocaleString(locale, {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  assert.equal(fmt(12), "£12");
  assert.equal(fmt(3.2), "£3.20");
  assert.equal(fmt(1.95), "£1.95");
  assert.equal(fmt(4200), "£4,200");
  assert.equal(fmt(1234.5), "£1,234.50");
  assert.equal(fmt(0), "£0");
});

test("a currency SYMBOL never crashes the page", () => {
  // Intl.NumberFormat's currency style demands an ISO 4217 code and THROWS a
  // RangeError on anything else. `Money` passed `currency` straight in, so
  // `currency="£"` took the whole page down through React's error boundary —
  // eight nodes and an apology where a checkout should have been.
  //
  // Reachable from an ordinary caller because the kit runs two conventions:
  // most components default to "GBP" and nine to "£" (PriceList, PriceTag,
  // CartLine, CartSummary, MenuSection among them). Anybody passing the symbol
  // those want into any of the two dozen that forward to Money hit it.
  const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
  const money = fs.readFileSync(path.join(UI, "money.tsx"), "utf8");
  assert.match(money, /try \{[\s\S]*Intl\.NumberFormat[\s\S]*\} catch/,
    "Money formats without a guard again — one symbol takes the page down");

  // The rule itself, EVALUATED — a regex proves the code is there, not that it
  // is right. Same discipline as the PriceList guard above.
  const fmt = (amount, currency = "GBP") => {
    try { return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount); }
    catch {
      return currency + amount.toLocaleString("en-GB", {
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 });
    }
  };
  assert.equal(fmt(6, "GBP"), "£6.00");
  assert.equal(fmt(6, "£"), "£6");
  assert.equal(fmt(6.5, "£"), "£6.50");
  assert.equal(fmt(1234.5, "£"), "£1,234.50");
  assert.doesNotThrow(() => fmt(6, "€"));
  assert.doesNotThrow(() => fmt(6, "not a currency"));

  // And the premise: this only matters while both conventions are in the kit.
  const files = fs.readdirSync(UI).filter((f) => f.endsWith(".tsx"));
  const bodies = files.map((f) => fs.readFileSync(path.join(UI, f), "utf8"));
  const symbolDefaults = bodies.filter((b) => /currency = "[^A-Z]"/.test(b)).length;
  assert.ok(symbolDefaults > 0,
    "no component defaults currency to a symbol any more — if the kit is now ISO-only, say so and this guard can go");
  assert.ok(bodies.filter((b) => /<Money/.test(b)).length > 1, "nothing forwards to Money — this guard is watching nothing");
});

test("a column whose every cell is identical is DROPPED, not printed", () => {
  // Found by rendering a leisure centre and a farm park, not by any test.
  //
  // RateCard prices one thing by BLOCK — a day, three days, a week — and derives
  // a per-unit column plus a "cheapest per day" badge from it. Handed rows that
  // are all `units: 1` (a swim, a squash court, the whole sports hall) the
  // derived column is a character-for-character copy of the price beside it,
  // and the badge stops meaning better value and starts meaning cheapest —
  // marking swimming as better value than hiring a hall. Measured live.
  //
  // ServiceTimes is the same shape one component along: an attraction's daily
  // timetable is eleven rows all saying "Every day" down the left, a constant
  // dressed as a field taking a quarter of the width, under a heading that has
  // already said it.
  //
  // Both compile, bundle, lint and pass every other check in this repo.
  const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
  const rate = fs.readFileSync(path.join(UI, "rate-card.tsx"), "utf8");
  const times = fs.readFileSync(path.join(UI, "service-times.tsx"), "utf8");
  assert.match(rate, /rates\.some\(\(r\) => r\.units !== 1\)/,
    "RateCard no longer asks whether its rows are blocks — the duplicate column is back");
  assert.match(rate, /blocks && winners\.length === 1/,
    "the badge is no longer gated on block pricing: it will call the cheapest ACTIVITY the best value");
  assert.match(times, /meetings\.some\(\(m\) => m\.day !== meetings\[0\]\.day\)/,
    "ServiceTimes no longer asks whether its rows span days");

  // ASKING IS NOT ACTING, and this half is where three mutants walked through
  // the first draft of this test. Each decision has to gate BOTH the heading
  // and the cells — an ungated header over gated cells is a column of nothing,
  // which is worse than the duplicate it was meant to remove.
  assert.match(rate, /\{blocks && <th [^>]*>Per \{unit\}<\/th>\}/,
    "the per-unit HEADING is printed unconditionally — a header with no cells under it");
  assert.match(rate, /\{blocks && \(\s*<td/,
    "the per-unit CELL is printed unconditionally");
  assert.match(times, /\{manyDays && <span [^>]*>\{m\.day\}<\/span>\}/,
    "the day cell is printed unconditionally again");

  // The rules themselves, EVALUATED. A regex proves the code is there and not
  // that it decides correctly — and the direction that matters is the SECOND
  // one each time: dropping a column that carries real information is the
  // expensive failure, not keeping a redundant one.
  const blocks = (rates) => rates.some((r) => r.units !== 1);
  assert.equal(blocks([{ units: 1 }, { units: 1 }, { units: 1 }]), false);
  assert.equal(blocks([{ units: 1 }, { units: 3 }, { units: 7 }]), true);
  assert.equal(blocks([{ units: 1 }, { units: 10 }]), true, "one genuine block is enough to keep the column");
  assert.equal(blocks([{ units: 0.5 }, { units: 1 }]), true, "half an hour is a block too");
  assert.equal(blocks([]), false);

  const manyDays = (ms) => ms.some((m) => m.day !== ms[0].day);
  assert.equal(manyDays([{ day: "Every day" }, { day: "Every day" }]), false);
  assert.equal(manyDays([{ day: "Sunday" }, { day: "Sunday" }, { day: "Wednesday" }]), true,
    "a church's week must keep its day column");
  assert.equal(manyDays([{ day: "Today" }]), false);
});

test("a hard-coded legend never states something false about the caller", () => {
  // AvailabilityCalendar's legend ended "Prices are per night for the whole
  // property" — true of a holiday let, false of a kennel pricing one animal by
  // size, of a mooring pricing a berth, of a stable pricing a stall. A legend
  // that is wrong is worse than none, because it is read as authority: the
  // grid was correct and the sentence under it contradicted the table beside
  // it. Same class as the "Hire for" heading on RateCard, over a leisure
  // centre's list of activities, which are not hired.
  const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
  const cal = fs.readFileSync(path.join(UI, "availability-calendar.tsx"), "utf8");
  const rate = fs.readFileSync(path.join(UI, "rate-card.tsx"), "utf8");
  assert.match(cal, /priceNote\?: string/, "AvailabilityCalendar cannot be told what the rate covers");
  assert.match(cal, /\{priceNote \?\? "Prices are per night for the whole property\."\}/,
    "the let-specific sentence is hard-coded again, or the default has silently changed for every existing caller");
  assert.match(rate, /label = "Hire for"/, "RateCard's first-column heading is hard-coded again");
  assert.match(rate, /className="py-2 pr-4 font-medium">\{label\}</,
    "the label prop exists but the heading does not use it");

  // And the premise: these two only matter while something actually overrides
  // them. A prop nothing passes is a prop that can be quietly broken.
  const PAGES = path.join(import.meta.dirname, "../builder/lovable/template/src/family-pages");
  const pages = fs.readdirSync(PAGES, { recursive: true })
    .filter((f) => String(f).endsWith(".tsx"))
    .map((f) => fs.readFileSync(path.join(PAGES, String(f)), "utf8"));
  assert.ok(pages.some((p) => /priceNote=/.test(p)), "no page overrides the calendar legend — this guard watches nothing");
  // Named, because "somebody somewhere overrides it" passes while the app the
  // default is FALSE for quietly goes back to saying "the whole property".
  for (const f of fs.readdirSync(path.join(PAGES, "pet-boarding"))) {
    const src = fs.readFileSync(path.join(PAGES, "pet-boarding", f), "utf8");
    if (!/<AvailabilityCalendar/.test(src)) continue;
    assert.match(src, /priceNote=/,
      `pet-boarding/${f} shows a calendar with no priceNote — its legend now prices "the whole property" for a dog`);
  }
  assert.ok(pages.some((p) => /<RateCard[^>]*label=/s.test(p)), "no page overrides the rate-card heading");
});

test("a grid inside a narrow parent is the CALLER's decision, not the viewport's", () => {
  // Found by rendering a franchise page, not by any test. TestimonialGrid hard-
  // coded `sm:grid-cols-2 lg:grid-cols-3`, and Tailwind's breakpoints are the
  // VIEWPORT's — so dropped into a half-width column on a 1280px screen it
  // still made three columns, of about 380px each, wrapping every quote to
  // twelve-character lines. It compiled, it bundled, and it was unreadable.
  //
  // The parent knows how much room it has and the CSS cannot, so the caller
  // says — the same `columns` prop `gallery` has had all along, which is why
  // that one has never had this problem.
  const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
  const t = fs.readFileSync(path.join(UI, "testimonial.tsx"), "utf8");
  assert.match(t, /columns\?: 1 \| 2 \| 3/, "TestimonialGrid cannot be told how many columns it has");
  assert.match(t, /\{ 1: "", 2:/, "columns={1} must produce NO grid-cols class — one per row is the whole point");
  assert.ok(!/className=\{cn\("grid gap-4 sm:grid-cols-2 lg:grid-cols-3"/.test(t),
    "the viewport breakpoints are hard-coded again");

  // The premise: something actually passes it. A prop nothing uses is a prop
  // that gets quietly broken, and both the pages that found this are narrow.
  const PAGES = path.join(import.meta.dirname, "../builder/lovable/template/src/family-pages");
  const used = fs.readdirSync(PAGES, { recursive: true })
    .filter((f) => String(f).endsWith(".tsx"))
    .map((f) => fs.readFileSync(path.join(PAGES, String(f)), "utf8"))
    .filter((src) => /<TestimonialGrid[^>]*columns=/s.test(src));
  assert.ok(used.length >= 2, "no page constrains the testimonial grid — this guard watches nothing");
});

test("a deadline derived from a date, and a status that cannot eat the row", () => {
  // MeetingPapers is the parish-council family's whole reason to exist: an
  // agenda is due three CLEAR days before a meeting — excluding the day it goes
  // up and the day of the meeting, which is the bit everyone gets wrong by one
  // — and a bare date tells a resident nothing about whether they can prepare.
  //
  // Derived rather than stored, because a stored due date drifts the moment a
  // meeting is moved, which is precisely when somebody is relying on it.
  const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
  const src = fs.readFileSync(path.join(UI, "meeting-papers.tsx"), "utf8");
  assert.match(src, /due\.setDate\(due\.getDate\(\) - \(noticeDays \+ 1\)\)/,
    "the agenda deadline is no longer derived from the meeting date, or the clear-days arithmetic has lost its +1");
  assert.ok(!/dueBy\?:|agendaDue\?:/.test(src),
    "a stored due date is back — it will disagree with the meeting date the first time one moves");

  // CLEAR days, evaluated. Three clear days before Tuesday 12th is Friday 8th,
  // not Saturday 9th: both endpoints are excluded and off-by-one here is a
  // council telling residents an unlawfully short notice period was fine.
  const dueFor = (iso, noticeDays = 3) => {
    const d = new Date(iso);
    d.setDate(d.getDate() - (noticeDays + 1));
    return d.toISOString().slice(0, 10);
  };
  assert.equal(dueFor("2026-08-11"), "2026-08-07");
  assert.equal(dueFor("2026-08-05"), "2026-08-01");
  assert.equal(dueFor("2026-09-01"), "2026-08-28", "it must cross a month boundary correctly");
  assert.equal(dueFor("2026-03-02"), "2026-02-26", "and a short month");

  // And the overdue state, which is the one the component exists for, must not
  // be able to consume the row. As a single long string with `shrink-0` it
  // squeezed the meeting name to a ~130px ribbon — measured on a render, and
  // invisible to tsc, to vite and to every other check here.
  assert.match(src, /shrink-0 max-w-\[13rem\] text-right/,
    "the status column is unbounded again — the widest state decides the whole layout");
  assert.match(src, /<span className="block text-sm font-medium">Agenda overdue<\/span>/,
    "the overdue message is one long string again");
});

test("the holding deposit comes OFF the first month, and three contracts that must not soften", () => {
  // Every one of these survived a first mutation pass.
  const UI = path.join(import.meta.dirname, "../builder/lovable/template/src/components/ui");
  const tenancy = fs.readFileSync(path.join(UI, "tenancy-costs.tsx"), "utf8");
  const livery = fs.readFileSync(path.join(UI, "livery-packages.tsx"), "utf8");
  const grades = fs.readFileSync(path.join(UI, "membership-grades.tsx"), "utf8");
  const papers = fs.readFileSync(path.join(UI, "meeting-papers.tsx"), "utf8");

  // 1. THE ONE ARITHMETIC ERROR THIS COMPONENT EXISTS TO PREVENT. A holding
  // deposit is set against the first month's rent, not added to it — almost
  // nobody knows that, so a naive sum of the rows overstates the total by a
  // week's rent. Adding it back survived the whole suite.
  assert.match(tenancy, /const total = Math\.round\(\(monthlyRent \+ deposit\) \* 100\) \/ 100;/,
    "the holding deposit is being added on top of the first month again");
  const total = (rent, depWeeks) => {
    const weekly = (rent * 12) / 52;
    return Math.round((rent + Math.round(weekly * depWeeks * 100) / 100) * 100) / 100;
  };
  assert.equal(total(950, 5), 2046.15, "£950 pcm is £219.23 a week, so five weeks is £1,096.15 plus one month");
  assert.equal(total(1000, 0), 1000, "no deposit means the first month and nothing else");

  // WEEKS, FROM AN ANNUALISED RENT. The caps are in WEEKS and the rent is
  // quoted MONTHLY, and multiplying the monthly figure by five weeks survived
  // the evaluated test above — because that test reimplements the right
  // formula and cannot see the source change. £950 pcm would have shown a
  // £4,750 deposit instead of £1,096.
  assert.match(tenancy, /const weekly = \(monthlyRent \* 12\) \/ 52;/,
    "the weekly rent is no longer annualised — a month is not four weeks and the caps are in weeks");
  assert.match(tenancy, /const deposit = Math\.round\(weekly \* depositWeeks \* 100\) \/ 100;/,
    "the deposit is being derived from something other than the weekly rent");
  assert.match(tenancy, /const holding = Math\.round\(weekly \* holdingWeeks \* 100\) \/ 100;/,
    "the holding deposit is being derived from something other than the weekly rent");

  // AND THE CAPS ARE CHECKED. A deposit above five weeks and a holding deposit
  // above one are unlawful in England; an agent typing into a CMS will
  // eventually type an unlawful number, and rendering it neatly is the worst
  // outcome available. `overCap = false` killed it and passed.
  assert.match(tenancy, /const overCap = depositWeeks > 5 \|\| holdingWeeks > 1;/,
    "the statutory cap check is gone — an unlawful figure now renders as though it were fine");
  const overCap = (dep, hold) => dep > 5 || hold > 1;
  assert.equal(overCap(5, 1), false, "the caps themselves are lawful");
  assert.equal(overCap(6, 1), true);
  assert.equal(overCap(5, 2), true);

  // 2. THE OVERDUE BRANCH, WIRED. Asserting the strings exist proves nothing
  // about whether anything can reach them — `const overdue = false` killed the
  // whole state and passed.
  assert.match(papers, /const overdue = !m\.agendaHref && !past && due\.getTime\(\) < midnight;/,
    "the overdue condition is gone or weakened — the late state is unreachable");

  // 3. `excludes` IS REQUIRED and must stay required. An unstated exclusion
  // reads as included, which is the failure that ends up in a county Facebook
  // group — full livery at £186 that does not cover bedding is not full livery.
  assert.match(livery, /\n  excludes: string\[\];/,
    "excludes has been made optional — an omitted exclusion reads as included");

  // 4. Every optional field on Grade is nullable, derived rather than listed.
  // A single non-nullable optional among nullable siblings is a trap: a caller
  // writing `orRequires: null` to mean "no second route" is saying something
  // true and gets a type error for it.
  const block = grades.slice(grades.indexOf("export type Grade = {"), grades.indexOf("export function MembershipGrades"));
  const optional = [...block.matchAll(/^ {2}(\w+)\?: ([^;]+);/gm)];
  assert.ok(optional.length >= 5, `only found ${optional.length} optional fields on Grade — the scan has broken`);
  for (const [, name, type] of optional) {
    assert.ok(/\| null\b/.test(type), `Grade.${name} is optional but not nullable, unlike its siblings`);
  }
});
