import { AvatarName } from "@/components/ui/avatar-name";
/** Who wrote it. */
export function AuthorByline({ name, role, avatar, className }: {
  name: string; role?: string | null; avatar?: string | null; className?: string;
}) {
  return <AvatarName name={name} subtitle={role} src={avatar} size="sm" className={className} />;
}
