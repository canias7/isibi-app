import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});

type EditForm = z.infer<typeof editSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!stage) return "neutral";
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");

  const deal = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: deal
      ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "New" }
      : { title: "", value: "", stage: "New" },
  });

  const onSave = (values: EditForm) => {
    if (!deal) return;
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => toast.success("Deal updated"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Sign in to see this deal</CardTitle>
            <CardDescription>Records live behind a sign-in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="motion-press">
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-muted-foreground">
          Open a deal from the{" "}
          <Link to="/records" className="underline">
            records list
          </Link>
          .
        </p>
      </main>
    );
  }

  if (deals.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="h-40 rounded-xl" />
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-destructive">
          Couldn't load this deal. Refresh and try again.
        </p>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-muted-foreground">
          We couldn't find that deal. It may not be yours to see.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <RecordHeader
        title={deal.title}
        subtitle={`Deal #${deal.id}`}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <Button asChild variant="outline">
            <Link to="/records">Back to records</Link>
          </Button>
        }
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Fields</CardTitle>
          <CardDescription>Edits save straight to the team's shared record.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
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
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <CardDescription>What's happened on this deal.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed
            items={[
              { who: "System", what: `Deal created as "${deal.stage ?? "New"}"`, at: deal.created_at },
            ]}
            empty="No activity recorded yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
