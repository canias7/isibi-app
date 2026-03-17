import "expo-dev-client";
import React, { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { getToken, registerPushToken } from "./src/lib/api";
import { registerForPushNotifications, addNotificationListener, addResponseListener } from "./src/lib/notifications";
import { C } from "./src/lib/theme";
import LoginScreen  from "./src/screens/LoginScreen";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  const [authState, setAuthState] = useState<"loading" | "authed" | "unauthed">("loading");
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    getToken().then(t => setAuthState(t ? "authed" : "unauthed"));
  }, []);

  // Register push token once authenticated
  useEffect(() => {
    if (authState !== "authed") return;

    registerForPushNotifications().then(token => {
      if (token) {
        registerPushToken(token, Platform.OS).catch(() => null);
      }
    });

    notifListener.current = addNotificationListener(notification => {
      // Handle foreground notifications (already shown via setNotificationHandler)
      console.log("Notification received:", notification);
    });

    responseListener.current = addResponseListener(response => {
      // User tapped on notification
      const data = response.notification.request.content.data;
      console.log("Notification tapped:", data);
      // TODO: navigate to relevant screen based on data.type
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [authState]);

  if (authState === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {authState === "unauthed"
        ? <LoginScreen onLogin={() => setAuthState("authed")} />
        : <AppNavigator onLogout={() => setAuthState("unauthed")} />
      }
    </SafeAreaProvider>
  );
}
