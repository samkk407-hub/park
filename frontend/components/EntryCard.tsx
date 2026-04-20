import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { VehicleEntry } from "@/context/AppContext";

interface EntryCardProps {
  entry: VehicleEntry;
  onPress?: () => void;
}

const VEHICLE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  bike: "zap",
  car: "truck",
  other: "box",
};

export function EntryCard({ entry, onPress }: EntryCardProps) {
  const colors = useColors();
  const isInside = entry.status === "inside";
  const isPaid = entry.paymentStatus === "paid";

  const entryTime = new Date(entry.entryTime);
  const now = new Date();
  const durationMinutes = Math.floor((now.getTime() - entryTime.getTime()) / 60000);
  const durationText = entry.exitTime
    ? formatDuration(entry.duration || 0)
    : formatDuration(durationMinutes);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <View style={[styles.vehicleIcon, { backgroundColor: isInside ? colors.accentForeground + "20" : colors.muted }]}>
          <Feather name={VEHICLE_ICONS[entry.vehicleType] || "box"} size={18} color={isInside ? colors.primary : colors.mutedForeground} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.plate, { color: colors.foreground }]}>{entry.numberPlate.toUpperCase()}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{entry.vehicleType.toUpperCase()} · {entry.ticketId}</Text>
        </View>
        <View style={styles.right}>
          <View style={[styles.badge, { backgroundColor: isInside ? colors.successLight : colors.muted }]}>
            <Text style={[styles.badgeText, { color: isInside ? colors.success : colors.mutedForeground }]}>
              {isInside ? "INSIDE" : "EXITED"}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isPaid ? colors.successLight : colors.warningLight, marginTop: 4 }]}>
            <Text style={[styles.badgeText, { color: isPaid ? colors.success : colors.warning }]}>
              {isPaid ? "PAID" : "PENDING"}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {formatTime(entry.entryTime)}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Feather name="timer" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{durationText}</Text>
        </View>
        <View style={styles.footerItem}>
          <Feather name="indian-rupee" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            ₹{entry.amount}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Feather name={entry.paymentType === "online" ? "wifi" : "dollar-sign"} size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {entry.paymentType === "online" ? "Online" : "Cash"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  vehicleIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  plate: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
  },
  badge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  footerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
