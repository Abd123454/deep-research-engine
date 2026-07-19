// Research tab — research jobs list + status
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ResearchScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Research</Text>
      <Text style={styles.empty}>No research jobs yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f1ea", padding: 16 },
  title: { fontSize: 24, fontFamily: "serif", color: "#2a2620", marginBottom: 16 },
  empty: { color: "#6b6358", fontSize: 14 },
});
