// The page generator's model-facing half — the rules it writes against, the
// tool it fills in, and the deterministic checks its output has to survive.
//
// Kept out of worker.js on purpose: this is plain, dependency-free JavaScript,
// so it can be imported and tested outside the Worker (see test/page-gen.test.mjs)
// the same way site-schema.mjs and site-data.mjs are.
//
// The contract itself is builder/GENERATOR.md, and the page it is derived from is
// builder/lovable/template/src/routes/index.tsx. Both are reproduced here because
// the Worker has no filesystem; a test asserts this copy has not drifted from the
// file, and GENERATOR.md's rule stands — when the two disagree, the file wins.

/** Every component in src/components/ui. An import of anything else does not resolve. */
export const UI_COMPONENTS = [
  "accordion", "alert-dialog", "alert", "aspect-ratio", "avatar", "badge", "breadcrumb",
  "button", "calendar", "card", "carousel", "chart", "checkbox", "collapsible", "command",
  "context-menu", "dialog", "drawer", "dropdown-menu", "form", "hover-card", "input-otp",
  "input", "label", "menubar", "navigation-menu", "pagination", "popover", "progress",
  "radio-group", "resizable", "scroll-area", "select", "separator", "sheet", "sidebar",
  "skeleton", "slider", "sonner", "switch", "table", "tabs", "textarea", "toggle-group",
  "toggle", "tooltip",
];

// Imported, not restated. The generator has to predict exactly what the API will
// refuse, and when these rules were written out in both files they drifted — the
// lint claimed a read of a `feed` or `admin` table returns 403, which the API
// does not do. site-access.mjs is dependency-free, so this module stays
// importable without the Worker's node_modules.
export { MANAGED_COLUMNS } from "../site-access.mjs";
import { MANAGED_COLUMNS, canReadAccess, canWriteAccess, whyNotReadable, needsMember, hasPublicView } from "../site-access.mjs";

export const MAX_PAGES = 6;
export const MAX_PAGE_CHARS = 24000;

// A byte-for-byte copy of builder/lovable/template/src/routes/index.tsx. The only
// change is the escape on the one `${` sequence, which a template literal would
// otherwise interpolate. test/page-gen.test.mjs fails if the two diverge.
export const REFERENCE_PAGE = `// Reference page. Hand-written against the schema the designer actually
// produced for "a small barber shop site": services(name, description, price,
// duration_minutes) and appointments(service, customer_name, customer_phone,
// date, time, notes).
//
// This exists to be imitated. It is the shape the generator should emit — read
// with useRows, write with useCreateRow, shadcn for every control, and no fetch
// code anywhere. If a generated page diverges from this, the generator is wrong.
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useRows, useCreateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/")({ component: Home });

type Service = Row & {
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
};

// Mirrors the declared columns. The API rejects anything undeclared anyway, but
// validating here means the visitor is told before a round trip.
const booking = z.object({
  service: z.string().min(1, "Pick a service"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_phone: z.string().min(6, "We need a number to confirm on"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
  notes: z.string().max(500).optional(),
});

type Booking = z.infer<typeof booking>;

function Home() {
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const create = useCreateRow("appointments");

  const form = useForm<Booking>({
    resolver: zodResolver(booking),
    defaultValues: { service: "", customer_name: "", customer_phone: "", date: "", time: "", notes: "" },
  });

  const onSubmit = (values: Booking) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Booked — we'll call to confirm.");
        form.reset();
      },
      // The API separates the caller's fault from a server fault, so its own
      // message is worth showing instead of a generic failure.
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Barber Shop</h1>
      <p className="mt-2 text-muted-foreground">Book a chair. We'll call to confirm.</p>

      <section className="mt-12">
        <h2 className="text-xl font-medium">Services</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.isPending && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

          {services.isError && (
            <p className="text-sm text-destructive sm:col-span-2">
              Couldn't load the services. Refresh and try again.
            </p>
          )}

          {services.data?.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-2">Nothing listed yet.</p>
          )}

          {services.data?.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-baseline justify-between text-base">
                  <span>{s.name}</span>
                  {s.price != null && <span className="tabular-nums">\${s.price}</span>}
                </CardTitle>
                {s.duration_minutes != null && <CardDescription>{s.duration_minutes} min</CardDescription>}
              </CardHeader>
              {s.description && (
                <CardContent className="text-sm text-muted-foreground">{s.description}</CardContent>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-medium">Book an appointment</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="service"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Service</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.data?.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Anything else?</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Booking…" : "Request appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </main>
  );
}
`;

