import { Link, Stack } from "expo-router";
import { Body, Screen, Title } from "@/components/app";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <Title>This screen doesn't exist.</Title>
        <Link href="/"><Body>Go to the home screen</Body></Link>
      </Screen>
    </>
  );
}
