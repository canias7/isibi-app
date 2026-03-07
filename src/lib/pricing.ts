// Centralized pricing logic — extend these maps when adding new providers

const FIXED_COSTS = {
  isibi: 0.05,
  twilio: 0.0085,
};

const TRANSCRIBER_PRICES: Record<string, [number, number]> = {
  "whisper-1": [0.01, 0.01],
  "gpt-4o-mini-transcribe": [0.01, 0.01],
  "gpt-4o-transcribe": [0.012, 0.012],
};

const MODEL_PRICES: Record<string, [number, number]> = {
  "gpt-realtime-2025-08-28": [0.00, 0.03],
  "gpt-4o": [0.00, 0.08],
  "gpt-4o-mini": [0.00, 0.05],
  "gpt-5": [0.00, 0.12],
};

const VOICE_PRICES: Record<string, [number, number]> = {
  elevenlabs: [0.00, 0.09],
  openai: [0.00, 0.077],
};

const TRANSCRIBER_LABELS: Record<string, string> = {
  "whisper-1": "Whisper",
  "gpt-4o-mini-transcribe": "GPT-4o Mini Transcribe",
  "gpt-4o-transcribe": "GPT-4o Transcribe",
};

const MODEL_LABELS: Record<string, string> = {
  "gpt-realtime-2025-08-28": "gpt-realtime-2025-08-28",
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-5": "gpt-5",
};

const VOICE_LABELS: Record<string, string> = {
  elevenlabs: "ElevenLabs",
  openai: "OpenAI",
};

// Defaults
const DEFAULT_TRANSCRIBER = "whisper-1";
const DEFAULT_MODEL = "gpt-realtime-2025-08-28";
const DEFAULT_VOICE = "elevenlabs";

export interface AgentPricingInput {
  transcriberModel?: string;
  llmModel?: string;
  voiceProvider?: string;
}

export function getEstimatedRange(config?: AgentPricingInput): { min: number; max: number } {
  const t = config?.transcriberModel || DEFAULT_TRANSCRIBER;
  const m = config?.llmModel || DEFAULT_MODEL;
  const v = config?.voiceProvider || DEFAULT_VOICE;

  const fixed = FIXED_COSTS.isibi + FIXED_COSTS.twilio;
  const [tMin, tMax] = TRANSCRIBER_PRICES[t] ?? TRANSCRIBER_PRICES[DEFAULT_TRANSCRIBER];
  const [mMin, mMax] = MODEL_PRICES[m] ?? MODEL_PRICES[DEFAULT_MODEL];
  const [vMin, vMax] = VOICE_PRICES[v] ?? VOICE_PRICES[DEFAULT_VOICE];

  return {
    min: fixed + tMin + mMin + vMin,
    max: fixed + tMax + mMax + vMax,
  };
}

export function formatRange(config?: AgentPricingInput): string {
  const { min, max } = getEstimatedRange(config);
  return `$${min.toFixed(4)}–$${max.toFixed(4)}/min`;
}

export function getTranscriberLabel(id: string): string {
  return TRANSCRIBER_LABELS[id] ?? id;
}
export function getTranscriberPrice(id: string): string {
  const [min, max] = TRANSCRIBER_PRICES[id] ?? TRANSCRIBER_PRICES[DEFAULT_TRANSCRIBER];
  return min === max ? `$${min.toFixed(2)}/min` : `$${min.toFixed(2)}–$${max.toFixed(2)}/min`;
}
export function getModelLabel(id: string): string {
  return MODEL_LABELS[id] ?? id;
}
export function getModelPrice(id: string): string {
  const [min, max] = MODEL_PRICES[id] ?? MODEL_PRICES[DEFAULT_MODEL];
  return min === max ? `$${min.toFixed(2)}/min` : `$${min.toFixed(2)}–$${max.toFixed(2)}/min`;
}
export function getVoiceLabel(id: string): string {
  return VOICE_LABELS[id] ?? id;
}
export function getVoicePrice(id: string): string {
  const [min, max] = VOICE_PRICES[id] ?? VOICE_PRICES[DEFAULT_VOICE];
  const fmt = (v: number) => {
    const s = v.toString();
    const dec = s.includes('.') ? s.split('.')[1].length : 0;
    return `$${v.toFixed(Math.max(dec, 2))}`;
  };
  return min === max ? `${fmt(min)}–${fmt(max)}/min` : `${fmt(min)}–${fmt(max)}/min`;
}

export { FIXED_COSTS };
