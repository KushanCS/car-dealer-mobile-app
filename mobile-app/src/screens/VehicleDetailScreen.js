import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import api from "../services/api";
import { Screen, Card, LoadingBlock, PrimaryButton, SecondaryButton } from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const formatVehicleTitle = (vehicle) =>
  [vehicle?.brand, vehicle?.model || vehicle?.type].filter(Boolean).join(" ");

const normalizeImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base = String(api.defaults.baseURL || "").replace(/\/$/, "");
  const path = String(url).startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
};

export default function VehicleDetailScreen({ navigation, route }) {
  const vehicleId = route?.params?.vehicleId;

  const [vehicle, setVehicle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("user");

  const canEdit = useMemo(() => role === "admin", [role]);

  const loadVehicle = useCallback(async () => {
    try {
      setError("");
      setIsLoading(true);
      const response = await api.get(`/api/vehicles/${vehicleId}`);
      setVehicle(response.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load vehicle");
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const nextRole = await getRole();
      if (isMounted) setRole(nextRole);
      await loadVehicle();
    })();

    return () => {
      isMounted = false;
    };
  }, [loadVehicle]);

  const handleEdit = useCallback(async () => {
    if (!canEdit) return;

    const token = await getAuthToken();
    if (!token) {
      navigation.navigate("Login");
      return;
    }

    navigation.navigate("VehicleForm", { mode: "edit", vehicleId });
  }, [canEdit, navigation, vehicleId]);

  const handleDelete = useCallback(() => {
    if (!canEdit) return;

    Alert.alert(
      "Delete Vehicle",
      "Are you sure you want to permanently delete this vehicle?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) {
                navigation.navigate("Login");
                return;
              }
              await api.delete(`/api/vehicles/${vehicleId}`, withAuth(token));
              navigation.goBack();
            } catch (err) {
              Alert.alert(
                "Error",
                err?.response?.data?.message || err?.message || "Failed to delete vehicle"
              );
            }
          },
        },
      ]
    );
  }, [canEdit, navigation, vehicleId]);


  if (isLoading) {
    return <Screen><LoadingBlock text="Loading vehicle..." /></Screen>;
  }

  if (!vehicle || error) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.errorTitle}>Vehicle unavailable</Text>
            <Text style={styles.errorText}>{error || "Could not load this vehicle."}</Text>
            <View style={styles.errorActions}>
              <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
              <PrimaryButton label="Retry" onPress={loadVehicle} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  const images = Array.isArray(vehicle.images) ? vehicle.images : [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="car-sports" size={22} color={COLORS.panel} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{formatVehicleTitle(vehicle) || "Vehicle"}</Text>
              <Text style={styles.subtitle}>
                {vehicle.type || "Type"} • {vehicle.year || "Year"} • {String(vehicle.status || "available")}
              </Text>
            </View>
          </View>

          {vehicle.price ? (
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>LKR {Number(vehicle.price).toLocaleString()}</Text>
            </View>
          ) : null}

          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Fuel</Text>
              <Text style={styles.metaValue}>{vehicle.fuelType || "—"}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Transmission</Text>
              <Text style={styles.metaValue}>{vehicle.transmission || "—"}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Condition</Text>
              <Text style={styles.metaValue}>{vehicle.condition || "—"}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Mileage</Text>
              <Text style={styles.metaValue}>{vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} km` : "—"}</Text>
            </View>
          </View>

          {vehicle.details ? (
            <View style={styles.detailsBlock}>
              <Text style={styles.detailsLabel}>Details</Text>
              <Text style={styles.detailsText}>{vehicle.details}</Text>
            </View>
          ) : null}

          {images.length ? (
            <View style={styles.imagesWrap}>
              <Text style={styles.detailsLabel}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                {images.map((img) => (
                  <Pressable key={img.filename || img.url} style={styles.imageCard}>
                    <Image source={{ uri: normalizeImageUrl(img.url) }} style={styles.image} contentFit="cover" transition={300} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {canEdit ? (
            <View style={styles.actionsRow}>
              <PrimaryButton label="Edit vehicle" onPress={handleEdit} style={{ flex: 1 }} />
              <SecondaryButton label="Delete" onPress={handleDelete} style={[styles.deleteBtn, { flex: 1 }]} />
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.textMuted,
    marginTop: 4,
    fontSize: 12,
  },
  pricePill: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(151,198,11,0.35)",
  },
  priceText: {
    color: COLORS.success,
    fontWeight: "900",
  },
  metaGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaCell: {
    width: "48%",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  metaValue: {
    marginTop: 6,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  detailsBlock: {
    marginTop: 16,
  },
  detailsLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  detailsText: {
    marginTop: 8,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
  },
  imagesWrap: {
    marginTop: 18,
  },
  imagesRow: {
    paddingTop: 12,
    gap: 12,
    paddingBottom: 4,
  },
  imageCard: {
    width: 168,
    height: 112,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  actionsRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  deleteBtn: {
    borderColor: "rgba(178,75,94,0.35)",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },
  errorText: {
    marginTop: 8,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  errorActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
});
