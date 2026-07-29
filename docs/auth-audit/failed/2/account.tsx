import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  startOAuthSignIn,
  useSessions,
  useRevokeSession,
  useLogoutOthers,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/account")({ component: Account });

const credsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type Creds = z.infer<typeof credsSchema>;

const resetSchema = z.object({ email: z.string().email("Enter a valid email") });
type Reset = z.infer<typeof resetSchema>;

const codeRequestSchema = z.object({ email: z.string().email("Enter a valid email") });
type CodeRequest = z.infer<typeof codeRequestSchema>;

const codeVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4, "Enter the code"),
});
type CodeVerify = z.infer<typeof codeVerifySchema>;

function Account() {
  const member = useMember();
  const navigate = useNavigate();

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return <SignedOut />;
  }

  return <SignedIn email={member.data.email} navigate={navigate} />;
}

function SignedOut() {
  const methods = useSignInMethods();
  const signup = useSignup();
  const login = useLogin();
  const requestReset = useRequestReset();
  const passkey = usePasskeySignIn();
  const requestCode = useRequestSignInCode();
  const verifyCode = useVerifySignInCode();
  const verifySecondFactor = useVerifySecondFactor();

  const [pendingLogin, setPendingLogin] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  const signupForm = useForm<Creds>({
    resolver: zodResolver(credsSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginForm = useForm<Creds>({
    resolver: zodResolver(credsSchema),
    defaultValues: { email: "", password: "" },
  });

  const resetForm = useForm<Reset>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  const codeRequestForm = useForm<CodeRequest>({
    resolver: zodResolver(codeRequestSchema),
    defaultValues: { email: "" },
  });

  const codeVerifyForm = useForm<CodeVerify>({
    resolver: zodResolver(codeVerifySchema),
    defaultValues: { email: "", code: "" },
  });

  const onSignup = (values: Creds) => {
    signup.mutate(values, {
      onSuccess: () => {
        toast.success("Welcome to Aurora Yoga!");
        signupForm.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onLogin = (values: Creds) => {
    login.mutate(values, {
      onSuccess: (data) => {
        if ("pending" in data && data.pending) {
          setPendingLogin(data.pending);
          return;
        }
        toast.success("Signed in.");
        loginForm.reset();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onVerifySecondFactor = () => {
    if (!pendingLogin) return;
    verifySecondFactor.mutate(
      { pending: pendingLogin, code: twoFaCode },
      {
        onSuccess: () => {
          toast.success("Signed in.");
          setPendingLogin(null);
          setTwoFaCode("");
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const onReset = (values: Reset) => {
    requestReset.mutate(values, {
      onSuccess: () => toast.success("If that address has an account, check your inbox."),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onRequestCode = (values: CodeRequest) => {
    requestCode.mutate(values, {
      onSuccess: () => {
        setCodeSentTo(values.email);
        codeVerifyForm.setValue("email", values.email);
        toast.success("Code sent — check your inbox.");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onVerifyCode = (values: CodeVerify) => {
    verifyCode.mutate(values, {
      onSuccess: (data) => {
        if ("pending" in data && data.pending) {
          setPendingLogin(data.pending);
          return;
        }
        toast.success("Signed in.");
        codeVerifyForm.reset();
        setCodeSentTo(null);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  if (methods.isPending) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-6 h-56 rounded-xl" />
      </main>
    );
  }

  const list = methods.data ?? [];
  const hasPassword = list.some((m) => m.name === "password");
  const hasPasskey = list.some((m) => m.name === "passkey");
  const hasEmailCode = list.some((m) => m.name === "email-code");
  const oauthMethods = list.filter((m) => m.oauth);

  if (pendingLogin) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">One more step</h1>
        <p className="mt-2 text-muted-foreground">Enter your two-factor code to finish signing in.</p>
        <div className="mt-6 grid gap-3">
          <Label htmlFor="tfa">Code</Label>
          <Input id="tfa" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} />
          <Button onClick={onVerifySecondFactor} disabled={verifySecondFactor.isPending}>
            {verifySecondFactor.isPending ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-muted-foreground">Sign in to manage your notes and account.</p>

      <div className="mt-8 grid gap-3">
        {oauthMethods.map((m) => (
          <Button key={m.name} variant="outline" onClick={() => startOAuthSignIn(m.name)}>
            Continue with {m.label}
          </Button>
        ))}

        {hasPasskey && (
          <Button
            variant="outline"
            onClick={() =>
              passkey.mutate(undefined, {
                onSuccess: (data) => {
                  if ("pending" in data && data.pending) {
                    setPendingLogin(data.pending);
                    return;
                  }
                  toast.success("Signed in.");
                },
                onError: (e: Error) => toast.error(e.message),
              })
            }
          >
            Sign in with a passkey
          </Button>
        )}
      </div>

      {(oauthMethods.length > 0 || hasPasskey) && (hasPassword || hasEmailCode) && (
        <Separator className="my-8" />
      )}

      {hasEmailCode && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Sign in with an email code</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!codeSentTo ? (
              <form onSubmit={codeRequestForm.handleSubmit(onRequestCode)} className="grid gap-3">
                <Label htmlFor="code-email">Email</Label>
                <Input id="code-email" type="email" {...codeRequestForm.register("email")} />
                <Button type="submit" disabled={requestCode.isPending}>
                  {requestCode.isPending ? "Sending…" : "Send code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={codeVerifyForm.handleSubmit(onVerifyCode)} className="grid gap-3">
                <Label htmlFor="code">Code sent to {codeSentTo}</Label>
                <Input id="code" {...codeVerifyForm.register("code")} />
                <Button type="submit" disabled={verifyCode.isPending}>
                  {verifyCode.isPending ? "Verifying…" : "Verify code"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {hasPassword && (
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="grid gap-3">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" {...loginForm.register("email")} />
              </div>
              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" type="password" {...loginForm.register("password")} />
              </div>
              <Button type="submit" disabled={login.isPending}>
                {login.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <Separator className="my-6" />

            <form onSubmit={resetForm.handleSubmit(onReset)} className="grid gap-3">
              <Label htmlFor="reset-email">Forgot your password?</Label>
              <Input id="reset-email" type="email" placeholder="Your email" {...resetForm.register("email")} />
              <Button type="submit" variant="outline" disabled={requestReset.isPending}>
                {requestReset.isPending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={signupForm.handleSubmit(onSignup)} className="grid gap-3">
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" {...signupForm.register("email")} />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" {...signupForm.register("password")} />
              </div>
              <Button type="submit" disabled={signup.isPending}>
                {signup.isPending ? "Creating account…" : "Sign up"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}

function SignedIn({
  email,
  navigate,
}: {
  email: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const logout = useLogout();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutOthers = useLogoutOthers();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-muted-foreground">Signed in as {email}.</p>

      <div className="mt-6 flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            logout();
            navigate({ to: "/account" });
          }}
        >
          Sign out
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            logoutOthers.mutate(undefined, {
              onSuccess: () => toast.success("Signed out everywhere else."),
              onError: (e: Error) => toast.error(e.message),
            })
          }
          disabled={logoutOthers.isPending}
        >
          {logoutOthers.isPending ? "Signing out…" : "Sign out everywhere else"}
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Where you're signed in</h2>
        <div className="mt-4 grid gap-3">
          {sessions.isPending &&
            [0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}

          {sessions.isError && (
            <p className="text-sm text-destructive">Couldn't load your sessions right now.</p>
          )}

          {sessions.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          )}

          {sessions.data?.map((s) => (
            <Card key={s.sid}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-sm">
                    {s.device} {s.current && "(this device)"}
                  </CardTitle>
                  <CardDescription>
                    {s.country ?? "Unknown location"} · {s.lastSeen}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    revoke.mutate(
                      { sid: s.sid },
                      {
                        onSuccess: (data) => {
                          toast.success("Session signed out.");
                          if (data.self) {
                            navigate({ to: "/account" });
                          }
                        },
                        onError: (e: Error) => toast.error(e.message),
                      }
                    )
                  }
                >
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
