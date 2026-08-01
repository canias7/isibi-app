// ai-native — "the input is the hero; the output is the proof". Directive components only.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PromptBox } from "@/components/ui/prompt-box";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { BeforeAfter } from "@/components/ui/before-after";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [v, setV] = useState("");
  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-6 pt-24 pb-16">
        <h1 className="text-center text-4xl font-semibold tracking-tight">Reword any room</h1>
        <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">Describe the change. No account until you've seen your own room done.</p>
        <div className="mt-8"><PromptBox value={v} onChange={setV} onSubmit={() => setV("")} placeholder="Paint it sage green, oak floor, morning light…" /></div>
        <SuggestionChips className="mt-4" title="Try one"
          suggestions={["Make it Scandinavian", "Same room, autumn evening", "Swap carpet for terracotta"]}
          onPick={setV} />
        <div className="mt-14">
          <p className="mb-3 text-center text-sm uppercase tracking-wider text-muted-foreground">One drag, same room</p>
          <BeforeAfter before={null} after={null} beforeLabel="Their photo" afterLabel="Sage green" ratio="16/9" />
        </div>
      </main>
    </div>
  );
}
