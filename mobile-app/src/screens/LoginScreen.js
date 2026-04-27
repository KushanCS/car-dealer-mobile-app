import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import api from "../services/api";
import { saveUser } from "../utils/storage";
import { Screen, Card, TextField, PrimaryButton } from "../ui/kit";
import { COLORS, SPACING } from "../ui/theme";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await api.post("/api/auth/login", {
        email: normalizedEmail,
        password,
      });

      await saveUser(response.data);
      Alert.alert("Success", "Login successful");
      navigation.replace("Home");
    } catch (error) {
      console.log("Login error:", error.response?.data || error.message);
      const errorMessage =
        (!error.response &&
          "Couldn't reach the backend. Check that the API server is running and that the mobile app can access it.") ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Invalid email or password";

      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.brandTitle}>Car Dealer</Text>
            <Text style={styles.brandSubtitle}>Login to your account</Text>
          </View>

          <Card style={styles.card}>
            <TextField
              label="Email Address"
              placeholder="Enter email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!isSubmitting}
            />

            <TextField
              label="Password"
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isSubmitting}
            />

            <PrimaryButton
              label={isSubmitting ? "Logging in..." : "Login"}
              onPress={handleLogin}
              disabled={isSubmitting}
              style={styles.submitButton}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword")}
              disabled={isSubmitting}
              style={styles.forgotButton}>
              <Text style={styles.linkSecondary}>Forgot password?</Text>
            </TouchableOpacity>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
              disabled={isSubmitting}>
              <Text style={styles.link}>Register</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.xl,
    justifyContent: "center",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: "900",
    color: COLORS.panel,
    letterSpacing: -1,
  },
  brandSubtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: "500",
  },
  card: {
    padding: SPACING.xl,
  },
  submitButton: {
    marginTop: SPACING.md,
  },
  forgotButton: {
    marginTop: SPACING.lg,
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
    gap: 8,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  link: {
    color: COLORS.panel,
    fontWeight: "900",
    fontSize: 15,
    textDecorationLine: "underline",
  },
  linkSecondary: {
    color: COLORS.textMuted,
    fontWeight: "700",
    fontSize: 14,
  },
});

