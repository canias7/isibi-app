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

export const Route = createFileRoute("/book")({
  component: Book,
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
});

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };
type Appointment = Row;

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit room. Come as you are.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The work", href: "/work" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

const CLASS_NAMES = [
  "Morning Flow",
  "Hatha Foundations",
  "Power Vinyasa",
  "Restorative",
  "Candlelit Yin",
];

const SLOTS = ["07:00", "08:00", "09:15", "12:00", "17:30", "18:30", "19:30"];

const booking = z.object({
  class_name: z.string().min(1, "Pick a class"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_email: z.string().email("That doesn't look like an email address"),
  slot_date: z.string().min(1, "Pick a date"),
  slot_time: z.string().min(1, "Pick a time"),
});

type Booking = z.infer<typeof booking>;

function Book() {
  const { service: preselected } = Route.useSearch();
  const create = useCreateRow<Appointment>("bookings");
  const teachers = useRows<Teacher>("teachers");
  const [booked, setBooked] = useState(false);

  const form = useForm<Booking>({
    resolver: zodResolver(booking),
    defaultValues: {
      class_name: preselected ?? "",
      customer_name: "",
      customer_email: "",
      slot_date: "",
      slot_time: "",
    },
  });

  const slotDate = form.watch("slot_date");
  const taken = usePublicRows<{ slot_date: string; slot_time: string }>(
    "bookings",
    slotDate ? { slot_date: slotDate } : undefined,
  );

  const onSubmit = (values: Booking) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Booked — see you on your mat.");
        form.reset();
        setBooked(true);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (booked) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-lg px-6 py-20 text-center motion-enter">
          <h1 className="text-3xl font-semibold tracking-tight">You're booked</h1>
          <p className="mt-3 text-muted-foreground">
            We've noted your spot. To change or cancel, get in touch with the studio directly.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Back to the studio</Link>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Book a class</h1>
        <p className="mt-2 text-muted-foreground">Pick a class, a date and a time — takes under a minute.</p>

        {!teachers.isPending && !!teachers.data?.length && (
          <p className="mt-4 text-sm text-muted-foreground">
            Taught by {teachers.data.map((t) => t.name).join(", ")}.
          </p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="class_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Class</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose one" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CLASS_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
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
              name="customer_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slot_date"
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
              name="slot_time"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <AvailabilityGrid
                      slots={SLOTS}
                      taken={taken.data?.map((t) => t.slot_time) ?? []}
                      value={field.value}
                      onSelect={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2">
              <Button type="submit" className="motion-press" disabled={create.isPending}>
                {create.isPending ? "Booking…" : "Book my spot"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </SiteChrome>
  );
}
