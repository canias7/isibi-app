import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SectionHeader } from "@/components/ui/section-header";
import { PriceList } from "@/components/ui/price-list";
import { TeamGrid } from "@/components/ui/team-grid";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { LocationCard } from "@/components/ui/location-card";
import { CtaBand } from "@/components/ui/cta-band";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Testimonial } from "@/components/ui/testimonial";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The studio", href: "#/work" },
  ],
  action: { label: "Book now", href: "#/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:30" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:30" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:30" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "13:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "12:30" },
];

const CLASSES = [
  { name: "Morning Flow", description: "A gentle wake-up vinyasa, all levels", price: 14, meta: "60 min" },
  { name: "Vinyasa", description: "Breath-led, building through the week", price: 16, meta: "60 min" },
  { name: "Restorative", description: "Long holds, blankets and bolsters", price: 14, meta: "75 min" },
