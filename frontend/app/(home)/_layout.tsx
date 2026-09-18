import { Tabs } from "expo-router";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";

export default function HomeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#00D293",
        tabBarInactiveTintColor: "#5A6E85",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "wallet" : "wallet-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="savings"
        options={{
          title: "Savings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "trending-up" : "trending-up-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* Center Highlighted OCR Tab */}
      <Tabs.Screen
        name="scan-ocr"
        options={{
          title: "Scan OCR",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.ocrIconWrapper}>
              {focused && <View style={styles.activePillDot} />}
              <Ionicons
                name={focused ? "camera" : "camera-outline"}
                size={23}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="recurring"
        options={{
          title: "Recurring",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "repeat" : "repeat-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "pie-chart" : "pie-chart-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="ai-chat"
        options={{
          title: "Finley AI",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "robot" : "robot-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#060B11",
    borderTopColor: "#111B27",
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 85 : 68,
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    elevation: 0,
    shadowColor: "transparent",
  },
  tabBarItem: {
    paddingVertical: 2,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  ocrIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: 32,
    height: 26,
  },
  activePillDot: {
    position: "absolute",
    top: -3,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00D293",
  },
});