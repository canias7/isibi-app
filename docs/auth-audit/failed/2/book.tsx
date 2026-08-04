import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useCreateRow, usePublicRows, type Row } from "@/lib/rows";
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

export const Route = createFileRoute("/book")({
  component: Book,
  validateSearch: (search: Record<string, unknown>): { class?: string } => ({
    class: typeof search.class === "string" ? search.class : undefined,
  }),
});

type Booking = Row & Record<string, never>;

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const SLOTS = ["07:00", "09:00", "18:15", "19:00", "19:30"];

const booking = z.object({
  class_name: z.string().min(1, "Tell us which class"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_email: z.string().email("That doesn't look like an email address"),
  slot_date: z.string().min(1, "Pick a date"),
  slot_time: z.string().min(1, "Pick a time"),
});

type BookingForm = z.infer<typeof booking>;

function Book() {
  const { class: preselected } = Route.useSearch();
  const create = useCreateRow<Row>("bookings");

  const form = useForm<BookingForm>({
    resolver: zodResolver(booking),
    defaultValues: {
      class_name: preselected ?? "",
      customer_name: "",
      customer_email: "",
      slot_date: "",
      slot_time: "",
    },
  });

  const slot_date = form.watch("slot_date");
  const taken = usePublicRows<{ slot_date: string; slot_time: string }>(
    "bookings",
    slot_date ? { slot_date } : undefined,
  );

  const onSubmit = (values: BookingForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Booked — see you on the mat.");
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Book a class</h1>
        <p className="mt-2 text-muted-foreground">
          Fill this in and we'll hold your spot on the mat.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="class_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Class</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Vinyasa" {...field} />
                  </FormControl>
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
                {create.isPending ? "Booking…" : "Book class"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </SiteChrome>
  );
}
