import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, VehicleEntry } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";

export default function ExitScreen() {
  const colors = useColors();
  const router = useRouter();
  const { entries, parking, exitVehicle, updatePaymentStatus, refreshSession } = useApp();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<VehicleEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession])
  );

  const insideEntries = useMemo(() =>
    entries.filter(e => e.status === "inside"),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return insideEntries;
    return insideEntries.filter(e =>
      e.numberPlate.toLowerCase().includes(q) ||
      e.ticketId.toLowerCase().includes(q) ||
      e.customerMobile.includes(q)
    );
  }, [insideEntries, search]);

  const handleSelect = (entry: VehicleEntry) => {
    setSelectedEntry(entry);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getDurationMinutes = (entry: VehicleEntry) => {
    const entryMs = new Date(entry.entryTime).getTime();
    const nowMs = Date.now();
    return Math.ceil((nowMs - entryMs) / (1000 * 60));
  };

  const calculateFinalAmount = (entry: VehicleEntry) => {
    if (!parking) return entry.amount;
    const minutes = getDurationMinutes(entry);
    const hours = Math.max(1, Math.ceil(minutes / 60));
    const rate = entry.vehicleType === "bike" ? parking.bikeRate
      : entry.vehicleType === "car" ? parking.carRate
      : parking.otherRate;
    return hours * rate;
  };

  const handleExit = async () => {
    if (!selectedEntry) return;
    const finalAmount = calculateFinalAmount(selectedEntry);

    Alert.alert(
      "Confirm Exit",
      `Vehicle: ${selectedEntry.numberPlate}\nDuration: ${formatDuration(getDurationMinutes(selectedEntry))}\nFinal Amount: ₹${finalAmount}\n\nProceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Exit",
          onPress: async () => {
            setLoading(true);
            try {
              await exitVehicle(selectedEntry.id, new Date().toISOString());
              if (finalAmount !== selectedEntry.amount) {
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Exit Successful",
                `${selectedEntry.numberPlate} has been checked out.\nTotal: ₹${finalAmount}`,
                [{ text: "Done", onPress: () => router.push("/") }]
              );
              setSelectedEntry(null);
              setSearch("");
            } catch (e) {
              Alert.alert("Error", "Failed to process exit");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Vehicle Exit" subtitle="Process checkout" showBack />

        {/* Search */}
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <View style={[styles.searchRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search ticket ID, plate number, mobile..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={v => { setSearch(v); setSelectedEntry(null); }}
            />
            {search ? (
              <TouchableOpacity onPress={() => { setSearch(""); setSelectedEntry(null); }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>
            {insideEntries.length} vehicles currently inside
          </Text>
        </View>

        {/* Selected Entry Detail */}
        {selectedEntry && (
          <View style={[styles.selectedCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary, margin: 16, marginTop: 0 }]}>
            <View style={styles.selectedHeader}>
              <Text style={[styles.selectedPlate, { color: colors.primary }]}>{selectedEntry.numberPlate}</Text>
              <TouchableOpacity onPress={() => setSelectedEntry(null)}>
                <Feather name="x-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.selectedDetails}>
              <DetailRow label="Ticket" value={selectedEntry.ticketId} colors={colors} />
              <DetailRow label="Entry Time" value={new Date(selectedEntry.entryTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} colors={colors} />
              <DetailRow label="Duration" value={formatDuration(getDurationMinutes(selectedEntry))} colors={colors} />
              <DetailRow label="Final Amount" value={`₹${calculateFinalAmount(selectedEntry)}`} colors={colors} highlight />
              <DetailRow label="Payment Status" value={selectedEntry.paymentStatus.toUpperCase()} colors={colors} />
            </View>
            <PrimaryButton label="Confirm Exit" onPress={handleExit} loading={loading} />
          </View>
        )}

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedEntry?.id === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.entryItem,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    marginHorizontal: 16,
                  },
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.vehicleIcon, { backgroundColor: colors.muted }]}>
                  <Feather
                    name={item.vehicleType === "bike" ? "zap" : item.vehicleType === "car" ? "truck" : "box"}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.plate, { color: colors.foreground }]}>{item.numberPlate}</Text>
                  <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                    {item.ticketId} · {formatDuration(getDurationMinutes(item))}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.amount, { color: colors.foreground }]}>₹{calculateFinalAmount(item)}</Text>
                  <View style={[styles.badge, { backgroundColor: item.paymentStatus === "paid" ? colors.successLight : colors.warningLight }]}>
                    <Text style={[styles.badgeText, { color: item.paymentStatus === "paid" ? colors.success : colors.warning }]}>
                      {item.paymentStatus === "paid" ? "PAID" : "PENDING"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={[
            { paddingBottom: isWeb ? 34 : insets.bottom + 20, gap: 8, paddingTop: 4 },
            filtered.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={40} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No vehicles inside</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function DetailRow({ label, value, colors, highlight }: { label: string; value: string; colors: any; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: highlight ? colors.primary : colors.foreground, fontFamily: highlight ? "Inter_700Bold" : "Inter_600SemiBold" }]}>
        {value}
      </Text>
    </View>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
  selectedCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  selectedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedPlate: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  selectedDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  detailValue: {
    fontSize: 13,
  },
  entryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  vehicleIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  plate: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 3,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  emptyContainer: {
    flex: 1,
  },
  empty: {
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
