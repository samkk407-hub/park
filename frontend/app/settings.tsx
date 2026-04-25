import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const { user, parking, resolvedTheme, toggleTheme } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const isOwner = user?.role === "owner" || user?.role === "superadmin";

  const botPad = isWeb ? 34 : insets.bottom + 20;

  const SettingRow = ({
    icon, label, subtitle, value, onPress,
  }: {
    icon: any; label: string; subtitle?: string; value?: string; onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} /> : null}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Settings" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: botPad, gap: 0 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.section, { color: colors.mutedForeground }]}>PROFILE</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="user" label="Name" value={user?.name} />
          <SettingRow icon="phone" label="Mobile" value={user?.mobile ? `+91 ${user.mobile}` : ""} />
          <SettingRow icon="shield" label="Role" value={user?.role?.toUpperCase()} />
        </View>

        <Text style={[styles.section, { color: colors.mutedForeground }]}>PARKING</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="map-pin" label="Name" value={parking?.name || "Not set"} />
          <SettingRow icon="map" label="Location" value={parking?.location || "Not set"} />
          <SettingRow icon="zap" label="Bike Rate" value={parking ? `Rs ${parking.bikeRate}/day` : "-"} />
          <SettingRow icon="truck" label="Car Rate" value={parking ? `Rs ${parking.carRate}/day` : "-"} />
          <SettingRow icon="layers" label="Capacity" value={parking ? String(parking.totalCapacity) : "-"} />
          <SettingRow
            icon="edit"
            label="Edit Parking Setup"
            subtitle="Update rates, capacity, and info"
            onPress={() => router.push("/setup")}
          />
        </View>

        <Text style={[styles.section, { color: colors.mutedForeground }]}>APP</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name={resolvedTheme === "dark" ? "moon" : "sun"} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Dark Mode</Text>
              <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>
                Turn dark mode on or off
              </Text>
            </View>
            <Switch
              value={resolvedTheme === "dark"}
              onValueChange={() => void toggleTheme()}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={resolvedTheme === "dark" ? colors.primaryForeground : colors.card}
            />
          </View>
          <SettingRow icon="globe" label="Currency" value="Rs INR" />
          <SettingRow icon="info" label="Version" value="1.0.0" />
        </View>

        {isOwner ? (
          <>
            {/*
            <Text style={[styles.section, { color: colors.mutedForeground }]}>BANKING</Text>
            <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SettingRow
                icon="credit-card"
                label="Settlement Bank Account"
                subtitle="Owner account for online settlement"
                value="Open"
                onPress={() => router.push("/banking")}
              />
              <SettingRow
                icon="file-text"
                label="Online Collection Ledger"
                subtitle="Record before bank settlement"
                value="Open"
                onPress={() => router.push("/banking")}
              />
            </View>
            */}
            <Text style={[styles.section, { color: colors.mutedForeground }]}>PLANS</Text>
            <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SettingRow
                icon="package"
                label="Entry Plans"
                subtitle="Free quota and paid entry packs"
                value="Open"
                onPress={() => router.push("/plans" as any)}
              />
            </View>
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.mutedForeground }]}>INTEGRATIONS</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="message-circle"
            label="WhatsApp API Key"
            subtitle="Configure for ticket sharing"
            value="Not configured"
            onPress={() => {}}
          />
          <SettingRow
            icon="phone-call"
            label="SMS API Key"
            subtitle="Configure for SMS notifications"
            value="Not configured"
            onPress={() => {}}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  group: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  settingSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  settingValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
