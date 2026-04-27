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

export default function ResetPasswordScreen({ navigation, route }) {
  const initialEmail = route?.params?.email || "";

  const [email, setEmail] = useState(String(initialEmail));
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async () => {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !otp.trim() || !password || !confirmPassword) {
      Alert.alert("Missing info", "All fields are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const response = await api.post("/api/auth/reset-password", {
        email: normalizedEmail,
        otp: otp.trim(),
        password,
        confirmPassword,
      });

      Alert.alert("Success", response.data?.message || "Password updated.");
      navigation.navigate("Login");
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to reset password"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmPassword, email, navigation, otp, password]);

  if (isSubmitting) {
    return (
      <Screen>
        <LoadingBlock text="Resetting password..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Card>
          <Text style={styles.title}>Reset Password</Text>

          <InlineMessage tone="danger" text={error} />

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <TextField
            label="OTP"
            value={otp}
            onChangeText={setOtp}
            placeholder="123456"
            keyboardType="number-pad"
          />
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="Strong password"
            secureTextEntry
          />
          <TextField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat password"
            secureTextEntry
          />

          <PrimaryButton label="Reset password" onPress={handleSubmit} />
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
