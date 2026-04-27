import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
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

const roleLabel = (role) => {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "User";
};

export default function AdminUsersScreen({ navigation }) {
  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canManage = useMemo(() => role === "admin", [role]);

  const bootstrap = useCallback(async () => {
    const [nextRole, nextToken] = await Promise.all([getRole(), getAuthToken()]);
    setRole(nextRole);
    setToken(nextToken);
  }, []);

  const loadUsers = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        setError("");

        const nextToken = token || (await getAuthToken());
        if (!nextToken) {
          setUsers([]);
          setError("Login required.");
          return;
        }

        const response = await api.get("/api/admin/users", withAuth(nextToken));
        const list = Array.isArray(response.data) ? response.data : [];
        const filtered = list.filter((u) => {
          const name = String(u.name || "").trim().toLowerCase();
          return name !== "system admin";
        });
        setUsers(filtered);
      } catch (err) {
        setError(
          err?.response?.data?.message || err?.message || "Failed to load users"
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          await bootstrap();
        } finally {
          if (isMounted) {
            loadUsers({ refreshing: true });
          }
        }
      })();

      return () => {
        isMounted = false;
      };
    }, [bootstrap, loadUsers])
  );

  const handleAdd = useCallback(() => {
    if (!canManage) {
      Alert.alert("Not allowed", "Only admins can manage users.");
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    navigation.navigate("AdminUserForm", { mode: "create" });
  }, [canManage, navigation, token]);

  const handleOpen = useCallback(
    (user) => {
      if (!canManage) return;
      navigation.navigate("AdminUserForm", {
        mode: "edit",
        userId: user?._id,
        user,
      });
    },
    [canManage, navigation]
  );

  const renderItem = ({ item }) => {
    const isDeleted = Boolean(item?.isDeleted);
    const badgeText = isDeleted ? "Disabled" : roleLabel(item?.role);

    return (
      <Pressable onPress={() => handleOpen(item)} style={styles.rowPressable}>
        <Card style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons
                name={item?.role === "staff" ? "account-tie" : "account"}
                size={20}
                color={COLORS.panel}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item?.name || "User"}</Text>
              <Text style={styles.rowSubtitle}>{item?.email || ""}</Text>
            </View>
            <View
              style={[
                styles.badge,
                isDeleted ? styles.badgeDeleted : styles.badgeActive,
              ]}>
              <Text
                style={[
                  styles.badgeText,
                  isDeleted ? styles.badgeTextDeleted : styles.badgeTextActive,
                ]}>
                {badgeText}
              </Text>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <Screen>
        <LoadingBlock text="Loading users..." />
      </Screen>
    );
  }

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Admin-only</Text>
            <Text style={styles.blockText}>
              User management is available only for admin accounts.
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
        <SectionHeader
          title="Users"
          subtitle="Manage administrative accounts"
          right={<PrimaryButton label="Add" onPress={handleAdd} />}
        />

        <InlineMessage tone={error ? "danger" : "muted"} text={error} />

        <FlatList
          data={users}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadUsers({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>No users</Text>
              <Text style={styles.emptyText}>
                Create staff/user accounts to manage access.
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
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: "rgba(151,198,11,0.45)",
  },
  badgeTextActive: {
    color: COLORS.success,
  },
  badgeDeleted: {
    backgroundColor: "#FCE4E8",
    borderColor: "#F0BAC3",
  },
  badgeTextDeleted: {
    color: COLORS.danger,
  },
  badgeText: {
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
