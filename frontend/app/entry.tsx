import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import { useApp, VehicleType, PaymentType } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { OccupancyBar } from "@/components/OccupancyBar";

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: any }[] = [
  { type: "bike", label: "Bike", icon: "zap" },
  { type: "car", label: "Car", icon: "truck" },
  { type: "other", label: "Other", icon: "box" },
];

const PAYMENT_OPTIONS: { type: PaymentType; label: string; icon: any }[] = [
  { type: "online", label: "Online / UPI", icon: "wifi" },
  { type: "offline", label: "Cash / Offline", icon: "dollar-sign" },
];
const STAY_DAY_OPTIONS = [1, 2, 3, 7, 10];

export default function EntryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { parking, entries, user, addEntry } = useApp();

  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");
  const [numberPlate, setNumberPlate] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [stayDays, setStayDays] = useState("1");
  const [paymentType, setPaymentType] = useState<PaymentType>("offline");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rate = parking
    ? vehicleType === "bike" ? parking.bikeRate
    : vehicleType === "car" ? parking.carRate
    : parking.otherRate
    : 0;
  const plannedDays = Math.max(1, Math.ceil(Number(stayDays) || 1));
  const dayRate = rate;
  const totalAmount = dayRate * plannedDays;

  const insideCount = useMemo(() =>
    entries.filter(e => e.status === "inside").length,
    [entries]
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!numberPlate.trim()) errs.numberPlate = "Number plate is required";
    if (numberPlate.trim().length < 4) errs.numberPlate = "Enter a valid number plate";
    if (customerMobile && customerMobile.length !== 10) errs.customerMobile = "Enter valid 10-digit mobile";
    if (!stayDays || Number.isNaN(Number(stayDays)) || Number(stayDays) < 1) errs.stayDays = "Enter valid days";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createPaidEntry = async (selectedPaymentType: PaymentType) => {
    const entry = await addEntry({
      vehicleType,
      numberPlate: numberPlate.trim().toUpperCase(),
      customerMobile: customerMobile.trim(),
      entryTime: new Date().toISOString(),
      plannedDurationDays: plannedDays,
      paymentType: selectedPaymentType,
      paymentStatus: "paid",
      amount: totalAmount,
      status: "inside",
      attendantId: user?.id || "",
      attendantName: user?.name || "Unknown",
    });

    router.replace({ pathname: "/ticket", params: { id: entry.id } });
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!parking) {
      Alert.alert("Setup Required", "Please complete parking setup first");
      return;
    }
    if (insideCount >= parking.totalCapacity) {
      Alert.alert("Parking Full", "No slots available. Cannot add new entry.");
      return;
    }

    setLoading(true);
    try {
      if (paymentType === "online") {
        Alert.alert(
          "Razorpay Demo",
          `Demo checkout for Rs ${totalAmount} (${plannedDays} day). Continue payment and generate ticket?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setLoading(false),
            },
            {
              text: "Pay Now",
              onPress: () => {
                void createPaidEntry("online")
                  .catch((e: any) => {
                    if (e.message?.toLowerCase().includes("entry limit")) {
                      Alert.alert("Plan Required", e.message, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Buy Plan", onPress: () => router.push("/plans" as any) },
                      ]);
                    } else {
                      Alert.alert("Error", e.message || "Failed to complete online payment and generate ticket");
                    }
                  })
                  .finally(() => setLoading(false));
              },
            },
          ]
        );
        return;
      }

      await createPaidEntry("offline");
    } catch (e: any) {
      if (e.message?.toLowerCase().includes("entry limit")) {
        Alert.alert("Plan Required", e.message, [
          { text: "Cancel", style: "cancel" },
          { text: "Buy Plan", onPress: () => router.push("/plans" as any) },
        ]);
      } else {
        Alert.alert("Error", e.message || "Failed to save entry");
      }
    } finally {
      if (paymentType !== "online") {
        setLoading(false);
      }
    }
  };

  if (!parking) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Setup parking first</Text>
      <PrimaryButton label="Go to Setup" onPress={() => router.push("/setup")} size="md" />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="New Entry" subtitle="Add incoming vehicle" showBack />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Occupancy Status */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <OccupancyBar current={insideCount} total={parking.totalCapacity} label="Current Occupancy" />
          </View>

          {/* Vehicle Details */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepText}>1</Text>
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Vehicle Details</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Select vehicle and enter customer info</Text>
              </View>
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Vehicle Type</Text>
            <View style={styles.optionRow}>
              {VEHICLE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.type}
                  style={[
                    styles.optBtn,
                    {
                      backgroundColor: vehicleType === opt.type ? colors.primary : colors.muted,
                      borderColor: vehicleType === opt.type ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setVehicleType(opt.type);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name={opt.icon} size={18} color={vehicleType === opt.type ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.optLabel, { color: vehicleType === opt.type ? "#fff" : colors.foreground }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.rateTag, { backgroundColor: colors.accent }]}>
              <Feather name="tag" size={14} color={colors.primary} />
              <Text style={[styles.rateText, { color: colors.primary }]}>Rate: Rs {dayRate}/day</Text>
            </View>

            <FormInput
              label="Number Plate"
              placeholder="e.g. MH12AB1234"
              value={numberPlate}
              onChangeText={v => {
                setNumberPlate(v.toUpperCase());
                setErrors(prev => ({ ...prev, numberPlate: "" }));
              }}
              error={errors.numberPlate}
              icon="credit-card"
              autoCapitalize="characters"
              required
            />
            <FormInput
              label="Customer Mobile (Optional)"
              placeholder="10-digit mobile"
              value={customerMobile}
              onChangeText={v => {
                setCustomerMobile(v);
                setErrors(prev => ({ ...prev, customerMobile: "" }));
              }}
              error={errors.customerMobile}
              icon="phone"
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          <View style={[styles.card, styles.compactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.success }]}>
                <Text style={styles.stepText}>2</Text>
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Stay Duration</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Choose paid days for this ticket</Text>
              </View>
            </View>
            <View style={styles.dayRow}>
              {STAY_DAY_OPTIONS.map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.dayBtn,
                    {
                      backgroundColor: plannedDays === days ? colors.success : colors.muted,
                      borderColor: plannedDays === days ? colors.success : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setStayDays(String(days));
                    setErrors(prev => ({ ...prev, stayDays: "" }));
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayBtnText, { color: plannedDays === days ? "#fff" : colors.foreground }]}>
                    {days}D
                  </Text>
                  <Text style={[styles.dayAmount, { color: plannedDays === days ? "#fff" : colors.mutedForeground }]}>
                    Rs {dayRate * days}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <FormInput
              label="Custom Days"
              placeholder="1"
              value={stayDays}
              onChangeText={v => {
                setStayDays(v.replace(/[^0-9]/g, ""));
                setErrors(prev => ({ ...prev, stayDays: "" }));
              }}
              error={errors.stayDays}
              icon="calendar"
              keyboardType="numeric"
              suffix="days"
            />
            <View style={[styles.totalBox, { backgroundColor: colors.successLight }]}>
              <View>
                <Text style={[styles.totalLabel, { color: colors.success }]}>Total to collect</Text>
                <Text style={[styles.totalSub, { color: colors.mutedForeground }]}>Rs {dayRate}/day x {plannedDays} day(s)</Text>
              </View>
              <Text style={[styles.totalAmount, { color: colors.success }]}>Rs {totalAmount}</Text>
            </View>
          </View>

          {/* Payment */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.stepBadge, { backgroundColor: colors.info }]}>
                <Text style={styles.stepText}>3</Text>
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Payment Method</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Collect payment before ticket generation</Text>
              </View>
            </View>
            <View style={styles.optionRow}>
              {PAYMENT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.type}
                  style={[
                    styles.payBtn,
                    {
                      backgroundColor: paymentType === opt.type ? colors.primary + "15" : colors.muted,
                      borderColor: paymentType === opt.type ? colors.primary : colors.border,
                      borderWidth: paymentType === opt.type ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => setPaymentType(opt.type)}
                  activeOpacity={0.8}
                >
                  <Feather name={opt.icon} size={18} color={paymentType === opt.type ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.optLabel, { color: paymentType === opt.type ? colors.primary : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Entry Time */}
          <View style={[styles.timeRow, { backgroundColor: colors.accent }]}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={[styles.timeText, { color: colors.primary }]}>
              Entry Time: {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} | {new Date().toLocaleDateString("en-IN")}
            </Text>
          </View>

          <PrimaryButton
            label={paymentType === "online" ? "Pay & Generate Ticket" : "Collect Cash & Generate Ticket"}
            onPress={handleSubmit}
            loading={loading}
          />
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  compactCard: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
  },
  optBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  payBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  optLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  rateTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  rateText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  dayRow: {
    flexDirection: "row",
    gap: 8,
  },
  dayBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  dayBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  dayAmount: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  totalBox: {
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  totalSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: 10,
  },
  timeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
