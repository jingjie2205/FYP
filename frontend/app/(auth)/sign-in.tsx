import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useClerk, useSignIn, useOAuth } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useUsers } from "@/hooks/useUsers";

// Required to handle the OAuth browser redirect safely
WebBrowser.maybeCompleteAuthSession();

const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export default function SignInPage() {
  useWarmUpBrowser(); 

  const { signIn, errors, fetchStatus } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const { setActive } = useClerk();
  const router = useRouter();
  const { addUser } = useUsers();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingMfa, setPendingMfa] = useState(false);

  const isFetching = fetchStatus === "fetching";

  // ==========================================
  // GOOGLE SSO HANDLER
  // ==========================================
  const handleGoogleSSO = async () => {
    try {
      // Pass the explicit redirect URL here
      const { createdSessionId, setActive, signUp } = await startOAuthFlow({
        redirectUrl: Linking.createURL("/(auth)/sign-in"),
      });

      if (createdSessionId) {
        if (signUp?.status === "complete") {
          const clerkUserId = signUp.createdUserId;
          const email = signUp.emailAddress;
          
          if (clerkUserId && email) {
            try {
              await addUser({ userId: clerkUserId, email: email });
            } catch (dbErr) {
              console.error("Database sync failed on Google SSO:", dbErr);
            }
          }
        }

        await setActive!({ session: createdSessionId });
        router.replace("/(home)/home");
      }
    } catch (err: any) {
      console.error("Google SSO Error:", err);
      Alert.alert("Google Login Failed", err?.message || "An error occurred during single sign-on.");
    }
  };

  // ==========================================
  // STANDARD EMAIL HANDLER
  // ==========================================
  const handleSubmit = async () => {
    try {
      await signIn!.password({
        emailAddress: emailAddress.trim(),
        password,
      });

      if (signIn!.status === "complete") {
        await signIn!.finalize({
          navigate: async ({ session }) => {
            if (session?.id) await setActive({ session: session.id });
            router.replace("/(home)/home");
          },
        });
      } else if (
        signIn!.status === "needs_second_factor" ||
        signIn!.status === "needs_client_trust"
      ) {
        try {
          await signIn!.mfa.sendEmailCode();
        } catch {}
        setPendingMfa(true);
      } else {
        Alert.alert("Sign In", `Status: ${signIn!.status}`);
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
      await signIn!.mfa.verifyEmailCode({ code });

      if (signIn!.status === "complete") {
        await signIn!.finalize({
          navigate: async ({ session }) => {
            if (session?.id) await setActive({ session: session.id });
            router.replace("/(home)/home");
          },
        });
      }
    } catch (err: any) {
      console.error("MFA error:", err);
      Alert.alert("Verification Failed", errors?.fields?.code?.message || "Invalid code.");
    }
  };

  const handleCancelVerification = () => {
    setPendingMfa(false);
    setCode("");
  };

  // ==========================================
  // MFA / OTP VERIFICATION VIEW
  // ==========================================
  if (pendingMfa || signIn?.status === "needs_client_trust") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={styles.keyboardView}
        >
          <View style={styles.headerContainer}>
            <View style={styles.iconWrapper}>
              <Ionicons name="shield-checkmark" size={40} color="#00D293" />
            </View>
            <Text style={styles.title}>Security Check</Text>
            <Text style={styles.subtitle}>
              A new device or session was detected. Enter the one-time code sent to your email.
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
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
            {errors?.fields?.code && <Text style={styles.errorText}>{errors.fields.code.message}</Text>}

            <TouchableOpacity
              style={[styles.primaryButton, (!code || isFetching) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!code || isFetching}
            >
              {isFetching ? (
                <ActivityIndicator color="#03151E" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => signIn!.mfa.sendEmailCode()}
            >
              <Text style={styles.secondaryButtonText}>Resend Email Code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity onPress={handleCancelVerification}>
              <Text style={styles.linkText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // MAIN SIGN IN VIEW
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.keyboardView}
      >
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name="wallet" size={40} color="#00D293" />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in & start budgeting.</Text>
        </View>

        <View style={styles.formContainer}>
          {/* Email Input */}
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={[styles.inputGroup, errors?.fields?.identifier && styles.inputErrorBorder]}>
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
          {errors?.fields?.identifier && (
            <Text style={styles.errorText}>{errors.fields.identifier.message}</Text>
          )}

          {/* Password Input */}
          <Text style={styles.inputLabel}>Password</Text>
          <View style={[styles.inputGroup, errors?.fields?.password && styles.inputErrorBorder]}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              placeholder="Enter your password"
              placeholderTextColor="#64748B"
              secureTextEntry={true}
              onChangeText={setPassword}
            />
          </View>
          {errors?.fields?.password && (
            <Text style={styles.errorText}>{errors.fields.password.message}</Text>
          )}

          {/* Email Submit Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!emailAddress || !password || isFetching) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!emailAddress || !password || isFetching}
          >
            {isFetching ? (
              <ActivityIndicator color="#03151E" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Custom OR Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google SSO Button */}
          <TouchableOpacity style={styles.ssoButton} onPress={handleGoogleSSO}>
            <Ionicons name="logo-google" size={20} color="#FFFFFF" style={styles.ssoIcon} />
            <Text style={styles.ssoButtonText}>Continue with Google</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#03151E",
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
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
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1E2D3D",
  },
  dividerText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 16,
  },
  ssoButton: {
    flexDirection: "row",
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C1A25", // Hollow dark background
    borderWidth: 1,
    borderColor: "#1E2D3D",
  },
  ssoIcon: {
    marginRight: 10,
  },
  ssoButtonText: {
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