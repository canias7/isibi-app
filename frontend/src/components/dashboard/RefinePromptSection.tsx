import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { refineAIPrompt } from "@/lib/api";

interface RefinePromptSectionProps {
  currentPrompt: string;
  onPromptRefined: (prompt: string) => void;
}

export default function RefinePromptSection({ currentPrompt, onPromptRefined }: RefinePromptSectionProps) {
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);

  const handleRefine = async () => {
    if (!feedback.trim()) return;
    setRefining(true);
    try {
      const result = await refineAIPrompt(currentPrompt, feedback);
      onPromptRefined(result);
      setFeedback("");
      toast({ title: "Prompt refined!" });
    } catch (err: any) {
      toast({ title: "Failed to refine prompt", description: err.message, variant: "destructive" });
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3">
      <h4 className="font-medium text-sm text-foreground">Refine with AI</h4>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="e.g., Make it more friendly, add loyalty program info, handle Spanish callers..."
        rows={2}
      />
      <Button variant="secondary" size="sm" onClick={handleRefine} disabled={refining || !feedback.trim()}>
        {refining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        {refining ? "Refining..." : "Refine Prompt"}
      </Button>
    </div>
  );
}
