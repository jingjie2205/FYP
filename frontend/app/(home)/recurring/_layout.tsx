import { Stack } from "expo-router";

export default function TabStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Recurring index" />
    </Stack>
  );
}