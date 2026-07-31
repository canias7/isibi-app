import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  useMember,
  useLogout,
  useSessions,
  useRevokeSession,
  useLogoutOthers,
  useAddPasskey,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import SignInPrompt from "@/components/sign-in-prompt";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-semibold">Your account</h1>
        <p className="mt-2 text-muted-foreground">Sign in to manage your account and devices.</p>
        <div className="mt-8">
          <SignInPrompt />
        </div>
      </main>
    );
  }

  return <AccountDetail email={member.data.email} />;
}

function AccountDetail({ email }: { email: string }) {
  const logout = useLogout();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutOthers = useLogoutOthers();
  const addPasskey = useAddPasskey();
  const [addingPasskey, setAddingPasskey] = useState(false);

  const onRevoke = (sid: string, isCurrent: boolean) => {
    revoke.mutate(
      { sid },
      {
        onSuccess: () => {
          if (isCurrent) {
            toast.success("Signed out on this device.");
            logout();
          } else {
            toast.success("That device has been signed out.");
          }
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const onLogoutOthers = () => {
    logoutOthers.mutate(undefined, {
      onSuccess: () => toast.success("Signed out everywhere else."),
      onError: (e) => toast.error(e.message),
    });
  };

  const onAddPasskey = async () => {
    setAddingPasskey(true);
    try {
      await addPasskey.mutateAsync();
      toast.success("Passkey added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add a passkey.");
    } finally {
      setAddingPasskey(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Your account</h1>
      <p className="mt-2 text-muted-foreground">{email}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="outline" onClick={onAddPasskey} disabled={addingPasskey}>
          {addingPasskey ? "Adding…" : "Add a passkey"}
        </Button>
        <Button variant="outline" onClick={onLogoutOthers} disabled={logoutOthers.isPending}>
          {logoutOthers.isPending ? "Working…" : "Sign out everywhere else"}
        </Button>
        <Button variant="destructive" onClick={() => logout()}>
          Sign out
        </Button>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-medium">Signed-in devices</h2>
        <div className="mt-4 grid gap-3">
          {sessions.isPending &&
            [0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}

          {sessions.isError && (
            <p className="text-sm text-destructive">Couldn't load your sessions right now.</p>
          )}

          {sessions.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          )}

          {sessions.data?.map((s) => (
            <Card key={s.sid}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {s.device}
                    {s.current && <Badge>This device</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {s.country ?? "Unknown location"} · {s.lastSeenLabel}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRevoke(s.sid, s.current)}>
                  Sign out
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
