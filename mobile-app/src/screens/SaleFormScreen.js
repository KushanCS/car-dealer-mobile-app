import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import api from "../services/api";
import {
  Screen,
  Card,
  DatePickerField,
  InlineMessage,
  LoadingBlock,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "../ui/kit";
import { COLORS } from "../ui/theme";
import { getAuthToken, getRole, withAuth } from "../utils/session";

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "other"];

const formatVehicleTitle = (vehicle) =>
  [vehicle?.brand, vehicle?.model || vehicle?.type].filter(Boolean).join(" ");

export default function SaleFormScreen({ navigation, route }) {
  const mode = route?.params?.mode || "create";
  const saleId = route?.params?.saleId || null;

  const [role, setRole] = useState("user");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [vehicles, setVehicles] = useState([]);
  const [leads, setLeads] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("");

  const [price, setPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(""); // ISO
  const [paymentDetails, setPaymentDetails] = useState("");

  const canAccess = useMemo(() => role === "admin" || role === "staff", [role]);
  const isAdmin = useMemo(() => role === "admin", [role]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      setError("");
      const nextRole = await getRole();
      const nextToken = await getAuthToken();

      setRole(nextRole);
      setToken(nextToken);

      if (!nextToken) {
        setIsLoading(false);
        return;
      }

      const [vehiclesRes, leadsRes] = await Promise.all([
        api.get("/api/vehicles"),
        api.get("/api/leads"),
      ]);

      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
      setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : []);

      if (mode === "edit" && saleId) {
        const saleRes = await api.get(`/api/sales/${saleId}`, withAuth(nextToken));
        const sale = saleRes.data;

        setVehicleId(sale?.vehicle?._id || sale?.vehicle || "");
        setCustomerId(sale?.customer?._id || sale?.customer || "");
        setPrice(sale?.price !== undefined ? String(sale.price) : "");
        setPaidAmount(sale?.paid_amount !== undefined ? String(sale.paid_amount) : "0");
        setPaymentMethod(sale?.payment_method || "");
        setPaymentReference(sale?.payment_reference || "");
        setBankName(sale?.bank_name || "");
        setChequeNumber(sale?.cheque_number || "");
        setPaymentDate(sale?.payment_date ? new Date(sale.payment_date).toISOString() : "");
        setPaymentDetails(sale?.payment_details || "");
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load sale form");
    } finally {
      setIsLoading(false);
    }
  }, [mode, saleId]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const handleSubmit = useCallback(async () => {
    if (!canAccess) {
      Alert.alert("Not allowed", "Only staff/admin can record sales.");
      return;
    }

    if (!token) {
      navigation.navigate("Login");
      return;
    }

    if (mode === "create" && (!vehicleId || !customerId)) {
      Alert.alert("Missing info", "Select a vehicle and customer lead.");
      return;
    }

    if (!price.trim()) {
      Alert.alert("Missing info", "Sale price is required.");
      return;
    }

    const paid = Number(paidAmount || 0);
    const nextPayload = {
      price: Number(price),
      paid_amount: Number.isFinite(paid) ? paid : 0,
      payment_method: paid > 0 ? paymentMethod : "",
      payment_reference: paymentReference.trim(),
      bank_name: bankName.trim(),
      cheque_number: chequeNumber.trim(),
      payment_details: paymentDetails.trim(),
      payment_date: paid > 0 ? (paymentDate.trim() || new Date().toISOString()) : null,
    };

    try {
      setIsSubmitting(true);
      setError("");

      if (mode === "edit" && saleId) {
        await api.put(`/api/sales/${saleId}`, nextPayload, withAuth(token));
        Alert.alert("Saved", "Sale updated.");
      } else {
        await api.post(
          "/api/sales",
          {
            vehicle: vehicleId,
            customer: customerId,
            ...nextPayload,
          },
          withAuth(token)
        );
        Alert.alert("Saved", "Sale recorded.");
      }

      navigation.goBack();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to save sale");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    bankName,
    canAccess,
    chequeNumber,
    customerId,
    mode,
    navigation,
    paidAmount,
    paymentDate,
    paymentDetails,
    paymentMethod,
    paymentReference,
    price,
    saleId,
    token,
    vehicleId,
  ]);

  const handleDelete = useCallback(() => {
    if (!isAdmin) return;
    Alert.alert(
      "Delete Sale",
      "Are you sure you want to permanently delete this sale record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!token || !saleId) return;
              setIsSubmitting(true);
              await api.delete(`/api/sales/${saleId}`, withAuth(token));
              Alert.alert("Deleted", "Sale has been removed.");
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", err?.response?.data?.message || err?.message || "Failed to delete sale");
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  }, [isAdmin, token, saleId, navigation]);

  const selectedVehicle = useMemo(() => vehicles.find((v) => v._id === vehicleId), [vehicles, vehicleId]);
  const selectedCustomer = useMemo(() => leads.find((l) => l._id === customerId), [leads, customerId]);

  if (isLoading) {
    return <Screen><LoadingBlock text="Loading sale form..." /></Screen>;
  }

  if (!canAccess) {
    return (
      <Screen>
        <View style={styles.container}>
          <Card>
            <Text style={styles.blockTitle}>Staff-only</Text>
            <Text style={styles.blockText}>Login as staff/admin to record sales.</Text>
            <View style={styles.blockActions}>
              <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
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
              <PrimaryButton label="Go to login" onPress={() => navigation.navigate("Login")} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>{mode === "edit" ? "Update Sale" : "Record Sale"}</Text>

          <InlineMessage tone="danger" text={error} />

          {mode === "create" ? (
            <>
              <Text style={styles.choiceLabel}>Vehicle</Text>
              <View style={styles.choiceRow}>
                {vehicles.map((vehicle) => (
                  <SecondaryButton
                    key={vehicle._id}
                    label={formatVehicleTitle(vehicle) || "Vehicle"}
                    onPress={() => setVehicleId(vehicle._id)}
                    disabled={isSubmitting}
                    style={[styles.choiceButton, vehicleId === vehicle._id ? styles.choiceActive : null]}
                  />
                ))}
              </View>

              <Text style={styles.choiceLabel}>Customer (Lead)</Text>
              <View style={styles.choiceRow}>
                {leads.map((lead) => (
                  <SecondaryButton
                    key={lead._id}
                    label={lead?.name || lead?.email || "Lead"}
                    onPress={() => setCustomerId(lead._id)}
                    disabled={isSubmitting}
                    style={[styles.choiceButton, customerId === lead._id ? styles.choiceActive : null]}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.lockedMeta}>
              <Text style={styles.lockedText}>Vehicle: {selectedVehicle ? formatVehicleTitle(selectedVehicle) : "—"}</Text>
              <Text style={styles.lockedText}>Customer: {selectedCustomer ? (selectedCustomer.name || selectedCustomer.email) : "—"}</Text>
            </View>
          )}

          <TextField label="Sale Price" value={price} onChangeText={setPrice} placeholder="3500000" keyboardType="numeric" editable={!isSubmitting} />
          <TextField label="Paid Amount" value={paidAmount} onChangeText={setPaidAmount} placeholder="0" keyboardType="numeric" editable={!isSubmitting} />

          <Text style={styles.choiceLabel}>Payment method</Text>
          <View style={styles.choiceRow}>
            {PAYMENT_METHODS.map((option) => (
              <SecondaryButton
                key={option}
                label={option}
                onPress={() => setPaymentMethod(option)}
                disabled={isSubmitting}
                style={[styles.choiceButton, paymentMethod === option ? styles.choiceActive : null]}
              />
            ))}
          </View>

          <TextField label="Payment Reference" value={paymentReference} onChangeText={setPaymentReference} placeholder="Optional" editable={!isSubmitting} />
          <TextField label="Bank Name" value={bankName} onChangeText={setBankName} placeholder="Optional" editable={!isSubmitting} />
          <TextField label="Cheque Number" value={chequeNumber} onChangeText={setChequeNumber} placeholder="Optional" editable={!isSubmitting} keyboardType="numeric" />
          <DatePickerField label="Payment Date" value={paymentDate} onChange={setPaymentDate} placeholder="Select payment date" editable={!isSubmitting} />
          <TextField label="Payment Details" value={paymentDetails} onChangeText={setPaymentDetails} placeholder="Optional notes" editable={!isSubmitting} />

          {mode === "edit" ? (
            <View style={styles.actionsRow}>
              <PrimaryButton label={isSubmitting ? "Saving..." : "Save"} onPress={handleSubmit} disabled={isSubmitting} style={{ flex: 1 }} />
              {isAdmin && (
                <SecondaryButton 
                  label="Delete" 
                  onPress={handleDelete} 
                  disabled={isSubmitting} 
                  style={[styles.deleteButton, { flex: 1 }]} 
                />
              )}
            </View>
          ) : (
            <PrimaryButton label={isSubmitting ? "Saving..." : "Save"} onPress={handleSubmit} disabled={isSubmitting} />
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
  choiceRow: {
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
  lockedMeta: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lockedText: {
    color: COLORS.textMuted,
    fontSize: 12,
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  deleteButton: {
    borderColor: "#F0BAC3",
    backgroundColor: "#FCE4E8",
  },
});
