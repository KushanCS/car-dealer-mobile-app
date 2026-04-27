import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import api from "../services/api";
import { Screen, Card, LoadingBlock, PrimaryButton, SecondaryButton, SectionHeader } from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const formatVehicle = (appointment) => {
  const vehicle = appointment?.vehicle;
  if (!vehicle) return "Vehicle";
  return [vehicle.brand, vehicle.model || vehicle.type].filter(Boolean).join(" ");
};

const formatWhen = (appointment) => {
  const date = appointment?.date ? new Date(appointment.date) : null;
  const time = appointment?.time || "";
  if (!date || Number.isNaN(date.getTime())) return time || "";

  const dateLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
  return time ? `${dateLabel} • ${time}` : dateLabel;
};

export default function AppointmentsScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isStaff = useMemo(() => role === "admin" || role === "staff", [role]);

  const loadAppointments = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        setError("");
        if (!token) {
          setItems([]);
          return;
        }

        const url = isStaff ? "/api/appointments" : "/api/customer/appointments/my";
        const response = await api.get(url, withAuth(token));
        const list = Array.isArray(response.data) ? response.data : [];
        const visible = list.filter(
          (appointment) => String(appointment?.status || "").toLowerCase() !== "completed"
        );
        setItems(visible);
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Failed to load appointments");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isStaff, token]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
      if (!mounted) return;
      setRole(nextRole);
      setToken(nextToken);
      await loadAppointments();
    })();

    return () => {
      mounted = false;
    };
  }, [loadAppointments]);

  const handleCancel = useCallback(
    (appointment) => {
      if (!token) return;
      const appointmentId = appointment?._id;
      if (!appointmentId) return;

      const title = isStaff ? "Cancel appointment" : "Cancel booking";

      Alert.alert(title, "Are you sure?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            try {
              if (isStaff) {
                await api.put(`/api/appointments/${appointmentId}`, { status: "cancelled" }, withAuth(token));
              } else {
                await api.delete(`/api/customer/appointments/${appointmentId}`, withAuth(token));
              }

              await loadAppointments({ refreshing: true });
            } catch (err) {
              Alert.alert(
                "Error",
                err?.response?.data?.message || err?.message || "Failed to cancel appointment"
              );
            }
          },
        },
      ]);
    },
    [isStaff, loadAppointments, token]
  );

  const handleComplete = useCallback(
    async (appointment) => {
      if (!isStaff || !token) return;

      try {
        await api.put(`/api/appointments/${appointment._id}/complete`, {}, withAuth(token));
        await loadAppointments({ refreshing: true });
      } catch (err) {
        Alert.alert(
          "Error",
          err?.response?.data?.message || err?.message || "Failed to mark complete"
        );
      }
    },
    [isStaff, loadAppointments, token]
  );

  const actions = useMemo(() => {
    if (!token) {
      return <PrimaryButton label="Login" onPress={() => navigation.navigate("Login")} />;
    }

    if (isStaff) {
      return <PrimaryButton label="Add" onPress={() => navigation.navigate("AppointmentForm", { mode: "staff" })} />;
    }

    return <PrimaryButton label="Book" onPress={() => navigation.navigate("BookAppointment")} />;
  }, [isStaff, navigation, token]);

  const renderItem = ({ item }) => {
    const status = String(item?.status || "scheduled");

    return (
      <Pressable 
        style={styles.rowPressable}
        onPress={() => {
          if (isStaff) {
            navigation.navigate("AppointmentForm", { mode: "edit", appointmentId: item._id, appointment: item });
          }
        }}
      >
        <Card style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name="calendar-check" size={20} color={COLORS.panel} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{formatVehicle(item)}</Text>
              <Text style={styles.rowSubtitle}>{formatWhen(item)}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          <View style={styles.rowActions}>
            {isStaff && status === "scheduled" ? (
              <SecondaryButton label="Complete" onPress={() => handleComplete(item)} style={{ flex: 1 }} />
            ) : null}
            {status === "scheduled" ? (
              <SecondaryButton label="Cancel" onPress={() => handleCancel(item)} style={[styles.cancelButton, { flex: 1 }]} />
            ) : null}
          </View>
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading appointments..." /></Screen>;
  }

  return (
    <Screen>
      <View style={styles.container}>
        <SectionHeader
          title={isStaff ? "Appointments" : "My Appointments"}
          subtitle={isStaff ? "Staff & admin scheduling" : "Your test drive bookings"}
          right={actions}
        />

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <FlatList
          data={items}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadAppointments({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>{token ? "No appointments" : "Not logged in"}</Text>
              <Text style={styles.emptyText}>
                {token
                  ? "Create a booking to see it here."
                  : "Login to view and manage appointments."}
              </Text>
            </Card>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  rowPressable: {
    borderRadius: 22,
  },
  rowCard: {
    padding: 14,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  rowSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusText: {
    color: COLORS.panel,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  rowActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    borderColor: "rgba(178,75,94,0.35)",
  },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 15,
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: "#FFF8EA",
    borderColor: "#F1E1B9",
  },
  errorText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
