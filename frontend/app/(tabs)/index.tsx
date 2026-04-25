import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useMemo } from "react";
import {
  Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { StatsCard } from "@/components/StatsCard";
import { OccupancyBar } from "@/components/OccupancyBar";
import { EntryCard } from "@/components/EntryCard";
import { useRouter } from "expo-router";
import { getBasePaymentAmount, getEntryAmountForPaymentType, getOverstayPaymentAmount } from "@/lib/entryMoney";

export default function DashboardScreen() {
  const { user, parking, entries, refreshData, refreshSession } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const [refreshing, setRefreshing] = React.useState(false);

  const today = useMemo(() => new Date().toDateString(), []);

  const stats = useMemo(() => {
    const todayEntries = entries.filter(e => new Date(e.entryTime).toDateString() === today);
    const inside = entries.filter(e => e.status === "inside");
    const todayExited = todayEntries.filter(e => e.status === "exited");
    const onlineIncome = todayEntries.reduce((sum, entry) => sum + getEntryAmountForPaymentType(entry, "online"), 0);
    const offlineIncome = todayEntries.reduce((sum, entry) => sum + getEntryAmountForPaymentType(entry, "offline"), 0);
    const pending = entries.filter(e => e.paymentStatus === "pending").length;
    return {
      inside: inside.length,
      todayTotal: todayEntries.length,
      todayExited: todayExited.length,
      onlineIncome,
      offlineIncome,
      totalIncome: onlineIncome + offlineIncome,
      pending,
      myCollectedCash: user
        ? entries
            .reduce((sum, entry) => {
              const base = entry.paymentStatus === "paid" &&
                entry.paymentType === "offline" &&
                entry.paymentCollectedByUserId === user.id &&
                entry.settlementStatus === "unsettled"
                ? getBasePaymentAmount(entry)
                : 0;
              const overstay = entry.overstayPaymentType === "offline" &&
                entry.overstayCollectedByUserId === user.id &&
                entry.overstaySettlementStatus === "unsettled"
                ? getOverstayPaymentAmount(entry)
                : 0;
              return sum + base + overstay;
            }, 0)
        : 0,
      ownerWalletBalance: user?.role === "owner" || user?.role === "superadmin"
        ? entries
            .reduce((sum, entry) => {
              const base = entry.paymentStatus === "paid" &&
                entry.paymentType === "online" &&
                entry.paymentCollectedByRole === "owner" &&
                entry.onlineSettlementStatus === "unsettled"
                ? getBasePaymentAmount(entry)
                : 0;
              const overstay = entry.overstayPaymentType === "online" &&
                entry.overstayCollectedByRole === "owner" &&
                entry.overstayOnlineSettlementStatus === "unsettled"
                ? getOverstayPaymentAmount(entry)
                : 0;
              return sum + base + overstay;
            }, 0)
        : 0,
      occupancyPct: parking ? Math.min((inside.length / parking.totalCapacity) * 100, 100) : 0,
    };
  }, [entries, today, parking, user]);

  const recentEntries = useMemo(() =>
    entries.filter(e => e.status === "inside").slice(0, 5),
    [entries]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession])
  );

  if (!parking) return null;

  const topPad = isWeb ? 67 : insets.top + 16;
  const botPad = isWeb ? 34 : insets.bottom + 90;
  const canViewIncome = user?.role === "owner" || user?.role === "superadmin";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: botPad, gap: 10, paddingHorizontal: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Good {getGreeting()}, {user?.name?.split(" ")[0]}
          </Text>
          <Text style={[styles.parkingName, { color: colors.foreground }]}>{parking.name}</Text>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/logs")}
        >
          <Feather name="bell" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.success }]}
          onPress={() => router.push("/entry")}
          activeOpacity={0.85}
        >
          <Feather name="plus-circle" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>New Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
          onPress={() => router.push("/exit")}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Occupancy */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Live Occupancy</Text>
        <OccupancyBar current={stats.inside} total={parking.totalCapacity} label="Total Slots" />
      </View>

      {/* Key Stats Grid */}
      <View style={styles.gridRow}>
        <StatsCard
          label="Inside Now"
          value={stats.inside}
          icon="truck"
          color={colors.primary}
          bgColor={colors.accent}
        />
        <StatsCard
          label="Today's Total"
          value={stats.todayTotal}
          icon="users"
          color={colors.info}
          bgColor={colors.infoLight}
        />
      </View>
      <View style={styles.gridRow}>
        <StatsCard
          label="Exited Today"
          value={stats.todayExited}
          icon="log-out"
          color={colors.success}
          bgColor={colors.successLight}
        />
        <StatsCard
          label="Pending Payment"
          value={stats.pending}
          icon="alert-circle"
          color={stats.pending > 0 ? colors.warning : colors.success}
          bgColor={stats.pending > 0 ? colors.warningLight : colors.successLight}
        />
      </View>

      {user?.role === "attendant" && (
        <View style={styles.gridRow}>
          <StatsCard
            label="Cash To Submit"
            value={`Rs ${stats.myCollectedCash}`}
            icon="briefcase"
            color={stats.myCollectedCash > 0 ? colors.warning : colors.success}
            bgColor={stats.myCollectedCash > 0 ? colors.warningLight : colors.successLight}
            subtitle={stats.myCollectedCash > 0 ? "Collect by owner pending" : "All settled"}
          />
        </View>
      )}

      {(user?.role === "owner" || user?.role === "superadmin") && (
        <View style={styles.gridRow}>
          <StatsCard
            label="Owner UPI Total"
            value={`Rs ${stats.ownerWalletBalance}`}
            icon="credit-card"
            color={stats.ownerWalletBalance > 0 ? colors.primary : colors.success}
            bgColor={stats.ownerWalletBalance > 0 ? colors.accent : colors.successLight}
            subtitle={stats.ownerWalletBalance > 0 ? "Paid to owner barcode" : "No owner UPI today"}
          />
        </View>
      )}

      {canViewIncome && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{"Today's Income"}</Text>
          <View style={styles.incomeRow}>
            <View style={[styles.incomeItem, { backgroundColor: colors.accent, borderRadius: 10 }]}>
              <Feather name="wifi" size={14} color={colors.primary} />
              <Text style={[styles.incomeLabel, { color: colors.mutedForeground }]}>Owner UPI</Text>
              <Text style={[styles.incomeAmount, { color: colors.primary }]}>₹{stats.onlineIncome}</Text>
            </View>
            <View style={[styles.incomeItem, { backgroundColor: colors.successLight, borderRadius: 10 }]}>
              <Feather name="dollar-sign" size={14} color={colors.success} />
              <Text style={[styles.incomeLabel, { color: colors.mutedForeground }]}>Cash</Text>
              <Text style={[styles.incomeAmount, { color: colors.success }]}>₹{stats.offlineIncome}</Text>
            </View>
            <View style={[styles.incomeItem, { backgroundColor: colors.muted, borderRadius: 10 }]}>
              <Feather name="trending-up" size={14} color={colors.foreground} />
              <Text style={[styles.incomeLabel, { color: colors.mutedForeground }]}>Total</Text>
              <Text style={[styles.incomeAmount, { color: colors.foreground }]}>₹{stats.totalIncome}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Inside */}
      {recentEntries.length > 0 && (
        <View>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Currently Inside</Text>
            <TouchableOpacity onPress={() => router.push("/entries")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentEntries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onPress={() => router.push({ pathname: "/entry-detail", params: { id: entry.id } })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 12,
  },
  parkingName: {
    fontSize: 18,
    fontWeight: "600",
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    gap: 8,
  },
  incomeRow: {
    flexDirection: "row",
    gap: 6,
  },
  incomeItem: {
    flex: 1,
    padding: 8,
    alignItems: "center",
    gap: 2,
  },
  incomeLabel: {
    fontSize: 11,
  },
  incomeAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 7,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  seeAll: {
    fontSize: 14,
  },
});
