import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from "react-native";
import { C, F, R } from "../lib/theme";
import { logout, API_BASE } from "../lib/api";

interface RowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}

function SettingsRow({ icon, label, value, onPress, destructive }: RowProps) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={s.rowLeft}>
        <Text style={s.rowIcon}>{icon}</Text>
        <Text style={[s.rowLabel, destructive && { color: C.red }]}>{label}</Text>
      </View>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {onPress ? <Text style={s.rowChevron}>›</Text> : null}
    </TouchableOpacity>
  );
}

interface Props {
  onLogout: () => void;
}

export default function SettingsScreen({ onLogout }: Props) {
  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          onLogout();
        },
      },
    ]);
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>Settings</Text>

      {/* App info */}
      <Text style={s.section}>App</Text>
      <View style={s.card}>
        <SettingsRow icon="🌐" label="Backend URL"     value="isibi-backend.onrender.com" />
        <View style={s.sep} />
        <SettingsRow icon="📱" label="App Version"     value="1.0.0" />
        <View style={s.sep} />
        <SettingsRow icon="🔐" label="Auth"            value="JWT Secure Store" />
      </View>

      {/* Platform links */}
      <Text style={s.section}>Platform</Text>
      <View style={s.card}>
        <SettingsRow icon="💻" label="Web Dashboard"   value="app.isibi.ai" />
        <View style={s.sep} />
        <SettingsRow icon="📊" label="CRM"             value="Remote Control" />
        <View style={s.sep} />
        <SettingsRow icon="🤖" label="AI Agents"       value="Managed via app" />
      </View>

      {/* Account */}
      <Text style={s.section}>Account</Text>
      <View style={s.card}>
        <SettingsRow
          icon="🚪"
          label="Sign Out"
          onPress={handleLogout}
          destructive
        />
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>ISIBI Remote Command</Text>
        <Text style={s.footerSub}>Connected to {API_BASE}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 60 },

  title:   { fontSize: F.xl, fontWeight: "800", color: C.text, marginBottom: 24, marginTop: 4 },
  section: { fontSize: F.xs, color: C.textDim, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 },

  card:    { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, marginBottom: 24, overflow: "hidden" },
  sep:     { height: 1, backgroundColor: C.border2, marginLeft: 44 },

  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  rowLeft:  { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon:  { fontSize: 18, width: 24, textAlign: "center" },
  rowLabel: { fontSize: F.sm, color: C.text, fontWeight: "500" },
  rowValue: { fontSize: F.xs, color: C.textDim, marginRight: 4 },
  rowChevron:{ fontSize: 20, color: C.textDim, lineHeight: 24 },

  footer:    { alignItems: "center", paddingTop: 20 },
  footerText:{ fontSize: F.xs, color: C.textDim, fontWeight: "600", letterSpacing: 1 },
  footerSub: { fontSize: 10, color: C.textDim + "80", marginTop: 3 },
});
