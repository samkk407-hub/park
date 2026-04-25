import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

export default function PlansScreen() {
  const { token, parking, user } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isOwner = user?.role === "owner" || user?.role === "superadmin";

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [requesting, setRequesting] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !parking || !isOwner) return;
    setLoading(true);
    try {
      const response = await api.getSubscriptionSummary(parking.id, token);
      setSummary(response.subscription);
      setPlans(response.plans || []);
      setPurchases(response.purchases || []);
      if (!selectedPlanId && response.plans?.[0]?._id) setSelectedPlanId(response.plans[0]._id);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [isOwner, parking, selectedPlanId, token]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const buyPlan = async () => {
    if (!token || !parking || !selectedPlanId) return;
    try {
      setRequesting(true);
      const selectedPlan = plans.find((plan) => plan._id === selectedPlanId);
      const response = await api.createPlanPurchase(
        {
          parkingId: parking.id,
          planId: selectedPlanId,
        },
        token
      );
      const base = process.env.EXPO_PUBLIC_DOMAIN
        ? `${process.env.EXPO_PUBLIC_DOMAIN.startsWith("http") ? "" : "http://"}${process.env.EXPO_PUBLIC_DOMAIN}`
        : "";
      await WebBrowser.openBrowserAsync(`${base}${response.checkoutUrl}`);
      Alert.alert(
        "Payment Started",
        `${selectedPlan?.name || "Plan"} Razorpay checkout has opened. Entries will be added automatically after successful payment.`
      );
      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to start payment");
    } finally {
      setRequesting(false);
    }
  };

  if (!isOwner) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Entry Plans" showBack />
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>Only owners can buy plans.</Text>
        </View>
      </View>
    );
  }

  const total = summary?.totalEntries || 0;
  const used = summary?.usedEntries || 0;
  const remaining = summary?.remainingEntries || 0;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Entry Plans" subtitle="Free quota and paid packs" showBack />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: isWeb ? 34 : insets.bottom + 20 }}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Usage</Text>
          <View style={styles.usageRow}>
            <UsageItem label="Used" value={used} color={colors.destructive} />
            <UsageItem label="Remaining" value={remaining} color={colors.success} />
            <UsageItem label="Total" value={total} color={colors.primary} />
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: remaining <= 100 ? colors.destructive : colors.primary }]} />
          </View>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            First {summary?.freeEntryLimit || 1000} entries are free. After the limit is reached, buy a plan with Razorpay and entries will be added automatically after successful payment.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Buy Entry Pack</Text>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan._id}
              style={[
                styles.planRow,
                {
                  borderColor: selectedPlanId === plan._id ? colors.primary : colors.border,
                  backgroundColor: selectedPlanId === plan._id ? colors.accent : colors.muted,
                },
              ]}
              onPress={() => setSelectedPlanId(plan._id)}
            >
              <View style={[styles.planIcon, { backgroundColor: colors.primary }]}>
                <Feather name="package" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                <Text style={[styles.planSub, { color: colors.mutedForeground }]}>
                  {plan.entryLimit} entries
                </Text>
              </View>
              <Text style={[styles.price, { color: colors.primary }]}>Rs {plan.price}</Text>
            </TouchableOpacity>
          ))}
          <PrimaryButton label="Pay with Razorpay" onPress={buyPlan} loading={requesting || loading} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Plan Payments</Text>
          {purchases.length === 0 ? (
            <Text style={{ color: colors.mutedForeground }}>No plan payments yet.</Text>
          ) : (
            purchases.map((purchase) => (
              <View key={purchase._id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.planName, { color: colors.foreground }]}>{purchase.planName}</Text>
                  <Text style={[styles.planSub, { color: colors.mutedForeground }]}>
                    Rs {purchase.price} | {purchase.entryLimit} entries | {new Date(purchase.createdAt).toLocaleDateString("en-IN")}
                  </Text>
                </View>
                <Text style={[styles.status, { color: statusColor(purchase.status, colors) }]}>
                  {(purchase.status === "paid" ? "PAID" : purchase.status.toUpperCase())}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function UsageItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.usageItem}>
      <Text style={[styles.usageValue, { color }]}>{value}</Text>
      <Text style={styles.usageLabel}>{label}</Text>
    </View>
  );
}

function statusColor(status: string, colors: any) {
  if (status === "approved") return colors.success;
  if (status === "rejected") return colors.destructive;
  return colors.warning;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  usageRow: { flexDirection: "row", gap: 10 },
  usageItem: { flex: 1 },
  usageValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  usageLabel: { color: "#64748b", fontSize: 12, fontFamily: "Inter_400Regular" },
  progressTrack: { height: 9, borderRadius: 20, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 20 },
  helper: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  planRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  planIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  planName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  planSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  price: { fontSize: 18, fontFamily: "Inter_700Bold" },
  historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, paddingVertical: 10, gap: 8 },
  status: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
