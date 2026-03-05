import { styles } from "@/assets/styles/auth.styles";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, TextInput, View } from "react-native";

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const handleSubmit = async () => {
    await signIn.password({
      emailAddress,
      password,
    });

    if (signIn.status === "needs_second_factor") {
      // See https://clerk.com/docs/guides/development/custom-flows/authentication/multi-factor-authentication
    }

    // For other second factor strategies,
    // see https://clerk.com/docs/guides/development/custom-flows/authentication/client-trust
    if (signIn.status === "needs_client_trust") {
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        // (factor): factor is EmailCodeFactor => factor.strategy === 'email_code',
        (factor) => factor.strategy === "email_code",
      );

      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
      }
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            // Handle pending session tasks
            // See https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks
            console.log(session?.currentTask);
            return;
          }

          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            window.location.href = url;
          } else {
            router.push(url as Href);
          }
        },
      });
    }
  };

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            // Handle pending session tasks
            // See https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks
            console.log(session?.currentTask);
            return;
          }

          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            window.location.href = url;
          } else {
            router.push(url as Href);
          }
        },
      });
    }
  };

  if (signIn.status === "needs_client_trust") {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Verify your account
        </ThemedText>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="Enter your verification code"
          placeholderTextColor="#666666"
          onChangeText={(code) => setCode(code)}
          keyboardType="numeric"
        />
        {errors.fields.code && (
          <ThemedText style={styles.error}>
            {errors.fields.code.message}
          </ThemedText>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            fetchStatus === "fetching" && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching"}
        >
          <ThemedText style={styles.buttonText}>Verify</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => signIn.mfa.sendEmailCode()}
        >
          <ThemedText style={styles.secondaryButtonText}>
            I need a new code
          </ThemedText>
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
        onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
        keyboardType="email-address"
      />
      {errors.fields.identifier && (
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
        onChangeText={(password) => setPassword(password)}
      />
      {errors.fields.password && (
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
        <ThemedText style={styles.buttonText}>Continue</ThemedText>
      </Pressable>
      <View style={styles.linkContainer}>
        <ThemedText style={styles.linkText}>Don't have an account?</ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link">Sign up</ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}
