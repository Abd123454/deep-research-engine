// Settings tab — API keys, theme, language
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.item}>API Keys</Text>
      <Text style={styles.item}>Theme</Text>
      <Text style={styles.item}>Language</Text>
      <Text style={styles.item}>Memory</Text>
      <Text style={styles.item}>About</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f1ea", padding: 16 },
  title: { fontSize: 24, fontFamily: "serif", color: "#2a2620", marginBottom: 16 },
  item: { fontSize: 16, color: "#2a2620", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#d9d4c7" },
});
