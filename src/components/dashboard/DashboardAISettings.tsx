import { useState, useEffect } from "react";
import { formatRange } from "@/lib/pricing";
import { motion } from "framer-motion";
import { Bot, Loader2, Upload, Sparkles, Phone, Headphones, Mic, Pencil, Trash2, Plus, Plug, Cpu, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAgent, setAgentVoice, deleteAgent, type AgentOut } from "@/lib/api";
import AIPromptGenerator from "@/components/dashboard/AIPromptGenerator";
import TestAgentModal from "@/components/TestAgentModal";
import DashboardIntegrations from "@/components/dashboard/DashboardIntegrations";
import VoiceSelector from "@/components/dashboard/VoiceSelector";
import RefinePromptSection from "@/components/dashboard/RefinePromptSection";

export interface AgentPricingConfig {
  transcriberModel: string;
  llmModel: string;
  voiceProvider: string;
}

interface DashboardAISettingsProps {
  agents: AgentOut[];
  onAgentsRefresh: () => void;
  onPricingConfigChange?: (config: AgentPricingConfig) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

export default function DashboardAISettings({ agents, onAgentsRefresh, onPricingConfigChange, onEditingChange }: DashboardAISettingsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [editing, setEditing] = useState(!!editId);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"assistant" | "phone" | "transcriber" | "model" | "voice" | "integrations">("assistant");

  // Agent form state
  const [assistantName, setAssistantName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [savedAgentId, setSavedAgentId] = useState<number | null>(editId ? Number(editId) : null);

  // Prompt creation mode
  const [promptMode, setPromptMode] = useState<"manual" | "ai" | "website">("manual");

  // Website URL scraper
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isGeneratingFromUrl, setIsGeneratingFromUrl] = useState(false);

  const generatePromptFromWebsite = async () => {
    if (!assistantName.trim()) {
      toast({ title: "Please enter an agent name first", variant: "destructive" });
      return;
    }
    if (!websiteUrl.trim()) {
      toast({ title: "Please enter a website URL", variant: "destructive" });
      return;
    }
    setIsGeneratingFromUrl(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("generate-prompt-from-url", {
        body: { url: websiteUrl, agent_name: assistantName.trim() },
      });
      if (error) throw error;
      if (data?.success) {
        setSystemPrompt(data.prompt);
        toast({ title: "System prompt generated!", description: `From: ${data.page_title || data.url}` });
      } else {
        toast({ title: "Failed to generate prompt", description: data?.detail || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Error:", err);
      toast({ title: "Failed to generate prompt from website", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingFromUrl(false);
    }
  };

  // Voice
  const [voiceValue, setVoiceValue] = useState<{ provider: string; voice_id: string }>({ provider: "elevenlabs", voice_id: "21m00Tcm4TlvDq8ikWAM" });



  // Transcriber
  const [transcriberProvider, setTranscriberProvider] = useState("openai");
  const [transcriberModel, setTranscriberModel] = useState("whisper-1");

  // LLM
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("gpt-4o-realtime-preview-2025-06-03");

  // Force re-fetch when editing same agent repeatedly
  const [loadKey, setLoadKey] = useState(0);

  // Test
  const [testingAgent, setTestingAgent] = useState(false);

  // Load agent for editing
  useEffect(() => {
    if (editId) {
      setEditing(true);
      getAgent(Number(editId))
        .then((agent) => {
          setAssistantName(agent.assistant_name || "");
          setBusinessName(agent.business_name || "");
          setPhoneNumber(agent.phone_number || "");
          setFirstMessage(agent.first_message || "");
          setSystemPrompt(agent.system_prompt ?? "");
          setSavedAgentId(agent.id);

          const savedProvider = agent.llm_provider || "openai";
          const VALID_OPENAI_MODELS = new Set([
            "gpt-realtime", "gpt-realtime-mini",
            "gpt-realtime-2025-08-28", "gpt-realtime-mini-2025-10-06", "gpt-realtime-mini-2025-12-15",
            "gpt-4o-realtime-preview", "gpt-4o-realtime-preview-2025-06-03",
            "gpt-4o-realtime-preview-2024-12-17", "gpt-4o-realtime-preview-2024-10-01",
            "gpt-4o-mini-realtime-preview", "gpt-4o-mini-realtime-preview-2024-12-17",
          ]);
          const VALID_ANTHROPIC_MODELS = new Set([
            "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5",
            "claude-opus-4-20250514", "claude-sonnet-4-20250514",
          ]);
          if (savedProvider === "anthropic") {
            setLlmProvider("anthropic");
            setLlmModel(agent.model && VALID_ANTHROPIC_MODELS.has(agent.model) ? agent.model : "claude-opus-4-5");
          } else {
            setLlmProvider("openai");
            setLlmModel(agent.model && VALID_OPENAI_MODELS.has(agent.model) ? agent.model : "gpt-4o-realtime-preview-2025-06-03");
          }
          if (agent.voice || agent.provider) {
            setVoiceValue({
              provider: agent.provider || "openai",
              voice_id: agent.voice || "alloy",
            });
          }
        })
        .catch(() => toast({ title: "Failed to load agent", variant: "destructive" }));
    }
  }, [editId, loadKey]);

  // Push pricing config to parent
  useEffect(() => {
    onPricingConfigChange?.({
      transcriberModel,
      llmModel,
      voiceProvider: voiceValue.provider,
    });
  }, [transcriberModel, llmModel, voiceValue.provider, onPricingConfigChange]);

  const handleVoiceChange = async (val: { provider: string; voice_id: string }) => {
    console.log('[Voice] Sending:', {
      voice_provider: val.provider,
      elevenlabs_voice_id: val.provider === 'elevenlabs' ? val.voice_id : null,
      openai_voice: val.provider === 'openai' ? val.voice_id : null
    });
    setVoiceValue(val);
    if (savedAgentId) {
      try { await setAgentVoice(savedAgentId, { provider: val.provider, voice_id: val.voice_id }); } catch {}
    }
  };

  // Default ElevenLabs voices that should always appear



  const handleSaveAgent = async () => {
    const token = localStorage.getItem("token");
    if (!assistantName.trim()) { toast({ title: "Agent name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const agentId = savedAgentId || (editId ? Number(editId) : null);
      const url = agentId ? `https://isibi-backend.onrender.com/api/agents/${agentId}` : "https://isibi-backend.onrender.com/api/agents";
      const method = agentId ? "PATCH" : "POST";
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone_number: phoneNumber || null, business_name: businessName || null, assistant_name: assistantName, first_message: firstMessage || null, system_prompt: systemPrompt || null, model: llmModel, llm_provider: llmProvider, voice_provider: voiceValue.provider, elevenlabs_voice_id: voiceValue.provider === 'elevenlabs' ? voiceValue.voice_id : null, openai_voice: voiceValue.provider === 'openai' ? voiceValue.voice_id : null }) });
      if (response.status === 403) { toast({ title: "Session Expired", description: "Please login again", variant: "destructive" }); navigate("/login"); return; }
      if (!response.ok) { const error = await response.json(); throw new Error(error.detail || "Failed to save agent"); }
      const data = await response.json();
      if (data.id) setSavedAgentId(data.id);
      toast({ title: "Agent published!" });
      onAgentsRefresh();
      setEditing(false);
      setSearchParams({});
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save agent", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startNew = () => {
    setAssistantName(""); setBusinessName(""); setPhoneNumber(""); setFirstMessage(""); setSystemPrompt("");
    setSavedAgentId(null); setEditing(true); setActiveSubTab("assistant");
    setLlmProvider("openai");
    setLlmModel("gpt-4o-realtime-preview-2025-06-03");
    setSearchParams({});
  };

  const startEdit = (id: number) => {
    // Reset LLM state before loading so stale values don't flash while fetching
    setLlmProvider("openai");
    setLlmModel("gpt-4o-realtime-preview-2025-06-03");
    setLoadKey(k => k + 1);
    setSearchParams({ edit: String(id) });
  };

  if (!editing) {
    // Agent list view
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Agents</h2>
            <p className="text-sm text-muted-foreground mt-1">Configure and manage your AI phone agents.</p>
          </div>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />New Agent</Button>
        </div>

        {agents.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">No agents yet</p>
            <p className="text-sm text-muted-foreground mb-6">Create your first AI phone agent to get started.</p>
            <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" />Create Agent</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {agents.map((agent) => (
              <motion.div key={agent.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 flex items-center justify-between hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">{agent.assistant_name}</p>
                    <p className="text-xs text-muted-foreground">{agent.phone_number || "No phone number"} - {agent.business_name || "No business"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-medium">~{formatRange({ voiceProvider: agent.voice_provider || (["alloy","ash","coral","echo","fable","onyx","nova","sage","shimmer"].includes(agent.voice || "") ? "openai" : "elevenlabs") })}</span>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(agent.id)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete "${agent.assistant_name}"?`)) return;
                    try {
                      await deleteAgent(agent.id);
                      toast({ title: "Agent deleted" });
                      onAgentsRefresh();
                    } catch {
                      toast({ title: "Failed to delete agent", variant: "destructive" });
                    }
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Editor view
  const subTabs = [
    { id: "assistant" as const, label: "Agent", icon: Bot },
    { id: "transcriber" as const, label: "Transcriber", icon: Headphones },
    { id: "model" as const, label: "Model", icon: Cpu },
    { id: "voice" as const, label: "Voice", icon: Mic },
    { id: "phone" as const, label: "Phone", icon: Phone },
    { id: "integrations" as const, label: "Integrations", icon: Plug },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{savedAgentId ? "Edit Agent" : "New Agent"}</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure your AI phone agent.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setEditing(false); setSearchParams({}); }}>Agents</Button>
          
          <Button disabled={saving || !assistantName.trim()} onClick={handleSaveAgent}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {saving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/30 border border-border/30">
        {subTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all", activeSubTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      <div className={activeSubTab === "assistant" ? "" : "hidden"}>
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-6">
            <div className="space-y-2">
              <Label>Agent Name</Label>
              <Input placeholder="e.g. Sarah" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} />
            </div>
            {promptMode === "manual" && (
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input placeholder="e.g. Acme Corp" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
            )}
            {/* System Prompt Creation Mode Selector */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">System Prompt</Label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { id: "manual" as const, icon: Pencil, label: "Write Manually", desc: "Craft your own prompt from scratch" },
                  { id: "ai" as const, icon: Sparkles, label: "Generate with AI", desc: "Answer a few questions to auto-create" },
                  { id: "website" as const, icon: Globe, label: "From Website", desc: "Scrape your site to build a prompt" },
                ]).map((mode) => (
                  <motion.button
                    key={mode.id}
                    type="button"
                    onClick={() => setPromptMode(mode.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition-all duration-200",
                      promptMode === mode.id
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                        : "border-border/50 bg-card/40 hover:border-border hover:bg-card/60"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                      promptMode === mode.id ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                    )}>
                      <mode.icon className="h-5 w-5" />
                    </div>
                    <span className={cn(
                      "text-sm font-semibold",
                      promptMode === mode.id ? "text-foreground" : "text-muted-foreground"
                    )}>{mode.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{mode.desc}</span>
                    {promptMode === mode.id && (
                      <motion.div
                        layoutId="prompt-mode-indicator"
                        className="absolute -top-px -left-px -right-px h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Website URL input */}
              {promptMode === "website" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Paste your business website URL and we'll scrape it to auto-generate a tailored system prompt.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="url"
                        placeholder="https://yourbusiness.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="pl-10"
                        disabled={isGeneratingFromUrl}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); generatePromptFromWebsite(); } }}
                      />
                    </div>
                    <Button
                      onClick={generatePromptFromWebsite}
                      disabled={isGeneratingFromUrl || !websiteUrl.trim() || !assistantName.trim()}
                      className="gap-2"
                    >
                      {isGeneratingFromUrl ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" />Generate</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* AI Generator */}
              {promptMode === "ai" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border/50 bg-secondary/20 p-4"
                >
                  {!assistantName.trim() ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Please enter an agent name above before generating a prompt.</p>
                  ) : (
                    <AIPromptGenerator
                      onPromptGenerated={(prompt) => {
                        setSystemPrompt(prompt);
                        setPromptMode("manual");
                        toast({ title: "System prompt applied!" });
                      }}
                    />
                  )}
                </motion.div>
              )}
              {(promptMode === "manual" || (promptMode !== "ai" && systemPrompt.trim())) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prompt Editor</span>
                    <select className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="anthropic">Anthropic</option>
                      <option value="openai" disabled>OpenAI (Coming Soon)</option>
                    </select>
                  </div>
                  <Textarea
                    placeholder="You are a helpful assistant that..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={24}
                    className="min-h-[400px] font-mono text-sm leading-relaxed"
                  />
                  {systemPrompt.trim() && (
                    <RefinePromptSection
                      currentPrompt={systemPrompt}
                      onPromptRefined={(refined) => setSystemPrompt(refined)}
                    />
                  )}
                </motion.div>
              )}
            </div>
          </div>
      </div>

      <div className={activeSubTab === "phone" ? "" : "hidden"}>
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-4">
            <Label>Phone Number</Label>
            <Input placeholder="+1 (555) 000-0000" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            <p className="text-xs text-muted-foreground">Assign a phone number to this agent from your purchased numbers.</p>
          </div>
      </div>

      <div className={activeSubTab === "transcriber" ? "" : "hidden"}>
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Transcription Provider</Label>
              <p className="text-sm text-muted-foreground mt-1">Converts caller speech to text in real-time so your agent can understand and respond.</p>
            </div>
            <select value={transcriberProvider} onChange={(e) => setTranscriberProvider(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="openai">OpenAI</option>
              <option value="assemblyai" disabled>AssemblyAI (Coming Soon)</option>
              <option value="deepgram" disabled>Deepgram (Coming Soon)</option>
              <option value="azure" disabled>Azure (Coming Soon)</option>
            </select>

            {transcriberProvider === "openai" && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Model</Label>
                <select value={transcriberModel} onChange={(e) => setTranscriberModel(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground mt-2 focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="whisper-1">Whisper-1 ($0.01/min)</option>
                  <option value="gpt-4o-transcribe" disabled>GPT-4o Transcribe ($0.012/min) (Coming Soon)</option>
                  <option value="gpt-4o-mini-transcribe" disabled>GPT-4o Mini Transcribe ($0.01/min) (Coming Soon)</option>
                  <option value="gpt-4o-transcribe-diarize" disabled>GPT-4o Transcribe Diarize (Coming Soon)</option>
                  <option value="gpt-realtime" disabled>GPT Realtime (Coming Soon)</option>
                  <option value="gpt-realtime-mini" disabled>GPT Realtime Mini (Coming Soon)</option>
                  <option value="gpt-audio" disabled>GPT Audio (Coming Soon)</option>
                  <option value="gpt-audio-mini" disabled>GPT Audio Mini (Coming Soon)</option>
                </select>
              </div>
            )}
          </div>
      </div>

      <div className={activeSubTab === "model" ? "" : "hidden"}>
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">LLM Provider</Label>
              <p className="text-sm text-muted-foreground mt-1">Choose which AI provider powers your agent's reasoning. Voice is handled separately.</p>
            </div>
            <select
              value={llmProvider}
              onChange={(e) => {
                const p = e.target.value;
                setLlmProvider(p);
                // Reset model to a sensible default when switching provider
                if (p === "anthropic") setLlmModel("claude-opus-4-5");
                else setLlmModel("gpt-4o-realtime-preview-2025-06-03");
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Model</Label>
              {llmProvider === "anthropic" ? (
                <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground mt-2 focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <optgroup label="Claude (Recommended)">
                    <option value="claude-opus-4-5">claude-opus-4-5 · $0.00–$0.075/min</option>
                    <option value="claude-sonnet-4-5">claude-sonnet-4-5 · $0.00–$0.045/min</option>
                    <option value="claude-haiku-4-5">claude-haiku-4-5 · $0.00–$0.015/min</option>
                  </optgroup>
                </select>
              ) : (
                <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground mt-2 focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <optgroup label="GPT Realtime (GA — Recommended)">
                    <option value="gpt-realtime">gpt-realtime · $0.00–$0.0285/min</option>
                    <option value="gpt-realtime-mini">gpt-realtime-mini · $0.00–$0.0035/min</option>
                  </optgroup>
                  <optgroup label="GPT-4o Realtime (Preview)">
                    <option value="gpt-4o-realtime-preview-2025-06-03">gpt-4o-realtime-preview-2025-06-03 · $0.00–$0.03/min</option>
                    <option value="gpt-4o-realtime-preview-2024-12-17">gpt-4o-realtime-preview-2024-12-17 · $0.00–$0.03/min</option>
                  </optgroup>
                  <optgroup label="GPT-4o Mini Realtime (Preview)">
                    <option value="gpt-4o-mini-realtime-preview">gpt-4o-mini-realtime-preview · $0.00–$0.003/min</option>
                    <option value="gpt-4o-mini-realtime-preview-2024-12-17">gpt-4o-mini-realtime-preview-2024-12-17 · $0.00–$0.00366/min</option>
                  </optgroup>
                </select>
              )}
              {llmProvider === "anthropic" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Anthropic mode: OpenAI Realtime handles speech-to-text, Claude handles reasoning, ElevenLabs handles voice output.
                </p>
              )}
            </div>
          </div>
      </div>

      <div className={activeSubTab === "voice" ? "" : "hidden"}>
          <VoiceSelector value={voiceValue} onChange={handleVoiceChange} />
      </div>

      <div className={activeSubTab === "integrations" ? "" : "hidden"}>
          <DashboardIntegrations />
      </div>

      {/* Test Agent Modal */}
      {testingAgent && assistantName.trim() && (
        <TestAgentModal
          agent={{ id: savedAgentId || 0, assistant_name: assistantName, business_name: businessName, phone_number: phoneNumber, first_message: firstMessage, system_prompt: systemPrompt } as any}
          open={testingAgent}
          onClose={() => setTestingAgent(false)}
        />
      )}
    </div>
  );
}
