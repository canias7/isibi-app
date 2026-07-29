import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";

import { useCreateRow, usePublicRows, type PublicRow } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/booking")({ component: Booking });

type BookedSlot = PublicRow & {
  slot_date: string;
  slot_time: string;
};

const booking = z.object({
  class_name: z.string().min(1, "Pick a class"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_email: z.string().email("Needs to be a valid email"),
  slot_date: z.string().min(1, "Pick a date"),
  slot_time: z.string().min(1, "Pick a time"),
});

type Booking = z.infer<typeof booking>;

function Booking() {
  const slots = usePublicRows<BookedSlot>("bookings");
  const create = useCreateRow("bookings");
  const [confirmed, setConfirmed] = useState<{ id: string; claim?: string } | null>(null);

  const form = useForm<Booking>({
    resolver: zodResolver(booking),
    defaultValues: {
      class_name: "",
      customer_name: "",
      customer_email: "",
      slot_date: "",
      slot_time: "",
    },
  });

  const onSubmit = (values: Booking) => {
    create.mutate(values, {
      onSuccess: (data) => {
        toast.success("Booked — see you on the mat!");
        setConfirmed({ id: data.row.id, claim: data.claim });
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Book a class</h1>
      <p className="mt-2 text-muted-foreground">
        Pick your class, date and time. Slots already taken below are unavailable —
        choose another time if yours is greyed out.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Already booked</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {slots.isPending &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}

          {slots.isError && (
            <p className="text-sm text-destructive sm:col-span-3">
              Couldn't load current bookings, but you can still submit the form below.
            </p>
          )}

          {slots.data?.length === 0 && (
            <p className="text-sm text-muted-foreground sm:col-span-3">
              No classes booked yet — be the first!
            </p>
          )}

          {slots.data?.map((s, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              {s.slot_date} at {s.slot_time}
            </div>
          ))}
        </div>
      </section>

      {confirmed && (
        <Card className="mt-10 border-primary">
          <CardHeader>
            <CardTitle>You're booked!</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {confirmed.claim ? (
              <>
                Save this link to view or cancel your booking later:{" "}
                <Link
                  className="underline"
                  to="/manage"
                  search={{ id: confirmed.id, claim: confirmed.claim }}
                >
                  Manage my booking
                </Link>
              </>
            ) : (
              "We've got your booking on file."
            )}
          </CardContent>
        </Card>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Reserve your spot</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="class_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Class</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Vinyasa Flow" {...field} />
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
                    <Input {...field} />
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
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slot_date"
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
              name="slot_time"
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

            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Booking…" : "Request booking"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </main>
  );
}
