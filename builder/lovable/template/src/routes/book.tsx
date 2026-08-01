// Reference page — THE FORM. Everything a `collect` table needs: validation
// before a round trip, the four list states behind a Select, the slots somebody
// else has already taken, and the claim link that lets the customer come back.
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

// `claim_token` is a column the schema declares on a `collect` table, and the
// insert hands the whole row back — so the token arrives as part of the row
// rather than beside it. It is NULLABLE, because only a table that declared one
// has it: read it guarded, never destructured as required.
type Appointment = Row & { claim_token: string | null };

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a chair", href: "#/book" },
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
  const [claim, setClaim] = useState<string | null>(null);

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
      onSuccess: (row) => {
        toast.success("Booked — we'll call to confirm.");
        form.reset();
        if (!row.claim_token) return;
        setClaim(row.claim_token);
      },
      // The API separates the caller's fault from a server fault, so its own
      // message is worth showing instead of a generic failure.
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (claim) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-lg px-6 py-20 text-center motion-enter">
          <h1 className="text-3xl font-semibold tracking-tight">You're booked</h1>
          <p className="mt-3 text-muted-foreground">
            Keep this link — it is the only way back to this appointment.
          </p>
          <Button asChild className="mt-6">
            <Link to="/manage" search={{ t: claim }}>
              Manage your booking
            </Link>
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
