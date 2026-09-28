import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Our Gallery — Harbour Loaf" },
      { property: "og:title", content: "Our Gallery — Harbour Loaf" },
      {
        name: "description",
        content: "See photographs of the bakery and its work.",
      },
      {
        property: "og:description",
        content: "See photographs of the bakery and its work.",
      },
    ],
  }),
  component: OurGallery,
});

const CHROME = {
  name: "Harbour Loaf",
  tagline: "A neighbourhood sourdough bakery in Bristol.",
  links: [
    { label: "Today's bake", href: "/" },
    { label: "The starter", href: "/starter" },
    { label: "Visit", href: "/visit" },
    { label: "Gallery", href: "/gallery" },
  ],
  action: { label: "Order a loaf", href: "/order" },
  contact: {
    address: "Bristol",
    hours: "Wed–Sat 8–2, Sun 9–1",
  },
};

function OurGallery() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Our Gallery</h1>
        <SectionHeader
          className="mt-8"
          eyebrow="Gallery"
          title="Photographs of the bakery's work"
          description="See photographs of the bakery and its work."
        />

        <SafeImage
          className="mt-10"
          src=""
          alt="Harbour Loaf interior in warm morning light, with flour-dusted wooden counters and cooling racks of crusty loaves by the brick oven"
          ratio="16/9"
          fallbackSeed="bakery-interior"
        />

        <Gallery
          className="mt-10"
          items={[
            {
              alt: "A crusty country loaf on the cooling rack",
              caption: "Country loaf",
              fallbackSeed: "loaf-country",
            },
            {
              alt: "Seeded sourdough on a wooden board",
              caption: "Seeded sourdough",
              fallbackSeed: "loaf-seeded",
            },
            {
              alt: "Flour-dusted bannetons after the morning prove",
              caption: "Bannetons",
              fallbackSeed: "bannetons",
            },
            {
              alt: "A dark rye loaf with a split crust",
              caption: "Dark rye",
              fallbackSeed: "loaf-rye",
            },
            {
              alt: "Batards stacked after the bake",
              caption: "Batards",
              fallbackSeed: "batards",
            },
            {
              alt: "The brick oven after the morning fire",
              caption: "The oven",
              fallbackSeed: "oven",
            },
          ]}
        />
      </section>
    </SiteChrome>
  );
}
