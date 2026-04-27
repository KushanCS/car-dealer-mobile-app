import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, RADIUS, SPACING } from "./theme";

export function Screen({ children, style, edges = ["top"] }) {
  return (
    <SafeAreaView style={[styles.safeArea, style]} edges={edges}>
      <View pointerEvents="none" style={styles.screenAuraOne} />
      <View pointerEvents="none" style={styles.screenAuraTwo} />
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, subtitle, right }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.sectionRight}>{right}</View> : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled = false, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}>
      <Text style={styles.primaryButtonText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled = false, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}>
      <Text style={styles.secondaryButtonText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType, editable = true, error, ...props }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, error && styles.fieldLabelError]}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input, 
          !editable && styles.inputDisabled, 
          error && styles.inputError,
          isFocused && styles.inputFocused
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={"#8FA1B4"}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize="none"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder = "Search...", style }) {
  return (
    <View style={[styles.searchWrap, style]}>
      <Ionicons name="search" size={20} color={COLORS.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSubtle}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

export function StatusBadge({ label, status }) {
  const tone = React.useMemo(() => {
    switch (String(status || "").toLowerCase()) {
      case "available":
      case "completed":
      case "success":
      case "sent":
        return styles.badgeSuccess;
      case "reserved":
      case "pending":
      case "scheduled":
        return styles.badgeWarning;
      case "sold":
      case "cancelled":
      case "failed":
        return styles.badgeDanger;
      default:
        return styles.badgeMuted;
    }
  }, [status]);

  return (
    <View style={[styles.badge, tone]}>
      <Text style={[styles.badgeText, { color: tone.color }]}>{label || status}</Text>
    </View>
  );
}

export function IconButton({ icon, onPress, color = COLORS.panel, size = 24, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.buttonPressed,
        style
      ]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const formatDateValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildFutureDateOptions = (days = 366) => {
  const options = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const value = formatDateValue(date);
    const label = new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
    options.push({ value, label });
  }

  return options;
};

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  editable = true,
  error,
}) {
  const [showPicker, setShowPicker] = React.useState(false);
  const options = React.useMemo(() => buildFutureDateOptions(366), []);
  const todayValue = React.useMemo(() => options[0]?.value || formatDateValue(new Date()), [options]);

  const handleSelect = (nextValue) => {
    if (String(nextValue) < String(todayValue)) return;
    onChange(nextValue);
    setShowPicker(false);
  };

  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, error && styles.fieldLabelError]}>{label}</Text> : null}
      <Pressable
        onPress={() => editable && setShowPicker(true)}
        style={[styles.dateButton, !editable && styles.inputDisabled, error && styles.inputError]}>
        <Text style={value ? styles.dateText : styles.datePlaceholder}>
          {value || placeholder}
        </Text>
      </Pressable>

      {showPicker ? (
        <Modal transparent animationType="fade" visible={showPicker} onRequestClose={() => setShowPicker(false)}>
          <Pressable style={styles.dateModalBackdrop} onPress={() => setShowPicker(false)}>
            <Pressable style={styles.dateModalCard} onPress={() => {}}>
              <Text style={styles.dateModalTitle}>Select date</Text>
              <ScrollView style={styles.dateList} contentContainerStyle={styles.dateListContent}>
                {options.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.dateOption,
                      value === option.value ? styles.dateOptionActive : null,
                    ]}
                    onPress={() => handleSelect(option.value)}>
                    <Text style={[styles.dateOptionLabel, value === option.value ? styles.dateOptionLabelActive : null]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.dateOptionValue, value === option.value ? styles.dateOptionLabelActive : null]}>
                      {option.value}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.dateDoneButton} onPress={() => setShowPicker(false)}>
                <Text style={styles.dateDoneText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
  editable = true,
  error,
}) {
  const [showPicker, setShowPicker] = React.useState(false);

  const normalizedOptions = React.useMemo(() => {
    return options.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : opt);
  }, [options]);

  const selectedLabel = React.useMemo(() => {
    const found = normalizedOptions.find(o => o.value === value);
    return found ? found.label : value;
  }, [value, normalizedOptions]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setShowPicker(false);
  };

  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, error && styles.fieldLabelError]}>{label}</Text> : null}
      <Pressable
        onPress={() => editable && setShowPicker(true)}
        style={[styles.dateButton, !editable && styles.inputDisabled, error && styles.inputError]}>
        <Text style={value ? styles.dateText : styles.datePlaceholder}>
          {selectedLabel || placeholder}
        </Text>
      </Pressable>

      {showPicker ? (
        <Modal transparent animationType="fade" visible={showPicker} onRequestClose={() => setShowPicker(false)}>
          <Pressable style={styles.dateModalBackdrop} onPress={() => setShowPicker(false)}>
            <Pressable style={styles.dateModalCard} onPress={() => {}}>
              <Text style={styles.dateModalTitle}>{label || "Select an option"}</Text>
              <ScrollView style={styles.dateList} contentContainerStyle={styles.dateListContent}>
                {normalizedOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.dateOption,
                      value === option.value ? styles.dateOptionActive : null,
                    ]}
                    onPress={() => handleSelect(option.value)}>
                    <Text style={[styles.dateOptionLabel, value === option.value ? styles.dateOptionLabelActive : null]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.dateDoneButton} onPress={() => setShowPicker(false)}>
                <Text style={styles.dateDoneText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

export function InlineMessage({ tone = "muted", text }) {
  if (!text) return null;
  const toneStyle =
    tone === "danger"
      ? styles.msgDanger
      : tone === "warning"
        ? styles.msgWarning
        : styles.msgMuted;

  return (
    <View style={[styles.msgWrap, toneStyle]}>
      <Text style={styles.msgText}>{text}</Text>
    </View>
  );
}

export function LoadingBlock({ text = "Loading..." }) {
  return (
    <View style={styles.loadingBlock}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenAuraOne: {
    position: "absolute",
    right: -80,
    top: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(19,61,91,0.06)",
  },
  screenAuraTwo: {
    position: "absolute",
    left: -90,
    bottom: -130,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(151,198,11,0.06)",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(14,24,48,0.08)",
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(19,61,91,0.35)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  primaryButtonText: {
    color: COLORS.surface,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(14,24,48,0.10)",
  },
  secondaryButtonText: {
    color: COLORS.panel,
    fontWeight: "800",
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  fieldLabelError: {
    color: COLORS.danger,
  },
  fieldErrorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(14,24,48,0.14)",
    borderRadius: RADIUS.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.text,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: COLORS.panel,
    backgroundColor: COLORS.surfaceSoft,
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: "#FDF4F6",
  },
  inputDisabled: {
    backgroundColor: COLORS.surfaceMuted,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(14,24,48,0.12)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgeSuccess: {
    backgroundColor: COLORS.accentSoft,
    color: COLORS.success,
  },
  badgeWarning: {
    backgroundColor: "#FFF1D6",
    color: COLORS.warning,
  },
  badgeDanger: {
    backgroundColor: "#FCE4E8",
    color: COLORS.danger,
  },
  badgeMuted: {
    backgroundColor: COLORS.surfaceMuted,
    color: COLORS.textMuted,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceMuted,
  },
  dateButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(14,24,48,0.14)",
    borderRadius: RADIUS.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateText: {
    color: COLORS.text,
    fontSize: 16,
  },
  datePlaceholder: {
    color: "#8FA1B4",
  },
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(14,24,48,0.35)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  dateModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "rgba(10,29,49,0.28)",
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  dateModalTitle: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 8,
  },
  dateList: {
    maxHeight: 300,
  },
  dateListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  dateOption: {
    borderWidth: 1,
    borderColor: "rgba(14,24,48,0.10)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceSoft,
  },
  dateOptionActive: {
    borderColor: "rgba(151,198,11,0.45)",
    backgroundColor: COLORS.accentSoft,
  },
  dateOptionLabel: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 13,
  },
  dateOptionValue: {
    marginTop: 2,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  dateOptionLabelActive: {
    color: COLORS.panel,
  },
  dateDoneButton: {
    alignSelf: "flex-end",
    marginTop: 4,
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateDoneText: {
    color: COLORS.surface,
    fontWeight: "800",
  },
  msgWrap: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  msgMuted: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
  },
  msgWarning: {
    backgroundColor: "#FFF8EA",
    borderColor: "#F1E1B9",
  },
  msgDanger: {
    backgroundColor: "#FCE4E8",
    borderColor: "#F0BAC3",
  },
  msgText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});
