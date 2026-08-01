// ai-native — the input is the hero, working, with no wall in front of it.
// A rewriting tool: the box up top, chips that fill it, a live-looking
// result, and proof below. Signup appears only after the visitor has already
// made something — the family's whole ethic.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PromptBox } from "@/components/ui/prompt-box";
import { RegenerateButton } from "@/components/ui/regenerate-button";
import { StreamingText } from "@/components/ui/streaming-text";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const SAMPLES: Record<string, string> = {
  "Make it warmer": "Thanks so much for thinking of us — honestly, we'd love to. Just say the word and we'll be there.",
  "Make it shorter": "Yes — count us in.",
  "Make it formal": "Thank you for the invitation. We would be delighted to attend, and look forward to it.",
};
function P() {
  const [value, setValue] = useState("we will come to the party thanks for inviting us");
  const [out, setOut] = useState<string | null>(null);
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <span className="font-semibold tracking-tight">Reword</span>
          <span className="text-sm text-muted-foreground">Free · no account to try</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Say it again, properly</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance">Reword any sentence in any room's voice</h1>
        </div>

        {/* The input IS the hero — working before any signup. */}
        <div className="mt-8 rounded-2xl border bg-card p-4 shadow-sm">
          <PromptBox value={value} onChange={setValue} onSubmit={() => setOut(SAMPLES["Make it warmer"])} placeholder="Paste the sentence you keep rewriting…" />
          <SuggestionChips className="mt-3" suggestions={["Make it warmer", "Make it shorter", "Make it formal"]} onPick={(c) => setOut(SAMPLES[c] ?? SAMPLES["Make it warmer"])} />
          {out && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-left">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reworded</p>
              <StreamingText className="mt-1" text={out} done />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Three rewrites free — an account keeps your voices.</p>
                <RegenerateButton onRegenerate={(v) => setOut(SAMPLES[v === "shorter" ? "Make it shorter" : "Make it warmer"] ?? out)} />
              </div>
            </div>
          )}
        </div>

        <StatsBand className="mt-12" items={[
          { value: "0", label: "Signup walls before the first result" },
          { value: "9", label: "Voices, from boardroom to group chat" },
          { value: "480k", label: "Sentences reworded this month" }]} />

        <section className="mt-12">
          <SectionHeader eyebrow="Why it sticks" title="The output is the pitch" description="No feature grid can prove a rewriting tool. The box above either just did, or we've lost you fairly." />
          <Testimonial className="mt-6" item={{ quote: "I pasted my resignation letter in at 11pm. It came back kind. I sent that one.", name: "Anonymous user", role: "The feedback box, March" }} />
        </section>
      </main>
    </div>
  );
}
