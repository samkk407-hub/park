import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

export default function EntryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { parking, entries, user, addEntry, updatePaymentStatus } = useApp();

  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");
  const [numberPlate, setNumberPlate] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("offline");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rate = parking
    ? vehicleType === "bike" ? parking.bikeRate
    : vehicleType === "car" ? parking.carRate
    : parking.otherRate
    : 0;

  const insideCount = useMemo(() =>
    entries.filter(e => e.status === "inside").length,
    [entries]
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!numberPlate.trim()) errs.numberPlate = "Number plate is required";
    if (numberPlate.trim().length < 4) errs.numberPlate = "Enter a valid number plate";
    if (customerMobile && customerMobile.length !== 10) errs.customerMobile = "Enter valid 10-digit mobile";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createPaidEntry = async (selectedPaymentType: PaymentType) => {
    const entry = await addEntry({
      vehicleType,
      numberPlate: numberPlate.trim().toUpperCase(),
      customerMobile: customerMobile.trim(),
      entryTime: new Date().toISOString(),
      paymentType: selectedPaymentType,
      paymentStatus: "pending",
      amount: rate,
      status: "inside",
      attendantId: user?.id || "",
      attendantName: user?.name || "Unknown",
    });

    await updatePaymentStatus(entry.id, "paid", selectedPaymentType);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
          `Demo checkout for Rs ${rate}. Continue payment and generate ticket?`,
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
                  .catch(() => {
                    Alert.alert("Error", "Failed to complete online payment and generate ticket");
                  })
                  .finally(() => setLoading(false));
              },
            },
          ]
        );
        return;
      }

      await createPaidEntry("offline");
    } catch (e) {
      Alert.alert("Error", "Failed to save entry");
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

          {/* Vehicle Type */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              <Text style={[styles.rateText, { color: colors.primary }]}>Rate: Rs {rate}/hr</Text>
            </View>
          </View>

          {/* Vehicle Details */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Vehicle Details</Text>
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

          {/* Payment */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Payment Method</Text>
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
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
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
