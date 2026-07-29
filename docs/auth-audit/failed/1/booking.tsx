import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { useCreateRow, usePublicRows, type PublicRow, type RowId } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/booking")({ component: Booking });

const CLASSES = ["Morning Flow", "Gentle Stretch", "Evening Vinyasa"];

type TakenSlot = PublicRow & { slot_date: string; slot_time: string };

const booking = z.object({
  class_name: z.string().min(1, "Pick a class"),
  customer_name: z.string().min(2, "Tell us your name"),
  customer_email: z.string().email("Enter a valid email"),
  slot_date: z.string().min(1, "Pick a date"),
  slot_time: z.string().min(1, "Pick a time"),
});

type Booking = z.infer<typeof booking>;

function Booking() {
  const taken = usePublicRows<TakenSlot>("bookings");
  const create = useCreateRow("bookings");
  const [confirmed, setConfirmed] = useState<{ id: RowId; claim: string } | null>(null);

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
        toast.success("You're booked — see you on the mat.");
        if (data.claim) {
          setConfirmed({ id: data.row.id, claim: data.claim });
        }
        form.reset();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Book a class</h1>
      <p className="mt-2 text-muted-foreground">
        Pick a class, date and time. We'll hold your spot the moment you submit.
      </p>

      {confirmed && (
        <Card className="mt-6 border-primary">
          <CardHeader>
            <CardTitle>Booking confirmed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Save this link to view or cancel your booking later:{" "}
            <Link
              to="/manage"
              search={{ id: String(confirmed.id), claim: confirmed.claim }}
              className="text-foreground underline"
            >
              Manage my booking
            </Link>
          </CardContent>
        </Card>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-medium">Already taken</h2>
        <div className="mt-3">
          {taken.isPending && <Skeleton className="h-16 rounded-xl" />}
          {taken.isError && (
            <p className="text-sm text-destructive">Couldn't load current bookings. You can still book below.</p>
          )}
          {taken.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No slots taken yet — plenty of room.</p>
          )}
          {taken.data && taken.data.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {taken.data.map((t, i) => (
                <li key={i} className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  {t.slot_date} at {t.slot_time}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="class_name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Class</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CLASSES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
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
