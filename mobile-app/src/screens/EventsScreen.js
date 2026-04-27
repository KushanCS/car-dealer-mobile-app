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
import { Screen, Card, LoadingBlock, PrimaryButton, SectionHeader, SecondaryButton } from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole } from "../utils/session";

const formatDateRange = (start, end) => {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return "";

  const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  const startLabel = fmt.format(startDate);

  if (!endDate || Number.isNaN(endDate.getTime())) return startLabel;

  const endLabel = fmt.format(endDate);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
};

export default function EventsScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canManage = useMemo(() => role === "admin" || role === "staff", [role]);

  const loadEvents = useCallback(async ({ refreshing = false } = {}) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      setError("");
      const response = await api.get("/api/events");
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load events");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
      if (!mounted) return;
      setRole(nextRole);
      setToken(nextToken);
      await loadEvents();
    })();

    return () => {
      mounted = false;
    };
  }, [loadEvents]);

  const handleOpen = useCallback((event) => {
    if (!canManage) return;
    navigation.navigate("EventForm", { mode: "edit", eventId: event?._id, event });
  }, [canManage, navigation]);

  const renderItem = ({ item }) => (
    <Pressable onPress={() => handleOpen(item)} style={styles.rowPressable}>
      <Card style={styles.rowCard}>
        <View style={styles.rowTop}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name="calendar-star" size={20} color={COLORS.panel} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item?.name || "Event"}</Text>
            <Text style={styles.rowSubtitle}>
              {formatDateRange(item?.startDate, item?.endDate)} • {String(item?.type || "other")}
            </Text>
          </View>
        </View>
        {item?.description ? <Text style={styles.rowDescription}>{item.description}</Text> : null}
        <View style={styles.rowMeta}>
          <Text style={styles.metaText}>
            {item?.isShopClosed ? "Shop closed" : "Shop open"} • {item?.createdBy?.name || item?.createdBy?.email || ""}
          </Text>
        </View>
      </Card>
    </Pressable>
  );

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading calendar..." /></Screen>;
  }

  return (
    <Screen>
      <View style={styles.container}>
        <SectionHeader
          title="Events"
          subtitle="Operational calendar & closures"
          right={
            canManage && token ? (
              <PrimaryButton label="Add" onPress={() => navigation.navigate("EventForm", { mode: "create" })} />
            ) : null
          }
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
              onRefresh={() => loadEvents({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>No events</Text>
              <Text style={styles.emptyText}>Add events/closures in the backend or via the admin/staff form.</Text>
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
  rowDescription: {
    marginTop: 10,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  rowMeta: {
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
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
