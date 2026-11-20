// ONE CHAT: messages, Coder's answers, its steps, the cards that wait for you, and the message box with
// the mode, model and effort pickers and Stop.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../lib/AppContext';
import { COLORS } from '../../lib/config';
import { buildItems, chatMode, EFFORT_NAME, MODES } from '../../lib/chat';
import { useChat } from '../../lib/useChat';
import type { Model, Pick } from '../../lib/api';
import { ChatItem } from '../../components/ChatItems';
import { Chip, PickerSheet } from '../../components/ui';
import { Logo } from '../../components/Logo';

const DEFAULT_MODELS: Model[] = [{ id: 'grok-4.7', name: 'Grok 4.7', efforts: ['low', 'medium', 'high', 'xhigh'], effort: 'low' }];

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useApp();
  const insets = useSafeAreaInsets();
  const chat = useChat(api, String(id));
  const [text, setText] = useState('');
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [pick, setPick] = useState<Pick>({ model: DEFAULT_MODELS[0].id, effort: 'low' });
  const [autoOff, setAutoOff] = useState(false);
  const [sheet, setSheet] = useState<'' | 'mode' | 'model' | 'effort'>('');
  const list = useRef<FlatList>(null);

  useEffect(() => {
    api.settings().then((r) => {
      if (r.status !== 200 || !r.data) return;
      if (Array.isArray(r.data.models) && r.data.models.length) setModels(r.data.models);
      if (r.data.pick) setPick(r.data.pick);
      setAutoOff(!!(r.data.prefs && r.data.prefs.autoOff === true));
    });
  }, [api]);

  const items = useMemo(() => buildItems(chat.events, chat.running, chat.project), [chat.events, chat.running, chat.project]);
  const mode = chatMode(chat.project, chat.events, chat.running, autoOff);
  const model = models.find((m) => m.id === pick.model) || models[0];
  const modes = MODES.filter((m) => !(autoOff && m.id === 'auto'));

  function choose(kind: 'model' | 'effort', v: string) {
    const next = kind === 'model' ? { ...pick, model: v, effort: (models.find((m) => m.id === v)?.efforts || []).includes(pick.effort) ? pick.effort : models.find((m) => m.id === v)?.effort || 'low' } : { ...pick, effort: v };
    setPick(next); setSheet('');
    api.savePick(next);
  }
  async function send() {
    const t = text;
    setText('');
    const ok = await chat.send(t, pick);
    if (!ok) setText(t);
  }

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen options={{ title: chat.project ? chat.project.title || chat.project.repo : '' }} />
      {!chat.project && !chat.error ? <View style={s.center}><ActivityIndicator color={COLORS.ink} /></View> : (
        <FlatList
          ref={list}
          testID="chat-list"
          data={items}
          keyExtractor={(x) => x.key}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={chat.project ? <Text style={s.repo}>{chat.project.repo}</Text> : undefined}
          ListEmptyComponent={chat.project ? <View style={s.empty}><Logo size={84} /><Text style={s.emptyText}>What should Coder do in {chat.project.repo}?</Text></View> : undefined}
          renderItem={({ item }) => (
            <ChatItem item={item} h={{
              sent: chat.sent, autoOff,
              onPermission: (pid, c) => chat.answer(pid, c),
              onQuestion: (pid, c, answers) => chat.answer(pid, c, { answers }),
            }} />
          )}
          ListFooterComponent={<>
            {chat.queue.length ? <Text style={s.queued}>{chat.queue.length} message{chat.queue.length > 1 ? 's' : ''} waiting for Coder</Text> : undefined}
            {chat.running ? <View style={s.working} testID="working"><ActivityIndicator size="small" color={COLORS.muted} /><Text style={s.workingText}>Coder is working…</Text></View> : undefined}
            {chat.error ? <Text style={s.err}>{chat.error}</Text> : undefined}
          </>}
        />
      )}
      <View style={[s.compose, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput testID="message" style={s.input} placeholder={chat.running ? 'Add to the queue…' : 'Ask Coder…'} placeholderTextColor={COLORS.muted} multiline value={text} onChangeText={setText} />
        <View style={s.bar}>
          <Chip testID="mode" label={(MODES.find((m) => m.id === mode) || MODES[0]).name} onPress={() => setSheet('mode')} />
          <Chip testID="model" label={model.name} onPress={() => setSheet('model')} />
          <Chip testID="effort" label={EFFORT_NAME[pick.effort] || pick.effort} onPress={() => setSheet('effort')} />
          <View style={{ flex: 1 }} />
          {chat.running ? (
            <Pressable testID="stop" accessibilityRole="button" accessibilityLabel="Stop" onPress={chat.stop} style={[s.send, s.stop]}><View style={s.stopSq} /></Pressable>
          ) : undefined}
          <Pressable testID="send" accessibilityRole="button" accessibilityLabel="Send" disabled={!text.trim() || chat.sending} onPress={send} style={[s.send, (!text.trim() || chat.sending) && { opacity: 0.35 }]}>
            <Text style={s.sendText}>↑</Text>
          </Pressable>
        </View>
      </View>
      <PickerSheet visible={sheet === 'mode'} title="Mode" current={mode} choices={modes.map((m) => ({ id: m.id, title: m.name, info: m.info }))} onClose={() => setSheet('')} onPick={(m) => { setSheet(''); chat.setMode(m); }} />
      <PickerSheet visible={sheet === 'model'} title="Model" current={pick.model} choices={models.map((m) => ({ id: m.id, title: m.name }))} onClose={() => setSheet('')} onPick={(m) => choose('model', m)} />
      <PickerSheet visible={sheet === 'effort'} title="Effort" current={pick.effort} choices={(model.efforts || []).map((e) => ({ id: e, title: EFFORT_NAME[e] || e }))} onClose={() => setSheet('')} onPick={(e) => choose('effort', e)} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  repo: { color: COLORS.muted, fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  empty: { alignItems: 'center', gap: 14, marginTop: 80 },
  emptyText: { fontSize: 17, color: COLORS.ink, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20 },
  working: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  workingText: { color: COLORS.muted, fontSize: 14 },
  queued: { color: COLORS.muted, fontSize: 13, fontStyle: 'italic', paddingVertical: 4, textAlign: 'right' },
  err: { color: COLORS.error, fontSize: 14, paddingVertical: 6 },
  compose: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 8 },
  input: { minHeight: 40, maxHeight: 140, fontSize: 16, color: COLORS.ink, paddingVertical: 8, paddingHorizontal: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  stop: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.ink },
  stopSq: { width: 12, height: 12, borderRadius: 2, backgroundColor: COLORS.ink },
});
