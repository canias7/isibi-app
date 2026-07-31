import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";

import { useClaimedRow, useCancelClaim, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/manage")({
  component: Manage,
  validateSearch: z.object({
    id: z.string().catch(""),
    claim: z.string().catch(""),
  }),
});

type Booking = Row & {
  class_name: string;
  customer_name: string;
  customer_email: string;
  slot_date: string;
  slot_time: string;
};

function Manage() {
  const { id, claim } = Route.useSearch();
  const navigate = useNavigate();
  const booking = useClaimedRow<Booking>("bookings", id, claim);
  const cancel = useCancelClaim("bookings");

  if (!id || !claim) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage booking</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This link is missing its booking details. Use the link you were given after
          booking to view it here.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Manage booking</h1>

      {booking.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}

      {booking.isError && (
        <p className="mt-6 text-sm text-destructive">
          We couldn't find that booking. It may already have been cancelled.
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
          <CardContent className="space-y-4 text-sm">
            <p>Booked under {booking.data.customer_name} ({booking.data.customer_email})</p>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { id, claim },
                  {
                    onSuccess: () => {
                      toast.success("Booking cancelled.");
                      navigate({ to: "/booking" });
                    },
                    onError: (e: Error) => toast.error(e.message),
                  }
                )
              }
            >
              {cancel.isPending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
