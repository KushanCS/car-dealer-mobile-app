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

function normalizeDateInput(value) {
  return String(value || "").trim();
}

export default function BookAppointmentScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState(""); // HH:MM
  const [availableSlots, setAvailableSlots] = useState([]);
  const [closure, setClosure] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canBook = useMemo(() => role === "user", [role]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      setError("");
      const [nextRole, nextToken, vehiclesRes] = await Promise.all([
        getRole(),
        getAuthToken(),
        api.get("/api/vehicles"),
      ]);

      setRole(nextRole);
      setToken(nextToken);
      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load booking form");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const handleCheckSlots = useCallback(async () => {
    const dateValue = normalizeDateInput(date);
    if (!dateValue) {
      return;
    }

    if (!canBook) {
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    try {
      setError("");
      setClosure(null);
      setSelectedTime("");
      setAvailableSlots([]);

      const response = await api.get(
        `/api/customer/appointments/available-slots/${encodeURIComponent(dateValue)}`,
        withAuth(token)
      );

      setAvailableSlots(Array.isArray(response.data?.slots) ? response.data.slots : []);
      setClosure(response.data?.closure || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to fetch time slots");
    }
  }, [canBook, date, navigation, token]);

  useEffect(() => {
    if (!date || !token || !canBook) {
      setAvailableSlots([]);
      setSelectedTime("");
      setClosure(null);
      return;
    }

    handleCheckSlots();
  }, [canBook, date, handleCheckSlots, token]);

  const handleSubmit = useCallback(async () => {
    if (!canBook) {
      Alert.alert("Not allowed", "Only customers can book through this screen.");
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    if (!selectedVehicleId) {
      Alert.alert("Vehicle required", "Select a vehicle first.");
      return;
    }

    const dateValue = normalizeDateInput(date);
    if (!dateValue || !selectedTime) {
      Alert.alert("Missing info", "Select a date and time slot.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await api.post(
        "/api/customer/appointments/book",
        {
          vehicle: selectedVehicleId,
          date: dateValue,
          time: selectedTime,
          appointmentType: "test_drive",
        },
        withAuth(token)
      );

      Alert.alert("Booked", "Your appointment has been scheduled.");
      navigation.goBack();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors[0] : null) ||
        err?.message ||
        "Failed to book appointment";
      setError(message);

      const timeSlots = err?.response?.data?.timeSlots;
      if (Array.isArray(timeSlots)) {
        setAvailableSlots(timeSlots);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [canBook, date, navigation, selectedTime, selectedVehicleId, token]);

  if (isLoading) {
    return <Screen><LoadingBlock text="Preparing booking..." /></Screen>;
  }

  if (!token) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Login required</Text>
            <Text style={styles.blockText}>Please login as a customer to book test drives.</Text>
            <View style={styles.blockActions}>
              <PrimaryButton label="Go to login" onPress={() => navigation.navigate("Login")} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!canBook) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Customer booking</Text>
            <Text style={styles.blockText}>This screen is intended for customer accounts only.</Text>
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
          <Text style={styles.title}>Book a Test Drive</Text>

          <InlineMessage tone="danger" text={error} />

          <Text style={styles.choiceLabel}>Vehicle</Text>
          <View style={styles.vehicleWrap}>
            {vehicles.map((vehicle) => (
              <SecondaryButton
                key={vehicle._id}
                label={formatVehicleTitle(vehicle) || "Vehicle"}
                onPress={() => setSelectedVehicleId(vehicle._id)}
                disabled={isSubmitting}
                style={[
                  styles.vehicleButton,
                  selectedVehicleId === vehicle._id ? styles.choiceActive : null,
                ]}
              />
            ))}
          </View>

          <DatePickerField
            label="Date"
            value={date}
            onChange={setDate}
            placeholder="Select appointment date"
            editable={!isSubmitting}
          />

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

          <PrimaryButton
            label={isSubmitting ? "Booking..." : "Confirm booking"}
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{ marginTop: 16 }}
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
  vehicleWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  vehicleButton: {
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
});
