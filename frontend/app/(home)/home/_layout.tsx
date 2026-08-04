import { Stack } from "expo-router";

export default function IndexStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen 
        name="create" 
        options={{ 
          presentation: "modal", // Smoothly opens your create screen as an overlay modal
        }} 
      />
    </Stack>
  );
}