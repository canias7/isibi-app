import { Settings } from "lucide-react";

export default function DashboardSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your account and preferences.</p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-12 text-center">
        <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-semibold text-foreground mb-2">Settings</p>
        <p className="text-sm text-muted-foreground">Advanced settings and preferences coming soon.</p>
      </div>
    </div>
  );
}
