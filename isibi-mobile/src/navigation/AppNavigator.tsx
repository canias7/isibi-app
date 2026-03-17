import React from "react";
import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { C, F } from "../lib/theme";
import DashboardScreen from "../screens/DashboardScreen";
import AgentsScreen    from "../screens/AgentsScreen";
import ContactsScreen  from "../screens/ContactsScreen";
import CallsScreen     from "../screens/CallsScreen";
import SettingsScreen  from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

const TABS = [
  { name: "Dashboard", icon: "⚡", Screen: DashboardScreen },
  { name: "Agents",    icon: "🤖", Screen: AgentsScreen    },
  { name: "Contacts",  icon: "👥", Screen: ContactsScreen  },
  { name: "Calls",     icon: "📞", Screen: CallsScreen     },
  { name: "Settings",  icon: "⚙️", Screen: null            },
] as const;

interface Props {
  onLogout: () => void;
}

export default function AppNavigator({ onLogout }: Props) {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle:      { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, elevation: 0, shadowOpacity: 0 },
          headerTitleStyle: { color: C.text, fontWeight: "700", fontSize: F.md },
          tabBarStyle: {
            backgroundColor: C.card,
            borderTopColor:  C.border,
            borderTopWidth:  1,
            paddingBottom:   4,
            height:          60,
          },
          tabBarActiveTintColor:   C.primary,
          tabBarInactiveTintColor: C.textDim,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: -2 },
          tabBarIcon: ({ focused }) => {
            const tab = TABS.find(t => t.name === route.name);
            return (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
                {tab?.icon ?? "•"}
              </Text>
            );
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Agents"    component={AgentsScreen}    />
        <Tab.Screen name="Contacts"  component={ContactsScreen}  />
        <Tab.Screen name="Calls"     component={CallsScreen}     />
        <Tab.Screen name="Settings">
          {() => <SettingsScreen onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
