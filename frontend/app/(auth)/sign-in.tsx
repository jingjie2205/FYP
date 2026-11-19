import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useClerk, useSignIn, useSSO } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useUsers } from "@/hooks/useUsers";
import { getClerkErrorMessage, isCancellationError, messageForCode } from "@/utils/clerkErrors";

// Module top-level: clears stale redirect handlers (Fast Refresh / interrupted logins)
WebBrowser.maybeCompleteAuthSession();

const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS === "web") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

type Factor = "first" | "second";

export default function SignInPage() {
  useWarmUpBrowser();

  const { signIn, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { setActive } = useClerk();
  const router = useRouter();
  const { addUser } = useUsers();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [factor, setFactor] = useState<Factor>("second");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);

  const isBusy = loading || ssoLoading || fetchStatus === "fetching";

  // ==========================================
  // GOOGLE SSO HANDLER
  // ==========================================
  const handleGoogleSSO = async () => {
    if (ssoLoading || loading) return;
    setError("");
    setNotice("");
    setSsoLoading(true);
    try {
      // Clear any previously backed-out browser session so it cannot block this attempt
      if (Platform.OS !== "web") {
        try {
          WebBrowser.dismissAuthSession();
        } catch {}
      }

      const redirectUrl = AuthSession.makeRedirectUri();
      const { createdSessionId, setActive: setSsoActive, signUp, signIn: ssoSignIn, authSessionResult } =
        await startSSOFlow({ strategy: "oauth_google", redirectUrl });

      if (createdSessionId) {
        if (signUp?.status === "complete" && signUp.createdUserId && signUp.emailAddress) {
          try {
            await addUser({ userId: signUp.createdUserId, email: signUp.emailAddress });
          } catch (dbErr) {
            console.error("Database sync failed on Google SSO:", dbErr);
          }
        }
        await (setSsoActive ?? setActive)({ session: createdSessionId });
        // The root layout redirects signed-in users to (home)
        return;
      }

      // No session: user cancelled, or Clerk needs something more
      if (authSessionResult && authSessionResult.type !== "success") return;

      if (signUp?.status === "missing_requirements") {
        setError("We couldn't finish setting up your account with Google. Please try again or sign up with email.");
      } else if (ssoSignIn?.status === "needs_second_factor" || ssoSignIn?.status === "needs_client_trust") {
        setError("Additional verification is required. Please sign in with your email and password instead.");
      } else {
        setError("Google sign-in wasn't completed. Please try again.");
      }
    } catch (err: any) {
      if (isCancellationError(err)) return;
      console.error("Google SSO Error:", err);
      setError(getClerkErrorMessage(err, "Unable to sign in with Google. Please try again."));
    } finally {
      setSsoLoading(false);
    }
  };

  // ==========================================
  // SHARED HELPERS
  // ==========================================
  const finalizeSignIn = async () => {
    const { error: finalizeError } = await signIn!.finalize({
      navigate: async ({ session }) => {
        if (session?.id) await setActive({ session: session.id });
        router.replace("/(home)/home");
      },
    });
    if (finalizeError) setError(getClerkErrorMessage(finalizeError));
  };

  /** Send the email code for whichever factor Clerk is asking for. */
  const sendVerificationCode = async (which: Factor): Promise<boolean> => {
    const { error: sendError } =
      which === "second"
        ? await signIn!.mfa.sendEmailCode()
        : await signIn!.emailCode.sendCode();
    if (sendError) {
      setError(getClerkErrorMessage(sendError));
      return false;
    }
    return true;
  };

  /** Decide what to do next based on the sign-in status. */
  const routeStatus = async () => {
    const status = signIn!.status;

    if (status === "complete") {
      await finalizeSignIn();
      return;
    }

    if (status === "needs_second_factor" || status === "needs_client_trust") {
      // New-device verification (Client Trust): send the code automatically.
      if (await sendVerificationCode("second")) {
        setFactor("second");
        setCode("");
        setVerifying(true);
      }
      return;
    }

    if (status === "needs_first_factor") {
      if (await sendVerificationCode("first")) {
        setFactor("first");
        setCode("");
        setVerifying(true);
      }
      return;
    }

    setError(messageForCode(status) ?? getClerkErrorMessage(null));
  };

  // ==========================================
  // STANDARD EMAIL HANDLER
  // ==========================================
  const handleSubmit = async () => {
    if (isBusy) return;
    const identifier = emailAddress.trim();
    if (!identifier || !password) {
      setError(messageForCode("needs_identifier")!);
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { error: createError } = await signIn!.create({ identifier, password });
      if (createError) {
        console.error("Sign-in error:", createError);
        setError(getClerkErrorMessage(createError));
        return;
      }
      await routeStatus();
    } catch (err) {
      console.error("Sign-in error:", err);
      setError(getClerkErrorMessage(err));
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
      const { error: verifyError } =
        factor === "second"
          ? await signIn!.mfa.verifyEmailCode({ code: trimmed })
          : await signIn!.emailCode.verifyCode({ code: trimmed });

      if (verifyError) {
        console.error("Verification error:", verifyError);
        setError(getClerkErrorMessage(verifyError, messageForCode("form_code_incorrect")!));
        return;
      }

      if (signIn!.status === "complete") {
        await finalizeSignIn();
      } else {
        setError(getClerkErrorMessage(null));
      }
    } catch (err) {
      console.error("Verification error:", err);
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
      if (await sendVerificationCode(factor)) {
        setNotice("A new code has been sent to your email.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelVerification = () => {
    setVerifying(false);
    setCode("");
    setError("");
    setNotice("");
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

  // ==========================================
  // EMAIL CODE VERIFICATION VIEW
  // ==========================================
  if (verifying) {
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
            <Text style={styles.title}>Verify This Device</Text>
            <Text style={styles.subtitle}>
              For your security, enter the 6-digit code sent to your email to verify this device.
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
                autoFocus
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
                <Text style={styles.primaryButtonText}>Verify Code</Text>
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
  const canSubmit = !!emailAddress.trim() && !!password && !isBusy;

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
          {errorBanner}

          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              value={emailAddress}
              placeholder="Enter your email"
              placeholderTextColor="#64748B"
              onChangeText={setEmailAddress}
              keyboardType="email-address"
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputGroup}>
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

          <TouchableOpacity
            style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isBusy ? (
              <ActivityIndicator color="#070D14" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.ssoButton, (ssoLoading || loading) && styles.buttonDisabled]}
            onPress={handleGoogleSSO}
            disabled={ssoLoading || loading}
          >
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
    backgroundColor: "#070D14",
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
    color: "#FF6B6B",
    fontSize: 13,
    fontWeight: "600",
    marginHorizontal: 8,
  },
  noticeText: {
    color: "#00D293",
    fontSize: 13,
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
    backgroundColor: "#0C1521",
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
