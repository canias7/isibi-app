// personal-brand /music — the work itself. A musician's site without the
// music is a CV; this page is releases with players, newest first, each with
// the one line of story that makes it hers.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AudioPlayer } from "@/components/ui/audio-player";
import { SafeImage } from "@/components/ui/safe-image";
import { Quote } from "@/components/ui/quote";
export const Route = createFileRoute("/music")({ component: P });
const CHROME = {
  name: "Elsie Marrow", tagline: "Songs about rivers and shift work.",
  links: [{ label: "Home", href: "/" }, { label: "Music", href: "/music" }, { label: "Press kit", href: "/press" }],
  action: { label: "Book me", href: "/" },
};
const RELEASES = [
  { title: "Marrow", year: "2026", kind: "Album — out October", note: "Eleven songs, recorded live in four days at Yellow Arch. The tour is this record.", tracks: [{ t: "Night Shift Says Goodnight", src: "/audio/night-shift.mp3" }, { t: "Five Weirs (reprise)", src: "/audio/five-weirs-r.mp3" }] },
  { title: "Five Weirs", year: "2022", kind: "EP", note: "The canal-side lockup one. The tape hiss is the room and it stays.", tracks: [{ t: "Five Weirs", src: "/audio/five-weirs.mp3" }, { t: "Kelham Goods Yard", src: "/audio/kelham.mp3" }] },
];
function P() {
  const [open, setOpen] = useState("Marrow");
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">The records</h1>
        <p className="mt-2 text-muted-foreground">Two so far. Stream anywhere, or right here — Bandcamp is where buying one actually pays me.</p>
        <div className="mt-8 grid gap-10">
          {RELEASES.map((r) => (
            <section key={r.title} className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <SafeImage src={null} alt={`${r.title} — cover`} ratio="1/1" />
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-xl font-medium">{r.title}</h2>
                  <span className="text-sm text-muted-foreground">{r.year} · {r.kind}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.note}</p>
                <div className="mt-3 grid gap-2">
                  {(open === r.title ? r.tracks : r.tracks.slice(0, 1)).map((t) => (
                    <AudioPlayer key={t.t} src={t.src} title={t.t} />
                  ))}
                </div>
                {open !== r.title && (
                  <button type="button" className="mt-2 text-sm underline underline-offset-4" onClick={() => setOpen(r.title)}>
                    More from {r.title}
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
        <Quote className="mt-12" cite="BBC Radio 6, first play of 'Five Weirs'">Where has she been.</Quote>
        <p className="mt-8 border-t pt-6 text-sm text-muted-foreground">Tour dates and everything else live on <a className="font-medium underline underline-offset-4" href="/">the front page</a>; artwork and bios in the <a className="font-medium underline underline-offset-4" href="/press">press kit</a>.</p>
      </div>
    </SiteChrome>
  );
}
