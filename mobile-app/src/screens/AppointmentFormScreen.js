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

const formatVehicleTitle = (vehicle) =>
  [vehicle?.brand, vehicle?.model || vehicle?.type].filter(Boolean).join(" ");

const getSlotTime = (slot) => {
  if (!slot) return "";
  if (typeof slot === "string") return slot;
  if (typeof slot === "object" && typeof slot.time === "string") return slot.time;
  return "";
};

export default function AppointmentFormScreen({ navigation, route }) {
  const mode = route?.params?.mode || "create";
  const appointmentId = route?.params?.appointmentId;
  const initialData = route?.params?.appointment || {};

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [vehicles, setVehicles] = useState([]);
  const [leads, setLeads] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialData.vehicle?._id || initialData.vehicle || "");
  const [selectedLeadId, setSelectedLeadId] = useState(initialData.lead?._id || initialData.lead || "");

  const [date, setDate] = useState(formatInitialDate(initialData.date)); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState(initialData.time || ""); // HH:MM
  const [availableSlots, setAvailableSlots] = useState([]);
  const [closure, setClosure] = useState(null);

  const [notes, setNotes] = useState(initialData.notes || "");

  const canManage = useMemo(() => role === "admin" || role === "staff", [role]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      setError("");
      const [nextRole, nextToken, vehiclesRes, leadsRes] = await Promise.all([
        getRole(),
        getAuthToken(),
        api.get("/api/vehicles"),
        api.get("/api/leads"),
      ]);

      setRole(nextRole);
      setToken(nextToken);
      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
      setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load appointment form");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const handleCheckSlots = useCallback(async () => {
    if (!token) {
      navigation.navigate("Login");
      return;
    }

    if (!date.trim()) {
      Alert.alert("Date required", "Select a date from the calendar.");
      return;
    }

    try {
      setError("");
      setClosure(null);
      setSelectedTime("");
      setAvailableSlots([]);

      const response = await api.get(
        `/api/appointments/available-slots/${encodeURIComponent(date.trim())}`,
        withAuth(token)
      );

      setAvailableSlots(Array.isArray(response.data?.slots) ? response.data.slots : []);
      setClosure(response.data?.closure || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to fetch time slots");
    }
  }, [date, navigation, token]);

  useEffect(() => {
    if (!date || !token || !canManage) {
      setAvailableSlots([]);
      setSelectedTime("");
      setClosure(null);
      return;
    }

    handleCheckSlots();
  }, [canManage, date, handleCheckSlots, token]);

  const handleSubmit = useCallback(async () => {
    if (!canManage) {
      Alert.alert("Not allowed", "Only staff/admin can create appointments.");
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    if (!selectedVehicleId || !date.trim() || !selectedTime.trim()) {
      Alert.alert("Missing info", "Vehicle, date and time are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        vehicle: selectedVehicleId,
        lead: selectedLeadId || undefined,
        appointmentType: "viewing",
        date: date.trim(),
        time: selectedTime.trim(),
        notes: notes.trim(),
      };

      if (mode === "edit") {
        await api.put(`/api/appointments/${appointmentId}`, payload, withAuth(token));
        Alert.alert("Saved", "Appointment updated.");
      } else {
        await api.post("/api/appointments/add", payload, withAuth(token));
        Alert.alert("Saved", "Appointment created.");
      }

      navigation.goBack();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors[0] : null) ||
        err?.message ||
        "Failed to create appointment";
      setError(message);

      const timeSlots = err?.response?.data?.timeSlots;
      if (Array.isArray(timeSlots)) {
        setAvailableSlots(timeSlots);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [canManage, date, mode, appointmentId, navigation, notes, selectedLeadId, selectedTime, selectedVehicleId, token]);

  const handleDelete = useCallback(() => {
    if (!canManage) return;
    Alert.alert(
      "Delete Appointment",
      "Are you sure you want to permanently delete this appointment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!appointmentId) return;
              setIsSubmitting(true);
              await api.delete(`/api/appointments/${appointmentId}`, withAuth(token));
              Alert.alert("Deleted", "Appointment has been removed.");
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", err?.response?.data?.message || err?.message || "Failed to delete appointment");
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  }, [canManage, appointmentId, navigation, token]);

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading appointment form..." /></Screen>;
  }

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Staff-only</Text>
            <Text style={styles.blockText}>Login as staff/admin to create internal appointments.</Text>
            <View style={styles.blockActions}>
              <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!token) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Login required</Text>
            <Text style={styles.blockText}>Please login to continue.</Text>
            <View style={styles.blockActions}>
              <PrimaryButton label="Go to login" onPress={() => navigation.navigate("Login")} />
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
          <Text style={styles.title}>{mode === "edit" ? "Edit Appointment" : "Create Appointment"}</Text>

          <InlineMessage tone="danger" text={error} />

          <Text style={styles.choiceLabel}>Vehicle</Text>
          <View style={styles.choiceWrap}>
            {vehicles.map((vehicle) => (
              <SecondaryButton
                key={vehicle._id}
                label={formatVehicleTitle(vehicle) || "Vehicle"}
                onPress={() => setSelectedVehicleId(vehicle._id)}
                disabled={isSubmitting}
                style={[styles.choiceButton, selectedVehicleId === vehicle._id ? styles.choiceActive : null]}
              />
            ))}
          </View>

          <Text style={styles.choiceLabel}>Lead (optional)</Text>
          <View style={styles.choiceWrap}>
            {leads.map((lead) => (
              <SecondaryButton
                key={lead._id}
                label={lead?.name || lead?.email || "Lead"}
                onPress={() => setSelectedLeadId(lead._id)}
                disabled={isSubmitting}
                style={[styles.choiceButton, selectedLeadId === lead._id ? styles.choiceActive : null]}
              />
            ))}
          </View>

          <DatePickerField label="Date" value={date} onChange={setDate} placeholder="Select date" editable={!isSubmitting} />

          {closure ? (
            <View style={styles.closureCard}>
              <Text style={styles.closureTitle}>Shop closed</Text>
              <Text style={styles.closureText}>{closure?.name || closure?.type || "Closed"}</Text>
            </View>
          ) : null}

          {availableSlots.length ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.choiceLabel}>Available slots</Text>
              <View style={styles.slotsWrap}>
                {availableSlots.map((slot, index) => {
                  const slotTime = getSlotTime(slot);
                  const availabilityNote =
                    slot && typeof slot === "object" && Number.isFinite(slot.availableStaffCount)
                      ? ` (${slot.availableStaffCount})`
                      : "";
                  if (!slotTime) return null;
                  return (
                  <SecondaryButton
                    key={`${slotTime}-${index}`}
                    label={`${slotTime}${availabilityNote}`}
                    onPress={() => setSelectedTime(slotTime)}
                    disabled={isSubmitting}
                    style={[styles.slotButton, selectedTime === slotTime ? styles.choiceActive : null]}
                  />
                  );
                })}
              </View>
            </View>
          ) : null}

          {selectedTime ? (
            <Text style={styles.selectedTimeText}>Selected time: {selectedTime}</Text>
          ) : null}

          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" editable={!isSubmitting} />

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
  slotsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  slotButton: {
    flexGrow: 1,
  },
  choiceActive: {
    borderColor: "rgba(151,198,11,0.45)",
    backgroundColor: COLORS.accentSoft,
  },
  selectedTimeText: {
    marginTop: 10,
    color: COLORS.panel,
    fontSize: 13,
    fontWeight: "800",
  },
  closureCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFF8EA",
    borderWidth: 1,
    borderColor: "#F1E1B9",
  },
  closureTitle: {
    fontWeight: "900",
    color: COLORS.text,
  },
  closureText: {
    marginTop: 6,
    color: COLORS.textMuted,
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
