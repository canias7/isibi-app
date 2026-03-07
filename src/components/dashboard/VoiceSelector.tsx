import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, Check, Loader2, Play, Pause, Lock } from 'lucide-react';
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

interface VoiceValue {
  provider: string;
  voice_id: string;
}

interface VoiceSelectorProps {
  value: VoiceValue;
  onChange: (value: VoiceValue) => void;
}

export default function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const [elevenlabsVoices, setElevenlabsVoices] = useState<VoiceOption[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load ElevenLabs voices when provider selected
  useEffect(() => {
    if (value.provider === 'elevenlabs' && elevenlabsVoices.length === 0) {
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
  }, [value.provider]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Merge default + fetched ElevenLabs voices
  const displayedElevenlabsVoices = (() => {
    const merged = [...DEFAULT_ELEVENLABS_VOICES];
    elevenlabsVoices.forEach((v) => {
      if (!merged.some((d) => d.id === v.id)) merged.push(v);
    });
    return merged;
  })();

  const currentVoices = value.provider === 'openai' ? OPENAI_VOICES : displayedElevenlabsVoices;

  const handleProviderChange = (providerId: string) => {
    // Stop any playing audio
    stopAudio();

    if (providerId === 'openai') {
      onChange({ provider: providerId, voice_id: 'alloy' });
    } else if (providerId === 'elevenlabs') {
      onChange({ provider: providerId, voice_id: '21m00Tcm4TlvDq8ikWAM' });
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    onChange({ provider: value.provider, voice_id: voiceId });
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingVoice(null);
  };

  const playVoicePreview = async (voiceId: string) => {
    // Toggle off if same voice
    if (playingVoice === voiceId) {
      stopAudio();
      return;
    }

    stopAudio();
    setLoadingVoice(voiceId);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(
        `${API_URL}/voices/test/${value.provider}/${voiceId}?text=Hello! This is a test of this voice.&token=${token}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('audio') || value.provider === 'elevenlabs') {
          const blob = await res.blob();
          if (blob.size > 0 && (blob.type.includes('audio') || value.provider === 'elevenlabs')) {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            setPlayingVoice(voiceId);

            audio.onended = () => {
              URL.revokeObjectURL(url);
              setPlayingVoice(null);
              audioRef.current = null;
            };

            audio.onerror = () => {
              URL.revokeObjectURL(url);
              setPlayingVoice(null);
              audioRef.current = null;
            };

            await audio.play();
          }
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoadingVoice(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold text-foreground">Voice Provider</Label>
        </div>
        <select
          value={value.provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {VOICE_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.enabled}>
              {p.name}{p.enabled ? ` (${p.price})` : ' (Coming Soon)'}
            </option>
          ))}
        </select>
      </div>

      {/* Voice Selection */}
      <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <Label className="text-sm font-semibold text-foreground">Pick a Voice</Label>
          <span className="text-xs text-muted-foreground ml-auto">{currentVoices.length} available</span>
        </div>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={value.provider}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {currentVoices.map((v) => {
              const isSelected = value.voice_id === v.id;
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
                  <button
                    onClick={() => handleVoiceSelect(v.id)}
                    className={cn(
                      'group p-4 rounded-2xl border-2 text-left text-sm transition-all duration-200 relative w-full',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                        : 'border-border/50 hover:border-primary/30 hover:bg-primary/5'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-semibold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                          {v.name}
                        </div>
                        {v.desc && (
                          <div className="text-[11px] mt-1 text-muted-foreground leading-snug">{v.desc}</div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant={isPlaying ? "default" : "outline"}
                        className={cn(
                          "h-7 px-3 text-[11px] gap-1.5 rounded-full transition-all",
                          isPlaying && "bg-primary text-primary-foreground"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          playVoicePreview(v.id);
                        }}
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
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
