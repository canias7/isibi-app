// ai-native — TERMINAL structure: a playground, monospace, no imagery, no
// marketing furniture. The input is a prompt line, the output prints under
// it, and the whole pitch is that it already ran before you signed up.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CodeBlock } from "@/components/ui/code-block";
import { PromptBox } from "@/components/ui/prompt-box";
import { StreamingText } from "@/components/ui/streaming-text";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
export const Route = createFileRoute("/")({ component: P });
const SAMPLES: Record<string, string> = {
  "Make it warmer": "Thanks so much for thinking of us — honestly, we'd love to. Just say the word and we'll be there.",
  "Make it shorter": "Yes — count us in.",
  "Make it formal": "Thank you for the invitation. We would be delighted to attend, and look forward to it.",
};
function P() {
  const [value, setValue] = useState("we will come to the party thanks for inviting us");
  const [out, setOut] = useState<string | null>(null);
  const [voice, setVoice] = useState("Make it warmer");
  return (
    <div className="min-h-svh bg-background font-mono text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3 text-sm">
          <span className="font-semibold">reword</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">v2.4 · free · no account to try</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">$ reword --voice "{voice.toLowerCase().replace("make it ", "")}"</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Any sentence, any room's voice.</h1>

        <div className="mt-6 border border-border p-3">
          <PromptBox value={value} onChange={setValue} onSubmit={() => setOut(SAMPLES[voice])} placeholder="paste the sentence you keep rewriting…" />
          <SuggestionChips className="mt-3" suggestions={["Make it warmer", "Make it shorter", "Make it formal"]} onPick={(c) => { setVoice(c); setOut(SAMPLES[c]); }} />
        </div>

        {out && (
          <div className="mt-4 border border-border p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">stdout</p>
            <StreamingText className="mt-2" text={out} done />
            <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">rewrites left: 2 of 3 · an account keeps your voices</p>
          </div>
        )}

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Also speaks API</p>
          <div className="mt-3"><CodeBlock language="bash" code={'curl -X POST https://api.reword.dev/v1 \\\n  -d text="we will come to the party" \\\n  -d voice=warmer'} /></div>
        </div>

        <div className="mt-10 grid gap-1 border-t border-border pt-6 text-xs uppercase tracking-wide text-muted-foreground sm:grid-cols-3">
          <span>0 signup walls before output</span>
          <span>9 voices, boardroom → group chat</span>
          <span>480k sentences this month</span>
        </div>
      </main>
    </div>
  );
}
