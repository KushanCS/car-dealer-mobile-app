import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import api from "../services/api";
import {
  Screen,
  Card,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  TextField,
  SelectField,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const STATUS_OPTIONS = ["available", "reserved", "sold"];
const TYPE_OPTIONS = ["SUV", "Sedan", "Hatchback", "Truck", "Van", "Coupe"];
const FUEL_OPTIONS = ["Petrol", "Diesel", "Hybrid", "Electric", "Other"];
const TRANSMISSION_OPTIONS = ["Automatic", "Manual"];
const CONDITION_OPTIONS = ["Brand New", "Used (Registered)", "Reconditioned"];

export default function VehicleFormScreen({ navigation, route }) {
  const mode = route?.params?.mode || "create";
  const vehicleId = route?.params?.vehicleId || null;

  const [role, setRole] = useState("user");
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({
    brand: "",
    model: "",
    type: "",
    condition: "",
    fuelType: "",
    transmission: "",
    year: "",
    price: "",
  });

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState("");
  const [condition, setCondition] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [transmission, setTransmission] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState("available");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [details, setDetails] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);

  const canManage = useMemo(() => role === "admin", [role]);

  const loadExisting = useCallback(async () => {
    if (mode !== "edit" || !vehicleId) return;

    try {
      setError("");
      setIsLoading(true);
      const response = await api.get(`/api/vehicles/${vehicleId}`);
      const vehicle = response.data;

      setBrand(vehicle?.brand || "");
      setModel(vehicle?.model || "");
      setType(vehicle?.type || "");
      setCondition(vehicle?.condition || "");
      setFuelType(vehicle?.fuelType || "");
      setTransmission(vehicle?.transmission || "");
      setYear(vehicle?.year ? String(vehicle.year) : "");
      setMileage(vehicle?.mileage !== null && vehicle?.mileage !== undefined ? String(vehicle.mileage) : "");
      setPrice(vehicle?.price ? String(vehicle.price) : "");
      setStatus(vehicle?.status || "available");
      setVehicleNumber(vehicle?.vehicleNumber || "");
      setDetails(vehicle?.details || "");
      setExistingImages(Array.isArray(vehicle?.images) ? vehicle.images : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load vehicle");
    } finally {
      setIsLoading(false);
    }
  }, [mode, vehicleId]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const nextRole = await getRole();
      if (isMounted) setRole(nextRole);
      await loadExisting();
    })();

    return () => {
      isMounted = false;
    };
  }, [loadExisting]);

  const maxNewImages = useMemo(() => {
    const existingCount = mode === "edit" ? existingImages.length : 0;
    const remaining = 4 - existingCount;
    return remaining > 0 ? remaining : 0;
  }, [existingImages.length, mode]);

  const handlePickImages = useCallback(async () => {
    if (!canManage) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant camera roll permissions.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: maxNewImages,
        quality: 0.8,
      });

      if (!result.canceled) {
        setNewImages((prev) => [...prev, ...result.assets].slice(0, 4));
      }
    } catch (err) {
      console.warn("Image picker error:", err);
    }
  }, [canManage, maxNewImages]);

  const handleDeleteExistingImage = useCallback(async (image) => {
    if (!canManage || isSubmitting) return;

    Alert.alert(
      "Remove Photo",
      "Are you sure you want to remove this photo? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const token = await getAuthToken();
              const filename = image.filename || image.url?.split("/").pop();
              await api.delete(`/api/vehicles/${vehicleId}/images/${filename}`, withAuth(token));
              
              setExistingImages((prev) => prev.filter((img) => img !== image));
            } catch (err) {
              Alert.alert(
                "Error",
                err?.response?.data?.message || err?.message || "Failed to remove photo"
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  }, [canManage, isSubmitting, vehicleId]);

  const handleSubmit = useCallback(async () => {
    if (!canManage) {
      Alert.alert("Not allowed", "Only admins can manage inventory.");
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      navigation.navigate("Login");
      return;
    }

    const cleanBrand = brand.trim();
    const cleanModel = model.trim();
    const cleanType = type.trim();

    // Validation
    const newErrors = {
      brand: !cleanBrand ? "Brand is required" : "",
      model: !cleanModel ? "Model is required" : "",
      type: !cleanType ? "Type is required" : "",
      year: !year.trim() ? "Year is required" : isNaN(Number(year)) ? "Year must be a number" : "",
      price: !price.trim() ? "Price is required" : isNaN(Number(price)) ? "Price must be a number" : "",
    };

    setErrors((prev) => ({ ...prev, ...newErrors }));

    const hasErrors = Object.values(newErrors).some((err) => err !== "");
    if (hasErrors) {
      return;
    }

    const formData = new FormData();
    formData.append("brand", cleanBrand);
    formData.append("model", cleanModel);
    formData.append("type", cleanType);
    formData.append("condition", condition.trim());
    formData.append("fuelType", fuelType.trim());
    formData.append("transmission", transmission.trim());
    formData.append("year", String(Number(year)));
    formData.append("mileage", mileage.trim() ? String(Number(mileage)) : "");
    formData.append("price", String(Number(price)));
    formData.append("status", status);
    formData.append("vehicleNumber", vehicleNumber.trim());
    formData.append("details", details.trim());

    newImages.forEach((imageAsset, index) => {
      const imageUri = imageAsset?.uri;
      if (!imageUri) return;

      const extension = (imageUri.split(".").pop() || "jpg").toLowerCase();
      const imageType = imageAsset?.mimeType || `image/${extension === "jpg" ? "jpeg" : extension}`;

      formData.append("images", {
        uri: imageUri,
        name: `vehicle_${Date.now()}_${index}.${extension}`,
        type: imageType,
      });
    });

    try {
      setIsSubmitting(true);
      setError("");

      if (mode === "edit" && vehicleId) {
        await api.put(`/api/vehicles/${vehicleId}`, formData, {
          ...withAuth(token),
        });
        Alert.alert("Saved", "Vehicle updated.");
      } else {
        await api.post("/api/vehicles", formData, {
          ...withAuth(token),
        });
        Alert.alert("Saved", "Vehicle created.");
      }

      navigation.goBack();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors[0] : null) ||
        err?.message ||
        "Failed to save vehicle";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canManage,
    navigation,
    mode,
    vehicleId,
    brand,
    model,
    type,
    condition,
    fuelType,
    transmission,
    year,
    mileage,
    price,
    status,
    vehicleNumber,
    details,
    newImages,
  ]);

  const handleUpdateField = (setter, field) => (value) => {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Admin only</Text>
            <Text style={styles.blockText}>Vehicle creation and updates require an admin account.</Text>
            <View style={styles.blockActions}>
              <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading form..." /></Screen>;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>{mode === "edit" ? "Edit Vehicle" : "Add Vehicle"}</Text>

          <InlineMessage tone={"danger"} text={error} />

          <TextField
            label="Brand"
            value={brand}
            onChangeText={handleUpdateField(setBrand, "brand")}
            placeholder="Toyota"
            editable={!isSubmitting}
            error={errors.brand}
          />
          <TextField
            label="Model"
            value={model}
            onChangeText={handleUpdateField(setModel, "model")}
            placeholder="Aqua"
            editable={!isSubmitting}
            error={errors.model}
          />
          <SelectField
            label="Type"
            value={type}
            onChange={handleUpdateField(setType, "type")}
            options={TYPE_OPTIONS}
            placeholder="Select type"
            editable={!isSubmitting}
            error={errors.type}
          />
          <SelectField
            label="Condition"
            value={condition}
            onChange={handleUpdateField(setCondition, "condition")}
            options={CONDITION_OPTIONS}
            placeholder="Select condition"
            editable={!isSubmitting}
            error={errors.condition}
          />
          <SelectField
            label="Fuel"
            value={fuelType}
            onChange={handleUpdateField(setFuelType, "fuelType")}
            options={FUEL_OPTIONS}
            placeholder="Select fuel"
            editable={!isSubmitting}
            error={errors.fuelType}
          />
          <SelectField
            label="Transmission"
            value={transmission}
            onChange={handleUpdateField(setTransmission, "transmission")}
            options={TRANSMISSION_OPTIONS}
            placeholder="Select transmission"
            editable={!isSubmitting}
            error={errors.transmission}
          />
          <TextField
            label="Year"
            value={year}
            onChangeText={handleUpdateField(setYear, "year")}
            placeholder="2021"
            keyboardType="numeric"
            editable={!isSubmitting}
            error={errors.year}
          />
          <TextField
            label="Mileage (km)"
            value={mileage}
            onChangeText={setMileage}
            placeholder="55000"
            keyboardType="numeric"
            editable={!isSubmitting}
          />
          <TextField
            label="Price (LKR)"
            value={price}
            onChangeText={handleUpdateField(setPrice, "price")}
            placeholder="3500000"
            keyboardType="numeric"
            editable={!isSubmitting}
            error={errors.price}
          />

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={styles.statusButtons}>
              {STATUS_OPTIONS.map((option) => (
                <SecondaryButton
                  key={option}
                  label={option}
                  onPress={() => setStatus(option)}
                  disabled={isSubmitting}
                  style={[styles.statusButton, status === option ? styles.statusButtonActive : null]}
                />
              ))}
            </View>
          </View>

          <TextField label="Vehicle Number" value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="ABC-1234" editable={!isSubmitting} />
          <TextField label="Details" value={details} onChangeText={setDetails} placeholder="Optional notes" editable={!isSubmitting} />

          <View style={styles.photosSection}>
            <Text style={styles.statusLabel}>Photos</Text>
            <Text style={styles.photoHint}>Up to 4 images. Existing: {existingImages.length}.</Text>
            
            {existingImages.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                {existingImages.map((image) => (
                  <View key={image.filename || image.url} style={styles.photoPreviewContainer}>
                    <Image source={{ uri: image.url }} style={styles.photoPreview} />
                    <Pressable
                      style={styles.photoRemoveBtn}
                      onPress={() => handleDeleteExistingImage(image)}>
                      <MaterialCommunityIcons name="close" size={14} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <SecondaryButton
              label={maxNewImages > 0 ? "Add photos from phone" : "Max photos reached"}
              onPress={handlePickImages}
              disabled={isSubmitting || maxNewImages <= 0}
            />

            {newImages.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                {newImages.map((image) => (
                  <View key={image.assetId || image.uri} style={styles.photoPreviewContainer}>
                    <Image source={{ uri: image.uri }} style={styles.photoPreview} />
                    <Pressable
                      style={styles.photoRemoveBtn}
                      onPress={() => setNewImages((prev) => prev.filter((img) => img !== image))}>
                      <MaterialCommunityIcons name="close" size={14} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <PrimaryButton
            label={isSubmitting ? "Saving..." : "Save"}
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{ marginTop: 8 }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  statusRow: {
    marginTop: 4,
    marginBottom: 12,
  },
  statusLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statusButton: {
    flexGrow: 1,
  },
  statusButtonActive: {
    borderColor: "rgba(151,198,11,0.45)",
    backgroundColor: COLORS.accentSoft,
  },
  photosSection: {
    marginTop: 4,
    marginBottom: 12,
    gap: 10,
  },
  photoHint: {
    marginTop: -2,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  photoRow: {
    gap: 10,
    paddingTop: 8,
  },
  photoPreviewContainer: {
    position: "relative",
  },
  photoPreview: {
    width: 96,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
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