export const PAGE_RULES = `You write the pages of a small business website, as TypeScript React route files.

The site's database ALREADY EXISTS. A schema was designed from the same brief and its tables
are live Postgres. You are given exactly what was created. You cannot invent a table, a column
or an access level — anything not in the schema below does not exist.

## Hard rules

1. NO FETCH CODE. Read with \`useRows\`, write with \`useCreateRow\`, both from "@/lib/rows".
   A page that calls fetch, axios or XMLHttpRequest is wrong.

2. RESPECT THE ACCESS LEVEL. The API enforces it — this is not a matter of taste.
   - \`display\` — you may LIST and READ it. A write returns 403.
   - \`collect\` — you may SUBMIT a form to it. A read returns 403. These rows are other
     visitors' submissions; never list them, never count them, never show "3 people booked".
   - \`user\` — PRIVATE PER MEMBER. Signed in, they read and write only their OWN rows;
     signed out, both return 401. Build the signed-in view AND a sign-in prompt.
   - \`feed\` — SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in
     member writes rows that become theirs. Signed out, both return 401.
   - \`admin\` — SHARED, ROLE-WRITABLE. Anyone signed in reads it; only a member whose role
     the table names in \`writeRoles\` may write. Anyone else gets 403 with \`code: "role"\`.

3. SHADCN FOR EVERY CONTROL, imported from "@/components/ui/<name>". Never hand-roll a
   button, input, select, checkbox or dialog. These exist and nothing else does:
   ${UI_COMPONENTS.join(", ")}.
   There is no "toast" or "use-toast" component — toasts come from \`import { toast } from "sonner"\`.

4. FORMS ARE react-hook-form + zod, through shadcn's \`Form\`/\`FormField\`/\`FormControl\`.
   TanStack Form is installed but shadcn's form components do not speak to it — mixing them
   produces inputs that silently do not validate. Never import "@tanstack/react-form".

5. THE ZOD SCHEMA MIRRORS THE DECLARED COLUMNS. The API drops anything undeclared, so a field
   the schema does not have vanishes without an error.

6. NEVER WRITE A MANAGED COLUMN. These are set by the engine and dropped from any write:
   ${MANAGED_COLUMNS.join(", ")}.

7. A COLUMN NAMED FOR A PICTURE HOLDS A URL STRING. \`photo\`, \`image_url\`, \`avatar\`,
   \`logo\`, \`cover\`, \`hero_image\` and the like are ordinary text columns whose value is a
   path like "/u/<slug>/<hash>.jpg". Render one as a plain
   \`<img src={row.photo} alt="" className="..." />\`.
   ALWAYS GUARD IT: on a \`display\` table the owner fills these in after the build, so
   the value is often empty, and \`<img src="">\` renders as a broken image on a brand-new
   site. Write \`{row.photo ? <img .../> : <div className="..." />}\` — an image or a
   placeholder box, never a broken one.

8. A FORM MAY LET THE VISITOR ATTACH ONE, but only when its table declares an image
   column. Upload first, then submit the URL as an ordinary text field:

   \`\`\`tsx
   const upload = useUploadFile("bookings");           // from "@/lib/rows"
   // <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ... />
   const { url } = await upload.mutateAsync(file);
   form.setValue("photo", url);                        // then create the row as normal
   \`\`\`

   The row write is still plain JSON — there is no multipart and no "file field".
   Disable submit while \`upload.isPending\`, and surface \`error.message\` like any other
   write: the API says "that image is too big" or "that doesn't look like a PNG, JPEG,
   WebP or GIF", which is worth showing. **PNG, JPEG, WebP and GIF only — SVG is refused**
   — and the file is capped at 2 MB, so say so next to the control rather than letting
   someone pick a 12 MB photo and be told no afterwards.

9. A BOOKING PAGE SHOWS WHICH SLOTS ARE TAKEN with \`usePublicRows\`. A \`collect\` table
   cannot be read — that is the whole point of it — but if the schema declares a
   \`publicView\` on it, that projection CAN be read by anyone, and it is how a form greys
   out a time somebody already booked. \`usePublicRows("bookings")\` returns only the
   columns the schema chose to publish, never a name or an email.
   **The schema above says, per table, whether this works — do not infer it.** When it says
   NO, build the ordinary form and ship it: the visitor picks a time and the server refuses
   a taken one with a clear message. Greying slots out early is a nicety, and a page that
   fails because it could not have one is far worse than a page without one.
   **These rows have NO \`id\`** — a projection publishes only the columns listed above, and
   \`id\` is refused outright. Type them as \`PublicRow & { … }\`, never \`Row & { … }\`, and key
   the list on a published column or the index.

10. GIVE THE VISITOR THEIR SUBMISSION BACK. A successful \`useCreateRow\` on a \`collect\`
    table resolves to \`{ row, claim }\` where **\`claim\` is optional** — only a \`collect\`
    table mints one, so its type is \`string | undefined\`. Take the whole result and
    narrow it (\`onSuccess: (data) => { if (!data.claim) return; … }\`); destructuring it
    as a required \`{ claim: string }\` does not typecheck and the page will be refused.
    **Never annotate a mutation callback's parameter.** Write \`onSuccess: (data) => …\`,
    not \`onSuccess: ({ row, claim }: { row: Booking; claim?: string }) => …\`. TanStack's
    callback takes four arguments and its types are contravariant, so ANY hand-written
    annotation is refused even when it looks right — this was three separate build
    failures. Let it infer.
    That \`claim\` is a signed token for THAT ONE row and
    it is issued exactly once — if the page drops it, nobody can ever reach that booking
    again except the site owner. On the confirmation screen, show a link to a manage page
    carrying it: \`/manage?id=\${row.id}&claim=\${claim}\`. If you hold that in state, type the id as \`RowId\`, not \`string\` — \`row.id\` comes back as a NUMBER and only becomes a string in the URL. That page reads the two values
    off the URL and calls \`useClaimedRow(table, id, claim)\` to show the booking and
    \`useCancelClaim(table)\` to cancel it. Build the manage page whenever you build a
    form on a \`collect\` table that represents an appointment, an order or a reservation
    — anything a person would reasonably want to check or call off. Do not build it for a
    plain contact form, which nobody comes back to. Never try to list a \`collect\` table:
    the claim opens one row, and only for the person who wrote it.

## Reading rows

\`useRows<T>(table, params)\` → a TanStack Query result whose \`.data\` is the rows.
- \`params\`: \`{ limit, offset, order, dir, q, <column>: value }\`. \`limit\` is capped at 100.
- \`order\` must be a DECLARED column or "id" — any other value silently falls back to id.
  \`created_at\` is NOT orderable unless the table declared it.
- a \`<column>: value\` pair is an equality filter, and only on declared columns.
- \`q\` is full-text search and only does something on a table that declared fts.
- rows come back with every column including \`id\` and \`created_at\`, so you can display those
  even though you cannot sort or filter on them.
- type it: \`type Service = Row & { name: string; price: number | null }\`. Every column the
  database did not mark required can be null — say so in the type and guard before rendering.

## Every list handles four states

Omit one and the page looks fine in a screenshot and broken in use:
- \`isPending\` → \`<Skeleton />\` placeholders, not a spinner and not nothing
- \`isError\` → one sentence a visitor can act on
- \`data?.length === 0\` → say the list is empty; do not render an empty grid
- loaded → the rows

## Every form must

- disable its submit button while \`mutation.isPending\`, and say so on the button
- \`toast.success(...)\` and \`form.reset()\` on success
- \`toast.error(e.message)\` on failure — THE API'S OWN MESSAGE. It distinguishes the caller's
  fault from a server fault and returns a \`code\` for duplicate / overlap / bad_ref / required /
  full / invalid. "That time is already taken" is useful; "something went wrong" is not.

## Routing

File-based, TanStack Router. Each page is one file under src/routes/ exporting
\`export const Route = createFileRoute("<url>")({ component: X })\`.
  index.tsx → "/"      about.tsx → "/about"      menu/index.tsx → "/menu"
\`index.tsx\` is required. Link between pages with \`<Link to="/menu">\` from "@tanstack/react-router".
Never write routeTree.gen.ts, __root.tsx, src/pages/ or app/layout.tsx.

## Styling

Tailwind v4 with semantic tokens: bg-background, text-foreground, bg-card, text-muted-foreground,
border-border, bg-primary, text-destructive. A raw bg-slate-900 breaks dark mode. Also available:
lucide-react icons, date-fns, recharts. Import nothing that is not already a dependency.

## Visitor accounts

A site can have members — its own customers, nothing to do with isibi accounts. Everything comes
from \`@/lib/rows\`; there is no other auth API and no fetch:

- \`useMember()\` → \`{ data: member | null, isPending }\`. **Render neither view until it settles**,
  or the page flashes a sign-in form at somebody already signed in.
- \`useSignup()\` / \`useLogin()\` → mutations taking \`{ email, password }\`. On success the session is
  stored and every read re-runs on its own. Passwords need 8+ characters.
- \`useLogout()\` → a plain function.
- \`useRequestReset()\` → \`{ email }\`. Always succeeds; tell the visitor to check their inbox
  whether or not the address has an account. The link itself is handled by the platform.

There is more than one way in, and WHICH ones depends on the site — so never hard-code buttons:

- **Every list hook's \`data\` IS the array** — \`useRows\`, \`useSessions\`, \`usePublicRows\`.
  Map it directly (\`sessions.data?.map(…)\`); there is no wrapper object to reach through.
- \`useSignInMethods()\` → the list this site actually offers, each \`{ name, label, oauth }\`.
  Render the sign-in page FROM THIS. A provider the owner has not set up must not appear.
- \`startOAuthSignIn(name)\` for any entry with \`oauth: true\` — Google, Microsoft, Apple and the
  rest. It navigates away and the platform brings them back signed in; there is nothing to await.
- \`usePasskeySignIn()\` → Face ID, Touch ID, a security key. Offer it whenever \`passkey\` is in
  the list; it needs no password and no email.
- \`useRequestSignInCode()\` then \`useVerifySignInCode()\` → \`{ email }\`, then \`{ email, code }\`.
  Only when \`email-code\` is in the list.
- \`useAddPasskey()\`, \`useConnectedAccounts()\`, \`useStartTotp()\` / \`useEnableTotp()\` /
  \`useDisableTotp()\` belong on an ACCOUNT page, never on the sign-in page.
- \`useSessions()\` → where this account is signed in, each \`{ sid, device, country, lastSeen,
  ageSec, current }\`; \`useRevokeSession()\` takes \`{ sid }\` and signs out that ONE device.
  Render \`lastSeenLabel\` (\"2 days ago\", always a string) — \`ageSec\` is a number OR null.
  Also an ACCOUNT page. \`useLogoutOthers()\` is the blunt version — offer both, because "sign out
  everywhere" makes somebody log back in on every machine they still have. Revoking the row
  marked \`current\` is allowed and simply logs them out here; the response says \`self: true\`,
  so send them to the sign-in page rather than leaving them on one that will 401.

**A sign-in may not finish in one step.** \`useLogin\`, \`usePasskeySignIn\` and
\`useVerifySignInCode\` all return \`{ token }\` OR \`{ pending, need }\`. When \`pending\` comes back
the person has two-factor on: show a code field and call \`useVerifySecondFactor({ pending, code })\`.
Treating \`pending\` as a successful login leaves them stuck on a page that thinks they are signed in.

Build sign-in and sign-up ONLY when the schema actually has a \`user\`, \`feed\` or \`admin\` table.
A site of \`display\` and \`collect\` tables needs no accounts, and adding them is friction nobody
asked for. Surface the API's message on failure — it distinguishes a wrong password from an address
that already has an account (\`code: "exists"\`).

## What is not possible yet

- Editing and deleting work ONLY on a member's OWN rows, in a \`user\` or \`feed\` table, with
  \`useUpdateRow\`/\`useDeleteRow\` and a signed-in member. A \`collect\` or \`display\` row has no
  owner and can never be changed from a page. Someone else's row answers 404, so treat "not found"
  as "not yours" and say so gently.
- No owner/admin dashboard IN THE SITE — a \`collect\` table cannot be read back from a page.
  Its owner reads those submissions inside isibi, which is not something you build.
If the brief asks for one of these, build everything else and say plainly in \`notes\` what was
left out and why. Never generate UI that cannot work.

## Definition of done

\`tsc --noEmit\` must be clean and \`vite build\` must succeed. Write real TypeScript: no \`any\`,
no unresolved imports, no props a component does not take.

Keep it to the few pages the brief actually needs — usually one, at most ${MAX_PAGES}. Write warm,
specific copy for the business in the brief; never lorem ipsum, never a placeholder image URL.

## The page to imitate

This is a real, compiling page written against services(display) + appointments(collect). It is
the shape to copy — every rule above is visible in it.

${REFERENCE_PAGE}`;

