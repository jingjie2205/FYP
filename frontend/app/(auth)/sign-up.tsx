import { styles } from "@/assets/styles/auth.styles";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { COLORS } from "@/constants/colors";
import { useAuth, useSignUp } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useUsers } from "@/hooks/useUsers";

export default function Page() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { addUser } = useUsers();

  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState(false);

  const handleSignUp = async () => {
    console.log("Attempting sign up...");

    try {
      await signUp.password({
        emailAddress,
        password,
        username,
      });
      console.log("STATUS:", signUp.status);
      console.log("missingFields:", signUp.missingFields);
      console.log("unverifiedFields:", signUp.unverifiedFields);
      console.log(pendingVerification);

      setPendingVerification(true);
      console.log("User created, sending email...");

      // Trigger the verification email
      await signUp.verifications.sendEmailCode();

      // The UI will automatically switch to the verification screen!
    } catch (err: any) {
      // 3. Catch and display any errors so the app doesn't freeze!
      console.error("Sign Up Error:", JSON.stringify(err, null, 2));
      alert(
        "Sign Up Failed: " + (err.errors?.[0]?.message || "An error occurred"),
      );
    }
  };

  const handleVerify = async () => {
    const completeSignUp = await signUp.verifications.verifyEmailCode({
      code,
    });
    console.log("STATUS:", signUp.status);
    console.log("missingFields:", signUp.missingFields);
    console.log("unverifiedFields:", signUp.unverifiedFields);
    console.log(pendingVerification);
    console.log(code);

    if (signUp.status === "complete") {
      await signUp.finalize({
        // Redirect the user to the home page after signing up
        navigate: async ({ session, decorateUrl }) => {
          // if (session?.currentTask) {
          //   // Handle pending session tasks
          //   // See https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks
          //   console.log(session?.currentTask);
          //   return;
          // }
          const clerkUserId = session?.user?.id;
          const email = emailAddress;

          console.log(clerkUserId, email);

          if (clerkUserId && email) {
            await addUser({
              userId: clerkUserId,
              email: email,
            });
          } 

          setPendingVerification(false);
          router.replace("/");
        },
      });
    }
    setError(true);
  };

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    pendingVerification
  ) {
    return (
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
      >
        <ThemedView style={styles.verificationContainer}>
          <ThemedText type="title" style={styles.verificationTitle}>
            Verify your account
          </ThemedText>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={COLORS.expense}
              />
              <ThemedText style={styles.errorText}>{"Wrong Code!"}</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  console.log(error);
                  setError(false);
                }}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={24}
                  color={COLORS.expense}
                />
              </TouchableOpacity>
            </View>
          ) : null}

          <TextInput
            style={[styles.verificationInput, error && styles.errorInput]}
            value={code}
            placeholder="Enter your verification code"
            placeholderTextColor="#9A8478"
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
          <Pressable onPress={() => setPendingVerification(false)}>
            <ThemedText style={styles.cancel}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => signUp.verifications.sendEmailCode()}
          >
            <ThemedText style={styles.secondaryButtonText}>
              I need a new code
            </ThemedText>
          </Pressable>
        </ThemedView>
      </KeyboardAwareScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Sign up
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
        {errors.fields.emailAddress && (
          <ThemedText style={styles.error}>
            {errors.fields.emailAddress.message}
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
          onPress={handleSignUp}
          disabled={!emailAddress || !password || fetchStatus === "fetching"}
        >
          <ThemedText style={styles.buttonText}>Sign up</ThemedText>
        </Pressable>

        <View style={styles.linkContainer}>
          <ThemedText style={styles.linkText}>
            Already have an account?
          </ThemedText>
          <Link href="/sign-in">
            <ThemedText type="link">Sign in</ThemedText>
          </Link>
        </View>

        {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
        <View nativeID="clerk-captcha" />
      </ThemedView>
    </KeyboardAwareScrollView>
  );
}
