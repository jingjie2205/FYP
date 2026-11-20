import { Tabs } from "expo-router";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Platform } from "react-native";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/expo";
import { MonthProvider } from "@/hooks/useMonth";
import { useUsers } from "@/hooks/useUsers";

export default function HomeLayout() {
  const { user, isLoaded, isSignedIn } = useUser();
  const userId = isLoaded && isSignedIn ? user?.id : undefined;
  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;

  // Make sure the signed-in Clerk user exists in the `users` table before anything
  // that references it (accounts, categories, rollover) is written.
  const { ensureUser } = useUsers();
  const [syncedUserId, setSyncedUserId] = useState<string | undefined>();

  useEffect(() => {
    if (!userId || !email || syncedUserId === userId) return;
    let cancelled = false;
    ensureUser({ userId, email }).then((ok) => {
      if (!cancelled && ok) setSyncedUserId(userId);
    });
    return () => { cancelled = true; };
  }, [userId, email, syncedUserId, ensureUser]);

  return (
    <MonthProvider userId={syncedUserId}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
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
          title: "Budget",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "trending-up" : "trending-up-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* Scan page stays routable but is hidden from the tab bar (scanning lives on Home) */}
      <Tabs.Screen name="scan-ocr" options={{ href: null }} />

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
          title: "Chat",
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
    </MonthProvider>
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
});