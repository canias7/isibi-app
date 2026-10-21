import { router } from "expo-router";
import { ScrollView } from "react-native";
import { Body, Button, Card, Heading, OpenNow, Screen, Title } from "@/components/app";
import { HOURS, LOAVES } from "@/lib/data";

export default function Today() {
  return (
    <Screen>
      <OpenNow hours={HOURS} />
      <Title>Good morning.</Title>
      <Body soft>Fresh out of the oven at 7:00. Order now and we'll hold your loaf at the counter.</Body>
      <Button label="Order for collection" onPress={() => router.push("/order")} />
      <Heading>Today's bake</Heading>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {LOAVES.slice(0, 3).map((l) => <Card key={l.id} title={l.name} subtitle={"£" + l.price.toFixed(2)} />)}
      </ScrollView>
    </Screen>
  );
}