export const SITE_PAGES_TOOL = {
  name: "write_pages",
  description: "Write the route files for the site.",
  input_schema: {
    type: "object",
    properties: {
      pages: {
        type: "array",
        description: "One entry per route file. Must include index.tsx.",
        items: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: 'Path under src/routes/, e.g. "index.tsx" or "menu.tsx". No leading directories.',
            },
            source: { type: "string", description: "The complete .tsx source for that route file." },
          },
          required: ["path", "source"],
        },
      },
      notes: {
        type: "string",
        description: "Anything the brief asked for that was left out, and why. Empty if nothing was.",
      },
    },
    required: ["pages"],
  },
};

export const ACCESS_NOTE = {
  display: "visitors READ it. List it, show it, search it. Writing to it returns 403.",
  collect: "visitors WRITE to it. Submit a form. Reading it returns 403 — never list these rows.",
  user: "PRIVATE PER MEMBER. Signed in, a member reads and writes only their OWN rows; signed out, both return 401. Build the signed-in view AND a sign-in prompt for when there is no member.",
  feed: "SHARED, MEMBER-AUTHORED. Anyone signed in reads every row; a signed-in member writes rows that become theirs. Signed out, both return 401.",
  admin: "SHARED, ROLE-WRITABLE. Anyone signed in reads it; only a member whose role is 'admin' (or one this table names in writeRoles) may write. A write by anyone else returns 403 with code 'role'.",
};

