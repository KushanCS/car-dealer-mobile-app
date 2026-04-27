import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import api from "../services/api";
import {
  Screen,
  Card,
  DatePickerField,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const TYPE_OPTIONS = ["holiday", "weather", "flood", "special", "other"];

export default function EventFormScreen({ navigation, route }) {
  const mode = route?.params?.mode || "create";
  const eventId = route?.params?.eventId || null;
  const initialData = route?.params?.event || {};

  const formatInitialDate = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");

  const [name, setName] = useState(initialData.name || "");
  const [type, setType] = useState(initialData.type || "holiday");
  const [description, setDescription] = useState(initialData.description || "");
  const [startDate, setStartDate] = useState(formatInitialDate(initialData.startDate)); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(formatInitialDate(initialData.endDate)); // YYYY-MM-DD
  const [isShopClosed, setIsShopClosed] = useState(initialData.isShopClosed ?? true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canManage = useMemo(() => role === "admin" || role === "staff", [role]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
      if (!mounted) return;
      setRole(nextRole);
      setToken(nextToken);
      setIsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canManage) {
      Alert.alert("Not allowed", "Only staff/admin can create events.");
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    if (!name.trim() || !type || !startDate.trim() || !endDate.trim()) {
      Alert.alert("Missing info", "Name, type, start date and end date are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        name: name.trim(),
        type,
        description: description.trim(),
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        isShopClosed,
      };

      if (mode === "edit" && eventId) {
        await api.put(`/api/events/${eventId}`, payload, withAuth(token));
        Alert.alert("Saved", "Event updated.");
      } else {
        await api.post("/api/events", payload, withAuth(token));
        Alert.alert("Saved", "Event created.");
      }
      navigation.goBack();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  }, [canManage, description, endDate, isShopClosed, mode, eventId, name, navigation, startDate, token, type]);

  const handleDelete = useCallback(() => {
    if (!canManage) return;
    Alert.alert(
      "Delete Event",
      "Are you sure you want to permanently delete this event?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!token || !eventId) return;
              setIsSubmitting(true);
              await api.delete(`/api/events/${eventId}`, withAuth(token));
              Alert.alert("Deleted", "Event has been removed.");
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", err?.response?.data?.message || err?.message || "Failed to delete event");
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  }, [canManage, token, eventId, navigation]);

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading form..." /></Screen>;
  }

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Staff-only</Text>
            <Text style={styles.blockText}>Login as staff/admin to create events.</Text>
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
          <Text style={styles.title}>{mode === "edit" ? "Edit Event" : "Create Event"}</Text>

          <InlineMessage tone="danger" text={error} />

          <TextField label="Name" value={name} onChangeText={setName} placeholder="New Year Closure" editable={!isSubmitting} />

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

          <DatePickerField label="Start Date" value={startDate} onChange={setStartDate} placeholder="Select start date" editable={!isSubmitting} />
          <DatePickerField label="End Date" value={endDate} onChange={setEndDate} placeholder="Select end date" editable={!isSubmitting} />

          <Text style={styles.choiceLabel}>Shop closed?</Text>
          <View style={styles.choiceRow}>
            <SecondaryButton
              label="Yes"
              onPress={() => setIsShopClosed(true)}
              disabled={isSubmitting}
              style={[styles.choiceButton, isShopClosed ? styles.choiceActive : null]}
            />
            <SecondaryButton
              label="No"
              onPress={() => setIsShopClosed(false)}
              disabled={isSubmitting}
              style={[styles.choiceButton, !isShopClosed ? styles.choiceActive : null]}
            />
          </View>

          <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Optional notes" editable={!isSubmitting} />

          {mode === "edit" ? (
            <View style={styles.actionsRow}>
              <PrimaryButton label={isSubmitting ? "Saving..." : "Save"} onPress={handleSubmit} disabled={isSubmitting} style={{ flex: 1 }} />
              <SecondaryButton 
                label="Delete" 
                onPress={handleDelete} 
                disabled={isSubmitting} 
                style={[styles.deleteButton, { flex: 1 }]} 
              />
            </View>
          ) : (
            <PrimaryButton label={isSubmitting ? "Saving..." : "Create"} onPress={handleSubmit} disabled={isSubmitting} />
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  deleteButton: {
    borderColor: "#F0BAC3",
    backgroundColor: "#FCE4E8",
  },
});
