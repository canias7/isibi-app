// A NEW CHAT: pick one of your GitHub repositories (Connect GitHub first if needed).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../lib/AppContext';
import { COLORS } from '../lib/config';
import type { Repo } from '../lib/api';
import { Button } from '../components/ui';

export default function NewChat() {
  const { api } = useApp();
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [install, setInstall] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    setError('');
    const g = await api.github();
    if (g.status !== 200) { setError(g.data.error || 'Coder could not be reached.'); setConnected(false); return; }
    setConnected(!!g.data.connected);
    if (!g.data.connected) return;
    const r = await api.repos();
    if (r.status !== 200) { setError(r.data.error || 'Your repositories could not be loaded.'); setRepos([]); return; }
    setRepos(r.data.repos || []);
    setInstall(r.data.install || '');
  }
  useEffect(() => { load(); }, []);

  async function connect() {
    const r = await api.githubStart();
    if (r.status === 200 && r.data.url) Linking.openURL(r.data.url);
    else setError(r.data.error || 'GitHub could not be started.');
  }
  async function start(repo: string) {
    if (busy) return;
    setBusy(repo); setError('');
    const r = await api.newProject(repo);
    setBusy('');
    if (r.status !== 200 || !r.data.project) { setError(r.data.error || 'The chat could not be made.'); return; }
    router.dismiss();
    router.push({ pathname: '/chat/[id]', params: { id: r.data.project.id } });
  }

  if (connected === null) return <View style={s.center}><ActivityIndicator color={COLORS.ink} /></View>;
  if (!connected) return (
    <View style={[s.wrap, { padding: 20, gap: 12 }]}>
      <Text style={s.lead}>Connect GitHub so Coder can work in your repositories.</Text>
      {error ? <Text style={s.err}>{error}</Text> : undefined}
      <Button title="Connect GitHub" onPress={connect} />
      <Button kind="light" title="I've connected it" onPress={load} />
    </View>
  );
  const shown = (repos || []).filter((r) => r.repo.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View style={s.wrap}>
      <TextInput testID="repo-search" style={s.search} placeholder="Search repositories" autoCapitalize="none" value={q} onChangeText={setQ} />
      {error ? <Text style={[s.err, { paddingHorizontal: 20 }]}>{error}</Text> : undefined}
      <FlatList
        data={shown}
        keyExtractor={(r) => r.repo}
        ListEmptyComponent={repos ? <Text style={s.empty}>No repositories{q ? ' match' : ' yet'}.</Text> : <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.ink} />}
        renderItem={({ item }) => (
          <Pressable testID={'repo-' + item.repo} disabled={!!busy} onPress={() => start(item.repo)} style={({ pressed }) => [s.row, pressed && { backgroundColor: COLORS.bubble }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.repo}>{item.repo}</Text>
              <Text style={s.info}>{item.private ? 'Private' : 'Public'}{item.branch ? ' · ' + item.branch : ''}</Text>
            </View>
            {busy === item.repo ? <ActivityIndicator color={COLORS.ink} /> : <Text style={s.info}>›</Text>}
          </Pressable>
        )}
        ListFooterComponent={install ? <Button kind="plain" title="Add more repositories on GitHub" onPress={() => Linking.openURL(install)} /> : undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  lead: { fontSize: 16, color: COLORS.ink, lineHeight: 22 },
  search: { margin: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  repo: { fontSize: 16, color: COLORS.ink, fontWeight: '500' },
  info: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  err: { color: COLORS.error },
  empty: { color: COLORS.muted, padding: 20, textAlign: 'center' },
});
