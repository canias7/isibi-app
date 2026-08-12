// Reference page — COMING BACK. The person who filled the form in has no
// account and never will, so a claim token IS their identity: it arrives in the
// confirmation link, it opens exactly one row, and it does nothing else.
//
// Build this page whenever a site takes appointments, orders or reservations —
// anything a customer might need to check, MOVE or cancel. A plain contact form
// does not need one; nobody comes back to look at an enquiry.
//
// CHANGING BEATS CANCELLING, and for a while this page could only cancel. On a
// booking table with `unique` or `noOverlap`, cancel-and-rebook gives the slot
// up before the new one is secured — so the customer can lose the only
// appointment they had, to move it by an hour. Offer the change when the schema
// declares a function for it.
//
// The token is read off the URL. A wrong token and a row that is not there
// answer IDENTICALLY, which is deliberate: a distinct "bad link" would tell
// somebody guessing which bookings exist.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { useClaimedRow, useCancelClaim, useAmendClaim, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/manage")({
  component: Manage,
  // Search params arrive as unknown; narrowing here is what makes the token a
  // string for the rest of the page instead of `unknown`.
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
});

type Appointment = Row & {
  service: string;
  date: string;
  time: string;
  status: string | null;
};

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  tagline: "Six chairs on Cutler Row. Walk in, or book one.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a chair", href: "/book" },
};

function Manage() {
  const { t: claim } = Route.useSearch();
  // The schema declares these three functions; they are named here, not guessed.
  const booking = useClaimedRow<Appointment>("booking_by_claim", claim);
  const cancel = useCancelClaim("cancel_booking_by_claim");
  const amend = useAmendClaim("amend_booking_by_claim");
  const [moving, setMoving] = useState(false);

  const onCancel = () => {
    if (!claim) return;
    cancel.mutate(
      { claim },
      {
        // Idempotent on purpose — a cancel link gets clicked twice, and the second
        // click should read as "already cancelled", never as a broken link.
        onSuccess: () => toast.success("Cancelled. Sorry to miss you."),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const onMove = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!claim) return;
    const form = new FormData(e.currentTarget);
    // The keys are the FUNCTION'S argument names, and the function decides which
    // columns those reach — so this page cannot touch a column the business did
    // not open, and the table's own constraints re-run inside the UPDATE.
    amend.mutate(
      { claim, values: { new_date: String(form.get("date") || ""), new_time: String(form.get("time") || "") } },
      {
        onSuccess: () => { setMoving(false); toast.success("Moved. See you then."); },
        // A slot taken between opening this page and submitting it comes back as
        // the same duplicate error the booking form gets, and says so.
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Your booking</h1>

        {!claim && (
          <p className="mt-4 text-muted-foreground">
            This page needs the link from your confirmation.{" "}
            <Link to="/book" className="underline">
              Book a chair
            </Link>{" "}
            instead.
          </p>
        )}

        {claim && booking.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}

        {claim && booking.isError && (
          <p className="mt-4 text-sm text-destructive">
            Couldn't load your booking. Refresh and try again.
          </p>
        )}

        {/* A missing row and a wrong token land here together, and say the same
            thing — which is the whole point. */}
        {claim && !booking.isPending && !booking.isError && !booking.data && (
          <p className="mt-4 text-muted-foreground">
            We couldn't find that booking. It may have been cancelled already.
          </p>
        )}

        {booking.data && (
          <Card className="mt-6 motion-enter">
            <CardHeader>
              <CardTitle>{booking.data.service}</CardTitle>
              <CardDescription className="tabular-nums">
                {booking.data.date} at {booking.data.time}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {booking.data.status === "cancelled" ? "Cancelled" : "Confirmed"}
                </span>
                {booking.data.status !== "cancelled" && (
                  <div className="flex gap-2">
                    {/* CHANGE SITS BEFORE CANCEL, and reads as the ordinary
                        action, because moving an appointment is what somebody
                        opening this link usually wants. Cancel stays
                        destructive and second. */}
                    <Button variant="outline" onClick={() => setMoving((v) => !v)}>
                      {moving ? "Keep it" : "Change time"}
                    </Button>
                    <Button variant="destructive" onClick={onCancel} disabled={cancel.isPending}>
                      {cancel.isPending ? "Cancelling…" : "Cancel booking"}
                    </Button>
                  </div>
                )}
              </div>

              {moving && booking.data.status !== "cancelled" && (
                /* PRE-FILLED with what they already have, so moving by an hour
                   is one field and not a re-entry of the whole booking. */
                <form onSubmit={onMove} className="flex flex-wrap items-end gap-3 border-t pt-4">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <Input type="date" name="date" defaultValue={booking.data.date} required />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <Input type="time" name="time" defaultValue={booking.data.time} required />
                  </label>
                  <Button type="submit" disabled={amend.isPending}>
                    {amend.isPending ? "Moving…" : "Move booking"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SiteChrome>
  );
}
