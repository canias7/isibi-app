// Reference page — MEMBERS. A `user`, `feed` or `admin` table is scoped to the
// visitor who is signed in, so reading or writing one WITHOUT a session is a
// 401, and a page that shows an error instead of a sign-in form looks broken
// rather than locked. That is the whole reason this page exists.
//
// One form, two buttons. Sign-up and sign-in take the same shape, so splitting
// them into two pages doubles the code and halves the chance a visitor finds the
// one they need.
//
// ONE ERROR FOR THE WHOLE FORM, never per field. Saying which of the address and
// the password was wrong tells somebody whether that address has an account
// here.
//
// The chrome wraps the page ONCE, with the three states switching inside it. A
// component that returns early into a second copy of the layout is how a header
// ends up on two of a page's three states.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useLogin,
  useSignup,
  useLogout,
  useRows,
  useCreateRow,
  type Row,
} from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList } from "@/components/ui/data-list";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/account")({ component: Account });

type Profile = Row & { nickname: string | null };

// The same facts on every page of the site. Written once per file rather than
// once per return.
const CHROME = {
  name: "Cutler Row",
  address: "14 Cutler Row, Sheffield S1",
  phone: "0114 270 0000",
  nav: (
    <>
      <Link to="/">Home</Link>
      <Link to="/book">Book</Link>
      <Link to="/account">Account</Link>
    </>
  ),
};

const credentials = z.object({
  email: z.string().email("That doesn't look like an email address"),
  // 8 is the server's own minimum. Saying so here saves a round trip.
  password: z.string().min(8, "At least 8 characters"),
});

type Credentials = z.infer<typeof credentials>;

function Account() {
  const member = useMember();
  const login = useLogin();
  const signup = useSignup();
  const logout = useLogout();

  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { email: "", password: "" },
  });

  // The callback's parameter is NOT annotated. TanStack's mutation callback is
  // contravariant in four arguments and refuses any hand-written type for it.
  const submit = (action: typeof login, values: Credentials) => {
    action.mutate(values, {
      onSuccess: (data) => {
        // A second factor answers with `pending` and NO token, so "it returned
        // 200" is not the same as "you are signed in".
        if (data && typeof data === "object" && "pending" in data) {
          toast.message("Check your authenticator app to finish signing in.");
          return;
        }
        form.reset();
      },
      onError: () => toast.error("That email and password didn't match."),
    });
  };

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-md px-6 py-16">
        {member.isPending && <p className="text-muted-foreground">Checking your sign-in…</p>}

        {/* Member-scoped reads live BEHIND the sign-in check, never beside it.
            Rendering this at all is the proof there is a session. */}
        {member.data && <SignedIn name={member.data.name} onSignOut={() => logout.mutate()} />}

        {!member.isPending && !member.data && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in, or make an account to keep your details.
            </p>

            <Form {...form}>
              <form
                className="mt-8 grid gap-4"
                onSubmit={form.handleSubmit((v) => submit(login, v))}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3">
                  <Button type="submit" className="motion-press" disabled={login.isPending}>
                    {login.isPending ? "Signing in…" : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={signup.isPending}
                    onClick={form.handleSubmit((v) => submit(signup, v))}
                  >
                    Create an account
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </div>
    </SiteChrome>
  );
}

function SignedIn({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const profiles = useRows<Profile>("profiles");
  const create = useCreateRow("profiles");

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Hello, {name}</h1>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* `profiles` is a `user` table, so this read returns THIS member's
              rows and nobody else's — the scoping is the database's job, not a
              filter written here. */}
          <DataList
            query={profiles}
            className="grid gap-2"
            skeleton={1}
            empty={{ title: "Nothing saved yet" }}
            error="Couldn't load your details."
          >
            {(p) => (
              <p key={p.id} className="text-sm">
                {p.nickname}
              </p>
            )}
          </DataList>
          <Button
            className="mt-4"
            disabled={create.isPending}
            onClick={() => create.mutate({ nickname: name })}
          >
            Save my name
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
