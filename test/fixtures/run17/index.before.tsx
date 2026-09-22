import { createFileRoute } from "@tanstack/react-router";
import { memo, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, startOfWeek } from "date-fns";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PageHeader } from "@/components/ui/page-header";
import { PriceList, type PriceRow } from "@/components/ui/price-list";
import { WeekStrip } from "@/components/ui/week-strip";
import { AvailabilityCalendar, type Night } from "@/components/ui/availability-calendar";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { BookingSummary } from "@/components/ui/booking-summary";
import { ContactForm } from "@/components/ui/contact-form";
import { SuccessPanel } from "@/components/ui/success-panel";
import { OpeningHours } from "@/components/ui/opening-hours";
import { Button } from "@/components/ui/button";
import { Figure } from "@/components/ui/figure";
import { TestimonialGrid } from "@/components/ui/testimonial";
import { DateEnquiry } from "@/components/ui/date-enquiry";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  useRows,
  useCreateRow,
  usePublicRows,
  useRpc,
  type Row,
  type PublicRow,
} from "@/lib/rows";
import { SITE_QR, SITE_QR_LABEL, SITE_QRS } from "@/site-brand";
import ChordDiagram from "@/routes/-parts/chord-diagram";
import TrialBookingForm from "@/routes/-parts/trial-booking-form";
import DaySpaceLookup from "@/routes/-parts/day-space-lookup";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Lesson = Row & {
  name: string;
  description: string | null;
  price: number;
  duration: string | null;
};

type Booking = Row & {
  name: string;
  email: string;
  phone: string;
  service_id: number;
  appointment_date: string;
  appointment_time: string;
  notes: string | null;
};

type PublicBooking = PublicRow & {
  appointment_date: string;
  appointment_time: string;
};

const trialSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const CHORDS: {
  name: string;
  strings: ("x" | "o" | number)[];
  fingers: (number | null)[];
}[] = [
  {
    name: "E major",
    strings: ["o", 2, 2, 1, "o", "o"],
    fingers: [null, 2, 3, 1, null, null],
  },
  {
    name: "A major",
    strings: ["x", "o", 2, 2, 2, "o"],
    fingers: [null, null, 1, 2, 3, null],
  },
  {
    name: "D major",
    strings: ["x", "x", "o", 2, 3, 2],
    fingers: [null, null, null, 1, 3, 2],
  },
  {
    name: "G major",
    strings: [3, 2, "o", "o", "o", 3],
    fingers: [2, 1, null, null, null, 3],
  },
  {
    name: "C major",
    strings: ["x", 3, 2, "o", 1, "o"],
    fingers: [null, 3, 2, null, 1, null],
  },
  {
    name: "E minor",
    strings: ["o", 2, 2, "o", "o", "o"],
    fingers: [null, 2, 3, null, null, null],
  },
  {
    name: "A minor",
    strings: ["x", "o", 2, 2, 1, "o"],
    fingers: [null, null, 2, 3, 1, null],
  },
  {
    name: "D minor",
    strings: ["x", "x", "o", 2, 3, 1],
    fingers: [null, null, null, 2, 3, 1],
  },
];

