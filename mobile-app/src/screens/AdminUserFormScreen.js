import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import api from "../services/api";
import {
  Card,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextField,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

export default function AdminUserFormScreen({ navigation, route }) {
  const mode = route?.params?.mode || "create";
  const userId = route?.params?.userId || "";
  const initialUser = route?.params?.user || null;

  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(initialUser?.name || "");
  const [email, setEmail] = useState(initialUser?.email || "");
  const [accountRole, setAccountRole] = useState(initialUser?.role || "staff");
  const [isDeleted, setIsDeleted] = useState(Boolean(initialUser?.isDeleted));

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canManage = useMemo(() => role === "admin", [role]);
  const canDelete = useMemo(() => canManage && mode === "edit" && userId, [canManage, mode, userId]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      setError("");
      const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
      setRole(nextRole);
      setToken(nextToken);

      if (mode === "edit" && userId && !initialUser && nextToken) {
        const response = await api.get("/api/admin/users", withAuth(nextToken));
        const users = Array.isArray(response.data) ? response.data : [];
        const found = users.find((u) => String(u?._id) === String(userId));
        if (found) {
          setName(found?.name || "");
          setEmail(found?.email || "");
          setAccountRole(found?.role || "staff");
          setIsDeleted(Boolean(found?.isDeleted));
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load user form");
    } finally {
      setIsLoading(false);
    }
  }, [initialUser, mode, userId]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const handleSubmit = useCallback(async () => {
    if (!canManage) {
      Alert.alert("Not allowed", "Only admins can manage users.");
      return;
    }

    const nextToken = token || (await getAuthToken());
    if (!nextToken) {
      navigation.navigate("Login");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (mode === "edit") {
        if (!userId) {
          setError("Missing user id");
          return;
        }

        await api.put(
          `/api/admin/users/${encodeURIComponent(userId)}`,
          {
            name: name.trim() || undefined,
            email: email.trim() || undefined,
            role: accountRole,
            isDeleted,
          },
          withAuth(nextToken)
        );

        Alert.alert("Saved", "User updated.");
        navigation.goBack();
        return;
      }

      if (!name.trim() || !email.trim() || !password || !confirmPassword) {
        Alert.alert("Missing info", "name, email, password, and confirm password are required.");
        return;
      }

      await api.post(
        "/api/admin/users/create",
        {
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          role: accountRole,
        },
        withAuth(nextToken)
      );

      Alert.alert("Saved", "User created.");
      navigation.goBack();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to save user");
    } finally {
      setIsSubmitting(false);
    }
  }, [accountRole, canManage, confirmPassword, email, isDeleted, mode, name, navigation, password, token, userId]);

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;

    const nextToken = token || (await getAuthToken());
    if (!nextToken) {
      navigation.navigate("Login");
      return;
    }

    Alert.alert(
      "Permanently delete user?",
      "This will permanently remove the account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await api.delete(
                `/api/admin/users/${encodeURIComponent(userId)}`,
                withAuth(nextToken)
              );
              Alert.alert("Deleted", "User removed.");
              navigation.goBack();
            } catch (err) {
              setError(err?.response?.data?.message || err?.message || "Failed to delete user");
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  }, [canDelete, navigation, token, userId]);

  if (isLoading) {
    return (
      <Screen>
        <LoadingBlock text="Loading user form..." />
      </Screen>
    );
  }

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Admin-only</Text>
            <Text style={styles.blockText}>Login as admin to manage user accounts.</Text>
            <View style={styles.blockActions}>
              <PrimaryButton label="Back" onPress={() => navigation.goBack()} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>{mode === "edit" ? "Edit User" : "Create User"}</Text>

          <InlineMessage tone="danger" text={error} />

          <TextField label="Name" value={name} onChangeText={setName} placeholder="Jane Doe" editable={!isSubmitting} />
          <TextField label="Email" value={email} onChangeText={setEmail} placeholder="jane@example.com" keyboardType="email-address" editable={!isSubmitting} />

          <Text style={styles.choiceLabel}>Role</Text>
          <View style={styles.choiceWrap}>
            {[
              { value: "staff", label: "Staff" },
              { value: "user", label: "User" },
            ].map((item) => (
              <SecondaryButton
                key={item.value}
                label={item.label}
                onPress={() => setAccountRole(item.value)}
                disabled={isSubmitting}
                style={[styles.choiceButton, accountRole === item.value ? styles.choiceActive : null]}
              />
            ))}
          </View>

          {mode === "edit" ? (
            <>
              <Text style={styles.choiceLabel}>Account status</Text>
              <View style={styles.choiceWrap}>
                <SecondaryButton
                  label="Active"
                  onPress={() => setIsDeleted(false)}
                  disabled={isSubmitting}
                  style={[styles.choiceButton, !isDeleted ? styles.choiceActive : null]}
                />
                <SecondaryButton
                  label="Disabled"
                  onPress={() => setIsDeleted(true)}
                  disabled={isSubmitting}
                  style={[styles.choiceButton, isDeleted ? styles.choiceDeleted : null]}
                />
              </View>
            </>
          ) : (
            <>
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Strong password"
                secureTextEntry
                editable={!isSubmitting}
              />
              <TextField
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat password"
                secureTextEntry
                editable={!isSubmitting}
              />
            </>
          )}

          {canDelete ? (
            <View style={styles.actionsRow}>
              <PrimaryButton
                label={isSubmitting ? "Saving..." : "Save"}
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                label={isSubmitting ? "..." : "Delete"}
                onPress={handleDelete}
                disabled={isSubmitting}
                style={[styles.dangerButton, { flex: 1 }]}
              />
            </View>
          ) : (
            <PrimaryButton
              label={isSubmitting ? "Saving..." : "Save"}
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
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
  choiceLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 6,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  choiceButton: {
    flexGrow: 1,
  },
  choiceActive: {
    borderColor: "rgba(151,198,11,0.45)",
    backgroundColor: COLORS.accentSoft,
  },
  choiceDeleted: {
    borderColor: "#F0BAC3",
    backgroundColor: "#FCE4E8",
  },
  dangerButton: {
    borderColor: "#F0BAC3",
    backgroundColor: "#FCE4E8",
  },
  blockTitle: {
    fontWeight: "900",
    fontSize: 16,
    color: COLORS.text,
  },
  blockText: {
    marginTop: 8,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  blockActions: {
    marginTop: 14,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
});
