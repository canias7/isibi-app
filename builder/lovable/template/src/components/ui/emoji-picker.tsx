import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * Pick an emoji.
 *
 * A CURATED ~180 rather than the full 3,800, and that is the whole design
 * decision. The complete set is a ~1.5 MB dataset plus a virtualised grid,
 * downloaded by every visitor to use six faces; this covers what people
 * actually reach for and costs nothing.
 *
 * Every emoji carries a NAME, which does double duty: it is what the search
 * matches on, and it is the accessible label — a grid of bare glyphs is
 * unreadable to a screen reader, which announces most of them as nothing at
 * all.
 */
const EMOJI: { group: string; items: [string, string][] }[] = [
  { group: "Faces", items: [["😀","grin"],["😃","smile"],["😄","happy"],["😁","beam"],["😅","sweat smile"],["😂","laughing"],["🙂","slight smile"],["😉","wink"],["😊","blush"],["😍","heart eyes"],["😘","kiss"],["😎","cool"],["🤩","star struck"],["🤔","thinking"],["😐","neutral"],["🙄","eye roll"],["😴","sleeping"],["😢","crying"],["😭","sobbing"],["😤","huffing"],["😡","angry"],["🥳","party"],["🤗","hug"],["🤝","handshake"],["😬","grimace"],["🤯","mind blown"],["🥹","holding back tears"],["😇","innocent"]] },
  { group: "Gestures", items: [["👍","thumbs up"],["👎","thumbs down"],["👏","clap"],["🙌","raised hands"],["🙏","please thanks"],["👌","ok"],["✌️","peace"],["🤞","fingers crossed"],["👋","wave"],["💪","strong"],["🫶","heart hands"],["👀","eyes"],["🖐️","hand"],["☝️","point up"],["👉","point right"]] },
  { group: "Hearts", items: [["❤️","red heart"],["🧡","orange heart"],["💛","yellow heart"],["💚","green heart"],["💙","blue heart"],["💜","purple heart"],["🖤","black heart"],["🤍","white heart"],["💔","broken heart"],["💯","hundred"],["✨","sparkles"],["🔥","fire"],["⭐","star"],["🌟","glowing star"],["💫","dizzy"]] },
  { group: "Work", items: [["✅","tick done"],["❌","cross no"],["⚠️","warning"],["📌","pin"],["📎","paperclip"],["📅","calendar"],["⏰","alarm clock"],["📈","chart up"],["📉","chart down"],["💰","money"],["💳","card"],["🧾","receipt"],["📝","memo note"],["📣","announce"],["🔔","bell"],["🔒","lock"],["🔑","key"],["⚙️","settings"],["🛠️","tools"],["🚀","rocket launch"],["🎯","target"],["🏆","trophy"],["📦","package box"],["✉️","email"],["📞","phone"],["🖨️","printer"],["💡","idea"],["🧠","brain"]] },
  { group: "Food", items: [["☕","coffee"],["🍵","tea"],["🍺","beer"],["🍷","wine"],["🥂","cheers"],["🍰","cake"],["🍕","pizza"],["🍔","burger"],["🥗","salad"],["🍞","bread"],["🧁","cupcake"],["🍫","chocolate"],["🍎","apple"],["🥐","croissant"],["🍟","chips fries"]] },
  { group: "Things", items: [["🎉","party popper"],["🎁","gift"],["🏠","house home"],["🏢","office"],["🚗","car"],["✈️","plane"],["🌍","world"],["☀️","sun"],["🌧️","rain"],["❄️","snow"],["🌱","plant"],["🐶","dog"],["🐱","cat"],["💇","haircut"],["💈","barber"],["✂️","scissors"],["🪒","razor"],["🧴","bottle"],["🕐","clock"],["📍","location pin"]] },
];
export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const groups = EMOJI
    .map((g) => ({ ...g, items: query ? g.items.filter(([, name]) => name.includes(query)) : g.items }))
    .filter((g) => g.items.length);
  return (
    <div data-slot="emoji-picker" className={cn("w-72 space-y-2 rounded-md border border-border bg-popover p-2 shadow-md", className)}>
      <Input value={q} placeholder="Search" aria-label="Search emoji" className="h-8"
        onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {groups.length === 0 && <p className="px-1 py-4 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</p>}
        {groups.map((g) => (
          <div key={g.group}>
            <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{g.group}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {g.items.map(([e, name]) => (
                <button key={e} type="button" onMouseDown={(ev) => { ev.preventDefault(); onPick(e); }}
                  aria-label={name} title={name}
                  className="cursor-pointer rounded p-1 text-lg leading-none hover:bg-muted">{e}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
