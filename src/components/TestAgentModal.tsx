import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, PhoneOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updateAgent } from "@/lib/api";
import type { AgentOut } from "@/lib/api";

const API_BASE = "https://isibi-backend.onrender.com";

interface TestAgentModalProps {
  agent: AgentOut;
  open: boolean;
  onClose: () => void;
}

interface LatencyState {
  current: number | null;
  avg: number | null;
  samples: number;
}

interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  complete?: boolean;
}

export default function TestAgentModal({ agent, open, onClose }: TestAgentModalProps) {
  const { toast } = useToast();

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [duration, setDuration] = useState(0);

  // Model / TTS selection
  const [selectedModel, setSelectedModel] = useState<string>(
    agent.model || "gpt-4o-realtime-preview-2025-06-03"
  );
  const [selectedTts, setSelectedTts] = useState<string>(
    agent.tts_provider || "openai"
  );
  const [activeModel, setActiveModel] = useState<string | null>(null);

  // Latency
  const [latency, setLatency] = useState<LatencyState>({ current: null, avg: null, samples: 0 });

  // Transcript
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      stopTest();
      setTranscript([]);
      setDuration(0);
      setLatency({ current: null, avg: null, samples: 0 });
      setActiveModel(null);
    }
  }, [open]);

  const getLatencyQuality = (ms: number | null) => {
    if (ms === null) return { label: "—", color: "text-muted-foreground" };
    if (ms < 500)  return { label: "Excellent", color: "text-green-500" };
    if (ms < 1000) return { label: "Good",      color: "text-yellow-500" };
    if (ms < 2000) return { label: "Fair",       color: "text-orange-500" };
    return               { label: "Poor",        color: "text-red-500" };
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleServerEvent = useCallback((data: any) => {
    const { type } = data;

    if (type === "conversation.item.input_audio_transcription.completed") {
      setTranscript(prev => [...prev, { role: "user", content: data.transcript }]);
    } else if (type === "response.audio_transcript.delta") {
      setTranscript(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && !last.complete) {
          return [...prev.slice(0, -1), { ...last, content: last.content + data.delta }];
        }
        return [...prev, { role: "assistant", content: data.delta, complete: false }];
      });
    } else if (type === "response.audio_transcript.done") {
      setTranscript(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          return [...prev.slice(0, -1), { ...last, complete: true }];
        }
        return prev;
      });
    } else if (type === "session.model") {
      setActiveModel(data.model);
    } else if (type === "latency.update") {
      setLatency({ current: data.latency_ms, avg: data.avg_latency_ms, samples: data.samples });
    } else if (type === "error") {
      toast({ variant: "destructive", title: "Agent Error", description: data.error });
      stopTest();
    }
  }, [toast]);

  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    isPlayingRef.current = true;
    setIsSpeaking(true);
    const buf = audioQueueRef.current.shift()!;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
      const decoded = await ctx.decodeAudioData(buf);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.onended = () => playNextChunk();
      src.start();
    } catch {
      playNextChunk();
    }
  }, []);

  const stopTest = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: "end" })); } catch {}
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const startTest = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Save model + TTS to agent
      await updateAgent(agent.id, { model: selectedModel, tts_provider: selectedTts });

      // Mic permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 24000 }
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;

      const token = localStorage.getItem("token");
      const ws = new WebSocket(`wss://isibi-backend.onrender.com/test-agent/${agent.id}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

        // Stream mic audio
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          wsRef.current.send(pcm.buffer);
        };
        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          const buf = await event.data.arrayBuffer();
          audioQueueRef.current.push(buf);
          if (!isPlayingRef.current) playNextChunk();
        } else {
          handleServerEvent(JSON.parse(event.data));
        }
      };

      ws.onerror = () => {
        toast({ variant: "destructive", title: "Connection Error", description: "Failed to connect to agent." });
        stopTest();
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      };

    } catch (err: any) {
      setIsConnecting(false);
      toast({
        variant: "destructive",
        title: "Microphone Required",
        description: err.message || "Please allow microphone access.",
      });
      stopTest();
    }
  }, [agent.id, selectedModel, selectedTts, handleServerEvent, playNextChunk, stopTest, toast]);

  const handleClose = () => {
    stopTest();
    onClose();
  };

  const qualityCurrent = getLatencyQuality(latency.current);
  const qualityAvg = getLatencyQuality(latency.avg);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎤 Test Agent: {agent.assistant_name}
          </DialogTitle>
        </DialogHeader>

        {!isConnected ? (
          /* ── Start Screen ── */
          <div className="flex flex-col gap-5 py-2">
            {/* Model selector */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-muted-foreground">🧠 Brain (Model)</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "gpt-4o-realtime-preview-2025-06-03", label: "GPT-4o Realtime", tag: "Recommended", tagClass: "bg-violet-100 text-violet-700" },
                  { value: "gpt-4o-mini-realtime-preview",       label: "GPT-4o Mini",     tag: "Faster · Cheaper", tagClass: "bg-green-100 text-green-700" },
                  { value: "gpt-4o",                             label: "GPT-4o",           tag: "Flexible TTS",    tagClass: "bg-amber-100 text-amber-700" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedModel(opt.value)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                      selectedModel === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${opt.tagClass}`}>{opt.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TTS selector — only for GPT-4o classic */}
            <AnimatePresence>
              {selectedModel === "gpt-4o" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  <p className="text-sm font-semibold text-muted-foreground">🔊 Voice Output (TTS)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "openai",      label: "OpenAI TTS",  tag: "Fast · Natural",    tagClass: "bg-violet-100 text-violet-700" },
                      { value: "elevenlabs",  label: "ElevenLabs",  tag: "Ultra-realistic",   tagClass: "bg-green-100 text-green-700" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSelectedTts(opt.value)}
                        className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                          selectedTts === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className="text-xs font-semibold">{opt.label}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${opt.tagClass}`}>{opt.tag}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Agent info */}
            <div className="rounded-xl bg-muted/50 p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">🎙️ Voice</span>
                <span>{agent.voice || agent.openai_voice || "alloy"}</span>
              </div>
              {agent.system_prompt && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground font-medium shrink-0">📝 Prompt</span>
                  <span className="text-right text-xs text-muted-foreground truncate max-w-[240px]">
                    {agent.system_prompt.substring(0, 100)}…
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={startTest}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Connecting…</span>
              ) : (
                <span className="flex items-center gap-2"><Mic className="h-5 w-5" /> Start Test Call</span>
              )}
            </Button>
          </div>
        ) : (
          /* ── Active Call Screen ── */
          <div className="flex flex-col gap-4 py-2">
            {/* Status animation */}
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="relative flex items-center justify-center h-24">
                {isSpeaking ? (
                  <div className="flex items-end gap-1">
                    {[0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => (
                      <motion.div
                        key={i}
                        className="w-2 rounded-full bg-primary"
                        animate={{ height: ["8px", "40px", "8px"] }}
                        transition={{ duration: 0.8, delay, repeat: Infinity }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    <motion.div
                      className="absolute w-20 h-20 rounded-full border-2 border-primary"
                      animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <div className="text-4xl">🎙️</div>
                  </div>
                )}
              </div>

              <p className="text-sm font-semibold text-primary">
                {isSpeaking ? `${agent.assistant_name} is speaking…` : "Listening… speak now"}
              </p>
              <p className="text-xs text-muted-foreground">⏱️ {formatDuration(duration)}</p>

              {activeModel && (
                <span className="text-xs font-semibold bg-violet-100 text-violet-700 px-3 py-1 rounded-full">
                  🧠 {activeModel === "gpt-4o-mini-realtime-preview"
                    ? "GPT-4o Mini Realtime"
                    : activeModel === "gpt-4o"
                    ? `GPT-4o + ${agent.tts_provider === "elevenlabs" ? "ElevenLabs" : "OpenAI TTS"}`
                    : "GPT-4o Realtime"}
                </span>
              )}
            </div>

            {/* Latency bar */}
            <div className="grid grid-cols-3 divide-x divide-border rounded-xl border bg-muted/30 text-center py-3">
              <div className="flex flex-col gap-1 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Latency</span>
                <span className={`text-lg font-bold tabular-nums ${qualityCurrent.color}`}>
                  {latency.current !== null ? `${latency.current}ms` : "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg</span>
                <span className={`text-lg font-bold tabular-nums ${qualityAvg.color}`}>
                  {latency.avg !== null ? `${latency.avg}ms` : "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quality</span>
                <span className={`text-sm font-bold ${qualityCurrent.color}`}>{qualityCurrent.label}</span>
              </div>
            </div>

            {/* Transcript */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Conversation</p>
              <div className="rounded-xl bg-muted/40 p-3 max-h-52 overflow-y-auto flex flex-col gap-2">
                {transcript.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">Start speaking to test your agent</p>
                ) : (
                  transcript.map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-violet-100 border-l-4 border-violet-500 self-end ml-8"
                          : "bg-blue-50 border-l-4 border-blue-400 self-start mr-8"
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 text-muted-foreground">
                        {msg.role === "user" ? "👤 You" : `🤖 ${agent.assistant_name}`}
                      </p>
                      <p className="leading-relaxed">{msg.content}</p>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            {/* End call button */}
            <Button variant="destructive" size="lg" className="w-full" onClick={stopTest}>
              <PhoneOff className="h-5 w-5 mr-2" /> End Test Call
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