/** The tables, exactly as they exist, in the least ambiguous form we can put them. */
export function schemaDigest(spec) {
  const tables = (spec && Array.isArray(spec.tables) ? spec.tables : []).filter((t) => t && t.name);
  if (!tables.length) return "(the schema declares no tables)";
  return tables.map((t) => {
    const access = String(t.access || "collect").toLowerCase();
    // Columns arrive in two shapes and BOTH must work. normalizeSchema produces
    // rich objects ({name, type, notnull, ref}); the schema persisted in a
    // site's own `_meta` stores plain NAMES. Filtering on `c.name` silently
    // dropped every string, so a spec read back from _meta described each table
    // as having no columns at all — and the generator dutifully wrote pages that
    // said so. Live for one deploy on 2026-07-28.
    const cols = (t.columns || [])
      .map((c) => (typeof c === "string" ? { name: c } : c))
      .filter((c) => c && c.name);
    const described = cols.map((c) => {
      const bits = [String(c.type || "text").toLowerCase()];
      if (c.notnull) bits.push("required");
      if (c.ref) bits.push("names a row in " + c.ref);
      return c.name + " (" + bits.join(", ") + ")";
    });
    const lines = [
      "TABLE " + t.name + " — access \"" + access + "\": " + (ACCESS_NOTE[access] || ACCESS_NOTE.collect),
      "  columns: " + (described.length ? described.join(" · ") : "(none)"),
    ];
    if (access === "display") {
      lines.push("  order / filter by: " + cols.map((c) => c.name).concat("id").join(", "));
      lines.push("  full-text search: " + (t.fts ? "yes — pass { q } to useRows" : "no — do not pass q"));
    }
    // Whether `usePublicRows` works on this table, stated rather than left to be
    // guessed. Rule 9 says not to call it on a table with no public view — a
    // rule the model could not follow, because nothing here told it which tables
    // have one. Measured live 2026-07-29: it correctly worked out that
    // `bookings` had none, could not build the taken-slots hint, and the whole
    // site came out as the placeholder over one optional enhancement.
    //
    // Printed for EVERY table, not only the ones that have it. "No public view"
    // is the fact that stops a 404, and an absent line reads as an omission
    // rather than an answer.
    if (access !== "display") {
      // `hasPublicView` decides, not a shape test written here — the data path
      // answers 404 on exactly this question, and a second copy of the rule
      // drifts into a digest that promises a read the API refuses.
      lines.push(hasPublicView(t)
        ? "  usePublicRows: YES — anyone may read " + t.publicView.columns.join(", ") + " from this table"
        : "  usePublicRows: NO — this table has no public view; calling it is a 404, so build the page without it");
    }
    return lines.join("\n");
  }).join("\n\n");
}

