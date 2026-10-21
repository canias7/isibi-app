import { Pressable, Text } from "react-native";

/** THE one main action on a screen (`primary`), or a quieter one beside it. Full width, 52pt tall, dims while pressed. */
export function Button({ label, onPress, variant = "primary", disabled = false }: {
  label: string; onPress?: () => void; variant?: "primary" | "secondary"; disabled?: boolean;
}) {
  const on = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={(on ? "bg-primary" : "border border-line bg-card") + " min-h-[52px] items-center justify-center rounded-app px-5 active:opacity-80" + (disabled ? " opacity-40" : "")}
    >
      <Text className={(on ? "text-on-primary" : "text-ink") + " text-base font-bold"}>{label}</Text>
    </Pressable>
  );
}
