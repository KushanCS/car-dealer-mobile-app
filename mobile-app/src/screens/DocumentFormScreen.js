import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import api from "../services/api";
import {
  Card,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextField,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const formatVehicleTitle = (vehicle) =>
  [vehicle?.brand, vehicle?.model || vehicle?.type].filter(Boolean).join(" ");

export default function DocumentFormScreen({ navigation, route }) {
  const mode = route?.params?.mode || "create";
  const docId = route?.params?.docId || "";
  const initialDoc = route?.params?.doc || null;
  const routeDocTypes = route?.params?.docTypes;
  const routeStatusTypes = route?.params?.statusTypes;
  const docTypes = useMemo(
    () => (Array.isArray(routeDocTypes) ? routeDocTypes : []),
    [routeDocTypes]
  );
  const statusTypes = useMemo(
    () => (Array.isArray(routeStatusTypes) ? routeStatusTypes : []),
    [routeStatusTypes]
  );

  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [vehicles, setVehicles] = useState([]);

  const [docType, setDocType] = useState(initialDoc?.docType || docTypes[0] || "OTHER");
  const [title, setTitle] = useState(initialDoc?.title || "");
  const [referenceNo, setReferenceNo] = useState(initialDoc?.referenceNo || "");
  const [vehicleId, setVehicleId] = useState(
    initialDoc?.vehicle && typeof initialDoc.vehicle === "object"
      ? initialDoc.vehicle?._id || ""
      : initialDoc?.vehicle || ""
  );
  const [status, setStatus] = useState(initialDoc?.status || statusTypes[0] || "AVAILABLE");
  const [location, setLocation] = useState(initialDoc?.location || "");
  const [notes, setNotes] = useState(initialDoc?.notes || "");

  const canManage = useMemo(() => role === "admin" || role === "staff", [role]);
  const canDelete = useMemo(() => role === "admin" && mode === "edit", [role, mode]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);

    try {
      setError("");
      const [nextRole, nextToken, vehiclesRes] = await Promise.all([
        getRole(),
        getAuthToken(),
        api.get("/api/vehicles"),
      ]);

      setRole(nextRole);
      setToken(nextToken);
      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);

      if (mode === "edit" && docId && !initialDoc && nextToken) {
        const response = await api.get(
          `/api/documents/${encodeURIComponent(docId)}`,
          withAuth(nextToken)
        );

        const doc = response.data;
        setDocType(doc?.docType || docTypes[0] || "OTHER");
        setTitle(doc?.title || "");
        setReferenceNo(doc?.referenceNo || "");
        setVehicleId(
          doc?.vehicle && typeof doc.vehicle === "object"
            ? doc.vehicle?._id || ""
            : doc?.vehicle || ""
        );
        setStatus(doc?.status || statusTypes[0] || "AVAILABLE");
        setLocation(doc?.location || "");
        setNotes(doc?.notes || "");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load document form"
      );
    } finally {
      setIsLoading(false);
    }
  }, [docId, docTypes, initialDoc, mode, statusTypes]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const handleSubmit = useCallback(async () => {
    if (!canManage) {
      Alert.alert("Not allowed", "Only staff/admin can manage documents.");
      return;
    }

    const nextToken = token || (await getAuthToken());
    if (!nextToken) {
      navigation.navigate("Login");
      return;
    }

    if (!title.trim() || !location.trim() || !docType) {
      Alert.alert("Missing info", "Document type, title, and location are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        docType,
        title: title.trim(),
        referenceNo: referenceNo.trim() || undefined,
        vehicle: vehicleId || undefined,
        status,
        location: location.trim(),
        notes: notes.trim() || undefined,
      };

      if (mode === "edit" && docId) {
        await api.put(
          `/api/documents/${encodeURIComponent(docId)}`,
          payload,
          withAuth(nextToken)
        );
        Alert.alert("Saved", "Document updated.");
      } else {
        await api.post("/api/documents", payload, withAuth(nextToken));
        Alert.alert("Saved", "Document created.");
      }

      navigation.goBack();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to save document"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [canManage, docId, docType, location, mode, navigation, notes, referenceNo, status, title, token, vehicleId]);

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;

    const nextToken = token || (await getAuthToken());
    if (!nextToken) {
      navigation.navigate("Login");
      return;
    }

    Alert.alert(
      "Delete document?",
      "This will permanently remove the document.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await api.delete(
                `/api/documents/${encodeURIComponent(docId)}`,
                withAuth(nextToken)
              );
              Alert.alert("Deleted", "Document removed.");
              navigation.goBack();
            } catch (err) {
              setError(
                err?.response?.data?.message ||
                  err?.message ||
                  "Failed to delete document"
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  }, [canDelete, docId, navigation, token]);

  if (isLoading) {
    return (
      <Screen>
        <LoadingBlock text="Loading document form..." />
      </Screen>
    );
  }

  if (!canManage) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Staff-only</Text>
            <Text style={styles.blockText}>
              Login as staff/admin to manage physical documents.
            </Text>
            <View style={styles.blockActions}>
              <PrimaryButton label="Back" onPress={() => navigation.goBack()} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!token) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Login required</Text>
            <Text style={styles.blockText}>Please login to continue.</Text>
            <View style={styles.blockActions}>
              <PrimaryButton
                label="Go to login"
                onPress={() => navigation.navigate("Login")}
              />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>
            {mode === "edit" ? "Edit Document" : "Add Document"}
          </Text>

          <InlineMessage tone="danger" text={error} />

          <Text style={styles.choiceLabel}>Document type</Text>
          <View style={styles.choiceWrap}>
            {(docTypes.length ? docTypes : ["OTHER"]).map((type) => (
              <SecondaryButton
                key={type}
                label={String(type).replaceAll("_", " ")}
                onPress={() => setDocType(type)}
                disabled={isSubmitting}
                style={[
                  styles.choiceButton,
                  docType === type ? styles.choiceActive : null,
                ]}
              />
            ))}
          </View>

          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="RC Book for Civic"
            editable={!isSubmitting}
          />

          <TextField
            label="Reference number (optional)"
            value={referenceNo}
            onChangeText={setReferenceNo}
            placeholder="ABC-123"
            editable={!isSubmitting}
          />

          <Text style={styles.choiceLabel}>Vehicle (optional)</Text>
          <View style={styles.choiceWrap}>
            <SecondaryButton
              label="None"
              onPress={() => setVehicleId("")}
              disabled={isSubmitting}
              style={[
                styles.choiceButton,
                !vehicleId ? styles.choiceActive : null,
              ]}
            />
            {vehicles.map((vehicle) => (
              <SecondaryButton
                key={vehicle._id}
                label={formatVehicleTitle(vehicle) || "Vehicle"}
                onPress={() => setVehicleId(vehicle._id)}
                disabled={isSubmitting}
                style={[
                  styles.choiceButton,
                  vehicleId === vehicle._id ? styles.choiceActive : null,
                ]}
              />
            ))}
          </View>

          <Text style={styles.choiceLabel}>Status</Text>
          <View style={styles.choiceWrap}>
            {(statusTypes.length ? statusTypes : ["AVAILABLE"]).map((value) => (
              <SecondaryButton
                key={value}
                label={String(value).replaceAll("_", " ")}
                onPress={() => setStatus(value)}
                disabled={isSubmitting}
                style={[
                  styles.choiceButton,
                  status === value ? styles.choiceActive : null,
                ]}
              />
            ))}
          </View>

          <TextField
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Main cabinet"
            editable={!isSubmitting}
          />

          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any handling notes"
            editable={!isSubmitting}
          />

          {canDelete ? (
            <View style={styles.actionsRow}>
              <PrimaryButton
                label={isSubmitting ? "Saving..." : "Save"}
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                label={isSubmitting ? "..." : "Delete"}
                onPress={handleDelete}
                disabled={isSubmitting}
                style={[styles.dangerButton, { flex: 1 }]}
              />
            </View>
          ) : (
            <PrimaryButton
              label={isSubmitting ? "Saving..." : "Save"}
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={{ marginTop: 16 }}
            />
          )}
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
  choiceLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 6,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  choiceButton: {
    flexGrow: 1,
  },
  choiceActive: {
    borderColor: "rgba(151,198,11,0.45)",
    backgroundColor: COLORS.accentSoft,
  },
  dangerButton: {
    borderColor: "#F0BAC3",
    backgroundColor: "#FCE4E8",
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
});
