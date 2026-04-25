import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type VehicleEntry } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";
import { getEntryAmountForPaymentType } from "@/lib/entryMoney";

type DateRange = "today" | "week" | "month" | "all";

export default function ReportsScreen() {
  const { parking, token, user, showToast } = useApp();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [range, setRange] = useState<DateRange>("all");
  const [reportEntries, setReportEntries] = useState<VehicleEntry[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const canManageStaff = user?.role === "owner" || user?.role === "superadmin";

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 : insets.bottom + 90;

  const filtered = useMemo(() => {
    const now = new Date();
    return reportEntries.filter(e => {
      const d = new Date(e.entryTime);
      if (Number.isNaN(d.getTime())) return false;
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
  }, [reportEntries, range]);

  const stats = useMemo(() => {
    const totalIncome = filtered.filter(e => e.paymentStatus === "paid").reduce((s, e) => s + e.amount, 0);
    const onlineIncome = filtered.reduce((sum, entry) => sum + getEntryAmountForPaymentType(entry, "online"), 0);
    const offlineIncome = filtered.reduce((sum, entry) => sum + getEntryAmountForPaymentType(entry, "offline"), 0);
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

  const fetchReportEntries = useCallback(async () => {
    if (!token || !parking?.id) return;
    setIsReportLoading(true);
    setReportError(null);
    try {
      const { entries: data } = await api.getEntries(parking.id, token, { limit: "1000" });
      setReportEntries(data.map(mapReportEntry));
    } catch (e: any) {
      const message = e.message || "Report data load nahi hua";
      setReportError(message);
      showToast(message, "error");
      await api.logFrontendError({
        area: "reports.load",
        message,
        stack: e.stack,
        metadata: { parkingId: parking.id, range },
      });
    } finally {
      setIsReportLoading(false);
    }
  }, [parking?.id, range, showToast, token]);

  const handleExport = async () => {
    if (filtered.length === 0) {
      showToast("No entries to export", "info");
      return;
    }

    const csv = buildReportCsv(filtered);
    const fileName = `parking-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;

    try {
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const file = new FileSystem.File(FileSystem.Paths.cache, fileName);
        file.create({ overwrite: true });
        file.write(csv);
        const uri = file.uri;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "text/csv",
            dialogTitle: "Export parking report",
            UTI: "public.comma-separated-values-text",
          });
        } else {
          Alert.alert("Report Saved", uri);
        }
      }
      showToast("Report exported", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to export report", "error");
      Alert.alert("Export Failed", e.message || "Failed to export report");
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      void fetchReportEntries();
    }, [fetchReportEntries])
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

      {isReportLoading && (
        <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Report data load ho raha hai...</Text>
        </View>
      )}

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
            <Text style={[styles.halfLabel, { color: colors.mutedForeground }]}>Owner UPI</Text>
            <Text style={[styles.halfAmount, { color: colors.primary }]}>₹{stats.onlineIncome}</Text>
          </View>
          <TouchableOpacity
            style={[styles.halfCard, { backgroundColor: colors.successLight }]}
            onPress={() => canManageStaff && router.push("/staff")}
            activeOpacity={canManageStaff ? 0.75 : 1}
            disabled={!canManageStaff}
          >
            <Feather name="dollar-sign" size={16} color={colors.success} />
            <Text style={[styles.halfLabel, { color: colors.mutedForeground }]}>Cash</Text>
            <Text style={[styles.halfAmount, { color: colors.success }]}>₹{stats.offlineIncome}</Text>
          </TouchableOpacity>
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

      {!isReportLoading && filtered.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="bar-chart-2" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {reportError ? "Report load failed" : "No report data"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {reportError
              ? reportError
              : reportEntries.length === 0
              ? "API se abhi report entries nahi mili. Thoda wait karke tab dobara open karo."
              : "Is date range me entry nahi hai. 7 Days, 30 Days ya All Time select karo."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function mapReportEntry(e: any): VehicleEntry {
  return {
    id: e._id || e.id,
    ticketId: e.ticketId,
    publicToken: e.publicToken,
    ticketUrl: e.ticketUrl,
    parkingId: e.parkingId,
    vehicleType: e.vehicleType,
    numberPlate: e.numberPlate,
    customerMobile: e.customerMobile || "",
    entryTime: e.entryTime,
    exitTime: e.exitTime,
    plannedDurationDays: e.plannedDurationDays,
    validUntil: e.validUntil,
    paymentType: e.paymentType,
    paymentStatus: e.paymentStatus,
    paymentCollectedByUserId: e.paymentCollectedByUserId,
    paymentCollectedByName: e.paymentCollectedByName,
    paymentCollectedByRole: e.paymentCollectedByRole,
    paymentCollectedAt: e.paymentCollectedAt,
    settlementStatus: e.settlementStatus,
    onlineSettlementStatus: e.onlineSettlementStatus,
    onlineSettledAt: e.onlineSettledAt,
    onlineSettlementId: e.onlineSettlementId,
    settledAt: e.settledAt,
    settledByUserId: e.settledByUserId,
    settledByName: e.settledByName,
    baseAmount: e.baseAmount,
    overstayAmount: e.overstayAmount,
    overstayPaymentType: e.overstayPaymentType,
    overstayCollectedByUserId: e.overstayCollectedByUserId,
    overstayCollectedByName: e.overstayCollectedByName,
    overstayCollectedByRole: e.overstayCollectedByRole,
    overstayCollectedAt: e.overstayCollectedAt,
    overstayOnlineSettlementStatus: e.overstayOnlineSettlementStatus,
    overstayOnlineSettledAt: e.overstayOnlineSettledAt,
    overstayOnlineSettlementId: e.overstayOnlineSettlementId,
    overstaySettlementStatus: e.overstaySettlementStatus,
    overstaySettledAt: e.overstaySettledAt,
    overstaySettledByUserId: e.overstaySettledByUserId,
    overstaySettledByName: e.overstaySettledByName,
    amount: e.amount || 0,
    status: e.status,
    attendantId: e.attendantId || "unknown",
    attendantName: e.attendantName || "Unknown",
    duration: e.duration,
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function reportDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function buildReportCsv(entries: any[]): string {
  const headers = [
    "Ticket ID",
    "Vehicle Number",
    "Vehicle Type",
    "Customer Mobile",
    "Entry Time",
    "Valid Till",
    "Exit Time",
    "Status",
    "Paid Days",
    "Payment Status",
    "Payment Method",
    "Total Amount",
    "Owner UPI Amount",
    "Cash Amount",
    "Attendant",
  ];

  const rows = entries.map((entry) => [
    entry.ticketId,
    entry.numberPlate,
    entry.vehicleType,
    entry.customerMobile ? `+91 ${entry.customerMobile}` : "",
    reportDate(entry.entryTime),
    reportDate(entry.validUntil),
    reportDate(entry.exitTime),
    entry.status,
    entry.plannedDurationDays || 1,
    entry.paymentStatus,
    entry.paymentType === "online" ? "Owner QR / UPI" : "Cash",
    entry.amount,
    getEntryAmountForPaymentType(entry, "online"),
    getEntryAmountForPaymentType(entry, "offline"),
    entry.attendantName,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
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
  loadingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
});
