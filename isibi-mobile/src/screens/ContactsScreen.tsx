import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from "react-native";
import { C, F, R } from "../lib/theme";
import { listContacts, initiateOutboundCall } from "../lib/api";

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const STATUS_COLOR: Record<string, string> = {
  new_lead:    C.blue,
  interested:  C.green,
  callback:    C.amber,
  not_interested: C.textDim,
  closed_won:  C.green,
  closed_lost: C.red,
};

function ContactRow({ contact, onCall }: { contact: any; onCall: (c: any) => void }) {
  const name   = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";
  const color  = STATUS_COLOR[contact.status] ?? C.textDim;
  const avatar = (contact.first_name?.[0] ?? "?").toUpperCase();

  return (
    <View style={s.row}>
      {/* Avatar */}
      <View style={[s.avatar, { backgroundColor: color + "20", borderColor: color + "40" }]}>
        <Text style={[s.avatarText, { color }]}>{avatar}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.phone}>{contact.phone_number ?? "No phone"}</Text>
        <View style={[s.badge, { backgroundColor: color + "18" }]}>
          <Text style={[s.badgeText, { color }]}>
            {(contact.status ?? "new_lead").replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      {/* Call button */}
      {contact.phone_number && (
        <TouchableOpacity
          style={s.callBtn}
          onPress={() => onCall(contact)}
          activeOpacity={0.7}
        >
          <Text style={s.callIcon}>📞</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ContactsScreen() {
  const [contacts,   setContacts]   = useState<any[]>([]);
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      const data = await listContacts({ limit: 100, search: q });
      setContacts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (text: string) => {
    setSearch(text);
    load(text || undefined);
  };

  const handleCall = (contact: any) => {
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    Alert.alert(
      "AI Call",
      `Start an AI call to ${name} at ${contact.phone_number}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: async () => {
            try {
              await initiateOutboundCall({
                to_number: contact.phone_number,
                contact_name: name,
              });
              Alert.alert("Calling…", `Connecting AI to ${name}`);
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ],
    );
  };

  const filtered = search
    ? contacts.filter(c => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.phone_number ?? ""}`.toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : contacts;

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Text style={s.title}>Contacts</Text>
        <Text style={s.count}>{contacts.length}</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Search contacts…"
          placeholderTextColor={C.textDim}
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(search || undefined); }} tintColor={C.primary} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.empty}>No contacts found</Text></View>}
          renderItem={({ item }) => <ContactRow contact={item} onCall={handleCall} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  empty:  { fontSize: F.sm, color: C.textDim },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, paddingBottom: 10 },
  title:  { fontSize: F.xl, fontWeight: "800", color: C.text },
  count:  { fontSize: F.sm, color: C.textDim, fontWeight: "600" },

  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  search: {
    backgroundColor: C.card,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: F.sm,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  sep: { height: 1, backgroundColor: C.border2 },

  avatar:     { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: F.md, fontWeight: "700" },

  name:      { fontSize: F.sm, fontWeight: "600", color: C.text },
  phone:     { fontSize: F.xs, color: C.textDim, marginTop: 1 },
  badge:     { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },

  callBtn:  { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary + "18", alignItems: "center", justifyContent: "center" },
  callIcon: { fontSize: 17 },
});
