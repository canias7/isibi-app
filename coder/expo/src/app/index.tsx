import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useApp } from '../lib/AppContext';
import { COLORS } from '../lib/config';

export default function Index() {
  const { ready, session } = useApp();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}><ActivityIndicator color={COLORS.ink} /></View>;
  return <Redirect href={session ? '/chats' : '/sign-in'} />;
}
