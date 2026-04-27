import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import api from "../services/api";
import { Screen, Card, LoadingBlock, SectionHeader } from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const formatWhen = (appointment) => {
  const date = appointment?.date ? new Date(appointment.date) : null;
  if (!date || Number.isNaN(date.getTime())) return appointment?.time || "";
  const dateLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
  return appointment?.time ? `${dateLabel} • ${appointment.time}` : dateLabel;
};

const formatVehicle = (appointment) =>
  [appointment?.vehicle?.brand, appointment?.vehicle?.model || appointment?.vehicle?.type]
    .filter(Boolean)
    .join(" ");

export default function NotificationsScreen() {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canAccess = useMemo(() => ["admin", "staff", "user"].includes(role), [role]);

  const loadNotifications = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        setError("");
        if (!token) {
          setItems([]);
          return;
        }

        const endpoint = role === "user" ? "/api/customer/appointments/my" : "/api/appointments";
        const response = await api.get(endpoint, withAuth(token));
        const appointments = Array.isArray(response.data) ? response.data : [];

        const upcoming = appointments
          .map((appointment) => {
            if (!appointment?.date) return null;

            const when = new Date(appointment.date);
            if (Number.isNaN(when.getTime())) return null;

            if (appointment?.time && /^\d{2}:\d{2}$/.test(String(appointment.time))) {
              const [hours, minutes] = String(appointment.time).split(":").map(Number);
              when.setHours(hours, minutes, 0, 0);
            }

            return {
              ...appointment,
              _notifyAt: when,
            };
          })
          .filter((item) => item && item._notifyAt >= new Date() && String(item.status || "").toLowerCase() !== "cancelled")
          .sort((a, b) => a._notifyAt - b._notifyAt);

        setItems(upcoming);
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Failed to load notifications");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [role, token]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
      if (!mounted) return;
      setRole(nextRole);
      setToken(nextToken);
      await loadNotifications();
    })();

    return () => {
      mounted = false;
    };
  }, [loadNotifications]);

  const renderItem = ({ item }) => (
    <Card style={styles.rowCard}>
      <View style={styles.rowTop}>
        <View style={styles.rowIcon}>
          <MaterialCommunityIcons name="calendar-clock" size={20} color={COLORS.panel} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {formatVehicle(item) || "Appointment reminder"}
          </Text>
          <Text style={styles.rowSubtitle}>
            {formatWhen(item)}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{String(item?.status || "scheduled")}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {item?.appointmentType ? `Type: ${String(item.appointmentType).replace("_", " ")}` : "Upcoming appointment"}
          {item?.staffMember?.name ? ` • Staff: ${item.staffMember.name}` : ""}
        </Text>
      </View>
    </Card>
  );

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading notifications..." /></Screen>;
  }

  if (!canAccess) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.emptyTitle}>Staff-only</Text>
            <Text style={styles.emptyText}>Login as staff/admin to manage notifications.</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <SectionHeader
          title="Notifications"
          subtitle="Upcoming appointment reminders"
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
              onRefresh={() => loadNotifications({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>No upcoming reminders</Text>
              <Text style={styles.emptyText}>Upcoming appointments will appear here automatically.</Text>
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
  rowCard: {
    padding: 14,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: 6,
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
  metaRow: {
    marginTop: 10,
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: 12,
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
