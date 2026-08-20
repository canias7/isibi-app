import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useLogin, useSignup } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const busy = login.isPending || signup.isPending;

  if (member.data) {
    navigate({ to: "/records" });
    return null;
  }

  const submit = () => {
    if (mode === "login") {
      login.mutate(
        { email, password },
        {
          onSuccess: () => navigate({ to: "/records" }),
          onError: (e) => toast.error(e.message),
        },
      );
    } else {
      signup.mutate(
        { email, password, name },
        {
          onSuccess: () => navigate({ to: "/records" }),
          onError: (e) => toast.error(e.message),
        },
      );
    }
  };

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">One table your whole sales team reads from</h1>
          <p className="mt-4 text-muted-foreground">Halyard is where the team keeps its deals and accounts — one shared pipeline, no spreadsheet passed around by email.</p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>Every deal the team is working, in one filterable table</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>A shared list of accounts everyone can read and add to</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="neutral">soon</StatusBadge><span>Kanban view by stage</span></li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">For the sales team only — sign in with your work account.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create an account"}</CardTitle>
            <CardDescription>
              {mode === "login" ? "Back to the pipeline in one field and a click." : "Join your team's Halyard."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pass">Password</Label>
              <Input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
            <Button className="motion-press" disabled={busy} onClick={submit}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <>New here? <button className="underline underline-offset-4" onClick={() => setMode("signup")}>Create an account</button></>
              ) : (
                <>Already have one? <button className="underline underline-offset-4" onClick={() => setMode("login")}>Sign in</button></>
              )}
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
