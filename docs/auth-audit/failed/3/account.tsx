import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";

import {
  useMember,
  useSignInMethods,
  useSignup,
  useLogin,
  useLogout,
  useRequestReset,
  usePasskeySignIn,
  useRequestSignInCode,
  useVerifySignInCode,
  useVerifySecondFactor,
  useSessions,
  useRevokeSession,
  useLogoutOthers,
  startOAuthSignIn,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/account")({ component: Account });

const credsSchema = z.object({
  email: z.string().email("A valid email please"),
  password: z.string().min(8, "At least 8 characters"),
});
type Creds = z.infer<typeof credsSchema>;

const emailSchema = z.object({ email: z.string().email("A valid email please") });
type EmailForm = z.infer<typeof emailSchema>;

const codeSchema = z.object({ code: z.string().min(4, "Enter the code") });
type CodeForm = z.infer<typeof codeSchema>;

function Account() {
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return <SignInView />;
  }

  return <SignedInView />;
}

function SignInView() {
  const methods = useSignInMethods();
  const signup = useSignup();
  const login = useLogin();
  const requestReset = useRequestReset();
  const passkey = usePasskeySignIn();
  const requestCode = useRequestSignInCode();
  const verifyCode = useVerifySignInCode();
  const verifySecond = useVerifySecondFactor();

  const [pendingLogin, setPendingLogin] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeEmail, setCodeEmail] = useState("");

  const loginForm = useForm<Creds>({
    resolver: zodResolver(credsSchema),
    defaultValues: { email: "", password: "" },
  });
  const signupForm = useForm<Creds>({
    resolver: zodResolver(credsSchema),
    defaultValues: { email: "", password: "" },
  });
  const resetForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const codeEmailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const methodNames = methods.data?.map((m) => m.name) ?? [];

  const onLogin = (values: Creds) => {
    login.mutate(values, {
      onSuccess: (data) => {
        if ("pending" in data && data.pending) {
          setPendingLogin(data.pending);
          toast("Enter your two-factor code.");
          return;
        }
        toast.success("Welcome back!");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onSecondFactor = () => {
    if (!pendingLogin) return;
    verifySecond.mutate(
      { pending: pendingLogin, code: twoFactorCode },
      {
        onSuccess: () => {
          toast.success("Welcome back!");
          setPendingLogin(null);
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const onSignup = (values: Creds) => {
    signup.mutate(values, {
      onSuccess: () => toast.success("Account created — you're signed in."),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onReset = (values: EmailForm) => {
    requestReset.mutate(values, {
      onSuccess: () => toast.success("Check your inbox for a reset link."),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onPasskey = () => {
    passkey.mutate(undefined, {
      onSuccess: (data) => {
        if ("pending" in data && data.pending) {
          setPendingLogin(data.pending);
          toast("Enter your two-factor code.");
          return;
        }
        toast.success("Welcome back!");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onRequestCode = (values: EmailForm) => {
    requestCode.mutate(values, {
      onSuccess: () => {
        setCodeSent(true);
        setCodeEmail(values.email);
        toast.success("Code sent — check your email.");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onVerifyCode = (values: CodeForm) => {
    verifyCode.mutate(
      { email: codeEmail, code: values.code },
      {
        onSuccess: (data) => {
          if ("pending" in data && data.pending) {
            setPendingLogin(data.pending);
            toast("Enter your two-factor code.");
            return;
          }
          toast.success("Welcome back!");
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  if (pendingLogin) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Two-factor code</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the code from your authenticator app.
        </p>
        <div className="mt-4 grid gap-3">
          <Input
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            placeholder="123456"
          />
          <Button onClick={onSecondFactor} disabled={verifySecond.isPending}>
            {verifySecond.isPending ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Aurora Yoga</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Access your notes and studio announcements.
      </p>

      <div className="mt-6 grid gap-2">
        {methodNames.includes("google") && (
          <Button variant="outline" onClick={() => startOAuthSignIn("google")}>
            Continue with Google
          </Button>
        )}
        {methodNames.includes("microsoft") && (
          <Button variant="outline" onClick={() => startOAuthSignIn("microsoft")}>
            Continue with Microsoft
          </Button>
        )}
        {methodNames.includes("apple") && (
          <Button variant="outline" onClick={() => startOAuthSignIn("apple")}>
            Continue with Apple
          </Button>
        )}
        {methodNames.includes("passkey") && (
          <Button variant="outline" onClick={onPasskey} disabled={passkey.isPending}>
            {passkey.isPending ? "Waiting…" : "Sign in with a passkey"}
          </Button>
        )}
      </div>

      {methodNames.includes("email-code") && (
        <div className="mt-6">
          <Separator />
          <p className="mt-4 mb-2 text-sm font-medium">Sign in with an email code</p>
          {!codeSent ? (
            <Form {...codeEmailForm}>
              <form onSubmit={codeEmailForm.handleSubmit(onRequestCode)} className="grid gap-3">
                <FormField
                  control={codeEmailForm.control}
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
            <Form {...codeForm}>
              <form onSubmit={codeForm.handleSubmit(onVerifyCode)} className="grid gap-3">
                <FormField
                  control={codeForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
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

      {methodNames.includes("password") && (
        <div className="mt-6">
          <Separator />
          <Tabs defaultValue="login" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="mt-4 grid gap-3">
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
                </form>
              </Form>

              <Form {...resetForm}>
                <form onSubmit={resetForm.handleSubmit(onReset)} className="mt-4 grid gap-2">
                  <FormField
                    control={resetForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Forgot your password?</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Your email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" variant="ghost" size="sm" disabled={requestReset.isPending}>
                    {requestReset.isPending ? "Sending…" : "Send reset link"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="mt-4 grid gap-3">
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
        </div>
      )}
    </main>
  );
}

function SignedInView() {
  const logout = useLogout();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutOthers = useLogoutOthers();

  const onRevoke = (sid: string, isCurrent: boolean) => {
    revoke.mutate(
      { sid },
      {
        onSuccess: () => {
          toast.success(isCurrent ? "Signed out." : "Device signed out.");
          if (isCurrent) logout();
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const onLogoutOthers = () => {
    logoutOthers.mutate(undefined, {
      onSuccess: () => toast.success("Signed out everywhere else."),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
        <Button variant="outline" onClick={() => logout()}>
          Sign out
        </Button>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Signed-in devices</h2>
          <Button variant="ghost" size="sm" onClick={onLogoutOthers} disabled={logoutOthers.isPending}>
            {logoutOthers.isPending ? "Working…" : "Sign out everywhere else"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          {sessions.isPending &&
            [0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}

          {sessions.isError && (
            <p className="text-sm text-destructive">Couldn't load your sessions.</p>
          )}

          {sessions.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          )}

          {sessions.data?.map((s) => (
            <Card key={s.sid}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {s.device} {s.current && <span className="text-xs text-primary">(this device)</span>}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevoke(s.sid, s.current)}
                  disabled={revoke.isPending}
                >
                  Sign out
                </Button>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {s.country ?? "Unknown location"} · {s.lastSeen}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
