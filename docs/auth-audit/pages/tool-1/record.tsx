import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/ui/login-form";
import { useLogin } from "@/lib/rows";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Proposal" || stage === "Negotiation") return "warning";
  return "neutral";
}

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

function RecordPage() {
  const member = useMember();

  if (member.isPending) {
    return <div className="p-10 text-sm text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return <SignInPrompt />;
  }

  return <RecordView />;
}

function SignInPrompt() {
  const login = useLogin();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center p-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to open this record.</p>
        <LoginForm
          busy={login.isPending}
          onSubmit={(v) =>
            login.mutate(v, {
              onSuccess: () => navigate({ to: "/record" }),
              onError: (e) => toast.error(e.message),
            })
          }
        />
      </div>
    </div>
  );
}

function RecordView() {
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");

  const deal = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: deal ? { title: deal.title, value: deal.value ?? "" } : { title: "", value: "" },
  });

  if (!id) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">
          No record chosen. <Link to="/records" className="underline">Back to the table</Link>
        </p>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-10 w-1/2 rounded-md" />
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return <div className="p-10 text-sm text-destructive">Couldn't load this record. Refresh and try again.</div>;
  }

  if (!deal) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">
          We couldn't find that deal — it may have been removed.{" "}
          <Link to="/records" className="underline">Back to the table</Link>
        </p>
      </div>
    );
  }

  const onSave = (values: EditForm) => {
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => toast.success("Saved."),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onStage = (stage: string) => {
    update.mutate(
      { id: deal.id, stage },
      {
        onSuccess: () => toast.success(`Moved to ${stage}.`),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const activity: Activity[] = [
    { who: "Team", what: `Deal created — "${deal.title}"`, at: deal.created_at },
    {
      who: "Team",
      what: `Currently in ${deal.stage ?? "New"}`,
      at: deal.updated_at ?? deal.created_at,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link to="/records" className="text-sm text-muted-foreground underline">
        Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle={deal.value ? `Value: ${deal.value}` : "No value set"}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={deal.stage === s ? "secondary" : "outline"}
                onClick={() => onStage(s)}
                disabled={update.isPending}
              >
                {s}
              </Button>
            ))}
          </div>
        }
      />

      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-sm font-medium">Fields</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <Button type="submit" className="motion-press" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium">Activity</h2>
        <ActivityFeed className="mt-3" items={activity} empty="Nothing has happened on this deal yet" />
      </div>
    </div>
  );
}
