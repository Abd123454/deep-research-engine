// Home tab — chat interface
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quaesitor</Text>
      <Text style={styles.subtitle}>What shall we investigate?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f1ea", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontFamily: "serif", color: "#2a2620", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#6b6358" },
});
