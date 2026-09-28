import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useCreateRow, useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
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
import { PhoneInput } from "@/components/ui/phone-input";
import { RadioCards } from "@/components/ui/radio-cards";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { SuccessPanel } from "@/components/ui/success-panel";
import { TimeSlot } from "@/components/ui/time-slot";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Order a loaf — Harbour Loaf" },
      { property: "og:title", content: "Order a loaf — Harbour Loaf" },
      {
        name: "description",
        content: "Choose a loaf from today's bake and a collection time at the counter.",
      },
      {
        property: "og:description",
        content: "Choose a loaf from today's bake and a collection time at the counter.",
      },
    ],
  }),
  component: Order,
});

type Loaf = Row & {
  name: string;
  description: string | null;
  price: number;
  photo: string | null;
};

type OrderRow = Row;

const CHROME = {
  name: "Harbour Loaf",
  tagline: "A neighbourhood sourdough bakery in Bristol.",
  links: [
    { label: "Today's bake", href: "/" },
    { label: "The starter", href: "/starter" },
    { label: "Visit", href: "/visit" },
  ],
  action: { label: "Order a loaf", href: "/order" },
  contact: {
    address: "Bristol",
    hours: "Wed–Sat 8–2, Sun 9–1",
  },
};

const SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
];

const orderSchema = z.object({
  customer_name: z.string().min(2, "Tell us your name"),
  phone: z.string().min(6, "We need a number for the counter"),
  loaf: z.string().min(1, "Pick a loaf"),
  pickup_date: z.string().min(1, "Pick a collection day"),
  pickup_time: z.string().min(1, "Pick a collection time"),
});

type OrderValues = z.infer<typeof orderSchema>;

function Order() {
  const loaves = useRows<Loaf>("loaves", { order: "name", dir: "asc" });
  const create = useCreateRow<OrderRow>("orders");
  const [sent, setSent] = useState(false);

  const form = useForm<OrderValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_name: "",
      phone: "",
      loaf: "",
      pickup_date: "",
      pickup_time: "",
    },
  });

  const onSubmit = (values: OrderValues) => {
    create.mutate(
      {
        customer_name: values.customer_name,
        phone: values.phone,
        loaf: Number(values.loaf),
        pickup_date: values.pickup_date,
        pickup_time: values.pickup_time,
      },
      {
        onSuccess: () => {
          toast.success("Order received — see you at the counter.");
          form.reset();
          setSent(true);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  if (sent) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-lg px-6 py-20 motion-enter">
          <h1 className="sr-only">Order received</h1>
          <SuccessPanel
            title="Order received"
            description="See you at the counter. We'll have your loaf ready for the slot you picked. Pay when you collect."
            action={{ label: "Back to today's bake", href: "/" }}
          />
        </div>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Order a loaf</h1>
        <SectionHeader
          className="mt-8"
          eyebrow="Collection"
          title="Pick a loaf and a collection slot"
          description="Your name, a phone number, and a time. Pay at the counter when you come."
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-10 grid gap-6">
            <FormField
              control={form.control}
              name="loaf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Today's loaves</FormLabel>
                  <FormControl>
                    <div>
                      {loaves.isPending && <Skeleton className="h-40 rounded-xl" />}
                      {loaves.isError && (
                        <p className="text-sm text-destructive">
                          Couldn't load today's bake. Refresh and try again.
                        </p>
                      )}
                      {loaves.data?.length === 0 && (
                        <Empty>
                          <p className="font-medium">Today's bake is not up yet</p>
                          <p className="text-sm text-muted-foreground">
                            Come back once the boards are written, or walk in and see what is left.
                          </p>
                        </Empty>
                      )}
                      {!!loaves.data?.length && (
                        <RadioCards
                          columns={1}
                          options={loaves.data.map((l) => ({
                            value: String(l.id),
                            label: l.name,
                            description: l.description
                              ? `£${l.price.toFixed(2)} · ${l.description}`
                              : `£${l.price.toFixed(2)}`,
                          }))}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customer_name"
              render={({ field, fieldState }) => (
                <FormRow
                  label="Your name"
                  htmlFor="customer_name"
                  required
                  error={fieldState.error?.message}
                >
                  <Input id="customer_name" autoComplete="name" {...field} />
                </FormRow>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field, fieldState }) => (
                <FormRow
                  label="Phone"
                  htmlFor="phone"
                  required
                  hint="So we can reach you if a loaf runs short."
                  error={fieldState.error?.message}
                >
                  <PhoneInput id="phone" value={field.value} onChange={field.onChange} />
                </FormRow>
              )}
            />

            <FormField
              control={form.control}
              name="pickup_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection day</FormLabel>
                  <FormControl>
                    <Input type="date" min={new Date().toISOString().slice(0, 10)} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pickup_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection time</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2 motion-stagger">
                      {SLOTS.map((t) => (
                        <TimeSlot
                          key={t}
                          time={t}
                          selected={field.value === t}
                          onSelect={() => field.onChange(t)}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="text-sm text-muted-foreground">
              Collection only — we do not deliver. Pay at the counter when you pick it up.
            </p>

            <div>
              <Button
                type="submit"
                className="motion-press"
                disabled={create.isPending || !loaves.data?.length}
              >
                {create.isPending ? <Spinner /> : null}
                {create.isPending ? "Sending…" : "Order a loaf"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </SiteChrome>
  );
}