const TEACHING_HOURS = [
  { day: 1, label: "Monday", open: "17:00", close: "21:00" },
  { day: 2, label: "Tuesday", open: "17:00", close: "21:00" },
  { day: 3, label: "Wednesday", open: "17:00", close: "21:00" },
  { day: 4, label: "Thursday", open: "17:00", close: "21:00" },
  { day: 5, label: "Friday", open: null, close: null },
  { day: 6, label: "Saturday", open: "10:00", close: "14:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];

const BEGINNER_QUOTES = [
  {
    quote:
      "Couldn’t hold a pick last month — now I play three chords.",
    name: "Sam H.",
    role: "Beginner",
    initials: "SH",
  },
  {
    quote:
      "First lesson and the fretboard stopped looking like a puzzle.",
    name: "Priya N.",
    role: "Beginner",
    initials: "PN",
  },
  {
    quote:
      "Two weeks from zero and I played a song for my mum.",
    name: "Jordan P.",
    role: "Beginner",
    initials: "JP",
  },
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function slotsOn(iso: string): string[] {
  const dow = fromIso(iso).getDay();
  if (dow >= 1 && dow <= 4) return ["17:00", "18:00", "19:00", "20:00"];
  if (dow === 6) return ["10:00", "11:00", "12:00", "13:00"];
  return [];
}

function eachIsoInMonth(month: string): string[] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const count = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= count; d++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

function tokenColor(token: string): THREE.Color {
  try {
    const el = document.createElement("span");
    el.style.color = `var(${token})`;
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    return new THREE.Color(rgb);
  } catch {
    return new THREE.Color();
  }
}

function GuitarMesh({
  rot,
}: {
  rot: { current: { x: number; y: number } };
}) {
  const group = useRef<THREE.Group>(null);
  const colors = useMemo(
    () => ({
      body: tokenColor("--primary"),
      neck: tokenColor("--muted-foreground"),
      board: tokenColor("--foreground"),
      hole: tokenColor("--background"),
      hardware: tokenColor("--muted-foreground"),
      string: tokenColor("--card-foreground"),
    }),
    [],
  );

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.x = rot.current.x;
    group.current.rotation.y = rot.current.y;
  });

  const stringXs = [-0.075, -0.045, -0.015, 0.015, 0.045, 0.075];
  const pegs: [number, number, number][] = [
    [-0.18, 2.12, 0],
    [-0.18, 2.24, 0],
    [-0.18, 2.36, 0],
    [0.18, 2.12, 0],
    [0.18, 2.24, 0],
    [0.18, 2.36, 0],
  ];

  return (
    <group ref={group} scale={0.72} position={[0, -0.25, 0]}>
      <mesh position={[0, -0.5, 0]} scale={[1.05, 0.85, 0.28]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial
          color={colors.body}
          roughness={0.42}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, 0.35, 0]} scale={[0.78, 0.62, 0.25]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial
          color={colors.body}
          roughness={0.42}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, -0.05, 0]} scale={[0.72, 0.48, 0.26]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial
          color={colors.body}
          roughness={0.42}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, 0.28, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 32]} />
        <meshStandardMaterial color={colors.hole} roughness={1} />
      </mesh>
      <mesh position={[0, 0.28, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.016, 8, 32]} />
        <meshStandardMaterial
          color={colors.hardware}
          metalness={0.45}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, -0.72, 0.26]}>
        <boxGeometry args={[0.42, 0.07, 0.05]} />
        <meshStandardMaterial color={colors.board} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[0.2, 1.5, 0.11]} />
        <meshStandardMaterial color={colors.neck} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.35, 0.065]}>
        <boxGeometry args={[0.18, 1.48, 0.03]} />
        <meshStandardMaterial color={colors.board} roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.08, 0.08]}>
        <boxGeometry args={[0.2, 0.03, 0.04]} />
        <meshStandardMaterial
          color={colors.hardware}
          metalness={0.35}
          roughness={0.4}
        />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0, 0.7 + i * 0.11, 0.082]}>
          <boxGeometry args={[0.19, 0.012, 0.02]} />
          <meshStandardMaterial
            color={colors.hardware}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}
      <mesh position={[0, 2.22, 0.02]}>
        <boxGeometry args={[0.3, 0.4, 0.08]} />
        <meshStandardMaterial color={colors.neck} roughness={0.55} />
      </mesh>
      {pegs.map((pos) => (
        <mesh key={pos.join(",")} position={pos} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.09, 8]} />
          <meshStandardMaterial
            color={colors.hardware}
            metalness={0.75}
            roughness={0.25}
          />
        </mesh>
      ))}
      {stringXs.map((x) => (
        <mesh key={x} position={[x, 0.7, 0.16]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.008, 2.85, 0.008]} />
          <meshStandardMaterial
            color={colors.string}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

const GuitarViewer = memo(function GuitarViewer() {
  const rot = useRef({ x: 0.22, y: 0.65 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="relative h-[420px] cursor-grab select-none overflow-hidden rounded-lg bg-muted active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        drag.current = { x: e.clientX, y: e.clientY };
        rot.current.y += dx * 0.012;
        rot.current.x = Math.min(
          1.1,
          Math.max(-1.1, rot.current.x + dy * 0.012),
        );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <Canvas
        camera={{ position: [0, 0.2, 4], fov: 40 }}
        style={{ height: 420 }}
        gl={{ alpha: true, antialias: true }}
        className="h-full w-full touch-none"
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 5]} intensity={1.15} />
        <directionalLight position={[-4, -1, -3]} intensity={0.3} />
        <GuitarMesh rot={rot} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-3 start-3 text-xs text-muted-foreground">
        Drag to turn
      </p>
    </div>
  );
});

function HomePage() {
  const [now] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(now, { weekStartsOn: 1 }),
  );
  const [month, setMonth] = useState(() => format(now, "yyyy-MM"));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [trialStatus, setTrialStatus] = useState<
    "free" | "taken" | "ask" | null
  >(null);
  const [trialSent, setTrialSent] = useState(false);
  const [preferredDay, setPreferredDay] = useState("");

  const { data: lessons = [] } = useRows<Lesson>("lessons", {
    order: "price",
    dir: "asc",
  });
  const { data: takenRows = [] } = usePublicRows<PublicBooking>("bookings", {
    order: "appointment_date",
    dir: "asc",
    limit: 100,
  });
  const { data: bookingCount } = useRpc("bookings_on_day", {
    preferred_day: preferredDay,
  });
  const create = useCreateRow<Booking>("bookings");
  const createTrial = useCreateRow<{
    name: string;
    email: string;
    appointment_date: string;
    notes: string | null;
  }>("bookings");
  const trialForm = useForm<z.infer<typeof trialSchema>>({
    resolver: zodResolver(trialSchema),
    defaultValues: { name: "", email: "" },
  });

  const todayIso = toIso(now);
  const selectedLesson = lessons.find((l) => l.id === serviceId) ?? null;

  const booked = useMemo(() => {
    const set = new Set<string>();
    for (const row of takenRows) {
      if (row.appointment_date && row.appointment_time) {
        set.add(`${row.appointment_date}|${row.appointment_time}`);
      }
    }
    return set;
  }, [takenRows]);

  const nights: Night[] = useMemo(() => {
    return eachIsoInMonth(month).map((date) => {
      const slots = slotsOn(date);
      const full =
        slots.length > 0 &&
        slots.every((slot) => booked.has(`${date}|${slot}`));
      const closed = slots.length === 0;
      const past = date < todayIso;
      return {
        date,
        taken: past || closed || full,
        rate: selectedLesson ? selectedLesson.price : null,
      };
    });
  }, [month, booked, todayIso, selectedLesson]);

  const weekDisabled = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = toIso(addDays(weekStart, i));
      const slots = slotsOn(iso);
      const full =
        slots.length > 0 &&
        slots.every((slot) => booked.has(`${iso}|${slot}`));
      if (iso < todayIso || slots.length === 0 || full) out.push(iso);
    }
    return out;
  }, [weekStart, booked, todayIso]);

  const slots = selectedDate ? slotsOn(selectedDate) : [];
  const takenTimes = selectedDate
    ? slots.filter((slot) => booked.has(`${selectedDate}|${slot}`))
    : [];

  const priceItems: PriceRow[] = lessons.map((lesson) => ({
    name: lesson.name,
    description: lesson.description,
    price: lesson.price,
    meta: lesson.duration,
  }));

  function shiftWeek(days: number) {
    const next = addDays(weekStart, days);
    setWeekStart(next);
    setMonth(format(next, "yyyy-MM"));
  }

  function pickDate(iso: string) {
    setSelectedDate(iso);
    setSelectedTime(null);
    setMonth(iso.slice(0, 7));
    setWeekStart(startOfWeek(fromIso(iso), { weekStartsOn: 1 }));
    setFormError(null);
  }

  function pickLesson(row: PriceRow) {
    const lesson = lessons.find((l) => l.name === row.name);
    setServiceId(lesson ? lesson.id : null);
    setFormError(null);
  }

  function onSubmit(v: {
    name: string;
    email: string;
    phone?: string;
    message: string;
  }) {
    if (!selectedLesson) {
      setFormError("Pick a lesson from the list.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      setFormError("Pick a date and a time.");
      return;
    }
    if (!v.phone) {
      setFormError("A phone number is required.");
      return;
    }
    setFormError(null);
    create.mutate(
      {
        name: v.name,
        email: v.email,
        phone: v.phone,
        service_id: selectedLesson.id,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        notes: v.message || null,
      },
      {
        onSuccess: () => {
          setSent(true);
          setSelectedTime(null);
        },
      },
    );
  }

  function onTrialCheck(v: { date: string; guests: number }) {
    const daySlots = slotsOn(v.date);
    const past = v.date < todayIso;
    const closed = daySlots.length === 0;
    const full =
      daySlots.length > 0 &&
      daySlots.every((slot) => booked.has(`${v.date}|${slot}`));
    setTrialStatus(past || closed || full ? "taken" : "free");
  }

  async function onTrialEnquire(v: { date: string; guests: number }) {
    const ok = await trialForm.trigger();
    if (!ok) return;
    const values = trialForm.getValues();
    createTrial.mutate(
      {
        name: values.name,
        email: values.email,
        appointment_date: v.date,
        notes: "Trial lesson",
      },
      {
        onSuccess: () => {
          setTrialSent(true);
        },
      },
    );
  }

  return (
    <SiteChrome
      name="Crookes Guitar School"
      links={[{ label: "Book", href: "/" }, { label: "Lesson Prices", href: "/prices" }, { label: "Gear Board", href: "/gear" }]}
      action={{ label: "Book a lesson", href: "#book" }}
      layout={{
        brand: "left",
        width: "full",
        sticky: true,
        divider: true,
      }}
    >
      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <PageHeader title="Book a guitar lesson" />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h2 className="text-xl font-semibold text-foreground">
            A guitar you can turn
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Drag with the mouse to spin it round. Same shape you will hold in
            the room.
          </p>
          <div className="mt-6">
            <GuitarViewer />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="max-w-xl">
            <PriceList
              items={priceItems}
              currency="£"
              locale="en-GB"
              action={{ label: "Select", onSelect: pickLesson }}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="motion-press"
              onClick={() => shiftWeek(-7)}
            >
              Previous week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="motion-press"
              onClick={() => shiftWeek(7)}
            >
              Next week
            </Button>
          </div>
          <WeekStrip
            start={weekStart}
            value={selectedDate}
            onSelect={pickDate}
            disabled={weekDisabled}
          />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid gap-8 md:grid-cols-2">
            <AvailabilityCalendar
              nights={nights}
              month={month}
              onMonth={(m) => {
                setMonth(m);
                const [y, mo] = m.split("-").map(Number);
                setWeekStart(
                  startOfWeek(new Date(y, mo - 1, 1), { weekStartsOn: 1 }),
                );
              }}
              currency="GBP"
              locale="en-GB"
              now={now}
              priceNote={selectedLesson?.name}
            />
            <AvailabilityGrid
              slots={slots}
              taken={takenTimes}
              value={selectedTime}
              onSelect={(slot) => {
                setSelectedTime(slot);
                setFormError(null);
              }}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <BookingSummary
            items={[
              {
                label: "Lesson",
                value: selectedLesson?.name ?? "—",
              },
              {
                label: "Date",
                value: selectedDate
                  ? format(fromIso(selectedDate), "EEE d MMMM yyyy")
                  : "—",
              },
              {
                label: "Time",
                value: selectedTime ?? "—",
              },
            ]}
            total={selectedLesson ? selectedLesson.price : undefined}
            currency="£"
          />
        </div>
      </section>

      <section id="book">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              {sent ? (
                <SuccessPanel
                  title="Lesson booked"
                  description="I have the time in the diary. See you in Crookes."
                  action={{
                    label: "Book another lesson",
                    onClick: () => setSent(false),
                  }}
                />
              ) : (
                <ContactForm
                  onSubmit={onSubmit}
                  busy={create.isPending}
                  error={formError || create.error?.message || null}
                  askPhone
                />
              )}
            </div>
            {SITE_QRS.prices ? (
              <Figure caption={SITE_QRS.prices.label}>
                <img
                  src={SITE_QRS.prices.src}
                  alt={SITE_QRS.prices.label}
                  className="h-auto w-[120px] min-h-[120px] min-w-[120px]"
                />
              </Figure>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <OpeningHours days={TEACHING_HOURS} now={now} />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h2 className="text-xl font-semibold text-foreground">
            The first eight chords
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every beginner asks for these. Which finger sits on which fret, and
            which strings you skip. Look here instead of a photograph of my hand.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4 motion-stagger">
            {CHORDS.map((chord) => (
              <li key={chord.name}>
                <ChordDiagram
                  name={chord.name}
                  strings={chord.strings}
                  fingers={chord.fingers}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {SITE_QR ? (
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Figure caption={SITE_QR_LABEL}>
            <img
              src={SITE_QR}
              alt={SITE_QR_LABEL}
              className="h-auto w-[120px] min-h-[120px] min-w-[120px]"
            />
          </Figure>
        </div>
      ) : null}

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <DaySpaceLookup
            preferredDay={preferredDay}
            bookingCount={Number(bookingCount ?? 0)}
            onPreferredDay={setPreferredDay}
          />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <TrialBookingForm />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          {trialSent ? (
            <div className="max-w-xl">
              <SuccessPanel
                title="Trial lesson requested"
                description="I have your name and preferred day, and I will confirm a time."
                action={{
                  label: "Request another trial",
                  onClick: () => {
                    setTrialSent(false);
                    setTrialStatus(null);
                    trialForm.reset();
                  },
                }}
              />
            </div>
          ) : (
            <div className="max-w-xl space-y-6">
              <Form {...trialForm}>
                <form
                  className="space-y-4"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <FormField
                    control={trialForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="name"
                            disabled={createTrial.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={trialForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            {...field}
                            autoComplete="email"
                            disabled={createTrial.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {createTrial.error ? (
                    <p className="text-sm text-destructive">
                      {createTrial.error.message}
                    </p>
                  ) : null}
                </form>
              </Form>
              <DateEnquiry
                status={trialStatus}
                checking={createTrial.isPending}
                minGuests={1}
                maxGuests={1}
                defaultGuests={1}
                now={now}
                heading="Book a trial lesson"
                onCheck={onTrialCheck}
                onEnquire={onTrialEnquire}
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <TestimonialGrid items={BEGINNER_QUOTES} columns={3} />
        </div>
      </section>
    </SiteChrome>
  );
}
