import { cn } from "@/lib/utils";
/**
 * Who is in a comment thread — and, more usefully, who will be notified.
 *
 * "WHO GETS NOTIFIED" IS NOT THE SAME AS "WHO HAS COMMENTED", and conflating
 * them is how somebody writes something candid believing it is between two
 * people. A watcher who has never posted is invisible in every participant list
 * built from the messages, which is exactly the person you would want to know
 * about.
 *
 * IT NAMES THEM RATHER THAN COUNTING. "4 people" is not checkable; four names
 * are, and spotting one that should not be there is the entire reason to look.
 *
 * THE AUTHOR IS MARKED, since a reply from the person who raised the thread
 * means something different from a reply by a bystander, and the list is where
 * that is cheapest to say.
 *
 * `<ul>` OF NAMES, not avatars. A row of circular photographs is unreadable
 * without hovering, and this component exists precisely to be read.
 */
export type Participant = { id: string; name: string; author?: boolean; watching?: boolean };

export function ThreadParticipants({ people, label = "In this thread", className }: {
  people: Participant[];
  label?: string;
  className?: string;
}) {
  if (!people.length) return null;
  const watchers = people.filter((p) => p.watching);
  return (
    <div data-slot="thread-participants" className={cn("space-y-0.5 text-xs", className)}>
      <p className="text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-x-2 gap-y-0.5">
        {people.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.author && <span className="text-muted-foreground"> (started it)</span>}
            {!p.author && p.watching && <span className="text-muted-foreground"> (watching)</span>}
          </li>
        ))}
      </ul>
      {watchers.length > 0 && (
        <p className="text-muted-foreground">
          {watchers.length === 1
            ? `${watchers[0].name} is notified but has not commented.`
            : `${watchers.length} people are notified but have not commented.`}
        </p>
      )}
    </div>
  );
}
