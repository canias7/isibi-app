import { Pressable, Switch, Text, View } from "react-native";
import { theme } from "./theme";

/** − n + for a quantity. Never below `min`. */
export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const btn = "h-9 w-9 items-center justify-center rounded-full bg-card";
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-paper p-1">
      <Pressable accessibilityLabel="Less" onPress={() => onChange(Math.max(min, value - 1))} className={btn}><Text className="text-xl font-bold text-primary">−</Text></Pressable>
      <Text className="min-w-[22px] text-center font-bold text-ink">{value}</Text>
      <Pressable accessibilityLabel="More" onPress={() => onChange(Math.min(max, value + 1))} className={btn}><Text className="text-xl font-bold text-primary">+</Text></Pressable>
    </View>
  );
}

/** A yes/no setting, with its label. */
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="min-h-[50px] flex-row items-center justify-between">
      <Text className="text-base text-ink">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.primary, false: theme.line }} />
    </View>
  );
}
