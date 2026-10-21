import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export { ErrorBoundary } from "expo-router";

// THE APP'S ROOT. Every app the builder writes has its tabs in `app/(tabs)/`, and
// may add screens that open on top of them (a loaf's details, a booking) beside
// `(tabs)` as ordinary files; this stack is what lets those slide in with a back
// button.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
