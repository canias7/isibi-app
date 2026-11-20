// RECENTS: your chats, newest first, and a new chat.
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useApp } from '../lib/AppContext';
import { COLORS } from '../lib/config';
import { ago } from '../lib/chat';
import type { ProjectEntry } from '../lib/api';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';

export default function Chats() {
  const { api } = useApp();
  const [list, setList] = useState<ProjectEntry[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.projects();
    setLoading(false);
    if (r.status === 403) { setError('Coder is not open to this account yet.'); setList([]); return; }
    if (r.status !== 200) { setError(r.data.error || 'Coder could not be reached.'); setList((x) => x || []); return; }
    setError('');
    setList((r.data.projects || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0)));
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.wrap}>
      <Stack.Screen options={{
        headerLeft: () => <View style={{ marginRight: 8 }}><Logo size={28} /></View>,
        headerRight: () => <Pressable testID="open-settings" accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={10}><Text style={{ fontSize: 22, color: COLORS.ink }}>⚙︎</Text></Pressable>,
      }} />
      <View style={s.top}><Button testID="new-chat" title="+  New chat" onPress={() => router.push('/new')} /></View>
      {error ? <Text style={s.err}>{error}</Text> : undefined}
      <Text style={s.section}>Recents</Text>
      <FlatList
        data={list || []}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={list && !error ? <Text style={s.empty}>No chats yet. Start one with a repository.</Text> : undefined}
        renderItem={({ item }) => (
          <Pressable testID={'chat-' + item.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })} style={({ pressed }) => [s.row, pressed && { backgroundColor: COLORS.bubble }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{item.title || item.repo}</Text>
              <Text style={s.repo} numberOfLines={1}>{item.repo}</Text>
            </View>
            {item.status === 'running' ? <Text style={s.badge}>Working</Text> : item.waiting ? <Text style={[s.badge, s.needs]}>Needs you</Text> : undefined}
            <Text style={s.when}>{item.at ? ago(item.at) : ''}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  top: { padding: 16, paddingBottom: 8 },
  section: { fontSize: 13, color: COLORS.muted, fontWeight: '600', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  title: { fontSize: 16, color: COLORS.ink, fontWeight: '500' },
  repo: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  when: { fontSize: 13, color: COLORS.muted, minWidth: 28, textAlign: 'right' },
  badge: { fontSize: 12, color: COLORS.ink, backgroundColor: COLORS.bubble, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  needs: { backgroundColor: '#fdecea', color: COLORS.error },
  err: { color: COLORS.error, paddingHorizontal: 20, paddingVertical: 6 },
  empty: { color: COLORS.muted, padding: 20, textAlign: 'center' },
});
