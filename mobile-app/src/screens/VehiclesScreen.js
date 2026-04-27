import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import api from "../services/api";
import { Screen, Card, LoadingBlock, PrimaryButton, SectionHeader, SearchField, StatusBadge } from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole } from "../utils/session";
import { formatCurrency, formatVehicleTitle } from "../utils/formatters";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;

export default function VehiclesScreen({ navigation }) {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("user");
  const [viewerImage, setViewerImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadVehicles = useCallback(async ({ refreshing = false } = {}) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      setError("");
      const response = await api.get("/api/vehicles");
      setVehicles(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load vehicles");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v => 
      v.brand?.toLowerCase().includes(q) || 
      v.model?.toLowerCase().includes(q) || 
      v.type?.toLowerCase().includes(q)
    );
  }, [vehicles, searchQuery]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const nextRole = await getRole();
        if (isMounted) setRole(nextRole);
      } finally {
        loadVehicles();
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loadVehicles]);

  const canManageInventory = useMemo(() => role === "admin", [role]);

  const handleAddVehicle = useCallback(async () => {
    if (!canManageInventory) return;

    const token = await getAuthToken();
    if (!token) {
      navigation.navigate("Login");
      return;
    }

    navigation.navigate("VehicleForm", { mode: "create" });
  }, [canManageInventory, navigation]);

  const renderItem = ({ item }) => {
    const status = String(item?.status || "available");
    const images = item?.images || [];

    return (
      <View style={styles.cardContainer}>
        <Card style={styles.feedCard}>
          <View style={styles.carouselContainer}>
            {images.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.carouselScroll}
              >
                {images.map((img, idx) => (
                  <Pressable key={idx} onPress={() => setViewerImage(img.url)}>
                    <Image 
                      source={{ uri: img.url }} 
                      style={styles.carouselImage} 
                      contentFit="cover" 
                      transition={300}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noImageContainer}>
                <MaterialCommunityIcons name="car-off" size={40} color={COLORS.textMuted} />
              </View>
            )}

            {images.length > 1 && (
              <View style={styles.imageCountBadge}>
                <MaterialCommunityIcons name="image-multiple" size={12} color="#FFF" />
                <Text style={styles.imageCountText}>{images.length}</Text>
              </View>
            )}
            <View style={styles.feedStatusBadge}>
              <StatusBadge status={status} label={status} />
            </View>
          </View>
          
          <Pressable
            onPress={() => navigation.navigate("VehicleDetail", { vehicleId: item._id })}
            style={styles.feedContent}>
            <View style={styles.feedHeaderRow}>
              <Text style={styles.feedTitle} numberOfLines={1}>
                {formatVehicleTitle(item) || "Vehicle"}
              </Text>
              <Text style={styles.feedPrice}>
                {item?.price ? formatCurrency(item.price) : ""}
              </Text>
            </View>
            
            <View style={styles.feedSpecsRow}>
              <Text style={styles.feedSubtitle}>
                {item?.type || "Type"} • {item?.year || "Year"} • {item?.transmission || "Auto"}
              </Text>
            </View>
          </Pressable>
        </Card>
      </View>
    );
  };

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading inventory..." /></Screen>;
  }

  return (
    <Screen>
      <View style={styles.container}>
        <SectionHeader
          title="Vehicles"
          subtitle="Manage dealership inventory"
          right={
            canManageInventory ? (
              <PrimaryButton label="Add" onPress={handleAddVehicle} />
            ) : null
          }
        />

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search brand, model, or type..."
          style={styles.searchField}
        />

        <FlatList
          data={filteredVehicles}
          keyExtractor={(item) => String(item?._id || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadVehicles({ refreshing: true })}
              tintColor={COLORS.panel}
            />
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="car-search" size={48} color={COLORS.textSubtle} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>{searchQuery ? "No results found" : "No vehicles"}</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? `We couldn't find any vehicles matching "${searchQuery}"`
                  : "Add inventory in the backend to see it here."}
              </Text>
            </Card>
          }
        />

        <Modal visible={!!viewerImage} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalCloseArea} onPress={() => setViewerImage(null)} />
            <View style={styles.modalContent}>
              <Image source={{ uri: viewerImage }} style={styles.fullScreenImage} contentFit="contain" transition={200} />
            </View>
            <Pressable style={styles.modalCloseButton} onPress={() => setViewerImage(null)}>
              <MaterialCommunityIcons name="close" size={28} color="#FFF" />
            </Pressable>
          </View>
        </Modal>
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
    gap: 16,
  },
  cardContainer: {
    borderRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  feedCard: {
    padding: 0,
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(217, 227, 236, 0.6)",
  },
  carouselContainer: {
    position: "relative",
    width: "100%",
    height: 220,
    backgroundColor: COLORS.surfaceMuted,
  },
  carouselScroll: {
    flex: 1,
  },
  carouselImage: {
    width: CARD_WIDTH,
    height: 220,
  },
  noImageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  feedStatusBadge: {
    position: "absolute",
    top: 12,
    left: 12,
  },
  imageCountBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  imageCountText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  searchField: {
    marginBottom: 20,
  },
  feedContent: {
    padding: 18,
    backgroundColor: COLORS.surface,
  },
  feedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  feedTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  feedPrice: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: "900",
  },
  feedSpecsRow: {
    marginTop: 6,
  },
  feedSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 16,
    color: COLORS.text,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  errorCard: {
    backgroundColor: "#FFF8EA",
    borderColor: "#F1E1B9",
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: "100%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },
  modalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
