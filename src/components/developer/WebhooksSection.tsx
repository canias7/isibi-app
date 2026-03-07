import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Webhook, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listDeveloperWebhooks, createDeveloperWebhook, deleteDeveloperWebhook, type DeveloperWebhook } from "@/lib/api";

const AVAILABLE_EVENTS = [
  "call.started",
  "call.ended",
  "call.failed",
  "agent.created",
  "agent.updated",
  "agent.deleted",
  "credits.low",
  "credits.purchased",
];

export default function WebhooksSection() {
  const [webhooks, setWebhooks] = useState<DeveloperWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchWebhooks = async () => {
    try {
      const data = await listDeveloperWebhooks();
      setWebhooks(Array.isArray(data) ? data : []);
    } catch {
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await createDeveloperWebhook({ url, events: selectedEvents });
      toast.success("Webhook created!");
      setUrl("");
      setSelectedEvents([]);
      setDialogOpen(false);
      fetchWebhooks();
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDeveloperWebhook(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Webhook deleted");
    } catch {
      toast.error("Failed to delete webhook");
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Configure webhook endpoints to receive real-time event notifications</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook Endpoint</DialogTitle>
                <DialogDescription>We'll send POST requests to this URL when selected events occur</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Endpoint URL *</Label>
                  <Input placeholder="https://yourapp.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Events</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_EVENTS.map((event) => (
                      <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedEvents.includes(event)}
                          onCheckedChange={() => toggleEvent(event)}
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={!url || selectedEvents.length === 0 || isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">No webhooks configured</p>
            <p className="text-sm text-muted-foreground">Add a webhook endpoint to receive event notifications.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="space-y-1.5">
                  <code className="text-sm font-medium text-foreground">{w.url}</code>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={w.active ? "default" : "secondary"} className="text-xs">
                      {w.active ? "Active" : "Inactive"}
                    </Badge>
                    {w.events?.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Created {new Date(w.created_at).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(w.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
