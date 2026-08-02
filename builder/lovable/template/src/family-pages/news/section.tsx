// news /section — everything filed under one heading. A section front is a
// second-order edit: still ranked, just narrower.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SectionHeader } from "@/components/ui/section-header";
import { StoryLead } from "@/components/ui/story-lead";
import { TagList } from "@/components/ui/tag-list";
export const Route = createFileRoute("/section")({ component: P });
const STORIES = [
  ["Budget consultation opens with a £41m gap to close", "The four options on the table, and what each one closes.", "Ada Mensah", "6 hours ago"],
  ["We asked every councillor about the tram. Nine answered.", "The full responses, unedited, and the eighty-one who did not reply.", "Sam Okonkwo", "3 days ago"],
  ["Committee papers are being published later and later", "Twelve months of agendas, timed. The statutory minimum is five clear days.", "Tom Brackley", "1 week ago"],
  ["Where the pothole money actually went", "£2.1m, ward by ward, from a freedom of information request.", "Ruth Oyelaran", "1 week ago"],
  ["The licensing sub-committee has met four times this year", "It is supposed to meet monthly. We asked why.", "Ada Mensah", "2 weeks ago"],
];
function P() {
  return (
    <SiteChrome name="The Sheffield Wire" tagline="Local reporting, four journalists, no owner in London."
      links={[{ label: "Home", href: "#/" }, { label: "Housing", href: "#/section" }, { label: "Sport", href: "#/section" }]}
      action={{ label: "Subscribe — £6/month", href: "#/" }}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="Section" title="Council"
          description="Everything we have filed about the town hall. Updated most weekdays." />
        <div className="mt-6">
          <TagList items={["Council", "Housing", "Transport", "Schools", "Sport", "Culture"]} active="Council" onSelect={() => {}} />
        </div>
        <div className="mt-10 border-t border-border pt-10">
          <StoryLead
            kicker="Council · the big one" href="#/story"
            headline="Budget consultation opens with a £41m gap to close"
            standfirst="Four options, none of them painless, and six weeks to say something about them."
            byline="Ada Mensah" when="6 hours ago"
            imageAlt="The town hall at dusk" />
        </div>
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {STORIES.slice(1).map(([head, stand, by, when]) => (
            <li key={head} className="py-6">
              <a href="#/story" className="group block">
                <h2 className="text-xl font-semibold tracking-tight text-balance group-hover:underline">{head}</h2>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">{stand}</p>
              </a>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{by}</span> · {when}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </SiteChrome>
  );
}
