import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import api from "../services/api";
import {
  Screen,
  Card,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const TYPE_OPTIONS = ["appointment", "payment", "general"];

const buildDefaultSendTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 10);
  return now.toISOString();
};

export default function NotificationFormScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");

  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);

  const [onModel, setOnModel] = useState("Lead");
  const [recipient, setRecipient] = useState("");
  const [type, setType] = useState("general");
  const [message, setMessage] = useState("");
  const [sendTime, setSendTime] = useState(buildDefaultSendTime());

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canAccess = useMemo(() => role === "admin" || role === "staff", [role]);
  const canTargetUsers = useMemo(() => role === "admin", [role]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      setError("");
      const [nextRole, nextToken, leadsRes] = await Promise.all([
        getRole(),
        getAuthToken(),
        api.get("/api/leads"),
      ]);

      setRole(nextRole);
      setToken(nextToken);
      setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : []);

      if (nextRole === "admin" && nextToken) {
        try {
          const usersRes = await api.get("/api/users", withAuth(nextToken));
          setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        } catch (_err) {
          // ignore user list load errors (admin may not need it)
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load notification form");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const recipientOptions = useMemo(() => {
    if (onModel === "User") {
      return users.map((user) => ({
        id: user._id || user.id,
        label: user.name || user.email || "User",
      }));
    }

    return leads.map((lead) => ({
      id: lead._id,
      label: lead.name || lead.email || "Lead",
    }));
  }, [leads, onModel, users]);

  const handleSubmit = useCallback(async () => {
    if (!canAccess) {
      Alert.alert("Not allowed", "Only staff/admin can create notifications.");
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    if (!recipient || !message.trim() || !sendTime.trim()) {
      Alert.alert("Missing info", "Recipient, message and send time are required.");
      return;
    }

    const parsedSendTime = new Date(sendTime.trim());
    if (Number.isNaN(parsedSendTime.getTime())) {
      Alert.alert("Invalid send time", "Use an ISO format like 2026-04-27T10:00:00.000Z");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await api.post(
        "/api/notifications/add",
        {
          recipient,
          onModel,
          type,
          message: message.trim(),
          send_time: parsedSendTime.toISOString(),
          status: "pending",
        },
        withAuth(token)
      );

      Alert.alert("Saved", "Notification created.");
      navigation.goBack();
    } catch (err) {
      const nextError =
        (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors.join("\n") : null) ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create notification";
      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  }, [canAccess, message, navigation, onModel, recipient, sendTime, token, type]);

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading form..." /></Screen>;
  }

  if (!canAccess) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Staff-only</Text>
            <Text style={styles.blockText}>Login as staff/admin to create notifications.</Text>
            <View style={styles.blockActions}>
              <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
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
          <Text style={styles.title}>Create Notification</Text>

          <InlineMessage tone="danger" text={error} />

          <Text style={styles.choiceLabel}>Recipient model</Text>
          <View style={styles.choiceRow}>
            <SecondaryButton
              label="Lead"
              onPress={() => {
                setOnModel("Lead");
                setRecipient("");
              }}
              disabled={isSubmitting}
              style={[styles.choiceButton, onModel === "Lead" ? styles.choiceActive : null]}
            />
            <SecondaryButton
              label="User"
              onPress={() => {
                setOnModel("User");
                setRecipient("");
              }}
              disabled={isSubmitting || !canTargetUsers}
              style={[styles.choiceButton, onModel === "User" ? styles.choiceActive : null]}
            />
          </View>

          <Text style={styles.choiceLabel}>Recipient</Text>
          <View style={styles.choiceRow}>
            {recipientOptions.map((option) => (
              <SecondaryButton
                key={option.id}
                label={option.label}
                onPress={() => setRecipient(option.id)}
                disabled={isSubmitting}
                style={[styles.choiceButton, recipient === option.id ? styles.choiceActive : null]}
              />
            ))}
          </View>

          <Text style={styles.choiceLabel}>Type</Text>
          <View style={styles.choiceRow}>
            {TYPE_OPTIONS.map((option) => (
              <SecondaryButton
                key={option}
                label={option}
                onPress={() => setType(option)}
                disabled={isSubmitting}
                style={[styles.choiceButton, type === option ? styles.choiceActive : null]}
              />
            ))}
          </View>

          <TextField
            label="Message"
            value={message}
            onChangeText={setMessage}
            placeholder="Write the notification message"
            editable={!isSubmitting}
          />
          <TextField
            label="Send Time (ISO)"
            value={sendTime}
            onChangeText={setSendTime}
            placeholder="2026-04-27T10:00:00.000Z"
            editable={!isSubmitting}
          />

          <PrimaryButton
            label={isSubmitting ? "Saving..." : "Create"}
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{ marginTop: 8 }}
          />
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
  choiceRow: {
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
});
