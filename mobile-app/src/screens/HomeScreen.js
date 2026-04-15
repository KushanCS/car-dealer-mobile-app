import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";

import api from "../services/api";
import { getUser, removeUser } from "../utils/storage";

const COLORS = {
  background: "#F4F7FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF4F8",
  panel: "#133D5B",
  panelAlt: "#1C5373",
  accent: "#97C60B",
  accentSoft: "#EEF7D0",
  text: "#0E1830",
  textMuted: "#72839A",
  border: "#D9E3EC",
  success: "#67A40F",
  warning: "#D99B2B",
  danger: "#B24B5E",
  shadow: "rgba(10, 29, 49, 0.10)",
};

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));

const formatCompactNumber = (value) =>
  Number(value || 0) > 999 ? compactNumberFormatter.format(Number(value || 0)) : `${Number(value || 0)}`;

const formatVehicleTitle = (vehicle) =>
  [vehicle?.brand, vehicle?.model || vehicle?.type].filter(Boolean).join(" ");

const formatAppointmentVehicle = (appointment) =>
  [appointment?.vehicle?.brand, appointment?.vehicle?.model || appointment?.vehicle?.type]
    .filter(Boolean)
    .join(" ");

const formatTimeStamp = (value) => {
  if (!value) return "No time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const buildAppointmentDate = (appointment) => {
  if (!appointment?.date) return null;

  const date = new Date(appointment.date);
  if (Number.isNaN(date.getTime())) return null;

  if (appointment.time && /^\d{2}:\d{2}$/.test(String(appointment.time))) {
    const [hours, minutes] = String(appointment.time).split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
  }

  return date;
};

const formatRelativeDay = (value) => {
  if (!value) return "Not scheduled";

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "Not scheduled";

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startTarget - startToday) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(target);
};

const getStatusTone = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "available":
    case "completed":
    case "sent":
    case "success":
      return {
        backgroundColor: COLORS.accentSoft,
        color: COLORS.success,
      };
    case "reserved":
    case "partial":
    case "pending":
    case "scheduled":
      return {
        backgroundColor: "#FFF1D6",
        color: COLORS.warning,
      };
    case "cancelled":
    case "failed":
    case "sold":
      return {
        backgroundColor: "#FCE4E8",
        color: COLORS.danger,
      };
    default:
      return {
        backgroundColor: COLORS.surfaceMuted,
        color: COLORS.textMuted,
      };
  }
};

const getRoleLabel = (role) => {
  switch (role) {
    case "admin":
      return "Admin Console";
    case "staff":
      return "Staff Operations";
    default:
      return "Customer Portal";
  }
};

const getRoleSubtitle = (role) => {
  switch (role) {
    case "admin":
      return "Monitor activity, inventory, sales, and dealership operations from one place.";
    case "staff":
      return "Stay ahead of appointments, notifications, and sales follow-ups for the day.";
    default:
      return "Track your test drives, browse inventory, and keep up with upcoming dealership events.";
  }
};

const withAuth = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

