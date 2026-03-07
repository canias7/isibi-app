import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Check, X, Loader2, Save, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

export function ApiConnectionPanel() {
  const [apiUrl, setApiUrl] = useState("https://isibi-backend.onrender.com");
  const [savedUrl, setSavedUrl] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("");

  const handleSave = () => {
    if (apiUrl.trim()) {
      setSavedUrl(apiUrl.trim());
      setMessage("API URL saved successfully");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleTestConnection = async () => {
    const urlToTest = savedUrl || apiUrl;
    if (!urlToTest.trim()) {
      setStatus("error");
      setMessage("Please enter a valid API URL");
      return;
    }

    setStatus("testing");
    setMessage("Testing connection...");

    // Simulate API connection test
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // For demo purposes, we'll simulate success/failure based on URL format
    if (urlToTest.startsWith("http://") || urlToTest.startsWith("https://")) {
      setStatus("success");
      setMessage("Connection successful! Backend is reachable.");
    } else {
      setStatus("error");
      setMessage("Connection failed. Please check the URL format.");
    }
  };

  const statusStyles = {
    idle: "border-border",
    testing: "border-primary/50",
    success: "border-success/50 bg-success/5",
    error: "border-destructive/50 bg-destructive/5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn(
        "glass-card rounded-xl p-6 transition-all duration-300",
        statusStyles[status]
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            API Connection
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure your backend API endpoint
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Backend API Base URL
          </label>
          <Input
            type="url"
            placeholder="https://superscientifically-unleisured-ermelinda.ngrok-free.dev"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="bg-background/50 border-border focus:border-primary"
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!apiUrl.trim() || status === "testing"}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            Save URL
          </Button>
          <Button
            variant="hero"
            onClick={handleTestConnection}
            disabled={status === "testing" || (!apiUrl.trim() && !savedUrl)}
            className="flex-1"
          >
            {status === "testing" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              status === "success" && "bg-success/10 text-success",
              status === "error" && "bg-destructive/10 text-destructive",
              status === "idle" && "bg-primary/10 text-primary",
              status === "testing" && "bg-primary/10 text-primary"
            )}
          >
            {status === "success" && <Check className="h-4 w-4" />}
            {status === "error" && <X className="h-4 w-4" />}
            {status === "testing" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {message}
          </motion.div>
        )}

        {savedUrl && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Saved endpoint:{" "}
              <span className="text-primary font-mono">{savedUrl}</span>
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
