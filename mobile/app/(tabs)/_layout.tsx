import { Tabs } from "expo-router";
import { MessageSquare, Search, Settings } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#f4f1ea" },
        headerTitleStyle: { fontFamily: "serif", color: "#2a2620" },
        tabBarStyle: { backgroundColor: "#f4f1ea" },
        tabBarActiveTintColor: "#8b4513",
        tabBarInactiveTintColor: "#6b6358",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Chat", tabBarIcon: ({ color }) => <MessageSquare color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="research"
        options={{ title: "Research", tabBarIcon: ({ color }) => <Search color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color }) => <Settings color={color} size={24} /> }}
      />
    </Tabs>
  );
}
