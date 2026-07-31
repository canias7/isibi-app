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
    <div className={cn("border-b border-border py-2 last:border-0", className)}>
      {root}
      {replies && replies.length > 0 && (
        <div className="ml-4 flex flex-col border-l pl-4 sm:ml-6 sm:pl-6">{replies}</div>
      )}
    </div>
  );
}
