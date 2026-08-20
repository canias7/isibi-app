import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addDays, startOfWeek, format } from "date-fns";

import { useCreateRow, usePublicRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeekStrip } from "@/components/ui/week-strip";
import { AvailabilityGrid } from "@/components/ui/availability-grid";

export const Route = createFileRoute("/book")({
  component: Book,
  head: () => ({
    meta: [
      { title: "Book a class — Aurora Yoga" },
      { property: "og:title", content: "Book a class — Aurora Yoga" },
      { name: "description", content: "Pick a class and a time, and leave your name and email to book your spot." },
      { property: "og:description", content: "Pick a class and a time, and leave your name and email to book your spot." },
    ],
  }),
});

type Booking = Row;

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice, six classes a week.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a class", href: "/book" },
};

const CLASSES = [
  "Morning Flow",
  "Vinyasa",
  "Gentle Hatha",
  "Power Yoga",
  "Restorative",
  "Family Flow",
];

const SLOTS = ["07:00", "09:30", "10:00", "11:30", "18:00", "19:00"];

const booking = z.object({
  class_name: z.string().min(1, "Pick a class"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_email: z.string().email("That doesn't look like an email address"),
  slot_date: z.string().min(1, "Pick a day"),
  slot_time: z.string().min(1, "Pick a time"),
});

type BookingForm = z.infer<typeof booking>;

function Book() {
  const create = useCreateRow<Booking>("bookings");
  const [booked, setBooked] = useState(false);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const form = useForm<BookingForm>({
    resolver: zodResolver(booking),
    defaultValues: {
      class_name: "",
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

  const onSubmit = (values: BookingForm) => {
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
            We've saved your spot. Arrive ten minutes early for a mat.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href="/">Back to the studio</a>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Book a class</h1>
        <p className="mt-2 text-muted-foreground">Pick a class and a time — takes less than a minute.</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-5">
            <FormField
              control={form.control}
              name="class_name"
              render={({ field, fieldState }) => (
                <FormRow label="Class" error={fieldState.error?.message} required>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormRow>
              )}
            />

            <FormField
              control={form.control}
              name="slot_date"
              render={({ field, fieldState }) => (
                <FormRow label="Day" error={fieldState.error?.message} required>
                  <WeekStrip
                    start={weekStart}
                    value={field.value || null}
                    onSelect={field.onChange}
                  />
                </FormRow>
              )}
            />

            <FormField
              control={form.control}
              name="slot_time"
              render={({ field, fieldState }) => (
                <FormRow label="Time" error={fieldState.error?.message} required>
                  <AvailabilityGrid
                    slots={SLOTS}
                    taken={taken.data?.map((t) => t.slot_time) ?? []}
                    value={field.value}
                    onSelect={field.onChange}
                  />
                </FormRow>
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

            <Button type="submit" className="motion-press" disabled={create.isPending}>
              {create.isPending ? "Booking…" : "Book a class"}
            </Button>
          </form>
        </Form>
      </div>
    </SiteChrome>
  );
}
