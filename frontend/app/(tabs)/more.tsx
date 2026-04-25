import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function MoreScreen() {
  const { user, parking, logout, refreshSession } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 : insets.bottom + 90;

  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "owner" || user?.role === "admin" || user?.role === "superadmin";
  const displayName =
    user?.name && user.name !== "New User"
      ? user.name
      : parking?.ownerName || "Owner";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession])
  );

  const MenuItem = ({
    icon, label, subtitle, onPress, color, disabled, badge,
  }: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    subtitle?: string;
    onPress: () => void;
    color?: string;
    disabled?: boolean;
    badge?: string;
  }) => (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border, opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, { backgroundColor: (color || colors.primary) + "18" }]}>
        <Feather name={icon} size={18} color={color || colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Card */}
      <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>More</Text>
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{displayName}</Text>
            <Text style={[styles.profileMobile, { color: colors.mutedForeground }]}>+91 {user?.mobile}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.roleText, { color: colors.primary }]}>{user?.role?.toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Feather name="edit-2" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {parking && (
          <View style={[styles.parkingCard, { backgroundColor: colors.accent }]}>
            <Feather name="map-pin" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.parkingName, { color: colors.primary }]}>{parking.name}</Text>
              <Text style={[styles.parkingLoc, { color: colors.accentForeground }]} numberOfLines={1}>{parking.location}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Operations */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OPERATIONS</Text>
      </View>
      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="plus-circle"
          label="New Vehicle Entry"
          subtitle="Log a vehicle entering"
          onPress={() => router.push("/entry")}
          color={colors.success}
        />
        <MenuItem
          icon="log-out"
          label="Vehicle Exit"
          subtitle="Process vehicle checkout"
          onPress={() => router.push("/exit")}
          color={colors.destructive}
        />
        <MenuItem
          icon="list"
          label="All Entries"
          subtitle="View all vehicle records"
          onPress={() => router.push("/entries")}
          color={colors.info}
        />
        <MenuItem
          icon="activity"
          label="Activity Logs"
          subtitle="Full audit trail"
          onPress={() => router.push("/logs")}
          color={colors.warning}
        />
      </View>

      {/* Management — owners & admins */}
      {isOwner && (
        <>
          <View style={{ paddingHorizontal: 16, marginBottom: 8, marginTop: 20 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MANAGEMENT</Text>
          </View>
          <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MenuItem
              icon="users"
              label="Staff Management"
              subtitle="Add and manage parking staff"
              onPress={() => router.push("/staff")}
            />
            <MenuItem
              icon="credit-card"
              label="Bank Account"
              subtitle="Add owner settlement bank details"
              onPress={() => router.push("/banking")}
              color={colors.success}
            />
            <MenuItem
              icon="package"
              label="Entry Plans"
              subtitle="Buy entry quota after free limit"
              onPress={() => router.push("/plans" as any)}
              color={colors.warning}
            />
          </View>
        </>
      )}

      {/* Account */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8, marginTop: 20 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      </View>
      <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MenuItem
          icon="settings"
          label="App Settings"
          subtitle="Theme and preferences"
          onPress={() => router.push("/settings")}
          color={colors.info}
        />
        <MenuItem
          icon="log-out"
          label="Sign Out"
          onPress={handleLogout}
          color={colors.destructive}
        />
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  profileName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  profileMobile: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  roleText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  parkingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 12,
  },
  parkingName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  parkingLoc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  menuSection: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  menuSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
