import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type DateRange = "today" | "week" | "month" | "all";

export default function ReportsScreen() {
  const { entries, parking, refreshSession } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [range, setRange] = useState<DateRange>("today");

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 : insets.bottom + 90;

  const filtered = useMemo(() => {
    const now = new Date();
    return entries.filter(e => {
      const d = new Date(e.entryTime);
      if (range === "today") return d.toDateString() === now.toDateString();
      if (range === "week") {
        const week = new Date(now);
        week.setDate(now.getDate() - 7);
        return d >= week;
      }
      if (range === "month") {
        const month = new Date(now);
        month.setMonth(now.getMonth() - 1);
        return d >= month;
      }
      return true;
    });
  }, [entries, range]);

  const stats = useMemo(() => {
    const totalIncome = filtered.filter(e => e.paymentStatus === "paid").reduce((s, e) => s + e.amount, 0);
    const onlineIncome = filtered.filter(e => e.paymentType === "online" && e.paymentStatus === "paid").reduce((s, e) => s + e.amount, 0);
    const offlineIncome = filtered.filter(e => e.paymentType === "offline" && e.paymentStatus === "paid").reduce((s, e) => s + e.amount, 0);
    const pending = filtered.filter(e => e.paymentStatus === "pending").reduce((s, e) => s + e.amount, 0);
    const bikes = filtered.filter(e => e.vehicleType === "bike").length;
    const cars = filtered.filter(e => e.vehicleType === "car").length;
    const others = filtered.filter(e => e.vehicleType === "other").length;
    const avgDuration = filtered.filter(e => e.duration).reduce((s, e) => s + (e.duration || 0), 0) / (filtered.filter(e => e.duration).length || 1);
    return { totalIncome, onlineIncome, offlineIncome, pending, bikes, cars, others, avgDuration: Math.round(avgDuration) };
  }, [filtered]);

  const dateRangeTabs: { key: DateRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "7 Days" },
    { key: "month", label: "30 Days" },
    { key: "all", label: "All Time" },
  ];

  const handleExport = () => {
    Alert.alert("Export", "CSV export would be implemented with a file system integration.\n\nIn production, this generates a CSV file with all entries.");
  };

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, gap: 16, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Reports</Text>
        <TouchableOpacity
          style={[styles.exportBtn, { borderColor: colors.border }]}
          onPress={handleExport}
        >
          <Feather name="download" size={16} color={colors.primary} />
          <Text style={[styles.exportText, { color: colors.primary }]}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Date Range */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {dateRangeTabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, range === tab.key && { backgroundColor: colors.card }]}
            onPress={() => setRange(tab.key)}
          >
            <Text style={[styles.tabText, { color: range === tab.key ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Income Summary */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Income Summary</Text>
        <View style={[styles.totalRow, { backgroundColor: colors.primary }]}>
          <Text style={styles.totalLabel}>Total Collected</Text>
          <Text style={styles.totalAmount}>₹{stats.totalIncome}</Text>
        </View>
        <View style={styles.row}>
          <View style={[styles.halfCard, { backgroundColor: colors.accent }]}>
            <Feather name="wifi" size={16} color={colors.primary} />
            <Text style={[styles.halfLabel, { color: colors.mutedForeground }]}>Online</Text>
            <Text style={[styles.halfAmount, { color: colors.primary }]}>₹{stats.onlineIncome}</Text>
          </View>
          <View style={[styles.halfCard, { backgroundColor: colors.successLight }]}>
            <Feather name="dollar-sign" size={16} color={colors.success} />
            <Text style={[styles.halfLabel, { color: colors.mutedForeground }]}>Offline</Text>
            <Text style={[styles.halfAmount, { color: colors.success }]}>₹{stats.offlineIncome}</Text>
          </View>
        </View>
        {stats.pending > 0 && (
          <View style={[styles.pendingRow, { backgroundColor: colors.warningLight }]}>
            <Feather name="alert-triangle" size={14} color={colors.warning} />
            <Text style={[styles.pendingText, { color: colors.warning }]}>
              ₹{stats.pending} pending collection
            </Text>
          </View>
        )}
      </View>

      {/* Vehicle Stats */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Vehicle Breakdown</Text>
        <View style={styles.vehicleRow}>
          <View style={[styles.vehicleItem, { backgroundColor: colors.muted }]}>
            <Feather name="zap" size={20} color={colors.primary} />
            <Text style={[styles.vehicleCount, { color: colors.foreground }]}>{stats.bikes}</Text>
            <Text style={[styles.vehicleLabel, { color: colors.mutedForeground }]}>Bikes</Text>
          </View>
          <View style={[styles.vehicleItem, { backgroundColor: colors.muted }]}>
            <Feather name="truck" size={20} color={colors.info} />
            <Text style={[styles.vehicleCount, { color: colors.foreground }]}>{stats.cars}</Text>
            <Text style={[styles.vehicleLabel, { color: colors.mutedForeground }]}>Cars</Text>
          </View>
          <View style={[styles.vehicleItem, { backgroundColor: colors.muted }]}>
            <Feather name="box" size={20} color={colors.warning} />
            <Text style={[styles.vehicleCount, { color: colors.foreground }]}>{stats.others}</Text>
            <Text style={[styles.vehicleLabel, { color: colors.mutedForeground }]}>Others</Text>
          </View>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Summary</Text>
        <StatRow label="Total Entries" value={String(filtered.length)} icon="log-in" colors={colors} />
        <StatRow label="Total Exits" value={String(filtered.filter(e => e.status === "exited").length)} icon="log-out" colors={colors} />
        <StatRow label="Avg Parking Duration" value={`${stats.avgDuration} min`} icon="clock" colors={colors} />
        <StatRow label="Paid Entries" value={String(filtered.filter(e => e.paymentStatus === "paid").length)} icon="check-circle" colors={colors} />
        <StatRow label="Pending Payment" value={String(filtered.filter(e => e.paymentStatus === "pending").length)} icon="alert-circle" colors={colors} />
      </View>

      {/* Attendant Breakdown */}
      <AttendantBreakdown entries={filtered} colors={colors} />
    </ScrollView>
  );
}

function StatRow({ label, value, icon, colors }: { label: string; value: string; icon: any; colors: any }) {
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name={icon} size={14} color={colors.primary} />
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function AttendantBreakdown({ entries, colors }: { entries: any[]; colors: any }) {
  const byAttendant = useMemo(() => {
    const map: Record<string, { name: string; count: number; income: number }> = {};
    entries.forEach(e => {
      if (!map[e.attendantId]) map[e.attendantId] = { name: e.attendantName, count: 0, income: 0 };
      map[e.attendantId].count++;
      if (e.paymentStatus === "paid") map[e.attendantId].income += e.amount;
    });
    return Object.values(map);
  }, [entries]);

  if (byAttendant.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Staff Activity</Text>
      {byAttendant.map((att, idx) => (
        <View key={idx} style={[styles.attendantRow, { borderBottomColor: colors.border }]}>
          <View style={[styles.attendantAvatar, { backgroundColor: colors.accent }]}>
            <Feather name="user" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.attendantName, { color: colors.foreground }]}>{att.name}</Text>
            <Text style={[styles.attendantSub, { color: colors.mutedForeground }]}>{att.count} entries</Text>
          </View>
          <Text style={[styles.attendantIncome, { color: colors.success }]}>₹{att.income}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exportText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tabsContainer: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  totalRow: {
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  totalAmount: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  halfCard: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    alignItems: "center",
  },
  halfLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  halfAmount: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: 10,
  },
  pendingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  vehicleRow: {
    flexDirection: "row",
    gap: 10,
  },
  vehicleItem: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  vehicleCount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  vehicleLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  attendantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  attendantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  attendantName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  attendantSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  attendantIncome: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
