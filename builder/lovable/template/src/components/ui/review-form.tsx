import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { FormRow } from "@/components/ui/form-row";
import { RatingInput } from "@/components/ui/rating-input";
import { TextareaCount } from "@/components/ui/textarea-count";
/** Leave a review. The rating is required; the words are not. */
export function ReviewForm({ onSubmit, busy, className }: {
  onSubmit: (v: { rating: number; body: string }) => void; busy?: boolean; className?: string;
}) {
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState("");
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); if (rating) onSubmit({ rating, body }); }}>
      <div className="flex flex-col gap-4">
        <FormRow label="Your rating" required><RatingInput value={rating} onChange={setRating} /></FormRow>
        <FormRow label="Anything to add?" htmlFor="rv-body">
          <TextareaCount id="rv-body" value={body} onChange={setBody} max={600} />
        </FormRow>
        <BusyButton type="submit" busy={busy} busyLabel="Posting…" disabled={!rating} className="w-fit">
          Post review
        </BusyButton>
      </div>
    </form>
  );
}
