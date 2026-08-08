import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMember, useLogin, useSignup } from "@/lib/rows";
import { toast } from "sonner";
import { LoginForm } from "@/components/ui/login-form";
import { SignupForm } from "@/components/ui/signup-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FeatureGrid } from "@/components/ui/feature-grid";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const navigate = useNavigate();

  useEffect(() => {
    if (member.data) navigate({ to: "/records" });
  }, [member.data, navigate]);

  if (member.isPending || member.data) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading Halyard…</div>;
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every deal your team is working, in one shared table
          </h1>
          <p className="mt-4 text-muted-foreground">
            Halyard is the internal deal tracker for a small sales team. Sign in and see
            the team's pipeline — every deal, its stage, and who is on it — with a shared
            list of accounts and the playbook everyone follows.
          </p>
          <FeatureGrid
            className="mt-8"
            columns={2}
            items={[
              { title: "Shared pipeline", description: "Every deal the team owns, in one table." },
              { title: "Shared accounts", description: "One list, everyone reads and adds." },
              { title: "Full record view", description: "Header, fields, activity — one screen." },
              { title: "The playbook", description: "Read-only, kept current by the business." },
            ]}
          />
          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Search, filter and bulk-act on the team's deals</span>
            </li>
            <li className="flex items-start gap-3">
              <StatusBadge state="success">live</StatusBadge>
              <span>Open any deal to its own header, fields and trail</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Built for the team — not a public site. Sign in to get to work.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in to Halyard</CardTitle>
            <CardDescription>Back to the pipeline in a moment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <LoginForm
                  busy={login.isPending}
                  error={login.error?.message ?? null}
                  onSubmit={(v) =>
                    login.mutate(v, {
                      onSuccess: () => navigate({ to: "/records" }),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <SignupForm
                  busy={signup.isPending}
                  error={signup.error?.message ?? null}
                  onSubmit={(v) =>
                    signup.mutate(v, {
                      onSuccess: () => navigate({ to: "/records" }),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
