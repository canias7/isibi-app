import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Copy, Trash2, AlertTriangle, Key, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listDeveloperKeys, createDeveloperKey, deleteDeveloperKey, type DeveloperAPIKey } from "@/lib/api";

export default function APIKeysSection() {
  const [keys, setKeys] = useState<DeveloperAPIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchKeys = async () => {
    try {
      const data = await listDeveloperKeys();
      setKeys(Array.isArray(data) ? data : []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const createKey = async () => {
    setIsCreating(true);
    try {
      const data = await createDeveloperKey(formData);
      setNewKey(data.api_key);
      setFormData({ name: "", description: "" });
      fetchKeys();
      toast.success("API key created!");
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      await deleteDeveloperKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success("API key deleted");
    } catch {
      toast.error("Failed to delete API key");
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard!");
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setNewKey(null);
    setFormData({ name: "", description: "" });
  };

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Manage your API keys to authenticate requests</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) handleDialogClose(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>Give your key a name to remember what it's for</DialogDescription>
              </DialogHeader>
              {newKey ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p className="font-semibold">Save this key now!</p>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded font-mono text-sm">
                      <code className="flex-1 break-all">{newKey}</code>
                      <Button size="sm" variant="ghost" onClick={() => copyKey(newKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">You won't be able to see it again!</p>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Name *</Label>
                    <Input placeholder="Production API Key" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input placeholder="Used for production server" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>
              )}
              <DialogFooter>
                {newKey ? (
                  <Button onClick={handleDialogClose}>Done</Button>
                ) : (
                  <Button onClick={createKey} disabled={!formData.name || isCreating}>
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Key
                  </Button>
                )}
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
        ) : keys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">No API keys yet</p>
            <p className="text-sm text-muted-foreground">Create one to get started integrating with the API.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{k.name}</p>
                  {k.description && <p className="text-sm text-muted-foreground">{k.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <code className="bg-muted px-2 py-0.5 rounded">{k.key_prefix}•••••••</code>
                    <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(k.id)}>
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
