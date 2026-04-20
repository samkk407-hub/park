import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { PrimaryButton } from "@/components/PrimaryButton";

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, parking, updatePaymentStatus } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const entry = useMemo(() => entries.find(e => e.id === id), [entries, id]);

  useEffect(() => {
    if (!entry) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  if (!entry || !parking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", marginTop: 12 }}>Ticket not found</Text>
        <PrimaryButton label="Go Back" onPress={() => router.back()} size="md" />
      </View>
    );
  }

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 : insets.bottom + 20;

  const handleMarkPaid = async () => {
    await updatePaymentStatus(entry.id, "paid");
    Alert.alert("Payment Recorded", "Payment has been marked as received.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShare = () => {
    Alert.alert(
      "Share Ticket",
      `WhatsApp/SMS sharing would be configured here.\n\nTicket ID: ${entry.ticketId}\nVehicle: ${entry.numberPlate}\nAmount: ₹${entry.amount}`,
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 20, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push("/")} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
          <Feather name="x" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Parking Ticket</Text>
        <TouchableOpacity onPress={handleShare} style={[styles.shareBtn, { backgroundColor: colors.accent }]}>
          <Feather name="share-2" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Ticket Card */}
      <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header Band */}
        <View style={[styles.ticketHeader, { backgroundColor: colors.primary }]}>
          <Feather name="map-pin" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketParkingName}>{parking.name}</Text>
            <Text style={styles.ticketParkingLoc} numberOfLines={1}>{parking.location}</Text>
          </View>
        </View>

        {/* Perforated Edge */}
        <View style={[styles.perforated, { borderTopColor: colors.border }]}>
          <View style={[styles.circle, { backgroundColor: colors.background, left: -20 }]} />
          <View style={[styles.circle, { backgroundColor: colors.background, right: -20 }]} />
        </View>

        {/* Ticket Body */}
        <View style={styles.ticketBody}>
          {/* Ticket ID */}
          <View style={styles.ticketIdRow}>
            <Text style={[styles.ticketIdLabel, { color: colors.mutedForeground }]}>TICKET ID</Text>
            <Text style={[styles.ticketId, { color: colors.primary }]}>{entry.ticketId}</Text>
          </View>

          {/* QR Placeholder */}
          <View style={[styles.qrBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="grid" size={40} color={colors.mutedForeground} />
            <Text style={[styles.qrLabel, { color: colors.mutedForeground }]}>{entry.ticketId}</Text>
          </View>

          {/* Details Grid */}
          <View style={styles.detailGrid}>
            <DetailItem label="Vehicle" value={entry.vehicleType.toUpperCase()} icon="truck" colors={colors} />
            <DetailItem label="Number Plate" value={entry.numberPlate} icon="credit-card" colors={colors} />
            <DetailItem label="Entry Time" value={formatTime(entry.entryTime)} icon="clock" colors={colors} />
            <DetailItem label="Entry Date" value={formatDate(entry.entryTime)} icon="calendar" colors={colors} />
            <DetailItem label="Rate" value={`₹${entry.amount}/hr`} icon="tag" colors={colors} />
            <DetailItem
              label="Payment"
              value={entry.paymentType === "online" ? "Online / UPI" : "Cash / Offline"}
              icon="credit-card"
              colors={colors}
            />
          </View>

          {/* Payment Status */}
          <View style={[
            styles.paymentStatus,
            { backgroundColor: entry.paymentStatus === "paid" ? colors.successLight : colors.warningLight },
          ]}>
            <Feather
              name={entry.paymentStatus === "paid" ? "check-circle" : "alert-circle"}
              size={16}
              color={entry.paymentStatus === "paid" ? colors.success : colors.warning}
            />
            <Text style={[
              styles.paymentStatusText,
              { color: entry.paymentStatus === "paid" ? colors.success : colors.warning },
            ]}>
              {entry.paymentStatus === "paid" ? "Payment Received" : "Payment Pending"}
            </Text>
          </View>

          {/* Mobile */}
          {entry.customerMobile ? (
            <Text style={[styles.mobile, { color: colors.mutedForeground }]}>
              Customer: +91 {entry.customerMobile}
            </Text>
          ) : null}

          {/* Attendant */}
          <Text style={[styles.mobile, { color: colors.mutedForeground }]}>
            Attendant: {entry.attendantName}
          </Text>
        </View>
      </View>

      {/* Actions */}
      {entry.paymentStatus === "pending" && (
        <PrimaryButton
          label="Mark Payment as Received"
          onPress={handleMarkPaid}
          variant="primary"
        />
      )}

      <PrimaryButton
        label="Share via WhatsApp"
        onPress={handleShare}
        variant="outline"
        size="md"
      />

      <PrimaryButton
        label="Back to Dashboard"
        onPress={() => router.push("/")}
        variant="secondary"
        size="md"
      />
    </ScrollView>
  );
}

function DetailItem({ label, value, icon, colors }: { label: string; value: string; icon: any; colors: any }) {
  return (
    <View style={styles.detailItem}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  ticketHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ticketParkingName: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  ticketParkingLoc: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  perforated: {
    height: 20,
    borderTopWidth: 1,
    borderStyle: "dashed",
    position: "relative",
  },
  circle: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    top: -15,
  },
  ticketBody: {
    padding: 20,
    gap: 14,
  },
  ticketIdRow: {
    alignItems: "center",
    gap: 4,
  },
  ticketIdLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  ticketId: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  qrBox: {
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "center",
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qrLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  detailGrid: {
    gap: 8,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  detailValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  paymentStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 12,
  },
  paymentStatusText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  mobile: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
