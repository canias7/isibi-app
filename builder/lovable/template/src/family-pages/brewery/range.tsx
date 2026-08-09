// brewery /range — every drink, with notes and strength. The core range is
// permanent; the specials are the reason to come back.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TapList } from "@/components/ui/tap-list";
export const Route = createFileRoute("/range")({ component: P });
function P() {
  return (
    <SiteChrome name="Six Weirs" tagline="A brewery and taproom under the arches at Kelham."
      links={[{ label: "Home", href: "/" }, { label: "Taproom", href: "/visit" }]}
      action={{ label: "What's pouring", href: "/" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="The range" title="Everything we make"
          description="Four permanent, and whatever the tanks are doing. Strength is on all of them because it changes how you get home." />
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-semibold tracking-tight">The four that never move</h2>
              <TapList className="mt-4" pours={[
                { name: "Weir Pale", style: "Pale ale · Citra and Amarillo", abv: 4.2, price: "£4.60", note: "Sessionable without being boring. Cask when we can, keg when we can't." },
                { name: "Arch 14", style: "Best bitter · Maris Otter, Fuggles", abv: 4.5, price: "£4.40", note: "The one that pays the rent. Held at £4.40 since 2023 and staying there." },
                { name: "Kelham Dark", style: "Porter · chocolate and brown malt", abv: 5.1, price: "£5.20", note: "Brewed all year because a porter in July is a good idea nobody agrees with." },
                { name: "Don Lager", style: "Helles · six weeks lagered", abv: 4.6, price: "£5.00", note: "Takes a tank out of action for a month and a half. Worth it." },
              ]} />
            </section>
            <section>
              <h2 className="text-xl font-semibold tracking-tight">On rotation</h2>
              <TapList className="mt-4" pours={[
                { name: "Cutlers IPA", style: "West coast IPA", abv: 6.4, price: "£6.10", note: "Back every eight weeks or so." },
                { name: "Rivelin Saison", style: "Saison · farmhouse yeast", abv: 5.8, price: "£5.40", off: true, note: "Off until the autumn — it wants a warm fermentation." },
                { name: "Loxley Sour", style: "Kettle sour, raspberry", abv: 3.9, price: "£5.60", off: true, note: "Summer only. Gone by September." },
                { name: "Winter Weir", style: "Old ale · aged four months", abv: 7.8, price: "£6.80", off: true, note: "November to January. Halves only, sensibly." },
              ]} />
            </section>
          </div>
          <aside className="space-y-6">
            <SafeImage src={null} alt="The four permanent pumpclips" ratio="3/4" />
            <div className="rounded-lg border border-border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Where else to find it</p>
              <p className="mt-2">
                Twelve pubs across Sheffield take our cask, and the bottle shops on Abbeydale Road and
                Division Street carry the cans. Everything else is drunk here.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Allergens</p>
              <p className="mt-2">
                Everything contains barley and most contain wheat. The saison and the sour are not fined
                with isinglass; the cask bitter is. Ask and we will check the batch.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
