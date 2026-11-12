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

export default function SignUpPage() {
  // Cast as 'any' to preserve your specific SDK destructured properties
  const { signUp, errors, fetchStatus } = useSignUp() as any; 
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { addUser } = useUsers();

  const [pendingVerification, setPendingVerification] = useState(false);
  const [username, setUsername] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationError, setVerificationError] = useState(false);

  const isFetching = fetchStatus === "fetching";

  const handleSignUp = async () => {
    // 1. Check if passwords match locally
    if (password !== confirmPassword) {
      Alert.alert("Sign Up Failed", "Passwords do not match. Please try again.");
      return;
    }

    try {
      // 2. Attempt to create the account with Clerk
      await signUp.password({
        emailAddress: emailAddress.trim(),
        password,
        username: username.trim(),
      });

      // 3. Request the verification email
      await signUp.verifications.sendEmailCode();

      // 4. ONLY advance the UI if both of the above network requests succeed without errors
      setPendingVerification(true);
      
    } catch (err: any) {
      // 5. FAILSAFE: Force the UI to stay on the Sign-Up form if Clerk rejects the payload
      setPendingVerification(false);
      
      console.error("Sign Up Error:", JSON.stringify(err, null, 2));
      
      // Look for Clerk's detailed 'longMessage' first, then fallback to standard messages
      const errMsg = 
        err.errors?.[0]?.longMessage || 
        err.errors?.[0]?.message || 
        err?.message || 
        "An error occurred during sign up.";
        
      Alert.alert("Sign Up Failed", errMsg);
    }
  };

  const handleVerify = async () => {
    try {
      setVerificationError(false);
      
      await signUp.verifications.verifyEmailCode({
        code,
      });

      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: async ({ session }: any) => {
            const clerkUserId = session?.user?.id;
            const email = emailAddress;

            // Sync with PostgreSQL Database
            if (clerkUserId && email) {
              try {
                await addUser({
                  userId: clerkUserId,
                  email: email,
                });
              } catch (dbErr) {
                console.error("Database sync failed:", dbErr);
              }
            }

            // Show Success Notification and force route to Login Page
            Alert.alert(
              "Account Created Successfully!",
              "Your account has been created!",
              [
                {
                  text: "Confirm",
                },
              ],
              { cancelable: false } // Forces the user to click the button to route properly
            );
          },
        });
      } else {
        setVerificationError(true);
      }
    } catch (err: any) {
      console.error("Verification Error:", err);
      setVerificationError(true);
    }
  };

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
            {verificationError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                <Text style={styles.errorBoxText}>Invalid verification code.</Text>
                <TouchableOpacity onPress={() => setVerificationError(false)} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.inputGroup, verificationError && styles.inputErrorBorder]}>
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
            {errors?.fields?.code && (
              <Text style={styles.errorText}>{errors.fields.code.message}</Text>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, (!code || isFetching) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!code || isFetching}
            >
              {isFetching ? (
                <ActivityIndicator color="#03151E" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => signUp.verifications.sendEmailCode()}
            >
              <Text style={styles.secondaryButtonText}>Resend Email Code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity onPress={() => setPendingVerification(false)}>
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
          <View style={[styles.inputGroup, errors?.fields?.emailAddress && styles.inputErrorBorder]}>
            <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Enter your email"
              placeholderTextColor="#64748B"
              onChangeText={setEmailAddress}
              keyboardType="email-address"
            />
          </View>
          {errors?.fields?.emailAddress && (
            <Text style={styles.errorText}>{errors.fields.emailAddress.message}</Text>
          )}

          <Text style={styles.inputLabel}>Password</Text>
          <View style={[styles.inputGroup, errors?.fields?.password && styles.inputErrorBorder]}>
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
          {errors?.fields?.password && (
            <Text style={styles.errorText}>{errors.fields.password.message}</Text>
          )}

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
              (!username || !emailAddress || !password || !confirmPassword || isFetching) && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={!username || !emailAddress || !password || !confirmPassword || isFetching}
          >
            {isFetching ? (
              <ActivityIndicator color="#03151E" />
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
    backgroundColor: "#03151E",
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
    backgroundColor: "#0C1A25",
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
    backgroundColor: "#0C1A25",
    borderWidth: 1,
    borderColor: "#1E2D3D",
    borderRadius: 12,
    marginBottom: 16,
    height: 54,
    paddingHorizontal: 16,
  },
  inputErrorBorder: {
    borderColor: "#EF4444",
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
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: -10,
    marginBottom: 16,
    marginLeft: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorBoxText: {
    color: "#EF4444",
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
    color: "#03151E",
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