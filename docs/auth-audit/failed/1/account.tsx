import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";

import {
  useMember,
  useSignInMethods,
  useLogin,
  useSignup,
  useLogout,
  usePasskeySignIn,
  useRequestSignInCode,
  useVerifySignInCode,
  useRequestReset,
  useSessions,
  useRevokeSession,
  useLogoutOthers,
  useRows,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/account")({ component: Account });

type Announcement = Row & {
  title: string;
  body: string | null;
};

const credsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type Creds = z.infer<typeof credsSchema>;

const codeRequestSchema = z.object({ email: z.string().email("Enter a valid email") });
type CodeRequest = z.infer<typeof codeRequestSchema>;

const codeVerifySchema = z.object({ code: z.string().min(4, "Enter the code") });
type CodeVerify = z.infer<typeof codeVerifySchema>;

function Account() {
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-32 rounded-xl" />
      </main>
    );
  }

  return member.data ? <SignedIn /> : <SignInView />;
}

function SignInView() {
  const methods = useSignInMethods();
  const login = useLogin();
  const signup = useSignup();
  const passkey = usePasskeySignIn();
  const requestCode = useRequestSignInCode();
  const verifyCode = useVerifySignInCode();
  const requestReset = useRequestReset();

  const [pendingLogin, setPendingLogin] = useState<{ pending: string } | null>(null);
  const [codeSent, setCodeSent] = useState<string | null>(null);

  const loginForm = useForm<Creds>({
    resolver: zodResolver(credsSchema),
    defaultValues: { email: "", password: "" },
  });
  const signupForm = useForm<Creds>({
    resolver: zodResolver(credsSchema),
    defaultValues: { email: "", password: "" },
  });
  const codeRequestForm = useForm<CodeRequest>({
    resolver: zodResolver(codeRequestSchema),
    defaultValues: { email: "" },
  });
  const codeVerifyForm = useForm<CodeVerify>({
    resolver: zodResolver(codeVerifySchema),
    defaultValues: { code: "" },
  });

  const list = methods.data ?? [];
  const hasPassword = list.some((m) => m.name === "password");
  const hasPasskey = list.some((m) => m.name === "passkey");
  const hasEmailCode = list.some((m) => m.name === "email-code");
  const oauthMethods = list.filter((m) => m.oauth);

  const onLogin = (values: Creds) => {
    login.mutate(values, {
      onSuccess: (data) => {
        if ("pending" in data && data.pending) {
          setPendingLogin({ pending: data.pending });
          return;
        }
        toast.success("Welcome back.");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onSignup = (values: Creds) => {
    signup.mutate(values, {
      onSuccess: () => toast.success("Account created — welcome!"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onPasskey = () => {
    passkey.mutate(undefined, {
      onSuccess: (data) => {
        if ("pending" in data && data.pending) {
          setPendingLogin({ pending: data.pending });
          return;
        }
        toast.success("Welcome back.");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onRequestCode = (values: CodeRequest) => {
    requestCode.mutate(values, {
      onSuccess: () => {
        setCodeSent(values.email);
        toast.success("Code sent — check your inbox.");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onVerifyCode = (values: CodeVerify) => {
    if (!codeSent) return;
    verifyCode.mutate(
      { email: codeSent, code: values.code },
      {
        onSuccess: (data) => {
          if ("pending" in data && data.pending) {
            setPendingLogin({ pending: data.pending });
            return;
          }
          toast.success("Welcome back.");
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const onRequestReset = (email: string) => {
    requestReset.mutate(
      { email },
      {
        onSuccess: () => toast.success("If that address has an account, check your inbox."),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  if (pendingLogin) {
    return <SecondFactor pending={pendingLogin.pending} />;
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-muted-foreground">Sign in to reach your notes and studio announcements.</p>

      <div className="mt-8 space-y-6">
        {oauthMethods.length > 0 && (
          <div className="grid gap-2">
            {oauthMethods.map((m) => (
              <Button key={m.name} variant="outline" onClick={() => startOAuth(m.name)}>
                Continue with {m.label}
              </Button>
            ))}
          </div>
        )}

        {hasPasskey && (
          <Button variant="outline" className="w-full" onClick={onPasskey} disabled={passkey.isPending}>
            {passkey.isPending ? "Checking…" : "Sign in with a passkey"}
          </Button>
        )}

        {hasPassword && (
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="grid gap-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={login.isPending}>
                    {login.isPending ? "Signing in…" : "Sign in"}
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline"
                    onClick={() => onRequestReset(loginForm.getValues("email"))}
                  >
                    Forgot your password?
                  </button>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="grid gap-4">
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={signup.isPending}>
                    {signup.isPending ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        )}

        {hasEmailCode && (
          <div>
            <Separator className="my-4" />
            <p className="text-sm font-medium">Sign in with a code</p>
            {!codeSent ? (
              <Form {...codeRequestForm}>
                <form onSubmit={codeRequestForm.handleSubmit(onRequestCode)} className="mt-3 grid gap-3">
                  <FormField
                    control={codeRequestForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={requestCode.isPending}>
                    {requestCode.isPending ? "Sending…" : "Send code"}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...codeVerifyForm}>
                <form onSubmit={codeVerifyForm.handleSubmit(onVerifyCode)} className="mt-3 grid gap-3">
                  <FormField
                    control={codeVerifyForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code sent to {codeSent}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={verifyCode.isPending}>
                    {verifyCode.isPending ? "Verifying…" : "Verify code"}
                  </Button>
                </form>
              </Form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function startOAuth(name: string) {
  import("@/lib/rows").then((m) => m.startOAuthSignIn(name));
}

function SecondFactor({ pending }: { pending: string }) {
  const verify = useVerifySecondFactorImport();
  const [code, setCode] = useState("");

  const onSubmit = () => {
    verify.mutate(
      { pending, code },
      {
        onSuccess: () => toast.success("Welcome back."),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Two-factor code</h1>
      <p className="mt-2 text-muted-foreground">Enter the code from your authenticator app.</p>
      <div className="mt-6 grid gap-3">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
        <Button onClick={onSubmit} disabled={verify.isPending}>
          {verify.isPending ? "Verifying…" : "Verify"}
        </Button>
      </div>
    </main>
  );
}

function useVerifySecondFactorImport() {
  // Local wrapper kept for clarity at the call site.
  const mod = require("@/lib/rows") as typeof import("@/lib/rows");
  return mod.useVerifySecondFactor();
}

function SignedIn() {
  const logout = useLogout();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutOthers = useLogoutOthers();
  const announcements = useRows<Announcement>("announcements", { order: "id", dir: "desc" });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
        <Button variant="outline" onClick={() => logout()}>
          Sign out
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Studio announcements</h2>
        <div className="mt-4 grid gap-3">
          {announcements.isPending &&
            [0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}

          {announcements.isError && (
            <p className="text-sm text-destructive">Couldn't load announcements. Refresh and try again.</p>
          )}

          {announcements.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No announcements right now.</p>
          )}

          {announcements.data?.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="text-base">{a.title}</CardTitle>
              </CardHeader>
              {a.body && <CardContent className="text-sm text-muted-foreground">{a.body}</CardContent>}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Where you're signed in</h2>
        <div className="mt-4 grid gap-2">
          {sessions.isPending && <Skeleton className="h-16 rounded-xl" />}
          {sessions.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          )}
          {sessions.data?.map((s) => (
            <Card key={s.sid}>
              <CardContent className="flex items-center justify-between py-4 text-sm">
                <div>
                  <div className="font-medium">
                    {s.device} {s.current && "(this device)"}
                  </div>
                  <CardDescription>
                    {s.country ?? "Unknown location"} · {s.lastSeen}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke.mutate({ sid: s.sid })}
                  disabled={revoke.isPending}
                >
                  Sign out
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => logoutOthers()}
          disabled={logoutOthers.isPending}
        >
          Sign out everywhere else
        </Button>
      </section>

      <div className="mt-10">
        <Link to="/members" className="underline text-sm">
          Go to your practice notes
        </Link>
      </div>
    </main>
  );
}
