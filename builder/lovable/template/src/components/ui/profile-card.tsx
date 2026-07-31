import { Card, CardContent } from "@/components/ui/card";
import { AvatarName } from "@/components/ui/avatar-name";
import { cn } from "@/lib/utils";
/** Who is signed in, and what they can do about it. */
export function ProfileCard({ name, email, avatar, meta, actions, className }: {
  name: string; email?: string; avatar?: string | null;
  meta?: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className={cn("flex flex-wrap items-center justify-between gap-4 pt-6")}>
        <AvatarName name={name} subtitle={email} src={avatar} size="lg" />
        {meta}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}
