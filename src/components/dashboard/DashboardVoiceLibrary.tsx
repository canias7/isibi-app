import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, Loader2, Play, Pause, Lock, Headphones, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import openaiLogo from '@/assets/openai-logo.png';
import ElevenLabsIcon from '@/components/icons/ElevenLabsIcon';

const API_URL = 'https://isibi-backend.onrender.com/api';

interface VoiceOption {
  id: string;
  name: string;
  desc?: string;
}

interface ProviderOption {
  id: string;
  name: string;
  logo: string | null;
  logoType: 'img' | 'icon';
  enabled: boolean;
  price: string;
}

const VOICE_PROVIDERS: ProviderOption[] = [
   { id: 'openai', name: 'OpenAI', logo: openaiLogo, logoType: 'img', enabled: true, price: '$0.00 - $0.077/min' },
  { id: 'elevenlabs', name: 'ElevenLabs', logo: null, logoType: 'icon', enabled: true, price: '$0.00 - $0.09/min' },
  { id: 'deepgram', name: 'Deepgram', logo: null, logoType: 'img', enabled: false, price: 'Coming Soon' },
  { id: 'azure', name: 'Azure', logo: null, logoType: 'img', enabled: false, price: 'Coming Soon' },
];

const OPENAI_VOICES: VoiceOption[] = [
  { id: 'alloy', name: 'Alloy', desc: 'Neutral & balanced' },
  { id: 'ash', name: 'Ash', desc: 'Clear & articulate' },
  { id: 'coral', name: 'Coral', desc: 'Warm & expressive' },
  { id: 'echo', name: 'Echo', desc: 'Smooth & mellow' },
  { id: 'fable', name: 'Fable', desc: 'Engaging narrator' },
  { id: 'onyx', name: 'Onyx', desc: 'Deep & resonant' },
  { id: 'nova', name: 'Nova', desc: 'Energetic & bright' },
  { id: 'sage', name: 'Sage', desc: 'Calm & thoughtful' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Light & cheerful' },
];

const DEFAULT_ELEVENLABS_VOICES: VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Female, calm and young American' },
  { id: 'U9VgC8Xinl7nnNsyDd3J', name: 'Drew', desc: 'Male, confident and clear' },
];

export default function DashboardVoiceLibrary() {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [elevenlabsVoices, setElevenlabsVoices] = useState<VoiceOption[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (selectedProvider === 'elevenlabs' && elevenlabsVoices.length === 0) {
      const token = localStorage.getItem('token');
      fetch(`${API_URL}/voices/providers?token=${token}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const el = data?.providers?.find((p: any) => p.id === 'elevenlabs');
          if (el?.voices) {
            setElevenlabsVoices(
              el.voices.map((v: any) => ({
                id: v.voice_id || v.id,
                name: v.name,
                desc: v.description,
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [selectedProvider]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const displayedElevenlabsVoices = (() => {
    const merged = [...DEFAULT_ELEVENLABS_VOICES];
    elevenlabsVoices.forEach((v) => {
      if (!merged.some((d) => d.id === v.id)) merged.push(v);
    });
    return merged;
  })();

  const currentVoices = selectedProvider === 'openai' ? OPENAI_VOICES : displayedElevenlabsVoices;

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingVoice(null);
  };

  const playVoicePreview = async (voiceId: string) => {
    if (playingVoice === voiceId) {
      stopAudio();
      return;
    }
    stopAudio();
    setLoadingVoice(voiceId);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(
        `${API_URL}/voices/test/${selectedProvider}/${voiceId}?text=Hello! This is a test of this voice.&token=${token}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('audio') || selectedProvider === 'elevenlabs') {
          const blob = await res.blob();
          if (blob.size > 0 && (blob.type.includes('audio') || selectedProvider === 'elevenlabs')) {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            setPlayingVoice(voiceId);
            audio.onended = () => { URL.revokeObjectURL(url); setPlayingVoice(null); audioRef.current = null; };
            audio.onerror = () => { URL.revokeObjectURL(url); setPlayingVoice(null); audioRef.current = null; };
            await audio.play();
          }
        }
      }
    } catch {} finally {
      setLoadingVoice(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Voice Library</h2>
            <p className="text-sm text-muted-foreground">Browse all available voices and test them before using in your agents</p>
          </div>
        </div>
      </div>

      {/* Provider Tabs */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mic className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold text-foreground">Providers</Label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {VOICE_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => p.enabled && setSelectedProvider(p.id)}
              className={cn(
                'group relative p-4 rounded-2xl border-2 text-sm font-medium transition-all duration-200 flex flex-col items-center gap-2.5',
                selectedProvider === p.id
                  ? 'border-primary bg-primary/10 text-primary shadow-md shadow-primary/10 scale-[1.02]'
                  : 'border-border/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5',
                !p.enabled && 'opacity-40 cursor-not-allowed hover:border-border/50 hover:bg-transparent'
              )}
              disabled={!p.enabled}
            >
              {selectedProvider === p.id && (
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div className="h-8 w-8 flex items-center justify-center">
                {p.logo ? (
                  <img src={p.logo} alt={p.name} className="h-7 w-7 object-contain" />
                ) : p.id === 'elevenlabs' ? (
                  <ElevenLabsIcon className="h-7 w-7" />
                ) : (
                  <Volume2 className="h-6 w-6 opacity-30" />
                )}
              </div>
              <span className="font-semibold text-xs">{p.name}</span>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full",
                p.enabled ? "bg-secondary/50 text-muted-foreground" : "bg-secondary/30 text-muted-foreground/60"
              )}>
                {!p.enabled && <Lock className="h-2.5 w-2.5 inline mr-0.5" />}
                {p.price}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Voice Cards */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <Label className="text-sm font-semibold text-foreground">Available Voices</Label>
          <span className="text-xs text-muted-foreground ml-auto">{currentVoices.length} voices</span>
        </div>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={selectedProvider}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {currentVoices.map((v) => {
              const isPlaying = playingVoice === v.id;
              const isLoading = loadingVoice === v.id;

              return (
                <motion.div
                  key={v.id}
                  variants={{
                    hidden: { opacity: 0, y: 12, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <div className="group p-4 rounded-2xl border-2 border-border/50 hover:border-primary/30 hover:bg-primary/5 text-left text-sm transition-all duration-200 w-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground">{v.name}</div>
                        {v.desc && (
                          <div className="text-[11px] mt-1 text-muted-foreground leading-snug">{v.desc}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant={isPlaying ? "default" : "outline"}
                        className={cn(
                          "h-7 px-3 text-[11px] gap-1.5 rounded-full transition-all",
                          isPlaying && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => playVoicePreview(v.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {isPlaying ? 'Playing...' : 'Preview'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
