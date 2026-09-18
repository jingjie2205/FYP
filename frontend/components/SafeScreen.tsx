import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SafeScreen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D14",
  },
});