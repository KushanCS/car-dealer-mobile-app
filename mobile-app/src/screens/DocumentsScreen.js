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
import {
  Card,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  Screen,
  SectionHeader,
  SecondaryButton,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const DOC_TYPES = [
  "RC_BOOK",
  "INSURANCE",
  "TRANSFER_FORM",
  "EMISSION",
  "SERVICE_BOOK",
  "OTHER",
];

const STATUS_TYPES = ["AVAILABLE", "IN_USE", "MISSING", "ARCHIVED"];

const formatDocType = (value) => String(value || "").replaceAll("_", " ");

const formatVehicleTitle = (vehicle) =>
  [vehicle?.brand, vehicle?.model || vehicle?.type].filter(Boolean).join(" ");

export default function DocumentsScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canView = useMemo(() => role === "admin" || role === "staff", [role]);
  const canDelete = useMemo(() => role === "admin", [role]);

  const bootstrap = useCallback(async () => {
    const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
    setRole(nextRole);
    setToken(nextToken);
  }, []);

  const loadDocuments = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        setError("");

        const nextToken = token || (await getAuthToken());
        if (!nextToken) {
          setDocuments([]);
          setError("Login required to view documents.");
          return;
        }

        const response = await api.get("/api/documents", withAuth(nextToken));
        setDocuments(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load documents"
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
        if (isMounted) {
          loadDocuments();
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [bootstrap, loadDocuments]);

  const handleAdd = useCallback(() => {
    if (!canView) {
      Alert.alert("Not allowed", "Only staff/admin can manage documents.");
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    navigation.navigate("DocumentForm", {
      mode: "create",
      docTypes: DOC_TYPES,
      statusTypes: STATUS_TYPES,
    });
  }, [canView, navigation, token]);

  const handleOpen = useCallback(
    (doc) => {
      if (!canView) return;

      navigation.navigate("DocumentForm", {
        mode: "edit",
        docId: doc?._id,
        doc,
        docTypes: DOC_TYPES,
        statusTypes: STATUS_TYPES,
      });
    },
    [canView, navigation]
  );

  const renderItem = ({ item }) => {
    const status = String(item?.status || "AVAILABLE");
    const vehicleTitle =
      item?.vehicle && typeof item.vehicle === "object"
        ? formatVehicleTitle(item.vehicle)
        : "";

    return (
      <Pressable onPress={() => handleOpen(item)} style={styles.rowPressable}>
        <Card style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={20}
                color={COLORS.panel}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item?.title || "Document"}</Text>
              <Text style={styles.rowSubtitle}>
                {formatDocType(item?.docType) || "Document"}
                {item?.referenceNo ? ` • ${item.referenceNo}` : ""}
              </Text>
              {vehicleTitle ? (
                <Text style={styles.rowMeta}>Vehicle: {vehicleTitle}</Text>
              ) : null}
              <Text style={styles.rowMeta}>Location: {item?.location || "Not set"}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <Screen>
        <LoadingBlock text="Loading documents..." />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Staff-only</Text>
            <Text style={styles.blockText}>
              Document tracking is only available for staff/admin accounts.
            </Text>
            <View style={styles.blockActions}>
              <PrimaryButton
                label="Back"
                onPress={() => navigation.goBack()}
              />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <SectionHeader
          title="Documents"
          subtitle="Track physical paperwork and records"
          right={<PrimaryButton label="Add" onPress={handleAdd} />}
        />

        <InlineMessage tone={error ? "danger" : "muted"} text={error} />

        <FlatList
          data={documents}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadDocuments({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>No documents</Text>
              <Text style={styles.emptyText}>
                Add a physical document record to keep track of files.
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
    fontSize: 16,
    fontWeight: "800",
  },
  rowSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  rowMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
  },
  statusText: {
    color: COLORS.panel,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
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
