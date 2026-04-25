import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { getApiDomain } from "@/lib/api";

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, parking, refreshSession } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const entry = useMemo(() => entries.find((e) => e.id === id), [entries, id]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession])
  );

  useEffect(() => {
    if (!entry) return;
  }, [entry]);

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
  const ticketUrl = entry.ticketUrl || getTicketUrl(entry.publicToken);
  const customerMessage = [
    `Your parking ticket is ${entry.ticketId}.`,
    `Parking: ${parking.name}`,
    `Vehicle: ${entry.numberPlate}`,
    `Entry: ${formatDateTime(entry.entryTime)}`,
    entry.validUntil ? `Valid till: ${formatDateTime(entry.validUntil)}` : "",
    `Amount: Rs ${entry.amount}`,
    ticketUrl ? `Ticket link: ${ticketUrl}` : "",
  ].filter(Boolean).join("\n");

  const handleShare = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Customer Ticket Message", customerMessage);
      return;
    }
    try {
      await Share.share({ message: customerMessage });
    } catch {
      Alert.alert("Customer Ticket Message", customerMessage);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, paddingHorizontal: 20, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push("/")} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
          <Feather name="x" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Parking Ticket</Text>
        <TouchableOpacity onPress={handleShare} style={[styles.shareBtn, { backgroundColor: colors.accent }]}>
          <Feather name="share-2" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.ticketHeader, { backgroundColor: colors.success }]}>
          <View style={styles.headerIcon}>
            <Feather name="map-pin" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketEyebrow}>PARKING TICKET</Text>
            <Text style={styles.ticketParkingName}>{parking.name}</Text>
            <Text style={styles.ticketParkingLoc} numberOfLines={1}>{parking.location}</Text>
          </View>
        </View>

        <View style={[styles.perforated, { borderTopColor: colors.border }]}>
          <View style={[styles.circle, { backgroundColor: colors.background, left: -20 }]} />
          <View style={[styles.circle, { backgroundColor: colors.background, right: -20 }]} />
        </View>

        <View style={styles.ticketBody}>
          <View style={styles.ticketIdRow}>
            <Text style={[styles.ticketIdLabel, { color: colors.mutedForeground }]}>TICKET ID</Text>
            <Text style={[styles.ticketId, { color: colors.success }]}>{entry.ticketId}</Text>
            <Text style={[styles.ticketSubText, { color: colors.mutedForeground }]}>
              Show this ticket number at exit
            </Text>
          </View>

          <View style={[styles.vehiclePlate, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.vehiclePlateText, { color: colors.background }]}>{entry.numberPlate}</Text>
            <Text style={[styles.vehicleType, { color: colors.background }]}>{entry.vehicleType.toUpperCase()}</Text>
          </View>

          <View style={styles.detailGrid}>
            <DetailItem label="Ticket Cut By" value={entry.attendantName} colors={colors} />
            <DetailItem label="Entry Time" value={formatDateTime(entry.entryTime)} colors={colors} />
            <DetailItem label="Paid Days" value={`${entry.plannedDurationDays || 1} day(s)`} colors={colors} />
            {entry.validUntil ? (
              <DetailItem label="Valid Till" value={formatDateTime(entry.validUntil)} colors={colors} />
            ) : null}
            <DetailItem label="Current Status" value={entry.status === "inside" ? "Vehicle Inside" : "Exited"} colors={colors} />
            <DetailItem label="Amount Collected" value={`Rs ${entry.amount}`} colors={colors} />
            <DetailItem
              label="Payment"
              value={entry.paymentType === "online" ? "Owner QR / UPI" : "Cash"}
              colors={colors}
            />
          </View>

          <View
            style={[
              styles.paymentStatus,
              { backgroundColor: entry.paymentStatus === "paid" ? colors.successLight : colors.warningLight },
            ]}
          >
            <Feather
              name={entry.paymentStatus === "paid" ? "check-circle" : "alert-circle"}
              size={16}
              color={entry.paymentStatus === "paid" ? colors.success : colors.warning}
            />
            <Text
              style={[
                styles.paymentStatusText,
                { color: entry.paymentStatus === "paid" ? colors.success : colors.warning },
              ]}
            >
              {entry.paymentStatus === "paid" ? "Payment Received" : "Payment Pending"}
            </Text>
          </View>

          {entry.customerMobile ? (
            <Text style={[styles.mobile, { color: colors.mutedForeground }]}>
              Customer SMS: +91 {entry.customerMobile}
            </Text>
          ) : null}

          {ticketUrl ? (
            <View style={[styles.linkBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="link" size={14} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.primary }]} numberOfLines={2}>
                {ticketUrl}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.terms, { color: colors.mutedForeground }]}>
            This is your parking ticket for {parking.name}. Keep this ticket safe. Lost tickets or extra duration will be charged as per parking rules.
          </Text>
        </View>
      </View>

      <PrimaryButton
        label={entry.customerMobile ? "Share Ticket Message" : "Share Ticket"}
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

function DetailItem({ label, value, colors }: { label: string; value: string; colors: any }) {
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

function getTicketUrl(publicToken?: string): string {
  if (!publicToken) return "";
  return `${getApiDomain()}/api/entries/public-ticket/${publicToken}`;
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
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    marginBottom: 3,
  },
  ticketParkingName: {
    color: "#fff",
    fontSize: 18,
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
    gap: 5,
  },
  ticketIdLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  ticketId: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  ticketSubText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  vehiclePlate: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 190,
  },
  vehiclePlateText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textAlign: "center",
  },
  vehicleType: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    opacity: 0.72,
    marginTop: 4,
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
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  terms: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
