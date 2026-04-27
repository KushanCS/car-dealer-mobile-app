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
import { Screen, Card, LoadingBlock, PrimaryButton, SecondaryButton, SectionHeader, SearchField, StatusBadge } from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getRole } from "../utils/session";

export default function LeadsScreen({ navigation }) {
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("user");

  const canManage = useMemo(() => role === "admin" || role === "staff", [role]);

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase().trim();
    return leads.filter((lead) => {
      return (
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.source?.toLowerCase().includes(query)
      );
    });
  }, [leads, searchQuery]);

  const loadLeads = useCallback(async ({ refreshing = false } = {}) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      setError("");
      const response = await api.get("/api/leads");
      setLeads(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load leads");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const nextRole = await getRole();
      if (mounted) setRole(nextRole);
      await loadLeads();
    })();

    return () => {
      mounted = false;
    };
  }, [loadLeads]);

  const renderItem = ({ item }) => (
    <Pressable
      onPress={() => navigation.navigate("LeadForm", { mode: "edit", leadId: item._id })}
      style={styles.rowPressable}>
      <Card style={styles.rowCard}>
        <View style={styles.rowTop}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name="account" size={20} color={COLORS.panel} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item?.name || "Lead"}</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {[item?.email, item?.contact_number].filter(Boolean).join(" • ") || "No contact info"}
            </Text>
          </View>
          {item?.source && (
            <StatusBadge label={item.source} status="muted" />
          )}
        </View>
      </Card>
    </Pressable>
  );

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.emptyTitle}>Leads are staff-only</Text>
            <Text style={styles.emptyText}>Login as staff or admin to manage lead records.</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading leads..." /></Screen>;
  }

  return (
    <Screen>
      <View style={styles.container}>
        <SectionHeader
          title="Leads"
          subtitle="Customer enquiries and contact records"
          right={<PrimaryButton label="Add" onPress={() => navigation.navigate("LeadForm", { mode: "create" })} />}
        />

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, email or source..."
          style={styles.searchField}
        />

        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadLeads({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons 
                name="account-search" 
                size={40} 
                color={COLORS.textSubtle} 
                style={styles.emptyIcon} 
              />
              <Text style={styles.emptyTitle}>No leads found</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? "Try adjusting your search query." : "Use “Add” to capture new enquiries."}
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
    fontSize: 16,
    fontWeight: "800",
  },
  rowSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  rowActions: {
    marginTop: 12,
  },
  searchField: {
    marginBottom: 16,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 15,
    color: COLORS.text,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
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
