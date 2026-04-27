import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import api from "../services/api";
import {
  Card,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  Screen,
  TextField,
} from "../ui/kit";
import { COLORS } from "../ui/theme";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async () => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Email required", "Enter your registered email address.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setMessage("");

      const response = await api.post("/api/auth/forgot-password", {
        email: normalizedEmail,
      });

      const successMessage =
        response.data?.message || "OTP has been sent to your email address.";
      setMessage(successMessage);

      Alert.alert("Check your email", successMessage);
      navigation.navigate("ResetPassword", { email: normalizedEmail });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to request password reset"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [email, navigation]);

  if (isSubmitting) {
    return (
      <Screen>
        <LoadingBlock text="Requesting OTP..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Card>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Request a one-time OTP via /api/auth/forgot-password
          </Text>

          <InlineMessage tone="danger" text={error} />
          <InlineMessage tone={message ? "muted" : "muted"} text={message} />

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            editable={!isSubmitting}
          />

          <PrimaryButton label="Send OTP" onPress={handleSubmit} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
});
