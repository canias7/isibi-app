import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["lead", "qualified", "proposal", "won", "lost"];

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type EditForm = z.infer<typeof editSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  switch (stage) {
    case "won":
      return "success";
    case "lost":
      return "danger";
    case "proposal":
      return "warning";
    default:
      return "neutral";
  }
}

function RecordPage() {
  const member = useMember();
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");

  const record = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: record
      ? { title: record.title, value: record.value ?? "", stage: record.stage ?? "lead" }
      : undefined,
  });

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
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to open this record</h1>
          <p className="mt-2 text-muted-foreground">Records are only visible to signed-in team members.</p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
          <p className="mt-2 text-muted-foreground">Open a deal from the records table.</p>
          <Button asChild className="mt-6">
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </main>
    );
  }

  const onSubmit = (values: EditForm) => {
    update.mutate(
      { id, values },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to records
      </Link>

      {deals.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}
      {deals.isError && (
        <p className="mt-6 text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      )}
      {!deals.isPending && !deals.isError && !record && (
        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
          <p className="mt-2 text-muted-foreground">This deal isn't in the team's pipeline, or it isn't yours to see.</p>
        </div>
      )}

      {record && (
        <>
          <RecordHeader
            className="mt-6"
            title={record.title}
            subtitle={record.value ?? undefined}
            status={<StatusBadge state={stageState(record.stage)}>{record.stage ?? "lead"}</StatusBadge>}
          />

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-base">Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
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

          <div className="mt-8">
            <h2 className="text-base font-semibold tracking-tight">Activity</h2>
            <ActivityFeed
              className="mt-3"
              items={[
                { who: member.data.name, what: "opened this record", at: new Date() },
              ]}
              empty="No activity recorded yet"
            />
          </div>
        </>
      )}
    </div>
  );
}
