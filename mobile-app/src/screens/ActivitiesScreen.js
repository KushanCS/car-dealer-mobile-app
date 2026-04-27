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
import {
  Card,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  Screen,
  SectionHeader,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const formatTimeStamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function ActivitiesScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");

  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canView = useMemo(() => role === "admin", [role]);

  const bootstrap = useCallback(async () => {
    const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
    setRole(nextRole);
    setToken(nextToken);
  }, []);

  const loadAll = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        setError("");
        const nextToken = token || (await getAuthToken());
        if (!nextToken) {
          setError("Login required.");
          setSummary(null);
          setActivities([]);
          return;
        }

        const [summaryRes, recentRes] = await Promise.all([
          api.get("/api/activities/summary", withAuth(nextToken)),
          api.get("/api/activities/recent?limit=30", withAuth(nextToken)),
        ]);

        setSummary(summaryRes.data?.data || null);
        setActivities(Array.isArray(recentRes.data?.data) ? recentRes.data.data : []);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load activities"
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        await bootstrap();
      } finally {
        if (isMounted) loadAll();
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [bootstrap, loadAll]);

  const renderActivity = ({ item }) => {
    return (
      <Card style={styles.activityCard}>
        <View style={styles.activityTop}>
          <View style={styles.activityIcon}>
            <MaterialCommunityIcons
              name="timeline-clock-outline"
              size={18}
              color={COLORS.panel}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.activityTitle}>{item?.title || "Activity"}</Text>
            <Text style={styles.activitySubtitle}>
              {item?.entityType || ""} • {item?.actionType || ""}
            </Text>
          </View>
        </View>

        <Text style={styles.activityDesc}>{item?.description || ""}</Text>

        <View style={styles.activityMetaRow}>
          <Text style={styles.activityMeta}>{item?.userName || "Unknown"}</Text>
          <Text style={styles.activityMetaDivider}>•</Text>
          <Text style={styles.activityMeta}>
            {formatTimeStamp(item?.timestamp || item?.createdAt)}
          </Text>
          {item?.status ? (
            <>
              <Text style={styles.activityMetaDivider}>•</Text>
              <Text style={styles.activityMeta}>{item.status}</Text>
            </>
          ) : null}
        </View>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Screen>
        <LoadingBlock text="Loading activities..." />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Admin-only</Text>
            <Text style={styles.blockText}>
              Activity monitoring is available only for admin accounts.
            </Text>
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
      <View style={styles.container}>
        <FlatList
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              <SectionHeader
                title="Activities"
                subtitle="Recent dealership operations feed"
                right={
                  <PrimaryButton
                    label="Refresh"
                    onPress={() => loadAll({ refreshing: true })}
                  />
                }
              />

              <InlineMessage tone={error ? "danger" : "muted"} text={error} />

              <Card style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{summary?.today ?? 0}</Text>
                    <Text style={styles.summaryLabel}>Today</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{summary?.thisWeek ?? 0}</Text>
                    <Text style={styles.summaryLabel}>7 Days</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{summary?.thisMonth ?? 0}</Text>
                    <Text style={styles.summaryLabel}>Month</Text>
                  </View>
                </View>
              </Card>
            </View>
          }
          data={activities}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderActivity}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadAll({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>No activity</Text>
              <Text style={styles.emptyText}>No activity records returned yet.</Text>
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
  summaryCard: {
    marginBottom: 12,
  },
  summaryTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  summaryRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryValue: {
    color: COLORS.panel,
    fontWeight: "900",
    fontSize: 20,
  },
  summaryLabel: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  activityCard: {
    padding: 14,
  },
  activityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },
  activitySubtitle: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  activityDesc: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  activityMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  activityMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  activityMetaDivider: {
    color: COLORS.border,
    fontSize: 12,
    fontWeight: "900",
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
