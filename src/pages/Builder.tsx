import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Download, Code2, Eye, Trash2,
  Plus, Loader2, Pencil, Check, X, Sparkles, Copy,
  RefreshCw, PanelLeftClose, PanelLeftOpen, Wand2,
  Monitor, FileCode2, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  builderGenerate,
  builderListSessions,
  builderDeleteSession,
  builderRenameSession,
  builderDownload,
  builderDownloadApp,
} from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

interface BuildSession {
  id: string;
  name: string;
  html: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

// ── Prompt suggestions ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "A modern SaaS landing page with pricing section",
  "An admin dashboard with stats and charts",
  "A contact form with gradient design",
  "A developer portfolio with project cards",
  "An e-commerce product page",
  "A restaurant menu page",
  "A real estate listing page",
  "A job board listing page",
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function Builder() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Sessions
  const [sessions, setSessions] = useState<BuildSession[]>([]);
  const [activeSession, setActiveSession] = useState<BuildSession | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewTab, setPreviewTab] = useState<"preview" | "code">("preview");
  const [building, setBuilding] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load sessions ────────────────────────────────────────────────────────────

  useEffect(() => {
    builderListSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || building) return;
    setBuilding(true);
    setPrompt("");

    // Optimistic: add user message immediately
    if (activeSession) {
      setActiveSession((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, { role: "user", content: trimmed, ts: new Date().toISOString() }] }
          : prev
      );
    }

    try {
      const result = await builderGenerate({
        prompt: trimmed,
        session_id: activeSession?.id ?? undefined,
      });

      const updated: BuildSession = result as BuildSession;
      setActiveSession(updated);

      // Refresh sessions list
      setSessions((prev) => {
        const exists = prev.find((s) => s.id === updated.id);
        if (exists) return prev.map((s) => (s.id === updated.id ? updated : s));
        return [updated, ...prev];
      });

      toast({ title: activeSession ? "Page updated!" : "Page created!", description: updated.name });
    } catch (err) {
      toast({ title: "Build failed", description: String(err), variant: "destructive" });
    } finally {
      setBuilding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  };

  const handleNewProject = () => {
    setActiveSession(null);
    setPrompt("");
    textareaRef.current?.focus();
  };

  const handleSelectSession = (s: BuildSession) => setActiveSession(s);

  const handleDelete = async (id: string) => {
    try {
      await builderDeleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) setActiveSession(null);
      toast({ title: "Project deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleRename = async () => {
    if (!activeSession) return;
    const name = nameInput.trim();
    if (!name) { setEditingName(false); return; }
    try {
      await builderRenameSession(activeSession.id, name);
      const updated = { ...activeSession, name };
      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {}
    setEditingName(false);
  };

  const handleDownload = async () => {
    if (!activeSession) return;
    try {
      const blob = await builderDownload(activeSession.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeSession.name.replace(/\s+/g, "-").toLowerCase()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement("a");
      a.href = "data:text/html;charset=utf-8," + encodeURIComponent(activeSession.html);
      a.download = `${activeSession.name.replace(/\s+/g, "-").toLowerCase()}.html`;
      a.click();
    }
  };

  const handleDownloadApp = async () => {
    if (!activeSession) return;
    try {
      const blob = await builderDownloadApp(activeSession.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeSession.name.replace(/\s+/g, "-").toLowerCase()}-installer.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Installer downloaded!",
        description: "Extract the ZIP and double-click install.bat — it installs everything and adds a Desktop shortcut automatically.",
      });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleCopyCode = () => {
    if (!activeSession?.html) return;
    navigator.clipboard.writeText(activeSession.html);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const useSuggestion = (s: string) => {
    setPrompt(s);
    textareaRef.current?.focus();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">

      {/* ── Projects sidebar ── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 border-r border-white/[0.06] bg-zinc-900/60 flex flex-col overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                  <Wand2 className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-white/80">AI Builder</span>
              </div>
              <button
                onClick={handleNewProject}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                title="New project"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Sessions list */}
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
              {loadingSessions ? (
                <div className="flex justify-center pt-8">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-white/30 text-center pt-8">No projects yet</p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                      activeSession?.id === s.id
                        ? "bg-violet-500/15 border border-violet-500/25"
                        : "hover:bg-white/[0.04] border border-transparent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{s.name}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">
                        {new Date(s.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/20 hover:text-red-400 text-white/30 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.06] shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>

            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* Project name */}
            {activeSession && (
              editingName ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    className="h-7 text-sm bg-white/10 border-white/20 text-white w-48"
                    autoFocus
                  />
                  <button onClick={handleRename} className="p-1 rounded hover:bg-white/10 text-green-400">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingName(false)} className="p-1 rounded hover:bg-white/10 text-white/40">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNameInput(activeSession.name); setEditingName(true); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors group"
                >
                  <span className="text-sm font-semibold text-white/80">{activeSession.name}</span>
                  <Pencil className="h-3 w-3 text-white/30 group-hover:text-white/60 transition-colors" />
                </button>
              )
            )}

            {!activeSession && (
              <span className="text-sm font-semibold text-white/40">New Project</span>
            )}
          </div>

          {/* Right actions */}
          {activeSession && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={handleDownloadApp} className="cursor-pointer gap-2">
                    <Monitor className="h-4 w-4 text-violet-400" />
                    <div>
                      <p className="font-semibold text-sm">Install as Desktop App</p>
                      <p className="text-xs text-muted-foreground">Run install.bat → auto-installs everything</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDownload} className="cursor-pointer gap-2">
                    <FileCode2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">Download HTML</p>
                      <p className="text-xs text-muted-foreground">Single file for browser</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Body: chat left, preview right */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Chat / command panel ── */}
          <div className="w-[360px] shrink-0 border-r border-white/[0.06] flex flex-col bg-zinc-900/30">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {!activeSession && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  <div className="text-center pt-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="h-7 w-7 text-violet-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white/90">What do you want to build?</h2>
                    <p className="text-sm text-white/40 mt-1.5 max-w-xs mx-auto leading-relaxed">
                      Describe any page or software and AI will generate it for you instantly.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Suggestions</p>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => useSuggestion(s)}
                        className="w-full text-left px-3 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06] hover:border-violet-500/30 transition-all text-sm text-white/60 hover:text-white/90"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeSession?.messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                      <Wand2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-violet-600/25 text-white/90 rounded-tr-sm"
                      : "bg-white/[0.06] text-white/70 rounded-tl-sm"
                  )}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {building && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
                    <Wand2 className="h-3 w-3 text-white" />
                  </div>
                  <div className="bg-white/[0.06] px-3.5 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                    <span className="text-sm text-white/50">Building your page…</span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/[0.06] space-y-2">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeSession ? "Describe a change…" : "Describe what you want to build…"}
                  rows={3}
                  className="resize-none bg-white/[0.05] border-white/10 text-white/90 placeholder:text-white/25 text-sm pr-12 rounded-xl focus:border-violet-500/50"
                />
                <button
                  onClick={handleSend}
                  disabled={!prompt.trim() || building}
                  className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {building ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" /> : <Send className="h-3.5 w-3.5 text-white" />}
                </button>
              </div>
              <p className="text-[10px] text-white/20 text-center">
                ⌘ + Enter to send
              </p>
            </div>
          </div>

          {/* ── Preview / Code panel ── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Tab bar */}
            <div className="flex items-center justify-between px-4 border-b border-white/[0.06] h-11 shrink-0">
              <div className="flex items-center gap-1">
                {(["preview", "code"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPreviewTab(tab)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      previewTab === tab
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    {tab === "preview" ? <Eye className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                    {tab === "preview" ? "Preview" : "Code"}
                  </button>
                ))}
              </div>

              {activeSession && previewTab === "code" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10"
                  onClick={handleCopyCode}
                >
                  {codeCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {codeCopied ? "Copied!" : "Copy"}
                </Button>
              )}

              {activeSession && previewTab === "preview" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10"
                  onClick={() => {
                    const w = window.open();
                    if (w) {
                      w.document.open();
                      w.document.write(activeSession.html);
                      w.document.close();
                    }
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Open in tab
                </Button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-white">
              {!activeSession ? (
                <div className="h-full bg-zinc-900/50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                      <Eye className="h-7 w-7 text-white/20" />
                    </div>
                    <p className="text-sm text-white/30">Your preview will appear here</p>
                  </div>
                </div>
              ) : previewTab === "preview" ? (
                <iframe
                  key={activeSession.html}
                  srcDoc={activeSession.html}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="Page preview"
                />
              ) : (
                <div className="h-full overflow-y-auto bg-zinc-950">
                  <pre className="text-xs text-green-300/80 p-5 leading-relaxed font-mono whitespace-pre-wrap break-words">
                    {activeSession.html}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
