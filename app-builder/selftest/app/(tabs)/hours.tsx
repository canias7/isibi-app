import { Group, GroupRow, HoursList, Screen } from "@/components/app";
import { HOURS } from "@/lib/data";

export default function Hours() {
  return (
    <Screen>
      <HoursList hours={HOURS} />
      <Group><GroupRow label="14 Harbour Street, Leeds LS1" last /></Group>
    </Screen>
  );
}
