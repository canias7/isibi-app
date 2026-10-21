import { useState } from "react";
import { Text, View } from "react-native";
import { Body, BottomSheet, Button, Group, GroupRow, Heading, Screen, Stepper } from "@/components/app";
import { LOAVES } from "@/lib/data";

export default function Order() {
  const [q, setQ] = useState<Record<string, number>>({ white: 1 });
  const [open, setOpen] = useState(false);
  const n = Object.values(q).reduce((a, b) => a + b, 0);
  const total = LOAVES.reduce((t, l) => t + (q[l.id] || 0) * l.price, 0);
  const chosen = LOAVES.filter((l) => q[l.id]);
  return (
    <Screen bar={<Button label={`Review order · ${n} ${n === 1 ? "loaf" : "loaves"} · £${total.toFixed(2)}`} disabled={!n} onPress={() => setOpen(true)} />}>
      <Body soft>Pick your loaves. We'll have them wrapped and waiting.</Body>
      {LOAVES.map((l) => (
        <View key={l.id} className="min-h-[68px] flex-row items-center rounded-app bg-card p-3.5">
          <View className="flex-1"><Text className="text-base font-semibold text-ink">{l.name}</Text><Text className="font-bold text-primary">£{l.price.toFixed(2)}</Text></View>
          <Stepper value={q[l.id] || 0} onChange={(v) => setQ({ ...q, [l.id]: v })} />
        </View>
      ))}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <Heading>Collect from the counter</Heading>
        <Body soft>Today, from 7:30. We hold orders until close.</Body>
        <Group>
          {chosen.map((l) => <GroupRow key={l.id} label={`${q[l.id]} × ${l.name}`} value={"£" + (q[l.id] * l.price).toFixed(2)} />)}
          <GroupRow label="Total" value={"£" + total.toFixed(2)} strong last />
        </Group>
        <Button label="Place order" onPress={() => setOpen(false)} />
      </BottomSheet>
    </Screen>
  );
}
