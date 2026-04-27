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
import { Screen, Card, TextField, PrimaryButton } from "../ui/kit";
import { COLORS, SPACING } from "../ui/theme";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      setIsSubmitting(true);

      await api.post("/api/auth/register", {
        name: normalizedName,
        email: normalizedEmail,
        password,
        confirmPassword: password,
      });

      Alert.alert("Success", "Registration successful");
      navigation.replace("Login");
    } catch (error) {
      console.log("Register error:", error.response?.data || error.message);
      const errorMessage =
        (!error.response &&
          "Couldn't reach the backend. Check that the API server is running and that the mobile app can access it.") ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Registration failed";

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
            <Text style={styles.brandSubtitle}>Create your account</Text>
          </View>

          <Card style={styles.card}>
            <TextField
              label="Full Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              editable={!isSubmitting}
            />

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
              label={isSubmitting ? "Creating account..." : "Register"}
              onPress={handleRegister}
              disabled={isSubmitting}
              style={styles.submitButton}
            />
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              disabled={isSubmitting}>
              <Text style={styles.link}>Login</Text>
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
});

