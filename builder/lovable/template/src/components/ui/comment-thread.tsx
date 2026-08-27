import { cn } from "@/lib/utils";
/**
 * Replies, indented ONE level only.
 *
 * Arbitrary nesting produces threads three words wide on a phone. One level of
 * indent is enough to show a reply is a reply.
 */
export function CommentThread({ root, replies, className }: {
  root: React.ReactNode; replies?: React.ReactNode[]; className?: string;
}) {
  return (
    <div data-slot="comment-thread" className={cn("border-b border-border py-2 last:border-0", className)}>
      {root}
      {replies && replies.length > 0 && (
        <div className="ms-4 flex flex-col border-s ps-4 sm:ms-6 sm:ps-6">{replies}</div>
      )}
    </div>
  );
}
