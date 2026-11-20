import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../lib/config';

export function Button({ title, onPress, kind = 'dark', disabled, busy, testID }: { title: string; onPress: () => void; kind?: 'dark' | 'light' | 'plain'; disabled?: boolean; busy?: boolean; testID?: string }) {
  const off = disabled || busy;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: !!off }} disabled={off} onPress={onPress}
      style={({ pressed }) => [s.btn, kind === 'light' && s.light, kind === 'plain' && s.plain, (pressed || off) && { opacity: off ? 0.5 : 0.8 }]}>
      {busy ? <ActivityIndicator color={kind === 'dark' ? '#fff' : COLORS.ink} /> : <Text style={[s.btnText, kind !== 'dark' && { color: COLORS.ink }]}>{title}</Text>}
    </Pressable>
  );
}

export interface Choice { id: string; title: string; info?: string }
/** A bottom sheet with a list to pick one from (mode, model, effort, repository). */
export function PickerSheet({ visible, title, choices, current, onPick, onClose }: { visible: boolean; title: string; choices: Choice[]; current?: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>{title}</Text>
        {choices.map((c) => (
          <Pressable key={c.id} accessibilityRole="menuitem" accessibilityState={{ selected: c.id === current }} onPress={() => onPick(c.id)} style={({ pressed }) => [s.row, pressed && { backgroundColor: COLORS.bubble }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{c.title}</Text>
              {c.info ? <Text style={s.rowInfo}>{c.info}</Text> : null}
            </View>
            <Text style={s.check}>{c.id === current ? '✓' : ''}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

export function Chip({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.chip, pressed && { backgroundColor: COLORS.bubble }]}>
      <Text style={s.chipText} numberOfLines={1}>{label} ▾</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { backgroundColor: COLORS.ink, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  light: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line },
  plain: { backgroundColor: 'transparent' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  scrim: { flex: 1, backgroundColor: 'rgba(13,27,42,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 14, paddingBottom: 34, paddingHorizontal: 8 },
  sheetTitle: { fontSize: 13, color: COLORS.muted, fontWeight: '600', paddingHorizontal: 12, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  rowTitle: { fontSize: 16, color: COLORS.ink, fontWeight: '500' },
  rowInfo: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  check: { width: 24, fontSize: 16, color: COLORS.ink, textAlign: 'right' },
  chip: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: '#fff', maxWidth: 160 },
  chipText: { fontSize: 13, color: COLORS.ink, fontWeight: '500' },
});
