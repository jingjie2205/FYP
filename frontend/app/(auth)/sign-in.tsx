import { styles } from "@/assets/styles/auth.styles";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useClerk, useSignIn } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { setActive } = useClerk();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingMfa, setPendingMfa] = useState(false);

  const handleSubmit = async () => {
    try {
      await signIn.password({
        emailAddress: emailAddress.trim(),
        password,
      });

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: async ({ session }) => {
            if (session?.id) {
              await setActive({ session: session.id });
            }
            router.replace("/(home)/home");
          },
        });
      } else if (
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_client_trust"
      ) {
        // Send verification code to email if required by client trust
        try {
          await signIn.mfa.sendEmailCode();
        } catch {
          // Ignores error if code was automatically dispatched
        }
        setPendingMfa(true);
      } else {
        Alert.alert("Sign In", `Status: ${signIn.status}`);
      }
    } catch (err: any) {
      console.error("Sign-in error:", err);
      const message =
        errors?.fields?.identifier?.message ||
        errors?.fields?.password?.message ||
        err?.message ||
        "Invalid credentials or network failure.";
      Alert.alert("Sign In Failed", message);
    }
  };

  const handleVerify = async () => {
    try {
      await signIn.mfa.verifyEmailCode({ code });

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: async ({ session }) => {
            if (session?.id) {
              await setActive({ session: session.id });
            }
            router.replace("/(home)/home");
          },
        });
      }
    } catch (err: any) {
      console.error("MFA error:", err);
      Alert.alert(
        "Verification Failed",
        errors?.fields?.code?.message || "Invalid code."
      );
    }
  };

  const handleCancelVerification = () => {
    setPendingMfa(false);
    setCode("");
  };

  if (pendingMfa || signIn.status === "needs_client_trust") {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Verify your account
        </ThemedText>
        <ThemedText style={styles.label}>
          A new device or session was detected. Enter the one-time code sent to your email.
        </ThemedText>

        <TextInput
          style={styles.input}
          value={code}
          placeholder="Enter 6-digit code"
          placeholderTextColor="#666666"
          onChangeText={setCode}
          keyboardType="numeric"
        />
        {errors?.fields?.code && (
          <ThemedText style={styles.error}>
            {errors.fields.code.message}
          </ThemedText>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (!code || fetchStatus === "fetching") && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleVerify}
          disabled={!code || fetchStatus === "fetching"}
        >
          <ThemedText style={styles.buttonText}>
            {fetchStatus === "fetching" ? "Verifying..." : "Verify Code"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => signIn.mfa.sendEmailCode()}
        >
          <ThemedText style={styles.secondaryButtonText}>
            Resend Email Code
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            { marginTop: 16, alignItems: "center", padding: 8 },
            pressed && { opacity: 0.6 },
          ]}
          onPress={handleCancelVerification}
        >
          <ThemedText type="link">Back to Sign In</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Sign in
      </ThemedText>

      <ThemedText style={styles.label}>Email address</ThemedText>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Enter email"
        placeholderTextColor="#D3D3D3"
        onChangeText={setEmailAddress}
        keyboardType="email-address"
      />
      {errors?.fields?.identifier && (
        <ThemedText style={styles.error}>
          {errors.fields.identifier.message}
        </ThemedText>
      )}

      <ThemedText style={styles.label}>Password</ThemedText>
      <TextInput
        style={styles.input}
        value={password}
        placeholder="Enter password"
        placeholderTextColor="#D3D3D3"
        secureTextEntry={true}
        onChangeText={setPassword}
      />
      {errors?.fields?.password && (
        <ThemedText style={styles.error}>
          {errors.fields.password.message}
        </ThemedText>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (!emailAddress || !password || fetchStatus === "fetching") &&
            styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleSubmit}
        disabled={!emailAddress || !password || fetchStatus === "fetching"}
      >
        <ThemedText style={styles.buttonText}>
          {fetchStatus === "fetching" ? "Signing in..." : "Continue"}
        </ThemedText>
      </Pressable>

      <View style={styles.linkContainer}>
        <ThemedText style={styles.linkText}>Don't have an account?</ThemedText>
        <Link href="/(auth)/sign-up">
          <ThemedText type="link">Sign up</ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}