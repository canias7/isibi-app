// educational /lesson — one lesson: the content, where you are on the path,
// what is next. Progress is visible ON the page (the family's rule), and the
// next action is always exactly one button.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";
import { ChapterList } from "@/components/ui/chapter-list";
import { PrevNext } from "@/components/ui/prev-next";
import { ProgressRing } from "@/components/ui/progress-ring";
import { VideoEmbed } from "@/components/ui/video-embed";
export const Route = createFileRoute("/lesson")({ component: P });
const CHROME = {
  name: "The Proving Room", tagline: "Sourdough, taught slowly, online.",
  links: [{ label: "The course", href: "#/" }, { label: "This week", href: "#/lesson" }],
};
function P() {
  const [done, setDone] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Week 3 · Lesson 2 of 6</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">The four folds, and when to stop</h1>
          </div>
          <ProgressRing value={38} label="course" />
        </div>
        <div className="mt-6"><VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="The four folds, demonstrated" /></div>
        <ChapterList className="mt-4" total={720} chapters={[
          { start: 0, title: "Why folding replaces kneading" },
          { start: 140, title: "The first fold — wet hands, one motion" },
          { start: 320, title: "Reading the dough between folds" },
          { start: 545, title: "When the fourth fold is one too many" },
        ]} />
        <div className="prose prose-sm mt-8 max-w-none text-foreground">
          <p>The dough tells you when it's had enough: it stops relaxing back. This lesson is mostly about learning to see that moment, and the homework is deliberately one loaf's worth of watching.</p>
          <p><strong>This week's bake:</strong> fold at 30-minute intervals until the dough holds a corner. Photograph the corner — that photo is what your tutor comments on.</p>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <Button onClick={() => setDone(true)} disabled={done}>{done ? "Marked done ✓" : "Mark lesson done"}</Button>
          {done && <span className="text-sm text-muted-foreground">Week 3 is now 2 of 6 — the path updates on the course page.</span>}
        </div>
        <PrevNext className="mt-12" prev={{ label: "Folding and time — the theory", href: "#/lesson" }} next={{ label: "Reading a proof by eye", href: "#/lesson" }} />
      </div>
    </SiteChrome>
  );
}
