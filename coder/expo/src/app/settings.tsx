// SETTINGS: who is signed in, the default model and effort, and sign out.
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useApp } from '../lib/AppContext';
import { API_BASE, COLORS } from '../lib/config';
import { EFFORT_NAME } from '../lib/chat';
import type { GitHub, Settings as S } from '../lib/api';
import { Button } from '../components/ui';
import { Logo } from '../components/Logo';

export default function Settings() {
  const { api, auth } = useApp();
  const [st, setSt] = useState<S | null>(null);
  const [gh, setGh] = useState<GitHub | null>(null);
  useEffect(() => {
    api.settings().then((r) => r.status === 200 && setSt(r.data));
    api.github().then((r) => r.status === 200 && setGh(r.data));
  }, [api]);
  const model = st?.models.find((m) => m.id === st.pick.model);
  async function out() { await auth.signOut(); router.replace('/sign-in'); }
  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View style={s.card}>
        <Row k="Signed in as" v={auth.email() || '—'} />
        <Row k="GitHub" v={gh ? (gh.connected ? gh.login || 'Connected' : 'Not connected') : '…'} />
        <Row k="Model" v={model ? model.name : st?.pick.model || '…'} />
        <Row k="Effort" v={st ? EFFORT_NAME[st.pick.effort] || st.pick.effort : '…'} last />
      </View>
      <Text style={s.note}>Change the model and effort from a chat. More settings (rules, connectors, notifications) are on gofarther.dev for now.</Text>
      <Button kind="light" title="Open gofarther.dev" onPress={() => Linking.openURL(API_BASE)} />
      <Button testID="sign-out" title="Sign out" onPress={out} />
      <View style={s.foot}><Logo size={36} /><Text style={s.ver}>Coder for phones · {Constants.expoConfig?.version || ''}</Text></View>
    </ScrollView>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return <View style={[s.row, last && { borderBottomWidth: 0 }]}><Text style={s.k}>{k}</Text><Text style={s.v} numberOfLines={1}>{v}</Text></View>;
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  k: { fontSize: 15, color: COLORS.muted },
  v: { fontSize: 15, color: COLORS.ink, fontWeight: '500', flexShrink: 1 },
  note: { fontSize: 13, color: COLORS.muted, lineHeight: 19 },
  foot: { alignItems: 'center', gap: 6, marginTop: 20 },
  ver: { fontSize: 12, color: COLORS.muted },
});
