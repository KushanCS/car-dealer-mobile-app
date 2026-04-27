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
import { getRole } from "../utils/session";

const INTEREST_LEVELS = ["low", "medium", "high"];
const STATUS_OPTIONS = ["new", "contacted", "converted", "lost"];

export default function LeadFormScreen({ navigation, route }) {
  const mode = route?.params?.mode || "create";
  const leadId = route?.params?.leadId || null;

  const [role, setRole] = useState("user");
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [interestLevel, setInterestLevel] = useState("medium");
  const [status, setStatus] = useState("new");

  const canManage = useMemo(() => role === "admin" || role === "staff", [role]);

  const loadExisting = useCallback(async () => {
    if (mode !== "edit" || !leadId) return;

    try {
      setError("");
      setIsLoading(true);
      const response = await api.get(`/api/leads/${leadId}`);
      const lead = response.data;

      setName(lead?.name || "");
      setEmail(lead?.email || "");
      setContactNumber(lead?.contact_number || "");
      setLeadSource(lead?.lead_source || "");
      setInterestLevel(lead?.interest_level || "medium");
      setStatus(lead?.status || "new");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load lead");
    } finally {
      setIsLoading(false);
    }
  }, [mode, leadId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const nextRole = await getRole();
      if (mounted) setRole(nextRole);
      await loadExisting();
    })();

    return () => {
      mounted = false;
    };
  }, [loadExisting]);

  const handleSubmit = useCallback(async () => {
    if (!canManage) {
      Alert.alert("Not allowed", "Only staff/admin can manage leads.");
      return;
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      contact_number: contactNumber.trim(),
      lead_source: leadSource.trim(),
      interest_level: interestLevel,
      status,
    };

    if (!payload.name || !payload.email || !payload.contact_number || !payload.lead_source) {
      Alert.alert("Missing info", "Name, email, contact number, and lead source are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (mode === "edit" && leadId) {
        await api.put(`/api/leads/${leadId}`, payload);
        Alert.alert("Saved", "Lead updated.");
      } else {
        await api.post("/api/leads/add", payload);
        Alert.alert("Saved", "Lead created.");
      }

      navigation.goBack();
    } catch (err) {
      const nextError =
        (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors.join("\n") : null) ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save lead";
      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  }, [canManage, navigation, mode, leadId, name, email, contactNumber, leadSource, interestLevel, status]);

  const handleDelete = useCallback(() => {
    if (!canManage) return;
    Alert.alert(
      "Delete Lead",
      "Are you sure you want to permanently delete this lead?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!leadId) return;
              setIsSubmitting(true);
              await api.delete(`/api/leads/${leadId}`);
              Alert.alert("Deleted", "Lead has been removed.");
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", err?.response?.data?.message || err?.message || "Failed to delete lead");
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  }, [canManage, leadId, navigation]);

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Staff-only</Text>
            <Text style={styles.blockText}>Login as staff/admin to add or edit leads.</Text>
            <View style={styles.blockActions}>
              <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading lead..." /></Screen>;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>{mode === "edit" ? "Edit Lead" : "Add Lead"}</Text>

          <InlineMessage tone="danger" text={error} />

          <TextField label="Name" value={name} onChangeText={setName} placeholder="Customer name" editable={!isSubmitting} />
          <TextField label="Email" value={email} onChangeText={setEmail} placeholder="name@email.com" keyboardType="email-address" editable={!isSubmitting} />
          <TextField label="Contact Number" value={contactNumber} onChangeText={setContactNumber} placeholder="07XXXXXXXX" keyboardType="phone-pad" editable={!isSubmitting} />
          <TextField label="Lead Source" value={leadSource} onChangeText={setLeadSource} placeholder="Facebook / Walk-in" editable={!isSubmitting} />

          <View style={styles.choiceBlock}>
            <Text style={styles.choiceLabel}>Interest Level</Text>
            <View style={styles.choiceRow}>
              {INTEREST_LEVELS.map((option) => (
                <SecondaryButton
                  key={option}
                  label={option}
                  onPress={() => setInterestLevel(option)}
                  disabled={isSubmitting}
                  style={[styles.choiceButton, interestLevel === option ? styles.choiceActive : null]}
                />
              ))}
            </View>
          </View>

          <View style={styles.choiceBlock}>
            <Text style={styles.choiceLabel}>Status</Text>
            <View style={styles.choiceRow}>
              {STATUS_OPTIONS.map((option) => (
                <SecondaryButton
                  key={option}
                  label={option}
                  onPress={() => setStatus(option)}
                  disabled={isSubmitting}
                  style={[styles.choiceButton, status === option ? styles.choiceActive : null]}
                />
              ))}
            </View>
          </View>

          {mode === "edit" ? (
            <View style={styles.actionsRow}>
              <PrimaryButton
                label={isSubmitting ? "Saving..." : "Save"}
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              />
              <SecondaryButton 
                label="Delete" 
                onPress={handleDelete} 
                disabled={isSubmitting} 
                style={[styles.deleteButton, { flex: 1 }]} 
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
  choiceBlock: {
    marginBottom: 12,
  },
  choiceLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
