import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_ENDPOINTS = [
  // Agents
  { method: "GET", path: "/api/agents", description: "List all your AI agents" },
  { method: "POST", path: "/api/agents", description: "Create a new agent" },
  { method: "GET", path: "/api/agents/:id", description: "Get a specific agent" },
  { method: "PATCH", path: "/api/agents/:id", description: "Update an existing agent" },
  { method: "DELETE", path: "/api/agents/:id", description: "Delete an agent" },
  // Voice
  { method: "PUT", path: "/api/agents/:id/voice", description: "Set agent voice provider & voice" },
  { method: "GET", path: "/api/agents/:id/vad-settings", description: "Get agent VAD settings" },
  { method: "PUT", path: "/api/agents/:id/vad-settings", description: "Update agent VAD settings" },
  // Phone
  { method: "POST", path: "/api/phone/search", description: "Search available phone numbers" },
  { method: "POST", path: "/api/phone/purchase", description: "Purchase a phone number" },
  { method: "GET", path: "/api/phone/my-numbers", description: "List your purchased numbers" },
  { method: "POST", path: "/api/phone/release/:sid", description: "Release a number by Twilio SID" },
  { method: "DELETE", path: "/api/phone/release", description: "Release a number by phone number" },
  // Google Calendar
  { method: "GET", path: "/api/google/auth", description: "Get Google OAuth URL (user-level)" },
  { method: "GET", path: "/api/google/status", description: "Get Google connection status" },
  { method: "POST", path: "/api/agents/:id/google/assign", description: "Assign calendar to agent" },
  { method: "DELETE", path: "/api/agents/:id/google/disconnect", description: "Disconnect Google from agent" },
  // Credits & Usage
  { method: "GET", path: "/api/credits/balance", description: "Get your current credit balance" },
  { method: "GET", path: "/api/credits/status", description: "Get credits status (low balance alert)" },
  { method: "POST", path: "/api/credits/purchase", description: "Purchase credits" },
  { method: "GET", path: "/api/credits/transactions", description: "Get transaction history" },
  { method: "GET", path: "/api/usage/calls", description: "Get call usage history" },
  { method: "GET", path: "/api/usage/call-details/:id", description: "Get details for a specific call" },
  // Prompt
  { method: "POST", path: "/api/agents/generate-prompt", description: "Generate AI prompt" },
  { method: "POST", path: "/api/agents/generate-prompt-ai", description: "Generate prompt with Claude" },
  { method: "POST", path: "/api/agents/refine-prompt-ai", description: "Refine prompt with AI" },
  { method: "POST", path: "/api/prompt/save", description: "Save a prompt" },
  { method: "GET", path: "/api/prompt/get", description: "Get saved prompt" },
  // Developer
  { method: "POST", path: "/api/developer/keys", description: "Create a new API key" },
  { method: "GET", path: "/api/developer/keys", description: "List your API keys" },
  { method: "DELETE", path: "/api/developer/keys/:id", description: "Revoke an API key" },
  { method: "POST", path: "/api/developer/webhooks", description: "Create a webhook endpoint" },
  { method: "GET", path: "/api/developer/webhooks", description: "List your webhooks" },
  { method: "DELETE", path: "/api/developer/webhooks/:id", description: "Delete a webhook" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  PATCH: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
  PUT: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

export default function DocumentationSection() {
  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                API Reference
              </CardTitle>
              <CardDescription>Base URL: <code className="bg-muted px-2 py-0.5 rounded text-xs">https://isibi-backend.onrender.com</code></CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://isibi-backend.onrender.com/docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Full Docs
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Authentication</h3>
              <div className="bg-muted/50 border border-border/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                <p>All API requests require a Bearer token in the <code className="bg-muted px-1.5 py-0.5 rounded text-xs text-foreground">Authorization</code> header:</p>
                <pre className="bg-background/80 border border-border/50 rounded p-3 text-xs font-mono overflow-x-auto">
{`Authorization: Bearer YOUR_API_KEY`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Endpoints</h3>
              <div className="space-y-2">
                {API_ENDPOINTS.map((ep, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <Badge variant="outline" className={`font-mono text-xs px-2 min-w-[60px] justify-center ${METHOD_COLORS[ep.method] || ""}`}>
                      {ep.method}
                    </Badge>
                    <code className="text-sm font-mono text-foreground flex-1">{ep.path}</code>
                    <span className="text-sm text-muted-foreground hidden sm:block">{ep.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