/**
 * The user turn: what to build, and what already exists to build it against.
 * The brand is the name the schema designer settled on, and it is already in the
 * published page's <title> — passing it here keeps the heading from disagreeing
 * with the browser tab.
 */
/**
 * What the generator is told a revise is FOR.
 *
 * A revise sends {slug, instruction}, so before this the generator's entire
 * knowledge of the site was one line like "add a gallery" — and since it rewrites
 * every page each time, a working barber shop came back as a page listing a
 * gallery and nothing else. The merged schema fixed the tables; this fixes the
 * intent.
 *
 * The ORIGINAL brief is the anchor and is never rewritten by an instruction: an
 * accumulating log would grow without bound and would keep contradicting itself
 * ("remove the gallery" stays true forever). What the site has BECOME is carried
 * by the merged schema, which is the authoritative half anyway.
 */
export function briefForPages({ brief, priorBrief } = {}) {
  const now = String(brief || "").trim();
  const before = String(priorBrief || "").trim();
  if (!before || before === now) return now;
  if (!now) return before;
  return "The site already exists. It was originally built from this brief:\n\n" + before +
    "\n\nWHAT TO CHANGE NOW\n" + now +
    "\n\nKeep everything the original brief asked for unless this change says otherwise.";
}

export function pagesPrompt(brief, spec, brand) {
  const name = String(brand || "").trim();
  return "Build the pages for this site.\n\nBRIEF\n" + String(brief || "").trim() +
    (name ? "\n\nTHE SITE IS CALLED\n" + name + " — use it as the heading; it is already the page title." : "") +
    "\n\nTHE SCHEMA THAT EXISTS\n" + schemaDigest(spec);
}

