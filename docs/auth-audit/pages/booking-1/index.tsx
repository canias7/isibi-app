import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { Hero } from "@/components/ui/hero";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DataList } from "@/components/ui/data-list";
import { TeamGrid } from "@/components/ui/team-grid";
import { SafeImage } from "@/components/ui/safe-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { SeoJsonLd, localBusinessJsonLd } from "@/components/ui/seo-jsonld";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice, six classes a week.",
  links: [
    { label: "Timetable", href: "#timetable" },
    { label: "Teachers", href: "#teachers" },
    { label: "FAQ", href: "#faq" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book a class", href: "/book" },
};

const TIMETABLE = [
  { day: "Monday", classes: ["07:00 Morning Flow", "18:00 Vinyasa"] },
  { day: "Tuesday", classes: ["09:30 Gentle Hatha"] },
  { day: "Wednesday", classes: ["07:00 Morning Flow", "18:00 Power Yoga"] },
  { day: "Thursday", classes: ["09:30 Gentle Hatha", "19:00 Restorative"] },
  { day: "Friday", classes: ["07:00 Morning Flow"] },
  { day: "Saturday", classes: ["10:00 Vinyasa", "11:30 Family Flow"] },
  { day: "Sunday", classes: ["10:00 Restorative"] },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <SeoJsonLd
        data={localBusinessJsonLd({
          name: "Aurora Yoga",
        })}
      />
      <Hero
        title="Aurora Yoga"
        subtitle="A calm room above the high street. Come as you are, mat and all — or borrow one of ours."
        primary={{ label: "Book a class", href: "/book" }}
        secondary={{ label: "See the timetable", href: "#timetable" }}
      />

      <section id="timetable" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="This week"
            title="Class timetable"
            description="Every class runs sixty minutes. Turn up ten minutes early for a mat and a chat."
          />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 motion-stagger">
            {TIMETABLE.map((d) => (
              <li key={d.day} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-medium">{d.day}</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {d.classes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <button
              onClick={() => navigate({ to: "/book" })}
              className="motion-press inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Book a class
            </button>
          </div>
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The teachers"
          title="Who you'll practise with"
          description="Each teacher brings their own pace — ask at the desk who suits you best."
        />
        <DataList
          query={teachers}
          className="mt-8"
          skeleton={3}
          empty={{ title: "No teachers listed yet", description: "Check back soon." }}
          error="Couldn't load the teachers. Refresh and try again."
        >
          {() => null}
        </DataList>
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({
              name: t.name,
              role: t.bio,
              photo: t.photo_url,
              fallbackSeed: t.name,
            }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader eyebrow="The room" title="A quiet space to practise" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="studio-room" />
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="studio-mats" />
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="studio-window" />
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
        <SectionHeader eyebrow="Before you come" title="Questions people ask" />
        <Faq
          className="mt-8"
          items={[
            {
              question: "Do I need to bring a mat?",
              answer: "No — we have mats and blocks for everyone, freshly cleaned between classes.",
            },
            {
              question: "What should I wear?",
              answer: "Anything you can move freely in. Bare feet or grip socks, no trainers on the floor.",
            },
            {
              question: "I've never done yoga before — is that alright?",
              answer: "More than alright. Morning Flow and Gentle Hatha are both easy starting points.",
            },
          ]}
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <CtaBand
          title="Your mat is waiting"
          description="Pick a class and a time — takes less than a minute."
          action={{ label: "Book a class", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
