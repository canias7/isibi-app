import { Group, GroupRow } from "./list";
import { Badge } from "./media";

/** One day's opening: `day` 0 is Sunday; `open` and `close` are "HH:MM". A day with no entry is closed. */
export type Opening = { day: number; open: string; close: string };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const mins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

/** Whether it is open now, from the phone's own clock, and the next change. */
export function openState(hours: Opening[], now = new Date()) {
  const t = now.getHours() * 60 + now.getMinutes();
  const today = hours.find((h) => h.day === now.getDay());
  if (today && t >= mins(today.open) && t < mins(today.close)) return { open: true, words: "Open now · until " + today.close };
  if (today && t < mins(today.open)) return { open: false, words: "Closed · opens " + today.open + " today" };
  for (let i = 1; i <= 7; i++) {
    const d = (now.getDay() + i) % 7, h = hours.find((x) => x.day === d);
    if (h) return { open: false, words: "Closed · opens " + DAYS[d] + " " + h.open };
  }
  return { open: false, words: "Closed" };
}

/** The open-now badge. */
export function OpenNow({ hours }: { hours: Opening[] }) {
  const s = openState(hours);
  return <Badge label={s.words} tone={s.open ? "good" : "plain"} />;
}

/** The week, Monday first, today lit. */
export function HoursList({ hours }: { hours: Opening[] }) {
  const order = [1, 2, 3, 4, 5, 6, 0], now = new Date().getDay();
  return (
    <Group>
      {order.map((d, i) => {
        const h = hours.find((x) => x.day === d);
        return <GroupRow key={d} label={DAYS[d] + (d === now ? " · today" : "")} value={h ? h.open + " – " + h.close : "Closed"} strong={d === now} last={i === order.length - 1} />;
      })}
    </Group>
  );
}