// A route path the container will accept: under src/routes, .tsx, no traversal,
// and not one of the files the template or the router owns. Checked on the name
// as written, BEFORE any extension is normalised — otherwise "routeTree.gen.ts"
// slips through as "routeTree.gen.tsx".
const RESERVED = /(^|\/)(__root|routeTree\.gen|readme)\b/i;
const SAFE_PATH = /^[a-z0-9_$][a-z0-9._$-]*(\/[a-z0-9._$-]+)*\.tsx$/i;

function cleanPath(raw) {
  let p = String(raw || "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  p = p.replace(/^(?:src\/)?routes\//, "");
  if (!p || p.includes("..") || RESERVED.test(p)) return null;
  if (!/\.[a-z]+$/i.test(p)) p += ".tsx";
  if (p.endsWith(".ts")) p = p.slice(0, -3) + ".tsx";
  return SAFE_PATH.test(p) ? p : null;
}

/**
 * Structural check on the tool's output: real paths, real source, an index.
 * Returns the files worth trying to compile plus everything wrong with them.
 */
export function validatePages(input) {
  const problems = [];
  const pages = [];
  const seen = new Set();
  const raw = (input && Array.isArray(input.pages)) ? input.pages : [];
  if (raw.length > MAX_PAGES) problems.push("More than " + MAX_PAGES + " pages were written; only the first " + MAX_PAGES + " were kept.");
  for (const p of raw.slice(0, MAX_PAGES)) {
    const source = p && typeof p.source === "string" ? p.source : "";
    if (!source.trim()) continue;
    const path = cleanPath(p.path);
    if (!path) { problems.push('"' + String(p && p.path).slice(0, 60) + '" is not a route file name — use something like index.tsx or menu.tsx.'); continue; }
    if (seen.has(path)) { problems.push(path + " was written twice; only the first was kept."); continue; }
    if (source.length > MAX_PAGE_CHARS) { problems.push(path + " is over " + MAX_PAGE_CHARS + " characters — split it or cut it down."); continue; }
    if (!/createFileRoute\s*\(/.test(source)) { problems.push(path + " does not export a Route — every page needs createFileRoute(...)."); continue; }
    seen.add(path);
    pages.push({ path, source });
  }
  if (pages.length && !seen.has("index.tsx")) problems.push("There is no index.tsx, so the site has no home page.");
  const notes = (input && typeof input.notes === "string") ? input.notes.trim().slice(0, 600) : "";
  return { pages, notes, problems };
}

// Reads the generated source for the mistakes that compile cleanly and then fail
// at runtime — a page that 403s against its own API looks perfect until it is
// loaded. Deliberately high-precision: every rule here is checked against the
// schema, so a hit is always a real defect, never a style opinion.
export function lintPages(pages, spec) {
  const problems = [];
  const tables = new Map();
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    if (t && t.name) tables.set(String(t.name).toLowerCase(), t);
  }
  const ui = new Set(UI_COMPONENTS);
  const say = (path, msg) => problems.push(path + ": " + msg);
  const memberTables = [...tables.values()].filter((t) => needsMember(t.access));

  for (const { path, source } of pages) {
    // Strip comments and string literals before pattern-matching, so a rule in a
    // doc comment is not reported as the code doing it.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    if (/\b(?:fetch|XMLHttpRequest)\s*\(/.test(code) || /\baxios\b/.test(code)) {
      say(path, "calls fetch directly. Read with useRows and write with useCreateRow from @/lib/rows — no fetch code in a page.");
    }
    if (/@tanstack\/react-form/.test(code)) {
      say(path, "imports @tanstack/react-form. shadcn's Form components only speak to react-hook-form; use useForm from react-hook-form with zodResolver.");
    }
    // Editing and deleting are allowed now, but ONLY on a member's own rows —
    // so a page that offers them without a member has nothing to scope by and
    // the API answers 401.
    const editsRows = /\buseUpdateRow\b|\buseDeleteRow\b/.test(code);
    if (editsRows && !/\buseMember\b/.test(code)) {
      say(path, "calls useUpdateRow/useDeleteRow without useMember(). Only a signed-in member can change a row, and only their own — put the edit UI behind a sign-in.");
    }
    if (editsRows && !memberTables.length) {
      say(path, "calls useUpdateRow/useDeleteRow, but this schema has no member table. `collect` and `display` rows have no owner and can never be edited from a page.");
    }

    for (const m of code.matchAll(/from\s+"@\/components\/ui\/([a-z0-9-]+)"/gi)) {
      if (!ui.has(m[1].toLowerCase())) say(path, 'imports "@/components/ui/' + m[1] + '", which does not exist. Available: ' + UI_COMPONENTS.join(", ") + ".");
    }

    // Read and write are asked separately because the API answers them
    // separately: `feed` and `admin` serve reads and refuse writes, so flagging
    // a read of one would be reporting a defect that does not exist — and every
    // problem reported here costs a paid repair pass.
    // A member-scoped table without useMember() renders a permanent 401 to a
    // signed-out visitor and looks like a broken page rather than a locked one.
    for (const m of code.matchAll(/\buseRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && needsMember(t.access) && !/\buseMember\b/.test(code)) {
        say(path, 'reads "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401, so the page must offer a sign-in rather than an error.');
      }
      if (!t) say(path, 'reads table "' + m[1] + '", which the schema does not declare.');
      // A member table is handled by the rule above: it is readable, just not
      // anonymously. Saying both would report one page twice and pay for a
      // repair pass to fix a problem that was already described.
      else if (!canReadAccess(t.access) && !needsMember(t.access)) {
        say(path, 'lists "' + m[1] + '", which is access "' + t.access + '" — reading it returns 403: ' + whyNotReadable(t.access) + '.');
      }
    }
    // `usePublicRows` is the one read that does NOT follow from a table's access
    // level — it works only where the schema declared a `publicView`, and on
    // every other table it is a 404 the visitor sees as a broken page. The same
    // class as the checks around it: a mismatch between what the page asks for
    // and what the schema actually permits, caught without running anything.
    for (const m of code.matchAll(/\busePublicRows\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'reads table "' + m[1] + '", which the schema does not declare.');
      else if (!hasPublicView(t)) {
        say(path, 'calls usePublicRows("' + m[1] + '"), but that table declares no publicView — the request is a 404. Build the page without the taken-slots hint; the server still refuses a taken slot on submit.');
      }
    }
    for (const m of code.matchAll(/\buseRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (t && needsMember(t.access) && !/\buseMember\b/.test(code)) {
        say(path, 'reads one row of "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401.');
      } else if (t && !canReadAccess(t.access) && !needsMember(t.access)) {
        say(path, 'reads one row of "' + m[1] + '", which is access "' + t.access + '" — reading it returns 403: ' + whyNotReadable(t.access) + '.');
      }
    }
    for (const m of code.matchAll(/\buseCreateRow\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
      const t = tables.get(m[1].toLowerCase());
      if (!t) say(path, 'writes to table "' + m[1] + '", which the schema does not declare.');
      // A member table accepts writes from someone signed in — that is the whole
      // point of the level — so the question is whether the page has a member,
      // not whether the table is writable.
      else if (needsMember(t.access)) {
        if (!/\buseMember\b/.test(code)) {
          say(path, 'writes to "' + m[1] + '" (access "' + t.access + '") without useMember(). Signed out that returns 401, so the form must be behind a sign-in.');
        }
      } else if (!canWriteAccess(t.access)) {
        say(path, 'submits to "' + m[1] + '", which is access "' + t.access + '" — writing to it returns 403. Only a `collect` table accepts a write from a published site.');
      }
    }
  }
  return [...new Set(problems)];
}

/** The repair turn: here is what you wrote, here is what is wrong, write it again. */
export function repairPrompt(brief, spec, pages, problems, brand) {
  const files = pages.map((p) => "=== src/routes/" + p.path + " ===\n" + p.source).join("\n\n");
  return "The pages you wrote did not work. Fix them and return the COMPLETE set of route files again — " +
    "every file, not a patch.\n\nWHAT IS WRONG\n" +
    problems.map((p) => "- " + p).join("\n") +
    "\n\nWHAT YOU WROTE\n" + files.slice(0, 60000) +
    "\n\n" + pagesPrompt(brief, spec, brand);
}

// ------------------------------------------------------- the request itself

/**
 * Page generation is a much bigger call than the schema design — whole .tsx
 * files rather than a handful of column names.
 *
 * Sized above what the pages themselves need: Sonnet 5 runs adaptive thinking
 * when `thinking` is omitted, and max_tokens caps thinking AND the response
 * together, so a budget tight around the files would spend part of itself
 * reasoning and truncate the last one.
 */
export const SITE_PAGES_MAX_TOKENS = 24000;

/**
 * The exact body the Worker POSTs to the model.
 *
 * Extracted so the eval harness issues the SAME request the Worker does. It was
 * built inline in worker.js, which cannot be imported — so any harness had to
 * restate the model, the budget, the tool and the prompt, and would then be
 * tuning against something subtly different from what production runs. A test
 * asserts worker.js calls this rather than rebuilding the body.
 */
export function pagesRequest({ brief, spec, brand, fix } = {}) {
  return {
    model: "claude-sonnet-5",
    max_tokens: SITE_PAGES_MAX_TOKENS,
    tools: [SITE_PAGES_TOOL],
    tool_choice: { type: "tool", name: "write_pages" },
    system: PAGE_RULES,
    messages: [{
      role: "user",
      content: fix
        ? repairPrompt(brief, spec, fix.pages, fix.problems, brand)
        : pagesPrompt(brief, spec, brand),
    }],
  };
}
