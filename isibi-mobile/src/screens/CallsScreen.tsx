import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator, TouchableOpacity, Alert,
} from "react-native";
import { C, F, R } from "../lib/theme";
import { listCRMCalls, initiateOutboundCall } from "../lib/api";

function formatDuration(secs: number) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(ts: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

const STATUS_COLOR: Record<string, string> = {
  completed:  C.green,
  initiated:  C.amber,
  no_answer:  C.red,
  in_progress: C.cyan,
};

function CallRow({ call }: { call: any }) {
  const isInbound  = call.direction === "inbound";
  const typeColor  = call.call_type === "ai" ? C.primary : C.amber;
  const statusColor = STATUS_COLOR[call.status] ?? C.textDim;

  return (
    <View style={s.row}>
      {/* Direction icon */}
      <View style={[s.dirIcon, { backgroundColor: typeColor + "18" }]}>
        <Text style={{ fontSize: 16 }}>{isInbound ? "📥" : "📤"}</Text>
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={s.rowTop}>
          <Text style={s.callName}>{call.contact_name ?? call.phone_number ?? "Unknown"}</Text>
          <Text style={[s.status, { color: statusColor }]}>{call.status?.replace(/_/g, " ") ?? "—"}</Text>
        </View>
        <View style={s.rowBottom}>
          <Text style={s.meta}>{call.phone_number ?? "—"}</Text>
          <Text style={s.meta}>·</Text>
          <Text style={s.meta}>{formatDuration(call.duration_seconds)}</Text>
          <Text style={s.meta}>·</Text>
          <Text style={s.meta}>{formatTime(call.called_at)}</Text>
        </View>
        <View style={s.tags}>
          <View style={[s.tag, { backgroundColor: typeColor + "18", borderColor: typeColor + "40" }]}>
            <Text style={[s.tagText, { color: typeColor }]}>
              {call.call_type === "ai" ? "AI Call" : "Manual"}
            </Text>
          </View>
          {call.recording_url && (
            <View style={[s.tag, { backgroundColor: C.green + "15", borderColor: C.green + "40" }]}>
              <Text style={[s.tagText, { color: C.green }]}>🎙 Recorded</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function CallsScreen() {
  const [calls,      setCalls]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listCRMCalls();
      setCalls(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleQuickCall = () => {
    Alert.prompt(
      "Quick AI Call",
      "Enter phone number to call:",
      async (number) => {
        if (!number?.trim()) return;
        try {
          await initiateOutboundCall({ to_number: number.trim() });
          Alert.alert("Calling…", `AI call to ${number.trim()} started`);
          setTimeout(load, 2000);
        } catch (e: any) {
          Alert.alert("Error", e.message);
        }
      },
      "plain-text",
      "",
      "phone-pad",
    );
  };

  const aiCalls     = calls.filter(c => c.call_type === "ai").length;
  const manualCalls = calls.filter(c => c.call_type !== "ai").length;
  const recorded    = calls.filter(c => c.recording_url).length;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Call History</Text>
          <Text style={s.sub}>{calls.length} total calls</Text>
        </View>
        <TouchableOpacity style={s.quickBtn} onPress={handleQuickCall} activeOpacity={0.8}>
          <Text style={s.quickBtnText}>+ Quick Call</Text>
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={s.strip}>
        {[
          { label: "AI Calls",  value: aiCalls,     color: C.primary },
          { label: "Manual",    value: manualCalls,  color: C.amber   },
          { label: "Recorded",  value: recorded,     color: C.green   },
        ].map(({ label, value, color }) => (
          <View key={label} style={s.stripItem}>
            <Text style={[s.stripValue, { color }]}>{value}</Text>
            <Text style={s.stripLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border2 }} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.empty}>No calls logged yet</Text></View>}
          renderItem={({ item }) => <CallRow call={item} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  empty:  { fontSize: F.sm, color: C.textDim },

  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 18, paddingBottom: 12 },
  title:      { fontSize: F.xl, fontWeight: "800", color: C.text },
  sub:        { fontSize: F.xs, color: C.textDim, marginTop: 2 },
  quickBtn:   { backgroundColor: C.primary, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 9 },
  quickBtnText:{ fontSize: F.xs, fontWeight: "700", color: "#fff" },

  strip:     { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  stripItem: { flex: 1, alignItems: "center", paddingVertical: 12, borderRightWidth: 1, borderRightColor: C.border2 },
  stripValue:{ fontSize: F.lg, fontWeight: "800" },
  stripLabel:{ fontSize: 10, color: C.textDim, marginTop: 2 },

  row:        { flexDirection: "row", alignItems: "flex-start", paddingVertical: 13 },
  dirIcon:    { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginTop: 2 },
  rowTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBottom:  { flexDirection: "row", gap: 4, marginTop: 2 },
  callName:   { fontSize: F.sm, fontWeight: "600", color: C.text, flex: 1 },
  status:     { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  meta:       { fontSize: F.xs, color: C.textDim },
  tags:       { flexDirection: "row", gap: 6, marginTop: 5 },
  tag:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  tagText:    { fontSize: 10, fontWeight: "600" },
});
