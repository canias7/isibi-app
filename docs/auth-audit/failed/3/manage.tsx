import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useClaimedRow, useCancelClaim, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type BookingSearch = { id: string; claim: string };

export const Route = createFileRoute("/manage")({
  component: Manage,
  validateSearch: (search: Record<string, unknown>): BookingSearch => ({
    id: typeof search.id === "string" ? search.id : "",
    claim: typeof search.claim === "string" ? search.claim : "",
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
  const booking = useClaimedRow<Booking>("bookings", id, claim);
  const cancel = useCancelClaim("bookings");

  if (!id || !claim) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Manage booking</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This link is missing its booking details. Use the link you were given
          right after booking.
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
      <h1 className="text-3xl font-semibold tracking-tight">Manage booking</h1>

      {booking.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}

      {booking.isError && (
        <p className="mt-6 text-sm text-destructive">
          Couldn't find this booking — the link may be wrong or it's already been cancelled.
        </p>
      )}

      {booking.data && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{booking.data.class_name}</CardTitle>
            <CardDescription>
              {booking.data.slot_date} @ {booking.data.slot_time}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Booked by {booking.data.customer_name}</p>
            <p className="text-muted-foreground">{booking.data.customer_email}</p>
            <Button
              variant="destructive"
              className="mt-4"
              onClick={onCancel}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
