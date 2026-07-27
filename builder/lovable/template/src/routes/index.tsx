// Reference page. Hand-written against the schema the designer actually
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
                  {s.price != null && <span className="tabular-nums">${s.price}</span>}
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
