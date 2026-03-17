import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from "react-native";
import { C, F, R } from "../lib/theme";
import { getDashboardStats, getCreditsBalance, listAgents } from "../lib/api";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function StatCard({ label, value, sub, accent = C.primary }: StatCardProps) {
  return (
    <View style={[s.statCard, { borderColor: accent + "30" }]}>
      <View style={[s.statAccent, { backgroundColor: accent + "18" }]} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function AgentRow({ agent }: { agent: any }) {
  const isActive = agent.is_active !== false;
  return (
    <View style={s.agentRow}>
      <View style={[s.agentDot, { backgroundColor: isActive ? C.green : C.textDim }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.agentName}>{agent.assistant_name ?? agent.name ?? "Agent"}</Text>
        <Text style={s.agentRole}>{agent.phone_number ?? "No number"}</Text>
      </View>
      <View style={[s.agentBadge, { backgroundColor: isActive ? C.green + "18" : C.border }]}>
        <Text style={[s.agentBadgeText, { color: isActive ? C.green : C.textDim }]}>
          {isActive ? "Active" : "Idle"}
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const [stats,     setStats]     = useState<any>(null);
  const [agents,    setAgents]    = useState<any[]>([]);
  const [balance,   setBalance]   = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async () => {
    try {
      const [s, a, b] = await Promise.all([
        getDashboardStats().catch(() => null),
        listAgents().catch(() => []),
        getCreditsBalance().catch(() => null),
      ]);
      setStats(s);
      setAgents(Array.isArray(a) ? a : []);
      if (b?.balance !== undefined) setBalance(b.balance);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Command Center</Text>
          <Text style={s.sub}>Live overview</Text>
        </View>
        <View style={[s.balanceBadge, { borderColor: C.primary + "40" }]}>
          <Text style={s.balanceLabel}>Credits</Text>
          <Text style={s.balanceValue}>
            {balance !== null ? `$${balance.toFixed(2)}` : "—"}
          </Text>
        </View>
      </View>

      {/* Stat cards */}
      <Text style={s.section}>Today</Text>
      <View style={s.statGrid}>
        <StatCard
          label="Calls Made"
          value={stats?.outbound_calls_today ?? 0}
          accent={C.primary}
        />
        <StatCard
          label="Inbound"
          value={stats?.inbound_calls_today ?? 0}
          accent={C.cyan}
        />
        <StatCard
          label="New Leads"
          value={stats?.new_contacts_today ?? 0}
          accent={C.green}
        />
        <StatCard
          label="SMS Sent"
          value={stats?.sms_today ?? 0}
          accent={C.amber}
        />
      </View>

      {/* Agents */}
      <View style={s.sectionRow}>
        <Text style={s.section}>AI Agents</Text>
        <Text style={s.sectionCount}>{agents.length} total</Text>
      </View>
      <View style={s.card}>
        {agents.length === 0 ? (
          <Text style={s.empty}>No agents found</Text>
        ) : (
          agents.map((a, i) => (
            <View key={a.id}>
              <AgentRow agent={a} />
              {i < agents.length - 1 && <View style={s.divider} />}
            </View>
          ))
        )}
      </View>

      {/* Platform status */}
      <Text style={s.section}>Platform</Text>
      <View style={s.card}>
        {[
          { label: "Backend",  value: "Online",  color: C.green },
          { label: "Twilio",   value: "Connected", color: C.green },
          { label: "Database", value: "Healthy", color: C.green },
        ].map(({ label, value, color }) => (
          <View key={label} style={s.statusRow}>
            <Text style={s.statusLabel}>{label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <Text style={[s.statusValue, { color }]}>{value}</Text>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 40 },
  center:  { flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    marginTop: 4,
  },
  greeting: { fontSize: F.xl, fontWeight: "800", color: C.text },
  sub:      { fontSize: F.xs, color: C.textDim, marginTop: 2 },

  balanceBadge: {
    borderWidth: 1,
    borderRadius: R.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: C.primaryL,
  },
  balanceLabel: { fontSize: 9,   color: C.textDim, letterSpacing: 0.5, textTransform: "uppercase" },
  balanceValue: { fontSize: F.md, color: C.primary, fontWeight: "700", marginTop: 1 },

  section:      { fontSize: F.xs, color: C.textDim, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  sectionRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionCount: { fontSize: F.xs, color: C.textDim },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 26 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  statAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg },
  statValue:  { fontSize: F.xxl, fontWeight: "800", color: C.text, marginTop: 4 },
  statLabel:  { fontSize: F.xs,  color: C.textDim, marginTop: 3 },
  statSub:    { fontSize: 10,    color: C.textDim, marginTop: 2 },

  card:    { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, marginBottom: 26, overflow: "hidden" },
  divider: { height: 1, backgroundColor: C.border2, marginHorizontal: 14 },
  empty:   { padding: 16, fontSize: F.sm, color: C.textDim, textAlign: "center" },

  agentRow:       { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  agentDot:       { width: 8, height: 8, borderRadius: 4, marginTop: 1 },
  agentName:      { fontSize: F.sm, fontWeight: "600", color: C.text },
  agentRole:      { fontSize: F.xs, color: C.textDim, marginTop: 2 },
  agentBadge:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  agentBadgeText: { fontSize: 10, fontWeight: "700" },

  statusRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: C.border2 },
  statusLabel:{ fontSize: F.sm, color: C.textMid },
  statusValue:{ fontSize: F.sm, fontWeight: "600" },
  dot:        { width: 7, height: 7, borderRadius: 3.5 },
});
