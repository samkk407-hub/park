import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, parking, exitVehicle, refreshSession } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const entry = useMemo(() => entries.find(e => e.id === id), [entries, id]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession])
  );

  if (!entry || !parking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Entry Detail" showBack />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Entry not found</Text>
        </View>
      </View>
    );
  }

  const isInside = entry.status === "inside";
  const isPaid = entry.paymentStatus === "paid";

  const durationMinutes = entry.exitTime
    ? Math.ceil((new Date(entry.exitTime).getTime() - new Date(entry.entryTime).getTime()) / 60000)
    : Math.ceil((Date.now() - new Date(entry.entryTime).getTime()) / 60000);

  const finalAmount = () => {
    const hours = Math.max(1, Math.ceil(durationMinutes / 60));
    const rate = entry.vehicleType === "bike" ? parking.bikeRate
      : entry.vehicleType === "car" ? parking.carRate
      : parking.otherRate;
    return hours * rate;
  };

  const handleExit = () => {
    Alert.alert("Confirm Exit", `Checkout ${entry.numberPlate}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          await exitVehicle(entry.id, new Date().toISOString());
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  };

  const botPad = isWeb ? 34 : insets.bottom + 20;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Entry Detail" showBack />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View style={[
          styles.statusBanner,
          { backgroundColor: isInside ? colors.accent : colors.successLight },
        ]}>
          <Feather
            name={isInside ? "truck" : "check-circle"}
            size={18}
            color={isInside ? colors.primary : colors.success}
          />
          <Text style={[styles.statusText, { color: isInside ? colors.primary : colors.success }]}>
            {isInside ? "Currently Inside" : "Checked Out"}
          </Text>
        </View>

        {/* Plate + Ticket */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.plate, { color: colors.foreground }]}>{entry.numberPlate}</Text>
          <Text style={[styles.ticket, { color: colors.mutedForeground }]}>{entry.ticketId}</Text>
          <View style={[styles.vehiclePill, { backgroundColor: colors.muted }]}>
            <Feather
              name={entry.vehicleType === "bike" ? "zap" : entry.vehicleType === "car" ? "truck" : "box"}
              size={14} color={colors.primary}
            />
            <Text style={[styles.vehicleType, { color: colors.foreground }]}>
              {entry.vehicleType.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row label="Entry Time" value={formatDT(entry.entryTime)} colors={colors} />
          {entry.exitTime && <Row label="Exit Time" value={formatDT(entry.exitTime)} colors={colors} />}
          <Row label="Duration" value={formatDuration(durationMinutes)} colors={colors} />
          <Row label="Customer" value={entry.customerMobile ? `+91 ${entry.customerMobile}` : "N/A"} colors={colors} />
          <Row label="Attendant" value={entry.attendantName} colors={colors} />
        </View>

        {/* Payment */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment</Text>
          <Row label="Method" value={entry.paymentType === "online" ? "Online / UPI" : "Cash / Offline"} colors={colors} />
          <Row label="Rate" value={`₹${entry.amount}/hr`} colors={colors} />
          <Row label="Final Amount" value={`₹${finalAmount()}`} colors={colors} highlight />
          <View style={[
            styles.payBadge,
            { backgroundColor: isPaid ? colors.successLight : colors.warningLight },
          ]}>
            <Feather name={isPaid ? "check-circle" : "alert-circle"} size={16} color={isPaid ? colors.success : colors.warning} />
            <Text style={[styles.payBadgeText, { color: isPaid ? colors.success : colors.warning }]}>
              {isPaid ? "Payment Received" : "Payment Pending"}
            </Text>
          </View>
        </View>

        {/* Actions */}
        {isInside && (
          <PrimaryButton label="Process Exit" onPress={handleExit} variant="secondary" />
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, colors, highlight }: { label: string; value: string; colors: any; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: highlight ? colors.primary : colors.foreground }]}>{value}</Text>
    </View>
  );
}

function formatDT(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 12,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  plate: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  ticket: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  vehiclePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  vehicleType: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  payBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 10,
  },
  payBadgeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
