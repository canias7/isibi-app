import { useState } from "react";
import { Wand2, Loader2, RefreshCw, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { generateAIPromptAdvanced, refineAIPrompt } from "@/lib/api";

interface AIPromptGeneratorProps {
  onPromptGenerated: (prompt: string) => void;
  initialBusinessType?: string;
}

interface FormData {
  business_name: string;
  business_type: string;
  business_description: string;
  services: string;
  tone: string;
  special_instructions: string;
  hours: string;
  phone_number: string;
  address: string;
}

const businessTypes = [
  { value: "general", label: "General Business", icon: "🏢" },
  { value: "salon", label: "Salon / Barbershop", icon: "💇" },
  { value: "restaurant", label: "Restaurant / Café", icon: "🍽️" },
  { value: "medical", label: "Medical / Healthcare", icon: "🏥" },
  { value: "retail", label: "Retail / E-commerce", icon: "🛍️" },
  { value: "professional", label: "Professional Services", icon: "💼" },
  { value: "real_estate", label: "Real Estate", icon: "🏠" },
  { value: "automotive", label: "Automotive", icon: "🚗" },
  { value: "legal", label: "Legal Services", icon: "⚖️" },
  { value: "fitness", label: "Fitness / Gym", icon: "💪" },
];

const toneOptions = [
  { value: "professional", label: "Professional", description: "Polished and businesslike" },
  { value: "friendly", label: "Friendly & Casual", description: "Warm and approachable" },
  { value: "formal", label: "Formal & Corporate", description: "Respectful and traditional" },
  { value: "warm", label: "Warm & Welcoming", description: "Inviting and personable" },
];

export default function AIPromptGenerator({ onPromptGenerated, initialBusinessType = "general" }: AIPromptGeneratorProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    business_name: "",
    business_type: initialBusinessType,
    business_description: "",
    services: "",
    tone: "professional",
    special_instructions: "",
    hours: "",
    phone_number: "",
    address: "",
  });

  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [refinementFeedback, setRefinementFeedback] = useState("");

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.business_name || !formData.business_type) {
      toast({ title: "Business name and type are required", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setStep(2);
    try {
      const result = await generateAIPromptAdvanced(formData as unknown as Record<string, unknown>);
      setGeneratedPrompt(result);
      setStep(3);
    } catch (err: any) {
      toast({ title: "Failed to generate prompt", description: err.message, variant: "destructive" });
      setStep(1);
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!refinementFeedback.trim()) return;
    setRefining(true);
    try {
      const result = await refineAIPrompt(generatedPrompt, refinementFeedback);
      setGeneratedPrompt(result);
      setRefinementFeedback("");
      toast({ title: "Prompt refined!" });
    } catch (err: any) {
      toast({ title: "Failed to refine prompt", description: err.message, variant: "destructive" });
    } finally {
      setRefining(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Step 2: Generating
  if (step === 2) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Generating Your Prompt...</h3>
        <p className="text-muted-foreground">AI is creating a custom system prompt for {formData.business_name}</p>
      </div>
    );
  }

  // Step 3: Review
  if (step === 3) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">Your AI-Generated Prompt</h3>
            <p className="text-sm text-muted-foreground">Review and refine as needed</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← Start Over</Button>
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-6 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm text-foreground font-mono">{generatedPrompt}</pre>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={copyToClipboard}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button className="flex-1" onClick={() => onPromptGenerated(generatedPrompt)}>
            Use This Prompt
          </Button>
        </div>

        <div className="border-t border-border pt-6 space-y-3">
          <h4 className="font-medium text-foreground">Want to make changes?</h4>
          <Textarea
            value={refinementFeedback}
            onChange={(e) => setRefinementFeedback(e.target.value)}
            placeholder="e.g., Make it more friendly, add loyalty program info..."
            rows={3}
          />
          <Button variant="secondary" onClick={handleRefine} disabled={refining || !refinementFeedback.trim()}>
            {refining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {refining ? "Refining..." : "Refine Prompt"}
          </Button>
        </div>
      </div>
    );
  }

  // Step 1: Form
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">AI Prompt Generator</h2>
        <p className="text-muted-foreground mt-2">Let AI create the perfect system prompt for your agent</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Business Name *</Label>
          <Input value={formData.business_name} onChange={(e) => handleChange("business_name", e.target.value)} placeholder="e.g., Mario's Pizza, Prestige Salon" />
        </div>

        <div className="space-y-2">
          <Label>Business Type *</Label>
          <div className="grid grid-cols-2 gap-3">
            {businessTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleChange("business_type", type.value)}
                className={cn(
                  "p-3 rounded-xl border-2 text-left transition-all",
                  formData.business_type === type.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{type.icon}</span>
                  <span className="text-sm font-medium text-foreground">{type.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Business Description</Label>
          <Textarea value={formData.business_description} onChange={(e) => handleChange("business_description", e.target.value)} placeholder="Briefly describe your business..." rows={3} />
        </div>

        <div className="space-y-2">
          <Label>Services / Products Offered</Label>
          <Input value={formData.services} onChange={(e) => handleChange("services", e.target.value)} placeholder="e.g., haircuts, pizza delivery, physical therapy" />
        </div>

        <div className="space-y-2">
          <Label>Conversation Tone</Label>
          <div className="grid grid-cols-2 gap-2">
            {toneOptions.map((tone) => (
              <button
                key={tone.value}
                onClick={() => handleChange("tone", tone.value)}
                className={cn(
                  "p-3 rounded-xl border-2 text-left transition-all",
                  formData.tone === tone.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="font-medium text-sm text-foreground">{tone.label}</div>
                <div className="text-xs text-muted-foreground">{tone.description}</div>
              </button>
            ))}
          </div>
        </div>



        <details className="rounded-xl border border-border p-4">
          <summary className="font-medium text-foreground cursor-pointer">Advanced Options (Optional)</summary>
          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Business Hours</Label>
              <Input value={formData.hours} onChange={(e) => handleChange("hours", e.target.value)} placeholder="e.g., Mon-Fri 9am-6pm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone Number</Label>
              <Input value={formData.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} placeholder="e.g., (555) 123-4567" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Input value={formData.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="e.g., 123 Main St, Charlotte NC" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Special Instructions</Label>
              <Textarea value={formData.special_instructions} onChange={(e) => handleChange("special_instructions", e.target.value)} placeholder="Any special requirements..." rows={2} />
            </div>
          </div>
        </details>
      </div>

      <Button className="w-full" onClick={handleGenerate} disabled={!formData.business_name || !formData.business_type}>
        <Wand2 className="h-5 w-5 mr-2" />
        Generate AI Prompt
      </Button>
    </div>
  );
}
