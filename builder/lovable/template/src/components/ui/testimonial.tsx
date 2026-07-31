import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Quote = { quote: string; name: string; role?: string | null; initials?: string };

/** One customer saying something. */
export function Testimonial({ item, className }: { item: Quote; className?: string }) {
  const initials = item.initials || item.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-4 pt-6">
        <p className="text-balance">&ldquo;{item.quote}&rdquo;</p>
        <div className="flex items-center gap-3">
          <Avatar className="size-8"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
          <div className="text-sm">
            <div className="font-medium">{item.name}</div>
            {item.role && <div className="text-muted-foreground">{item.role}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Several of them. */
export function TestimonialGrid({ items, className }: { items: Quote[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((q, i) => <Testimonial key={q.name + i} item={q} />)}
    </div>
  );
}
