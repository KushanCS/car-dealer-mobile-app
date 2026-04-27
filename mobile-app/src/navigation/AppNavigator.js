import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import VehiclesScreen from "../screens/VehiclesScreen";
import VehicleDetailScreen from "../screens/VehicleDetailScreen";
import VehicleFormScreen from "../screens/VehicleFormScreen";
import LeadsScreen from "../screens/LeadsScreen";
import LeadFormScreen from "../screens/LeadFormScreen";
import AppointmentsScreen from "../screens/AppointmentsScreen";
import BookAppointmentScreen from "../screens/BookAppointmentScreen";
import AppointmentFormScreen from "../screens/AppointmentFormScreen";
import NotificationFormScreen from "../screens/NotificationFormScreen";
import SalesScreen from "../screens/SalesScreen";
import SaleFormScreen from "../screens/SaleFormScreen";
import EventsScreen from "../screens/EventsScreen";
import EventFormScreen from "../screens/EventFormScreen";
import DocumentsScreen from "../screens/DocumentsScreen";
import DocumentFormScreen from "../screens/DocumentFormScreen";
import AdminUsersScreen from "../screens/AdminUsersScreen";
import AdminUserFormScreen from "../screens/AdminUserFormScreen";
import ActivitiesScreen from "../screens/ActivitiesScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import { getUser, removeUser } from "../utils/storage";
import { COLORS, HEADER_OPTIONS } from "../ui/theme";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function DrawerContentWithLogout(props) {
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await removeUser();
    props.navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <View style={styles.drawerRoot}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[
          styles.drawerScrollContent,
          { paddingTop: insets.top + 6, paddingBottom: 10 },
        ]}>
        <View style={styles.drawerBrandCard}>
          <View style={styles.drawerBrandIconWrap}>
            <MaterialCommunityIcons name="car-sports" size={24} color={COLORS.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.drawerBrandTitle}>Car Dealer Suite</Text>
            <Text style={styles.drawerBrandSubtitle}>Operations Console</Text>
          </View>
        </View>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={styles.drawerFooter}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MainDrawer() {
  const [drawerRole, setDrawerRole] = useState("user");

  useEffect(() => {
    let mounted = true;

    (async () => {
      const savedSession = await getUser();
      const profile = savedSession?.user || savedSession;
      if (!mounted) return;
      setDrawerRole(profile?.role || "user");
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const isAdmin = drawerRole === "admin";
  const isStaff = drawerRole === "staff" || isAdmin;

  const iconByRoute = {
    Overview: "view-dashboard-outline",
    Vehicles: "car-multiple",
    Leads: "account-search-outline",
    Appointments: "calendar-check-outline",
    Sales: "cash-register",
    Events: "calendar-star",
    Holidays: "calendar-remove-outline",
    Documents: "file-document-outline",
    Users: "shield-account",
    Activities: "timeline-clock-outline",
  };

  return (
    <Drawer.Navigator
      initialRouteName="Vehicles"
      drawerContent={(props) => <DrawerContentWithLogout {...props} />}
      screenOptions={({ route }) => ({
        ...HEADER_OPTIONS,
        sceneStyle: { backgroundColor: COLORS.background },
        drawerActiveBackgroundColor: COLORS.panel,
        drawerActiveTintColor: COLORS.surface,
        drawerInactiveTintColor: COLORS.text,
        drawerLabelStyle: styles.drawerLabel,
        drawerItemStyle: styles.drawerItem,
        drawerStyle: styles.drawerPane,
        drawerIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={iconByRoute[route.name] || "circle-outline"}
            size={size}
            color={color}
          />
        ),
      })}>
      <Drawer.Screen name="Overview" component={HomeScreen} options={{ title: "Overview" }} />
      <Drawer.Screen name="Vehicles" component={VehiclesScreen} options={{ title: "Vehicles" }} />
      <Drawer.Screen name="Appointments" component={AppointmentsScreen} options={{ title: "Appointments" }} />
      <Drawer.Screen name="Events" component={EventsScreen} options={{ title: "Events" }} />

      {isStaff ? (
        <Drawer.Screen name="Leads" component={LeadsScreen} options={{ title: "Leads" }} />
      ) : null}
      {isStaff ? (
        <Drawer.Screen name="Sales" component={SalesScreen} options={{ title: "Sales" }} />
      ) : null}
      {isStaff ? (
        <Drawer.Screen name="Documents" component={DocumentsScreen} options={{ title: "Documents" }} />
      ) : null}

      {isAdmin ? (
        <Drawer.Screen name="Users" component={AdminUsersScreen} options={{ title: "Users" }} />
      ) : null}
      {isAdmin ? (
        <Drawer.Screen name="Activities" component={ActivitiesScreen} options={{ title: "Activities" }} />
      ) : null}
    </Drawer.Navigator>
  );
}

export default function AppNavigator() {
  const [initialRouteName, setInitialRouteName] = useState("Login");
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        await removeUser();
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
          // initialRouteName remains "Login" as per state default
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={HEADER_OPTIONS}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Register" }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Forgot Password" }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: "Reset Password" }} />
        <Stack.Screen
          name="Home"
          component={MainDrawer}
          options={{ headerShown: false, headerBackVisible: false }}
        />

        <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ title: "Vehicle" }} />
        <Stack.Screen name="VehicleForm" component={VehicleFormScreen} options={{ title: "Vehicle" }} />

        <Stack.Screen name="LeadForm" component={LeadFormScreen} options={{ title: "Lead" }} />

        <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ title: "Book" }} />
        <Stack.Screen name="AppointmentForm" component={AppointmentFormScreen} options={{ title: "Appointment" }} />

        <Stack.Screen name="NotificationForm" component={NotificationFormScreen} options={{ title: "Notification" }} />

        <Stack.Screen name="SaleForm" component={SaleFormScreen} options={{ title: "Sale" }} />

        <Stack.Screen name="EventForm" component={EventFormScreen} options={{ title: "Event" }} />


        <Stack.Screen name="DocumentForm" component={DocumentFormScreen} options={{ title: "Document" }} />

        <Stack.Screen name="AdminUserForm" component={AdminUserFormScreen} options={{ title: "User" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  drawerRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  drawerScrollContent: {
    paddingTop: 0,
    paddingHorizontal: 10,
  },
  drawerPane: {
    width: 300,
    backgroundColor: COLORS.background,
  },
  drawerBrandCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(14,24,48,0.10)",
    backgroundColor: COLORS.surface,
    padding: 12,
    marginTop: 0,
    marginBottom: 14,
  },
  drawerBrandIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerBrandTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  drawerBrandSubtitle: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  drawerItem: {
    borderRadius: 12,
    marginVertical: 2,
    marginHorizontal: 4,
    paddingLeft: 2,
  },
  drawerLabel: {
    fontWeight: "800",
    fontSize: 14,
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  logoutButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: COLORS.surface,
    fontWeight: "800",
    fontSize: 15,
  },
});
