import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../../constants/colors";

export default function AiChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Chat Page</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
  text: { fontSize: 18, fontWeight: "600", color: COLORS.text },
});