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
import { Screen, Card, LoadingBlock, PrimaryButton, SectionHeader, SecondaryButton, StatusBadge } from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";
import { formatCurrency, formatVehicleTitle } from "../utils/formatters";

export default function SalesScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canAccess = useMemo(() => role === "admin" || role === "staff", [role]);
  const isAdmin = useMemo(() => role === "admin", [role]);

  const loadSales = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        setError("");
        if (!token) {
          setStats(null);
          setSales([]);
          return;
        }

        const [statsRes, listRes] = await Promise.all([
          api.get("/api/sales/stats", withAuth(token)),
          api.get("/api/sales", withAuth(token)),
        ]);

        setStats(statsRes.data || null);
        setSales(Array.isArray(listRes.data) ? listRes.data : []);
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Failed to load sales");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
      if (!mounted) return;
      setRole(nextRole);
      setToken(nextToken);
      await loadSales();
    })();

    return () => {
      mounted = false;
    };
  }, [loadSales]);

  const handleOpen = useCallback((sale) => {
    if (!canAccess) return;
    navigation.navigate("SaleForm", { mode: "edit", saleId: sale?._id, sale });
  }, [canAccess, navigation]);

  const renderItem = ({ item }) => {
    const status = String(item?.payment_status || "pending");
    
    return (
      <Pressable onPress={() => handleOpen(item)} style={styles.rowPressable}>
        <Card style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name="cash-register" size={20} color={COLORS.panel} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{formatVehicleTitle(item?.vehicle) || "Vehicle"}</Text>
              <Text style={styles.rowSubtitle}>{item?.customer?.name || "Customer"}</Text>
              
              <View style={styles.rowMeta}>
                <Text style={styles.metaText}>Price: {formatCurrency(item?.price)}</Text>
                <Text style={styles.metaText}>Paid: {formatCurrency(item?.paid_amount)}</Text>
                <Text style={styles.metaText}>Pending: {formatCurrency(item?.pending_amount)}</Text>
              </View>
            </View>
            
            <StatusBadge status={status} />
          </View>
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading sales..." /></Screen>;
  }

  if (!canAccess) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.emptyTitle}>Staff-only</Text>
            <Text style={styles.emptyText}>Login as staff/admin to view sales.</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <SectionHeader
          title="Sales"
          subtitle="Payment tracking and revenue metrics"
          right={<PrimaryButton label="Add" onPress={() => navigation.navigate("SaleForm", { mode: "create" })} />}
        />

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {stats ? (
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Collected</Text>
              <Text style={styles.statValue}>{formatCurrency(stats.collectedAmount)}</Text>
              <Text style={styles.statHint}>Year {stats.year}</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text style={styles.statValue}>{formatCurrency(stats.outstandingAmount)}</Text>
              <Text style={styles.statHint}>Pending payments</Text>
            </Card>
          </View>
        ) : null}

        <FlatList
          data={sales}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadSales({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>No sales</Text>
              <Text style={styles.emptyText}>Record the first sale to see analytics.</Text>
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
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 14,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  statValue: {
    marginTop: 10,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  statHint: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 12,
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
  rowMeta: {
    marginTop: 8,
    gap: 4,
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
  },
  statusPillSuccess: {
    backgroundColor: COLORS.accentSoft,
    borderColor: "rgba(151,198,11,0.45)",
  },
  statusPillWarning: {
    backgroundColor: "#FFF1D6",
    borderColor: "#F1E1B9",
  },
  statusText: {
    color: COLORS.panel,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  statusTextSuccess: {
    color: COLORS.success,
  },
  statusTextWarning: {
    color: COLORS.warning,
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
