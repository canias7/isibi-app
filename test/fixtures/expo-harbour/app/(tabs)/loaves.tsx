import { useState } from "react";
import { Chips, ListRow, Screen } from "@/components/app";
import { LOAVES } from "@/lib/data";

export default function Loaves() {
  const [f, setF] = useState("All");
  return (
    <Screen>
      <Chips options={["All", "Daily", "Fri–Sun", "Weekend"]} value={f} onChange={setF} />
      {LOAVES.filter((l) => f === "All" || l.tag === f).map((l) => (
        <ListRow key={l.id} title={l.name} subtitle={l.note} right={"£" + l.price.toFixed(2)} image={null} onPress={() => {}} />
      ))}
    </Screen>
  );
}
