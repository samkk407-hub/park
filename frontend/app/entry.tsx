import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, type KeyboardTypeOptions,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, VehicleType, PaymentType } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { PrimaryButton } from "@/components/PrimaryButton";

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: any }[] = [
  { type: "bike", label: "Bike", icon: "navigation" },
  { type: "car", label: "Car", icon: "truck" },
  { type: "other", label: "Other", icon: "box" },
];

const PAYMENT_OPTIONS: { type: PaymentType; label: string; icon: any }[] = [
  { type: "online", label: "Owner QR / UPI", icon: "maximize" },
  { type: "offline", label: "Cash", icon: "dollar-sign" },
];
const STAY_DAY_OPTIONS = [1, 2, 3, 7, 10];
const NUMBER_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/;

function getPlateCharType(index: number): "letter" | "digit" | null {
  if (index < 2) return "letter";
  if (index < 4) return "digit";
  if (index < 6) return "letter";
  if (index < 10) return "digit";
  return null;
}

function sanitizeNumberPlate(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let next = "";
  for (const char of raw) {
    const expected = getPlateCharType(next.length);
    if (!expected) break;
    if (expected === "letter" && /^[A-Z]$/.test(char)) next += char;
    if (expected === "digit" && /^[0-9]$/.test(char)) next += char;
  }
  return next;
}

function formatNumberPlate(value: string): string {
  const parts = [
    value.slice(0, 2),
    value.slice(2, 4),
    value.slice(4, 6),
    value.slice(6, 10),
  ].filter(Boolean);
  return parts.join(" ");
}

function getNumberPlateKeyboard(value: string): KeyboardTypeOptions {
  return getPlateCharType(value.length) === "digit" ? "numeric" : "default";
}

