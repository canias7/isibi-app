import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Answering a consultation — with what happens to the answer.
 *
 * IT SAYS WHETHER RESPONSES ARE PUBLISHED, AND WITH WHAT ATTRIBUTION, BEFORE
 * the text box. Somebody writing about their own housing, health or immigration
 * status is making a decision about publicity, and discovering afterwards that
 * their name is attached is the harm this prevents.
 *
 * IT IS HONEST THAT A CONSULTATION IS NOT A VOTE. Responses are weighed, not
 * counted, and a well-argued minority position can change an outcome while a
 * thousand identical form letters do not. Saying so improves the responses and
 * respects the reader.
 *
 * IT ASKS WHO IS RESPONDING. An individual, an organisation and a professional
 * body carry different weight for legitimate reasons, and an unattributed
 * response is regularly discounted for want of that one field.
 *
 * IT SAYS WHEN AND WHERE THE OUTCOME APPEARS. The commonest complaint about
 * consultation is not being told what happened, and it is fixed by one sentence.
 */
export function ConsultationResponse({ question, published = true, attribution = "name only", anonymousAllowed = true, outcomeNote, value, onChange, respondentType, onRespondentTypeChange, className }: {
  question: string;
  /** Whether responses are published at all. */
  published?: boolean;
  /** What is published alongside — "name only", "name and organisation", "nothing". */
  attribution?: string;
  anonymousAllowed?: boolean;
  /** When and where the outcome appears. */
  outcomeNote?: string;
  value?: string;
  onChange?: (next: string) => void;
  respondentType?: string;
  onRespondentTypeChange?: (next: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div data-slot="consultation-response" className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium">{question}</p>
      <p className="text-xs text-muted-foreground">
        {published
          ? `Responses are published, with your ${attribution}.`
          : "Responses are not published."}
        {anonymousAllowed && " You can ask for yours to be anonymous."}
      </p>
      <div className="space-y-1">
        <label htmlFor={`${id}-who`} className="block text-xs font-medium">Responding as</label>
        <select
          id={`${id}-who`}
          value={respondentType ?? ""}
          onChange={(e) => onRespondentTypeChange?.(e.target.value)}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Choose one</option>
          <option value="individual">An individual</option>
          <option value="organisation">An organisation</option>
          <option value="professional">A professional or representative body</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={id} className="block text-xs font-medium">Your response</label>
        <textarea
          id={id}
          rows={4}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          Responses are weighed, not counted — one well-argued point does more than a hundred identical ones.
        </p>
      </div>
      {outcomeNote && <p className="text-xs">{outcomeNote}</p>}
    </div>
  );
}
