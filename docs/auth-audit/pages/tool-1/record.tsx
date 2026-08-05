import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

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
  value: z.string().min(1, "Enter a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type EditForm = z.infer<typeof editSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
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

  if (member.isPending || deals.isPending) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Skeleton className="h-64 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to open this record.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-muted-foreground">No record selected.</p>
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-muted-foreground">
          We couldn't find that record. It may not be yours to see, or it's been removed.
        </p>
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle="Shared with the team"
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSave)}>
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
                          <SelectValue placeholder="Choose a stage" />
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
        </CardHeader>
        <CardContent>
          <ActivityFeed
            items={[
              {
                who: member.data.name,
                what: `opened this deal — currently "${deal.stage ?? "New"}"`,
                at: deal.created_at,
              },
            ]}
            empty="No activity recorded yet."
          />
        </CardContent>
      </Card>
    </main>
  );
}