export default function EntryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    if (numberPlate.trim() && !NUMBER_PLATE_REGEX.test(numberPlate.trim())) {
      errs.numberPlate = "Enter number plate like MH12AB1234";
    }
    if (customerMobile && customerMobile.length !== 10) errs.customerMobile = "Enter valid 10-digit mobile";
    if (!stayDays || Number.isNaN(Number(stayDays)) || Number(stayDays) < 1) errs.stayDays = "Enter valid days";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isPlanLimitError = (message?: string) => {
    const text = message?.toLowerCase() || "";
    return text.includes("entry limit") || text.includes("entry plan") || text.includes("plan khatam");
  };

  const showPlanRequired = () => {
    Alert.alert(
      "Entry Plan Khatam",
      "Naya ticket katne ke liye Entry Plan purchase karo.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Buy Plan", onPress: () => router.push("/plans" as any) },
      ]
    );
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
          "Owner QR Payment",
          `Ask the customer to pay Rs ${totalAmount} to the owner's barcode/UPI. Generate the ticket only after payment is confirmed.`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setLoading(false),
            },
            {
              text: "Payment Received",
              onPress: () => {
                void createPaidEntry("online")
                  .catch((e: any) => {
                    if (isPlanLimitError(e.message)) {
                      showPlanRequired();
                    } else {
                      Alert.alert("Error", e.message || "Failed to confirm owner UPI payment and generate ticket");
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
      if (isPlanLimitError(e.message)) {
        showPlanRequired();
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
    <KeyboardAvoidingView style={styles.screenRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.screenRoot, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.compactHeader,
            {
              backgroundColor: colors.primary + "0D",
              borderBottomColor: colors.border,
              paddingTop: (Platform.OS === "web" ? 8 : insets.top) + 6,
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerTitleArea}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Entry</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Add incoming vehicle</Text>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primary }]}>
                <Feather name="truck" size={16} color="#fff" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Vehicle Details</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Select vehicle and customer info</Text>
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
                      backgroundColor: vehicleType === opt.type ? colors.primary + "10" : colors.card,
                      borderColor: vehicleType === opt.type ? colors.primary : colors.border,
                      borderWidth: vehicleType === opt.type ? 1.5 : 1,
                      shadowColor: vehicleType === opt.type ? colors.primary : "#0f172a",
                    },
                  ]}
                  onPress={() => {
                    setVehicleType(opt.type);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name={opt.icon} size={18} color={vehicleType === opt.type ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.optLabel, { color: vehicleType === opt.type ? colors.primary : colors.foreground }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.rateLine, { backgroundColor: colors.primary + "12" }]}>
              <Feather name="tag" size={16} color={colors.primary} />
              <Text style={[styles.rateText, { color: colors.primary }]}>Rate: Rs {dayRate}/day</Text>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Number Plate <Text style={{ color: colors.destructive }}>*</Text>
              </Text>
              <View style={[styles.underlineInput, { borderBottomColor: errors.numberPlate ? colors.destructive : colors.border }]}>
                <Feather name="credit-card" size={16} color={colors.primary} />
                <TextInput
                  style={[styles.flatInput, { color: colors.foreground }]}
                  placeholder="MH 12 AB 1234"
                  placeholderTextColor={colors.mutedForeground}
                  value={formatNumberPlate(numberPlate)}
                  onChangeText={v => {
                    setNumberPlate(sanitizeNumberPlate(v));
                    setErrors(prev => ({ ...prev, numberPlate: "" }));
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType={getNumberPlateKeyboard(numberPlate)}
                  maxLength={13}
                />
              </View>
              {errors.numberPlate ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.numberPlate}</Text> : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Customer Mobile (Optional)</Text>
              <View style={[styles.underlineInput, { borderBottomColor: errors.customerMobile ? colors.destructive : colors.border }]}>
                <Feather name="phone" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.flatInput, { color: colors.foreground }]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.mutedForeground}
                  value={customerMobile}
                  onChangeText={v => {
                    setCustomerMobile(v.replace(/[^0-9]/g, ""));
                    setErrors(prev => ({ ...prev, customerMobile: "" }));
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              {errors.customerMobile ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.customerMobile}</Text> : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.success }]}>
                <Feather name="calendar" size={16} color="#fff" />
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
                      borderWidth: plannedDays === days ? 1.5 : 1,
                      shadowColor: plannedDays === days ? colors.success : "#0f172a",
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

            <View style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Custom Days</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, { backgroundColor: colors.muted }]}
                  onPress={() => {
                    setStayDays(String(Math.max(1, plannedDays - 1)));
                    setErrors(prev => ({ ...prev, stayDays: "" }));
                  }}
                >
                  <Feather name="minus" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.daysInput, { color: colors.foreground }]}
                  value={stayDays}
                  onChangeText={v => {
                    setStayDays(v.replace(/[^0-9]/g, ""));
                    setErrors(prev => ({ ...prev, stayDays: "" }));
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TouchableOpacity
                  style={[styles.stepperBtn, { backgroundColor: colors.muted }]}
                  onPress={() => {
                    setStayDays(String(plannedDays + 1));
                    setErrors(prev => ({ ...prev, stayDays: "" }));
                  }}
                >
                  <Feather name="plus" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                <Text style={[styles.daysSuffix, { color: colors.mutedForeground }]}>days</Text>
              </View>
              {errors.stayDays ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.stayDays}</Text> : null}
            </View>

            <View style={[styles.totalBox, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.totalLabel, { color: colors.success }]}>Total to collect</Text>
                <Text style={[styles.totalSub, { color: colors.mutedForeground }]}>Rs {dayRate}/day x {plannedDays} day(s)</Text>
              </View>
              <Text style={[styles.totalAmount, { color: colors.success }]}>Rs {totalAmount}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.info }]}>
                <Feather name="credit-card" size={16} color="#fff" />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Payment Method</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Collect payment before ticket</Text>
              </View>
            </View>
            <View style={styles.optionRow}>
              {PAYMENT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.type}
                  style={[
                    styles.payBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: paymentType === opt.type ? colors.primary : colors.border,
                      borderWidth: paymentType === opt.type ? 1.5 : 1,
                      shadowColor: paymentType === opt.type ? colors.primary : "#0f172a",
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

          <View style={[styles.timeRow, { borderTopColor: colors.border }]}>
            <View style={styles.timeLeft}>
              <Feather name="clock" size={14} color={colors.primary} />
              <Text style={[styles.timeText, { color: colors.primary }]}>
                Entry Time: {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} | {new Date().toLocaleDateString("en-IN")}
              </Text>
            </View>
            <Text style={[styles.changeText, { color: colors.primary }]}>Change</Text>
          </View>

        </View>
        <View style={[styles.footerBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={styles.submitLift}>
            <PrimaryButton
              label={paymentType === "online" ? "Confirm UPI & Generate Ticket" : "Collect Cash & Generate Ticket"}
              onPress={handleSubmit}
              loading={loading}
              size="sm"
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    overflow: "hidden",
  },
  compactHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: Platform.OS === "ios" ? 68 : 60,
    gap: 5,
    justifyContent: "space-between",
  },
  section: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  cardSub: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionRow: {
    flexDirection: "row",
    gap: 5,
  },
  optBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  optLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  rateLine: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rateText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  fieldBlock: {
    gap: 1,
  },
  underlineInput: {
    minHeight: 30,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flatInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    paddingVertical: 2,
  },
  errorText: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.25)",
  },
  dayRow: {
    flexDirection: "row",
    gap: 4,
  },
  dayBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  dayBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  dayAmount: {
    fontSize: 8,
    fontFamily: "Inter_500Medium",
  },
  stepperRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  daysInput: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 1,
  },
  daysSuffix: {
    marginLeft: "auto",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  totalBox: {
    borderTopWidth: 1,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  totalSub: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  totalAmount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  payBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexDirection: "row",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 3,
  },
  timeLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  timeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  changeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 8,
  },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: Platform.OS === "ios" ? 22 : 16,
  },
  submitLift: {
    borderRadius: 12,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
});
