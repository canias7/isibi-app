import { cn } from "@/lib/utils";
/**
 * A wrapper for rich text a site OWNS but did not write in JSX — an About page,
 * a policy, a long description out of the database. Styles descendants, so the
 * content needs no classes of its own.
 */
export function Prose({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="prose" className={cn(
      "max-w-prose text-[15px] leading-7",
      "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
      "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold",
      "[&_p]:mt-4 [&_p:first-child]:mt-0",
      "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:ps-5 [&_li]:mt-1",
      "[&_a]:underline [&_a]:underline-offset-4",
      "[&_blockquote]:mt-4 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground",
      "[&_hr]:my-8 [&_hr]:border-border",
      className)}>{children}</div>
  );
}