function StatCard({ icon, label, value, caption, accent = false }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <View style={[styles.statIconWrap, accent && styles.statIconWrapAccent]}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={accent ? COLORS.panel : COLORS.surface}
        />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

function ModulePill({ icon, label }) {
  return (
    <View style={styles.modulePill}>
      <MaterialCommunityIcons name={icon} size={16} color={COLORS.panel} />
      <Text style={styles.modulePillText}>{label}</Text>
    </View>
  );
}

function SectionShell({ title, subtitle, action, children }) {
  return (
    <View style={styles.sectionShell}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [session, setSession] = useState(null);
  const [dashboard, setDashboard] = useState({
    vehicles: [],
    leads: [],
    appointments: [],
    notifications: [],
    salesStats: null,
    activities: [],
    events: [],
    documents: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const profile = session?.user || session;
  const role = profile?.role || "user";

  const loadDashboard = async ({ refreshing = false } = {}) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const savedSession = await getUser();
      const nextProfile = savedSession?.user || savedSession;
      const nextRole = nextProfile?.role || "user";
      const nextToken = savedSession?.token || "";

      setSession(savedSession);

      const requests = [
        { key: "vehicles", promise: api.get("/api/vehicles") },
        { key: "events", promise: api.get("/api/events") },
      ];

      if (nextRole === "admin" || nextRole === "staff") {
        if (nextToken) {
          requests.push(
            { key: "appointments", promise: api.get("/api/appointments", withAuth(nextToken)) },
            { key: "notifications", promise: api.get("/api/notifications", withAuth(nextToken)) },
            { key: "salesStats", promise: api.get("/api/sales/stats", withAuth(nextToken)) },
            { key: "documents", promise: api.get("/api/documents", withAuth(nextToken)) }
          );
        }

        requests.push({ key: "leads", promise: api.get("/api/leads") });

        if (nextRole === "admin" && nextToken) {
          requests.push({
            key: "activities",
            promise: api.get("/api/activities/recent?limit=4", withAuth(nextToken)),
          });
        }
      }

      if (nextRole === "user" && nextToken) {
        requests.push({
          key: "appointments",
          promise: api.get("/api/customer/appointments/my", withAuth(nextToken)),
        });
      }

      const settled = await Promise.allSettled(requests.map((entry) => entry.promise));
      const nextDashboard = {
        vehicles: [],
        leads: [],
        appointments: [],
        notifications: [],
        salesStats: null,
        activities: [],
        events: [],
        documents: [],
      };

      let encounteredError = "";

      settled.forEach((result, index) => {
        const key = requests[index].key;

        if (result.status === "fulfilled") {
          const responseData = result.value?.data;

          if (key === "activities") {
            nextDashboard.activities = responseData?.data || [];
            return;
          }

          nextDashboard[key] = responseData;
          return;
        }

        if (!encounteredError) {
          encounteredError =
            result.reason?.response?.data?.message ||
            result.reason?.message ||
            "Failed to load dashboard data.";
        }
      });

      setDashboard(nextDashboard);
      setLoadError(encounteredError);
    } catch (error) {
      setLoadError(error.message || "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleLogout = async () => {
    await removeUser();
    setSession(null);
    navigation.replace("Login");
  };

  const metrics = useMemo(() => {
    const vehicles = dashboard.vehicles || [];
    const leads = dashboard.leads || [];
    const appointments = dashboard.appointments || [];
    const notifications = dashboard.notifications || [];
    const documents = dashboard.documents || [];
    const upcomingAppointments = appointments
      .map((appointment) => ({
        ...appointment,
        appointmentDate: buildAppointmentDate(appointment),
      }))
      .filter(
        (appointment) =>
          appointment.appointmentDate &&
          appointment.appointmentDate >= new Date() &&
          appointment.status !== "cancelled"
      )
      .sort((left, right) => left.appointmentDate - right.appointmentDate);

    const inventoryValue = vehicles.reduce(
      (total, vehicle) => total + Number(vehicle.price || 0),
      0
    );

    const availableVehicles = vehicles.filter((vehicle) => vehicle.status === "available");
    const reservedVehicles = vehicles.filter((vehicle) => vehicle.status === "reserved");
    const soldVehicles = vehicles.filter((vehicle) => vehicle.status === "sold");
    const pendingNotifications = notifications.filter(
      (notification) => notification.status === "pending"
    );
    const featuredVehicle = availableVehicles[0] || vehicles[0] || null;
    const nextEvent = (dashboard.events || [])
      .map((event) => ({
        ...event,
        startDateValue: event.startDate ? new Date(event.startDate) : null,
      }))
      .filter((event) => event.startDateValue && event.startDateValue >= new Date())
      .sort((left, right) => left.startDateValue - right.startDateValue)[0];

    return {
      totalVehicles: vehicles.length,
      availableVehicles,
      reservedVehicles,
      soldVehicles,
      inventoryValue,
      leads,
      appointments,
      upcomingAppointments,
      pendingNotifications,
      documents,
      featuredVehicle,
      nextEvent,
      salesStats: dashboard.salesStats,
      activities: dashboard.activities || [],
    };
  }, [dashboard]);

  const statCards = useMemo(() => {
    if (role === "admin" || role === "staff") {
      return [
        {
          icon: "car-multiple",
          label: "Inventory",
          value: `${metrics.totalVehicles}`,
          caption: `${metrics.availableVehicles.length} ready for viewing`,
        },
        {
          icon: "calendar-clock",
          label: "Upcoming",
          value: `${metrics.upcomingAppointments.length}`,
          caption: "Scheduled appointments ahead",
        },
        {
          icon: "cash-multiple",
          label: "Collected",
          value: formatCompactNumber(metrics.salesStats?.collectedAmount || 0),
          caption: "Payments captured this year",
        },
        {
          icon: "bell-ring-outline",
          label: "Pending",
          value: `${metrics.pendingNotifications.length}`,
          caption: "Notifications awaiting dispatch",
          accent: true,
        },
      ];
    }

    return [
      {
        icon: "car-estate",
        label: "Vehicles",
        value: `${metrics.totalVehicles}`,
        caption: `${metrics.availableVehicles.length} available now`,
      },
      {
        icon: "calendar-check",
        label: "My Bookings",
        value: `${metrics.upcomingAppointments.length}`,
        caption: "Upcoming test drives",
      },
      {
        icon: "calendar-star",
        label: "Next Event",
        value: metrics.nextEvent ? formatRelativeDay(metrics.nextEvent.startDate) : "Clear",
        caption: metrics.nextEvent?.name || "No upcoming dealership closures",
      },
      {
        icon: "cash",
        label: "Inventory Value",
        value: formatCompactNumber(metrics.inventoryValue),
        caption: "Current listed stock value",
        accent: true,
      },
    ];
  }, [metrics, role]);

  const modulePills = useMemo(() => {
    const baseModules = ["Inventory Feed", "Dealer Calendar"];

    if (role === "admin") {
      return [...baseModules, "Activity Panel", "Sales Analytics", "Document Control"];
    }

    if (role === "staff") {
      return [...baseModules, "Appointments", "Notifications", "Sales Desk"];
    }

    return [...baseModules, "My Test Drives"];
  }, [role]);

  const actionSummary = useMemo(() => {
    if (role === "admin" || role === "staff") {
      return [
        {
          label: "Available",
          value: `${metrics.availableVehicles.length}`,
        },
        {
          label: "Reserved",
          value: `${metrics.reservedVehicles.length}`,
        },
        {
          label: "Sold",
          value: `${metrics.soldVehicles.length}`,
        },
      ];
    }

    return [
      {
        label: "Upcoming",
        value: `${metrics.upcomingAppointments.length}`,
      },
      {
        label: "Available Cars",
        value: `${metrics.availableVehicles.length}`,
      },
      {
        label: "Closures",
        value: metrics.nextEvent ? "1" : "0",
      },
    ];
  }, [metrics, role]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loaderSafeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loaderText}>Loading dealership overview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDashboard({ refreshing: true })}
            tintColor={COLORS.panel}
          />
        }>
        <View style={styles.heroPanel}>
          <View style={styles.heroGlow} />

          <View style={styles.heroTopRow}>
            <View style={styles.brandWrap}>
              <View style={styles.brandBadge}>
                <MaterialCommunityIcons
                  name="car-sports"
                  size={30}
                  color={COLORS.accent}
                />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandTitle}>Car Dealership System</Text>
                <Text style={styles.brandSubtitle}>{getRoleLabel(role)}</Text>
              </View>
            </View>

            <View style={styles.heroActions}>
              <Pressable
                style={styles.iconAction}
                onPress={() => loadDashboard({ refreshing: true })}>
                <Feather name="refresh-cw" size={18} color={COLORS.surface} />
              </Pressable>
              <Pressable style={styles.logoutAction} onPress={handleLogout}>
                <MaterialCommunityIcons
                  name="logout"
                  size={18}
                  color={COLORS.surface}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroCopyBlock}>
            <Text style={styles.heroEyebrow}>Premium Dealer Operations</Text>
            <Text style={styles.heroTitle}>
              Welcome back, {profile?.name || profile?.email || "Driver"}
            </Text>
            <Text style={styles.heroText}>{getRoleSubtitle(role)}</Text>
          </View>

          <View style={styles.heroMetaRow}>
            {actionSummary.map((item) => (
              <View key={item.label} style={styles.heroMetricCard}>
                <Text style={styles.heroMetricValue}>{item.value}</Text>
                <Text style={styles.heroMetricLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modulePillsRow}>
            {modulePills.map((item) => (
              <ModulePill
                key={item}
                icon={
                  item.includes("Inventory")
                    ? "car-estate"
                    : item.includes("Activity")
                      ? "timeline-clock-outline"
                      : item.includes("Sales")
                        ? "cash-register"
                        : item.includes("Document")
                          ? "file-document-outline"
                          : item.includes("Notifications")
                            ? "bell-outline"
                            : item.includes("Appointments") || item.includes("Drives")
                              ? "calendar-check"
                              : "calendar-star"
                }
                label={item}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.dashboardShell}>
          {loadError ? (
            <View style={styles.warningBanner}>
              <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
              <Text style={styles.warningText}>{loadError}</Text>
            </View>
          ) : null}

          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <StatCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                caption={card.caption}
                accent={card.accent}
              />
            ))}
          </View>

          <SectionShell
            title="Inventory Spotlight"
            subtitle="A live vehicle card powered by your inventory endpoint."
            action={
              <View style={styles.sectionChip}>
                <Text style={styles.sectionChipText}>
                  {formatCurrency(metrics.inventoryValue)}
                </Text>
              </View>
            }>
            {metrics.featuredVehicle ? (
              <View style={styles.featuredCard}>
                <View style={styles.featuredMedia}>
                  {metrics.featuredVehicle.images?.[0]?.url ? (
                    <Image
                      source={{ uri: metrics.featuredVehicle.images[0].url }}
                      style={styles.featuredImage}
                    />
                  ) : (
                    <View style={styles.featuredPlaceholder}>
                      <MaterialCommunityIcons
                        name="car-hatchback"
                        size={58}
                        color={COLORS.panel}
                      />
                    </View>
                  )}
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: getStatusTone(metrics.featuredVehicle.status)
                          .backgroundColor,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: getStatusTone(metrics.featuredVehicle.status).color,
                        },
                      ]}>
                      {metrics.featuredVehicle.status || "available"}
                    </Text>
                  </View>
                </View>

                <View style={styles.featuredContent}>
                  <Text style={styles.featuredTitle}>
                    {formatVehicleTitle(metrics.featuredVehicle)}
                  </Text>
                  <Text style={styles.featuredSubtitle}>
                    {metrics.featuredVehicle.type} • {metrics.featuredVehicle.year}
                  </Text>
                  <Text style={styles.featuredPrice}>
                    {formatCurrency(metrics.featuredVehicle.price)}
                  </Text>

                  <View style={styles.featuredSpecsGrid}>
                    <View style={styles.featuredSpec}>
                      <Text style={styles.featuredSpecLabel}>Fuel</Text>
                      <Text style={styles.featuredSpecValue}>
                        {metrics.featuredVehicle.fuelType || "Not set"}
                      </Text>
                    </View>
                    <View style={styles.featuredSpec}>
                      <Text style={styles.featuredSpecLabel}>Drive</Text>
                      <Text style={styles.featuredSpecValue}>
                        {metrics.featuredVehicle.transmission || "Not set"}
                      </Text>
                    </View>
                    <View style={styles.featuredSpec}>
                      <Text style={styles.featuredSpecLabel}>Condition</Text>
                      <Text style={styles.featuredSpecValue}>
                        {metrics.featuredVehicle.condition || "Not set"}
                      </Text>
                    </View>
                    <View style={styles.featuredSpec}>
                      <Text style={styles.featuredSpecLabel}>Mileage</Text>
                      <Text style={styles.featuredSpecValue}>
                        {metrics.featuredVehicle.mileage
                          ? `${metrics.featuredVehicle.mileage.toLocaleString()} km`
                          : "No reading"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="car-off"
                  size={32}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyStateTitle}>No vehicles yet</Text>
                <Text style={styles.emptyStateText}>
                  Add inventory in the backend and this spotlight will populate automatically.
                </Text>
              </View>
            )}
          </SectionShell>

          <SectionShell
            title={role === "user" ? "My Upcoming Test Drives" : "Upcoming Appointments"}
            subtitle={
              role === "user"
                ? "Appointments from your customer booking flow."
                : "Pulled from the scheduling endpoints used by staff and admin."
            }
            action={
              <View style={styles.sectionActionWrap}>
                <Text style={styles.sectionActionText}>
                  {metrics.upcomingAppointments.length} queued
                </Text>
              </View>
            }>
            {metrics.upcomingAppointments.length ? (
              metrics.upcomingAppointments.slice(0, 4).map((appointment) => (
                <View key={appointment._id} style={styles.listRowCard}>
                  <View style={styles.listRowIcon}>
                    <MaterialCommunityIcons
                      name="calendar-check"
                      size={20}
                      color={COLORS.panel}
                    />
                  </View>

                  <View style={styles.listRowContent}>
                    <View style={styles.listRowHead}>
                      <Text style={styles.listRowTitle}>
                        {formatAppointmentVehicle(appointment) || "Vehicle appointment"}
                      </Text>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: getStatusTone(appointment.status).backgroundColor,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: getStatusTone(appointment.status).color },
                          ]}>
                          {appointment.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.listRowSubtitle}>
                      {appointment.appointmentType?.replace("_", " ") || "viewing"} with{" "}
                      {appointment.staffMember?.name || "assigned staff"}
                    </Text>

                    <View style={styles.listRowMeta}>
                      <Text style={styles.listMetaText}>
                        {formatRelativeDay(appointment.appointmentDate)}
                      </Text>
                      <Text style={styles.listMetaDivider}>•</Text>
                      <Text style={styles.listMetaText}>
                        {appointment.time || formatTimeStamp(appointment.appointmentDate)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={32}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyStateTitle}>Nothing scheduled yet</Text>
                <Text style={styles.emptyStateText}>
                  Upcoming bookings will appear here as soon as the backend has appointment data.
                </Text>
              </View>
            )}
          </SectionShell>

          {(role === "admin" || role === "staff") && (
            <SectionShell
              title="Operations Snapshot"
              subtitle="A compact read of dealership modules connected to your backend."
              action={
                <View style={styles.sectionChipMuted}>
                  <Text style={styles.sectionChipMutedText}>
                    {metrics.documents.length} docs
                  </Text>
                </View>
              }>
              <View style={styles.snapshotGrid}>
                <View style={styles.snapshotCard}>
                  <Text style={styles.snapshotLabel}>Sales this year</Text>
                  <Text style={styles.snapshotValue}>
                    {metrics.salesStats?.totalSales ?? 0}
                  </Text>
                  <Text style={styles.snapshotCaption}>
                    {formatCurrency(metrics.salesStats?.totalRevenue || 0)} revenue
                  </Text>
                </View>

                <View style={styles.snapshotCard}>
                  <Text style={styles.snapshotLabel}>Open leads</Text>
                  <Text style={styles.snapshotValue}>{metrics.leads.length}</Text>
                  <Text style={styles.snapshotCaption}>CRM pipeline contacts</Text>
                </View>

                <View style={styles.snapshotCard}>
                  <Text style={styles.snapshotLabel}>Pending reminders</Text>
                  <Text style={styles.snapshotValue}>
                    {metrics.pendingNotifications.length}
                  </Text>
                  <Text style={styles.snapshotCaption}>Notifications not sent yet</Text>
                </View>

                <View style={styles.snapshotCard}>
                  <Text style={styles.snapshotLabel}>Reserved stock</Text>
                  <Text style={styles.snapshotValue}>
                    {metrics.reservedVehicles.length}
                  </Text>
                  <Text style={styles.snapshotCaption}>Vehicles awaiting completion</Text>
                </View>
              </View>
            </SectionShell>
          )}

          {(role === "admin" || metrics.activities.length > 0) && (
            <SectionShell
              title="Recent Activity"
              subtitle={
                role === "admin"
                  ? "Latest admin activity feed from your backend activity logger."
                  : "Recent changes across your account."
              }>
              {metrics.activities.length ? (
                metrics.activities.map((activity) => (
                  <View key={activity._id} style={styles.activityCard}>
                    <View style={styles.activityIcon}>
                      <MaterialCommunityIcons
                        name={
                          activity.entityType === "VEHICLE"
                            ? "car-wrench"
                            : activity.entityType === "APPOINTMENT"
                              ? "calendar-sync"
                              : activity.entityType === "SALE"
                                ? "cash-fast"
                                : activity.entityType === "DOCUMENT"
                                  ? "file-document-edit"
                                  : "shield-account"
                        }
                        size={20}
                        color={COLORS.surface}
                      />
                    </View>

                    <View style={styles.activityContent}>
                      <View style={styles.listRowHead}>
                        <Text style={styles.activityTitle}>{activity.title}</Text>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: getStatusTone(activity.status).backgroundColor,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: getStatusTone(activity.status).color },
                            ]}>
                            {activity.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.activityDescription}>
                        {activity.description || "System update recorded."}
                      </Text>
                      <View style={styles.listRowMeta}>
                        <Text style={styles.listMetaText}>
                          {activity.userName || "Unknown"}
                        </Text>
                        <Text style={styles.listMetaDivider}>•</Text>
                        <Text style={styles.listMetaText}>
                          {formatTimeStamp(activity.timestamp || activity.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="timeline-clock-outline"
                    size={32}
                    color={COLORS.textMuted}
                  />
                  <Text style={styles.emptyStateTitle}>No recent activity</Text>
                  <Text style={styles.emptyStateText}>
                    Admin actions will show up here once your activity logger records them.
                  </Text>
                </View>
              )}
            </SectionShell>
          )}

          <SectionShell
            title="Dealer Calendar"
            subtitle="Public events and closures that can affect appointments.">
            {metrics.nextEvent ? (
              <View style={styles.eventCard}>
                <View style={styles.eventMarker} />
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{metrics.nextEvent.name}</Text>
                  <Text style={styles.eventSubtitle}>
                    {formatRelativeDay(metrics.nextEvent.startDate)} •{" "}
                    {metrics.nextEvent.type || "Dealership event"}
                  </Text>
                  <Text style={styles.eventDescription}>
                    {metrics.nextEvent.description || "Upcoming operational event on the calendar."}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="calendar-blank"
                  size={32}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyStateTitle}>Calendar is clear</Text>
                <Text style={styles.emptyStateText}>
                  No upcoming closures or dealership events were returned by the backend.
                </Text>
              </View>
            )}
          </SectionShell>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.panel,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loaderSafeArea: {
    flex: 1,
    backgroundColor: COLORS.panel,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.background,
  },
  loaderText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  heroPanel: {
    backgroundColor: COLORS.panel,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 112,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.panelAlt,
    top: -70,
    right: -80,
    opacity: 0.9,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  brandBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.panelAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  brandCopy: {
    marginLeft: 14,
    flex: 1,
  },
  brandTitle: {
    color: COLORS.surface,
    fontSize: 21,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: "#B7CAD9",
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  logoutAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(151,198,11,0.22)",
    borderWidth: 1,
    borderColor: "rgba(151,198,11,0.35)",
  },
  heroCopyBlock: {
    marginTop: 26,
    gap: 10,
  },
  heroEyebrow: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: COLORS.surface,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
  },
  heroText: {
    color: "#C7D6E3",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  heroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 26,
  },
  heroMetricCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroMetricValue: {
    color: COLORS.surface,
    fontSize: 24,
    fontWeight: "800",
  },
  heroMetricLabel: {
    color: "#B5C7D6",
    fontSize: 12,
    marginTop: 4,
  },
  modulePillsRow: {
    paddingTop: 20,
    paddingBottom: 4,
    gap: 10,
  },
  modulePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
  },
  modulePillText: {
    color: COLORS.panel,
    fontWeight: "700",
    fontSize: 13,
  },
  dashboardShell: {
    marginTop: -82,
    paddingHorizontal: 16,
    gap: 18,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF8EA",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#F1E1B9",
  },
  warningText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  statCard: {
    width: "48.2%",
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  statCardAccent: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.panelAlt,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.panel,
  },
  statIconWrapAccent: {
    backgroundColor: COLORS.accent,
  },
  statLabel: {
    marginTop: 14,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  statValue: {
    marginTop: 10,
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
  },
  statValueAccent: {
    color: COLORS.surface,
  },
  statCaption: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionShell: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionChip: {
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sectionChipText: {
    color: COLORS.success,
    fontWeight: "800",
    fontSize: 12,
  },
  sectionChipMuted: {
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sectionChipMutedText: {
    color: COLORS.panel,
    fontWeight: "700",
    fontSize: 12,
  },
  sectionActionWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
  },
  sectionActionText: {
    color: COLORS.panel,
    fontWeight: "700",
    fontSize: 12,
  },
  featuredCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featuredMedia: {
    height: 220,
    backgroundColor: "#EDF3F7",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  featuredPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  featuredContent: {
    padding: 18,
  },
  featuredTitle: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
  },
  featuredSubtitle: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 15,
  },
  featuredPrice: {
    marginTop: 16,
    color: COLORS.accent,
    fontSize: 30,
    fontWeight: "900",
  },
  featuredSpecsGrid: {
    marginTop: 18,
    gap: 12,
  },
  featuredSpec: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featuredSpecLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  featuredSpecValue: {
    marginTop: 6,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  listRowCard: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  listRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowContent: {
    flex: 1,
  },
  listRowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  listRowTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  listRowSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 5,
    lineHeight: 19,
  },
  listRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  listMetaText: {
    color: COLORS.panel,
    fontWeight: "700",
    fontSize: 12,
  },
  listMetaDivider: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  snapshotGrid: {
    gap: 12,
  },
  snapshotCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  snapshotLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  snapshotValue: {
    marginTop: 10,
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
  },
  snapshotCaption: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 13,
  },
  activityCard: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  activityDescription: {
    marginTop: 6,
    color: COLORS.textMuted,
    lineHeight: 19,
    fontSize: 14,
  },
  eventCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventMarker: {
    width: 10,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
  },
  eventSubtitle: {
    color: COLORS.panel,
    marginTop: 6,
    fontWeight: "700",
    fontSize: 14,
  },
  eventDescription: {
    marginTop: 8,
    color: COLORS.textMuted,
    lineHeight: 20,
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyStateTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyStateText: {
    marginTop: 8,
    color: COLORS.textMuted,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
});
