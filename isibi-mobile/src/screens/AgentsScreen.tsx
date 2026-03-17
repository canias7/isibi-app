import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Switch,
} from "react-native";
import { C, F, R } from "../lib/theme";
import { listAgents, updateAgent, initiateOutboundCall } from "../lib/api";

function AgentCard({
  agent,
  onToggle,
  onCall,
}: {
  agent: any;
  onToggle: (id: number, active: boolean) => void;
  onCall: (agent: any) => void;
}) {
  const isActive = agent.is_active !== false;
  const color    = isActive ? C.primary : C.textDim;

  return (
    <View style={s.card}>
      {/* Top row */}
      <View style={s.cardTop}>
        <View style={[s.iconBox, { backgroundColor: color + "18", borderColor: color + "40" }]}>
          <View style={[s.iconDot, { backgroundColor: color }]} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.agentName}>{agent.assistant_name ?? agent.name ?? "Agent"}</Text>
          <Text style={s.agentPhone}>{agent.phone_number ?? "No phone number"}</Text>
        </View>
        <Switch
          value={isActive}
          onValueChange={(val) => onToggle(agent.id, val)}
          trackColor={{ false: C.border, true: C.primary + "80" }}
          thumbColor={isActive ? C.primary : C.textDim}
        />
      </View>

      {/* Info row */}
      <View style={s.infoRow}>
        <View style={s.infoItem}>
          <Text style={s.infoLabel}>LLM</Text>
          <Text style={s.infoValue}>{agent.llm_provider ?? "openai"}</Text>
        </View>
        <View style={s.infoItem}>
          <Text style={s.infoLabel}>Voice</Text>
          <Text style={s.infoValue}>{agent.voice_provider ?? "openai"}</Text>
        </View>
        <View style={s.infoItem}>
          <Text style={s.infoLabel}>Status</Text>
          <Text style={[s.infoValue, { color: isActive ? C.green : C.textDim }]}>
            {isActive ? "Active" : "Idle"}
          </Text>
        </View>
      </View>

      {/* Actions */}
      {agent.phone_number && (
        <TouchableOpacity
          style={s.callBtn}
          onPress={() => onCall(agent)}
          activeOpacity={0.8}
        >
          <Text style={s.callBtnText}>⚡ Test Call via This Agent</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function AgentsScreen() {
  const [agents,     setAgents]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await listAgents();
      setAgents(Array.isArray(a) ? a : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onToggle = async (id: number, active: boolean) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, is_active: active } : a));
    try {
      await updateAgent(id, { is_active: active });
    } catch {
      setAgents(prev => prev.map(a => a.id === id ? { ...a, is_active: !active } : a));
      Alert.alert("Error", "Failed to update agent");
    }
  };

  const onCall = (agent: any) => {
    Alert.prompt(
      "Test Call",
      `Use agent "${agent.assistant_name}" to call a number:`,
      async (number) => {
        if (!number?.trim()) return;
        try {
          await initiateOutboundCall({ to_number: number.trim(), from_number: agent.phone_number });
          Alert.alert("Call initiated", `Calling ${number}…`);
        } catch (e: any) {
          Alert.alert("Failed", e.message);
        }
      },
      "plain-text",
      "",
      "phone-pad",
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={s.root}
      contentContainerStyle={s.content}
      data={agents}
      keyExtractor={a => String(a.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
      ListHeaderComponent={
        <View style={s.header}>
          <Text style={s.title}>AI Agents</Text>
          <Text style={s.sub}>{agents.length} configured</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={s.center2}>
          <Text style={s.empty}>No agents yet. Create one in the web app.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <AgentCard agent={item} onToggle={onToggle} onCall={onCall} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    />
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 40 },
  center:  { flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" },
  center2: { paddingTop: 60, alignItems: "center" },
  empty:   { fontSize: F.sm, color: C.textDim, textAlign: "center" },

  header: { marginBottom: 20, marginTop: 4 },
  title:  { fontSize: F.xl, fontWeight: "800", color: C.text },
  sub:    { fontSize: F.xs, color: C.textDim, marginTop: 2 },

  card: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "center" },

  iconBox: {
    width: 42, height: 42,
    borderRadius: R.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDot: { width: 16, height: 16, borderRadius: 8 },

  agentName:  { fontSize: F.md, fontWeight: "700", color: C.text },
  agentPhone: { fontSize: F.xs, color: C.textDim, marginTop: 2 },

  infoRow:  { flexDirection: "row", gap: 0, borderTopWidth: 1, borderTopColor: C.border2, paddingTop: 12 },
  infoItem: { flex: 1, alignItems: "center" },
  infoLabel:{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue:{ fontSize: F.sm, fontWeight: "600", color: C.textMid, marginTop: 3 },

  callBtn:     { backgroundColor: C.primary + "18", borderRadius: R.md, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: C.primary + "40" },
  callBtnText: { fontSize: F.sm, fontWeight: "700", color: C.primary },
});
