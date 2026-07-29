import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";

import { useClaimedRow, useCancelClaim, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Booking = Row & {
  class_name: string;
  customer_name: string;
  customer_email: string;
  slot_date: string;
  slot_time: string;
};

const searchSchema = z.object({
  id: z.string().catch(""),
  claim: z.string().catch(""),
});

export const Route = createFileRoute("/manage")({
  component: Manage,
  validateSearch: searchSchema,
});

function Manage() {
  const { id, claim } = useSearch({ from: "/manage" });
  const booking = useClaimedRow<Booking>("bookings", id, claim);
  const cancel = useCancelClaim("bookings");

  if (!id || !claim) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Manage booking</h1>
        <p className="mt-2 text-muted-foreground">
          This link is missing its details. Use the link you were given when you booked.
        </p>
      </main>
    );
  }

  const onCancel = () => {
    cancel.mutate(
      { id, claim },
      {
        onSuccess: () => toast.success("Booking cancelled."),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Manage booking</h1>

      {booking.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}

      {booking.isError && (
        <p className="mt-6 text-sm text-destructive">
          We couldn't find that booking. It may have already been cancelled.
        </p>
      )}

      {booking.data && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{booking.data.class_name}</CardTitle>
            <CardDescription>
              {booking.data.slot_date} at {booking.data.slot_time}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Booked under {booking.data.customer_name} ({booking.data.customer_email})
          </CardContent>
          <CardContent>
            <Button variant="destructive" onClick={onCancel} disabled={cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
