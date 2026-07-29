import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";

import { useRows, useCreateRow, usePublicRows, type PublicRow } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export const Route = createFileRoute("/book")({ component: Book });

type TakenSlot = PublicRow & {
  slot_date: string;
  slot_time: string;
};

const booking = z.object({
  class_name: z.string().min(2, "Tell us which class"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_email: z.string().email("A valid email please"),
  slot_date: z.string().min(1, "Pick a date"),
  slot_time: z.string().min(1, "Pick a time"),
});

type Booking = z.infer<typeof booking>;

function Book() {
  const taken = usePublicRows<TakenSlot>("bookings");
  const create = useCreateRow("bookings");
  const [claimInfo, setClaimInfo] = useState<{ id: string; claim: string } | null>(null);

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
        toast.success("You're booked — see you on the mat!");
        if (data.claim) {
          setClaimInfo({ id: data.row.id, claim: data.claim });
        }
        form.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Book a class</h1>
      <p className="mt-2 text-muted-foreground">
        Pick your class, date and time. We'll hold your spot.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Already taken</h2>
        <div className="mt-3 grid gap-2">
          {taken.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}

          {taken.isError && (
            <p className="text-sm text-muted-foreground">
              Couldn't load current bookings — pick a time and we'll confirm it works.
            </p>
          )}

          {taken.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No slots booked yet — plenty of room.</p>
          )}

          {taken.data && taken.data.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {taken.data.map((slot, i) => (
                <span
                  key={i}
                  className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  {slot.slot_date} @ {slot.slot_time}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {claimInfo && (
        <Card className="mt-8 border-primary">
          <CardHeader>
            <CardTitle className="text-base">Manage this booking</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Save this link — it's the only way to view or cancel your booking later:
            <div className="mt-2">
              <Link
                to="/manage"
                search={{ id: claimInfo.id, claim: claimInfo.claim }}
                className="text-primary underline"
              >
                Manage my booking
              </Link>
            </div>
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
