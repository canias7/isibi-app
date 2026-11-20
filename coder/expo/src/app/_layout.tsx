import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../lib/AppContext';
import { COLORS } from '../lib/config';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: COLORS.bg }, headerTintColor: COLORS.ink, headerShadowVisible: false, contentStyle: { backgroundColor: COLORS.bg }, headerTitleStyle: { fontWeight: '600' } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="chats" options={{ title: 'Coder' }} />
          <Stack.Screen name="new" options={{ title: 'New chat', presentation: 'modal' }} />
          <Stack.Screen name="chat/[id]" options={{ title: '' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
