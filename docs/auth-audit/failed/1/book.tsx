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

export const Route = createFileRoute("/book")({ component: Book });

type BookedSlot = PublicRow & {
  slot_date: string | null;
  slot_time: string | null;
};

const booking = z.object({
  class_name: z.string().min(1, "Pick a class"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_email: z.string().email("Enter a valid email"),
  slot_date: z.string().min(1, "Pick a date"),
  slot_time: z.string().min(1, "Pick a time"),
});

type Booking = z.infer<typeof booking>;

function Book() {
  const taken = usePublicRows<BookedSlot>("bookings");
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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Book a class</h1>
      <p className="mt-2 text-muted-foreground">
        Pick a class, a date and a time, and we'll hold your spot.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Already taken</h2>
        <div className="mt-3 grid gap-2">
          {taken.isPending && [0, 1].map((i) => <Skeleton key={i} className="h-10 rounded-md" />)}
          {taken.isError && (
            <p className="text-sm text-muted-foreground">
              Couldn't load booked slots — you can still submit a request below.
            </p>
          )}
          {taken.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No slots booked yet — plenty of room.</p>
          )}
          {taken.data?.map((s, i) => (
            <div key={i} className="rounded-md border border-border px-3 py-2 text-sm">
              {s.slot_date ?? "?"} at {s.slot_time ?? "?"} — taken
            </div>
          ))}
        </div>
      </section>

      {confirmed && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>You're booked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {confirmed.claim ? (
              <p>
                Save this link to manage your booking later:{" "}
                <Link
                  className="underline"
                  to="/manage"
                  search={{ id: confirmed.id, claim: confirmed.claim }}
                >
                  Manage booking
                </Link>
              </p>
            ) : (
              <p>We'll email you to confirm.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4 sm:grid-cols-2">
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
    </main>
  );
}
