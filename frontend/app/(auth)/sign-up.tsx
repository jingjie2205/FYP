import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useAuth, useSignUp } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useUsers } from "@/hooks/useUsers";
import { getClerkErrorMessage, messageForCode } from "@/utils/clerkErrors";

export default function SignUpPage() {
  // Cast as 'any' to preserve your specific SDK destructured properties
  const { signUp, fetchStatus } = useSignUp() as any;
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { addUser } = useUsers();

  const [pendingVerification, setPendingVerification] = useState(false);
  const [username, setUsername] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isBusy = loading || fetchStatus === "fetching";

  const handleSignUp = async () => {
    if (isBusy) return;

    const email = emailAddress.trim();
    const name = username.trim();

    // Local validation: never send empty values to Clerk
    if (!email || !password || !name) {
      setError(messageForCode("needs_identifier")!);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      // Create the account with Clerk (errors are returned, not thrown)
      const { error: createError } = await signUp.password({
        emailAddress: email,
        password,
        username: name,
      });
      if (createError) {
        console.error("Sign Up Error:", createError);
        setError(getClerkErrorMessage(createError, "Unable to create your account. Please try again."));
        return;
      }

      // Request the verification email
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        console.error("Send code error:", sendError);
        setError(getClerkErrorMessage(sendError, "Unable to send the verification code. Please try again."));
        return;
      }

      // Only advance once both requests succeeded
      setEmailAddress(email);
      setCode("");
      setPendingVerification(true);
    } catch (err: any) {
      console.error("Sign Up Error:", err);
      setError(getClerkErrorMessage(err, "Unable to create your account. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isBusy) return;
    const trimmed = code.trim();
    if (!trimmed) return;

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: trimmed });
      if (verifyError) {
        console.error("Verification Error:", verifyError);
        setError(getClerkErrorMessage(verifyError, messageForCode("form_code_incorrect")!));
        return;
      }

      if (signUp.status === "complete") {
        const { error: finalizeError } = await signUp.finalize({
          navigate: async ({ session }: any) => {
            const clerkUserId = session?.user?.id;

            // Sync with PostgreSQL Database
            if (clerkUserId && emailAddress) {
              try {
                await addUser({
                  userId: clerkUserId,
                  email: emailAddress,
                });
              } catch (dbErr) {
                console.error("Database sync failed:", dbErr);
              }
            }

            Alert.alert(
              "Account Created Successfully!",
              "Your account has been created!",
              [{ text: "Confirm" }],
              { cancelable: false }
            );
          },
        });
        if (finalizeError) setError(getClerkErrorMessage(finalizeError, "Unable to finish creating your account. Please try again."));
      } else {
        setError(messageForCode("form_code_incorrect")!);
      }
    } catch (err: any) {
      console.error("Verification Error:", err);
      setError(getClerkErrorMessage(err, messageForCode("form_code_incorrect")!));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (isBusy) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(getClerkErrorMessage(sendError, "Unable to resend the code. Please try again."));
      } else {
        setNotice("A new code has been sent to your email.");
      }
    } catch (err: any) {
      setError(getClerkErrorMessage(err, "Unable to resend the code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const errorBanner = error ? (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={20} color="#FF6B6B" />
      <Text style={styles.errorBoxText}>{error}</Text>
      <TouchableOpacity onPress={() => setError("")} hitSlop={8}>
        <Ionicons name="close" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  ) : null;

  if (isSignedIn) {
    return null;
  }

  // ==========================================
  // EMAIL VERIFICATION VIEW
  // ==========================================
  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContainer}>
            <View style={styles.iconWrapper}>
              <Ionicons name="mail-unread-outline" size={40} color="#00D293" />
            </View>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              We sent a verification code to {emailAddress}. Enter it below to activate your account.
            </Text>
          </View>

          <View style={styles.formContainer}>
            {errorBanner}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

            <View style={[styles.inputGroup, !!error && styles.inputErrorBorder]}>
              <Ionicons name="keypad-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={code}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#64748B"
                onChangeText={setCode}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, (!code.trim() || isBusy) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!code.trim() || isBusy}
            >
              {isBusy ? (
                <ActivityIndicator color="#070D14" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, isBusy && styles.buttonDisabled]}
              onPress={handleResend}
              disabled={isBusy}
            >
              <Text style={styles.secondaryButtonText}>Resend Code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity onPress={() => { setPendingVerification(false); setError(""); setNotice(""); }}>
              <Text style={styles.linkText}>Cancel & Go Back</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // MAIN SIGN UP VIEW
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name="person-add-outline" size={36} color="#00D293" />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us to manage your budget and track your wealth.</Text>
        </View>

        <View style={styles.formContainer}>
          {errorBanner}
          <Text style={styles.inputLabel}>Username</Text>
          <View style={styles.inputGroup}>
            <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={username}
              placeholder="Enter a username"
              placeholderTextColor="#64748B"
              onChangeText={setUsername}
            />
          </View>

          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={[styles.inputGroup]}>
            <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={emailAddress}
              autoCorrect={false}
              placeholder="Enter your email"
              placeholderTextColor="#64748B"
              onChangeText={setEmailAddress}
              keyboardType="email-address"
            />
          </View>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={[styles.inputGroup]}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              placeholder="Create a password"
              placeholderTextColor="#64748B"
              secureTextEntry={true}
              onChangeText={setPassword}
            />
          </View>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.inputGroup}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="#64748B"
              secureTextEntry={true}
              onChangeText={setConfirmPassword}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!username.trim() || !emailAddress.trim() || !password || !confirmPassword || isBusy) && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={!username.trim() || !emailAddress.trim() || !password || !confirmPassword || isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#070D14" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View nativeID="clerk-captcha" />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D14",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#0C1521",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1E2D3D",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  formContainer: {
    width: "100%",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0C1521",
    borderWidth: 1,
    borderColor: "#1E2D3D",
    borderRadius: 12,
    marginBottom: 16,
    height: 54,
    paddingHorizontal: 16,
  },
  inputErrorBorder: {
    borderColor: "#FF6B6B",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    height: "100%",
  },
  noticeText: {
    color: "#00D293",
    fontSize: 13,
    marginBottom: 16,
    marginLeft: 4,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 16,
    marginLeft: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBoxText: {
    flex: 1,
    marginRight: 8,
    color: "#FF6B6B",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: "#00D293",
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#00D293",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#070D14",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#1E2D3D",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    color: "#64748B",
    fontSize: 14,
  },
  linkText: {
    color: "#00D293",
    fontSize: 14,
    fontWeight: "700",
  },
});