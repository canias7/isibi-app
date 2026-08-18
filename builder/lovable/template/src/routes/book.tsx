// Reference page — THE FORM. Everything a `collect` table needs: validation
// before a round trip, the four list states behind a Select, the slots somebody
// else has already taken, and a confirmation screen that does not promise the
// customer a link this page cannot obtain.
//
// A `collect` table is write-only: no policy lets anyone list it, so a booking
// page CANNOT read the bookings to work out what is free. `usePublicRows` reads
// a VIEW the schema published for exactly that — the taken times and nothing
// else. If the schema declares no view for a table, ship the ordinary form; a
// visitor is told about a clash on submit instead of before it.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useRows, useCreateRow, usePublicRows, type Row } from "@/lib/rows";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/book")({
  component: Book,
  // WHAT THIS PAGE IS, so a share of it does not preview as the home page.
  // Without a `head` a route inherits the site's own title and description, so
  // every address on the site showed one headline and one blurb — the booking
  // page pasted into a message read as the front page. The root supplies
  // `og:url`, the share image and the card type; a page supplies only these.
  head: () => ({
    meta: [
      { title: "Book a chair — Sharp Fade Barbers" },
      { property: "og:title", content: "Book a chair — Sharp Fade Barbers" },
      { name: "description", content: "Pick a service and a time. Takes about a minute, and you get a link to change it." },
      { property: "og:description", content: "Pick a service and a time. Takes about a minute, and you get a link to change it." },
    ],
  }),
  // Every Book button on the site carries its service here — the price list's
  // per-row button navigates with `search: { service: r.name }` — so the form
  // opens half-filled. Narrowing here is also what TYPES that navigate call.
  // The return type marks the key OPTIONAL (`service?:`), not merely
  // possibly-undefined — without that, every <Link to="/book"> in the site is
  // forced to spell out a search object.
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
});

type Service = Row & { name: string; price: number | null };

// The row shape this form writes. It is a TYPE ARGUMENT ONLY — `useCreateRow`
// resolves to void, because a `collect` table grants no SELECT and asking
// PostgREST to return the inserted row is what made the insert 403.
type Appointment = Row;

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
};

const SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

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

function Book() {
  // A service name that no longer exists simply leaves the Select on its
  // placeholder — a stale link half-fills instead of breaking.
  const { service: preselected } = Route.useSearch();
  const services = useRows<Service>("services", { order: "price", dir: "asc" });
  const create = useCreateRow<Appointment>("appointments");
  // A plain "did it land" flag, not a token. The token could never have arrived
  // — see onSuccess below.
  const [booked, setBooked] = useState(false);

  const form = useForm<Booking>({
    resolver: zodResolver(booking),
    defaultValues: {
      service: preselected ?? "",
      customer_name: "",
      customer_phone: "",
      date: "",
      time: "",
      notes: "",
    },
  });

  // Watched, because which slots are gone depends on the day being asked about.
  const date = form.watch("date");
  // The argument is the TABLE, not the name of a view. A `publicView` is a
  // projection the schema declared ON that table, so `appointments` is what is
  // asked for and the server returns only the published columns.
  //
  // Those rows carry NEVER an `id` — a projection strips it — so they are keyed
  // on a published column. Filters are FLAT: a declared column name is the key,
  // with no `filter` wrapper around it.
  const taken = usePublicRows<{ time: string }>("appointments", date ? { date } : undefined);

  const onSubmit = (values: Booking) => {
    create.mutate(values, {
      // The callback parameter is NOT annotated: TanStack's signature is
      // contravariant in four arguments and refuses any hand-written type here.
      // NOTHING COMES BACK, and this page is why that had to be said out loud.
      // It read `row.claim_token` off the insert — which needs PostgREST to
      // RETURN the row, which needs SELECT, which a write-only `collect` table
      // deliberately does not grant. So the header that fetched the token is
      // what made the INSERT itself 403, and since this file is the reference
      // the generator is derived from, it taught that pattern to every site the
      // builder has produced. Confirmation is the end of the flow; a manage link
      // needs the schema to expose a function that creates AND returns.
      onSuccess: () => {
        toast.success("Booked — we'll call to confirm.");
        form.reset();
        setBooked(true);
      },
      // The API separates the caller's fault from a server fault, so its own
      // message is worth showing instead of a generic failure.
      onError: (e: Error) => toast.error(e.message),
    });
  };

  // THE CONFIRMATION IS THE END OF THE FLOW, and that is a complete site rather
  // than a broken one. Offering a "manage your booking" link here would need a
  // token this page cannot obtain: reading it off the insert is what refused the
  // insert. A site that wants one declares a function that creates AND returns.
  if (booked) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-lg px-6 py-20 text-center motion-enter">
          <h1 className="text-3xl font-semibold tracking-tight">You're booked</h1>
          <p className="mt-3 text-muted-foreground">
            We'll call to confirm within the hour. Need to change it? Give us a ring.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Back to the shop</Link>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Book a chair</h1>
        <p className="mt-2 text-muted-foreground">We'll call to confirm within the hour.</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4 sm:grid-cols-2">
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
                    <Input autoComplete="name" {...field} />
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
                    <Input type="tel" autoComplete="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
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
                <FormItem className="sm:col-span-2">
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    {/* Taken slots are struck through and unpickable, so a visitor
                      sees 09:30 is gone BEFORE submitting rather than being
                      refused after filling the whole form in. */}
                    <AvailabilityGrid
                      slots={SLOTS}
                      taken={taken.data?.map((t) => t.time) ?? []}
                      value={field.value}
                      onSelect={field.onChange}
                    />
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
              {/* Disabled while in flight, or a customer who sees nothing happen
                presses again and books three times. */}
              <Button type="submit" className="motion-press" disabled={create.isPending}>
                {create.isPending ? "Booking…" : "Request appointment"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </SiteChrome>
  );
}
