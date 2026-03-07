import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, Mic, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: Date;
}

export default function VoiceChatISIBI() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [partialUserText, setPartialUserText] = useState("");
  const [partialAgentText, setPartialAgentText] = useState("");
  const streamingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const addTranscript = useCallback((role: "user" | "agent", text: string) => {
    setTranscripts((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: new Date() },
    ]);
  }, []);

  // Stream agent text word-by-word for a typing effect
  const streamAgentText = useCallback((fullText: string) => {
    // Clear any existing stream
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
    }
    const words = fullText.split(/(\s+)/);
    let currentIndex = 0;
    setPartialAgentText("");

    streamingIntervalRef.current = setInterval(() => {
      currentIndex++;
      if (currentIndex >= words.length) {
        if (streamingIntervalRef.current) clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
        setPartialAgentText("");
        addTranscript("agent", fullText);
        return;
      }
      setPartialAgentText(words.slice(0, currentIndex).join(""));
    }, 60);
  }, [addTranscript]);

  const conversation = useConversation({
    onConnect: () => console.log("Connected to ISIBI"),
    onDisconnect: () => {
      console.log("Disconnected from ISIBI");
      setPartialUserText("");
      setPartialAgentText("");
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to connect to ISIBI. Please try again.",
      });
    },
    onMessage: (message: any) => {
      console.log("ISIBI message:", JSON.stringify(message));
      
      // Primary format: { source, role, message }
      if (message.message && message.role) {
        if (message.role === "user") {
          setPartialUserText("");
          addTranscript("user", message.message);
        } else {
          streamAgentText(message.message);
        }
        return;
      }

      // Handle user transcript (finalized)
      if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript 
          || message.user_transcript;
        if (text) {
          setPartialUserText("");
          addTranscript("user", text);
        }
      } 
      // Handle agent response (finalized)
      else if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response 
          || message.agent_response;
        if (text) {
          streamAgentText(text);
        }
      }
      // Handle transcript messages (alternative format)
      else if (message.type === "transcript") {
        const text = message.text || message.transcript;
        const role = message.role === "agent" ? "agent" : "user";
        if (text) {
          if (role === "user") {
            setPartialUserText("");
            addTranscript("user", text);
          } else {
            streamAgentText(text);
          }
        }
      }
      // Handle partial/interim transcripts  
      else if (message.type === "partial_transcript" || message.type === "interim") {
        const text = message.text || message.transcript || message.partial;
        if (text) {
          setPartialUserText(text);
        }
      }
      // Handle agent response correction
      else if (message.type === "agent_response_correction") {
        const text = message.agent_response_correction_event?.corrected_agent_response;
        if (text) {
          setTranscripts((prev) => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === "agent") {
                updated[i] = { ...updated[i], text };
                break;
              }
            }
            return updated;
          });
        }
      }
    },
  });

  // Auto-scroll to bottom when transcripts update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, partialUserText, partialAgentText]);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setTranscripts([]);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (error || !data?.token) {
        throw new Error(error?.message || "No token received");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (error: any) {
      console.error("Failed to start conversation:", error);
      toast({
        variant: "destructive",
        title: "Microphone Access Required",
        description: error.message || "Please enable microphone access to talk to ISIBI.",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, toast]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isActive = conversation.status === "connected";

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-4 w-full"
          >
            {/* Pulsing orb when connected */}
            <div className="relative">
              <motion.div
                animate={{
                  scale: conversation.isSpeaking ? [1, 1.2, 1] : [1, 1.05, 1],
                  opacity: conversation.isSpeaking ? [0.6, 1, 0.6] : [0.3, 0.5, 0.3],
                }}
                transition={{ duration: conversation.isSpeaking ? 0.6 : 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-primary blur-xl"
              />
              <button
                onClick={stopConversation}
                className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_60px_hsl(45_100%_51%/0.5)] hover:brightness-110 transition-all"
              >
                <X className="h-7 w-7" />
              </button>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {conversation.isSpeaking ? "ISIBI is speaking..." : "Listening..."}
            </p>

            {/* Live Transcript */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full mt-2"
            >
              <div className="rounded-2xl border border-border/60 bg-background/60 backdrop-blur-md overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Live Transcript
                  </span>
                </div>
                <div
                  ref={scrollRef}
                  className="max-h-64 overflow-y-auto p-4 space-y-3 scrollbar-thin"
                >
                  {transcripts.length === 0 && !partialUserText && !partialAgentText ? (
                    <p className="text-sm text-muted-foreground/60 text-center py-4 italic">
                      Start speaking — your conversation will appear here...
                    </p>
                  ) : (
                    <>
                      {transcripts.map((entry) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex gap-2.5 ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {entry.role === "agent" && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
                              <Bot className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm leading-relaxed ${
                              entry.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            {entry.text}
                          </div>
                          {entry.role === "user" && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary mt-0.5">
                              <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                        </motion.div>
                      ))}

                      {/* Partial texts (live typing indicators) */}
                      {partialUserText && (
                        <div className="flex gap-2.5 justify-end">
                          <div className="max-w-[80%] rounded-xl px-3.5 py-2 text-sm bg-primary/60 text-primary-foreground rounded-br-sm opacity-70">
                            {partialUserText}
                          </div>
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary mt-0.5">
                            <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                      {partialAgentText && (
                        <div className="flex gap-2.5 justify-start">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="max-w-[80%] rounded-xl px-3.5 py-2 text-sm bg-muted/60 text-foreground rounded-bl-sm opacity-70">
                            {partialAgentText}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="inactive"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <button
              onClick={startConversation}
              disabled={isConnecting}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg hover:brightness-110 transition-all duration-200 shadow-[0_0_40px_hsl(45_100%_51%/0.3)] hover:shadow-[0_0_60px_hsl(45_100%_51%/0.5)] disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : null}
              {isConnecting ? "Connecting..." : "Talk"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
