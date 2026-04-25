import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp, User } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

type LoginMode = "owner" | "attendant";
type Step = "role" | "mobile" | "otp";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginWithToken, showToast } = useApp();
  const isWeb = Platform.OS === "web";

  const [step, setStep] = useState<Step>("role");
  const [loginMode, setLoginMode] = useState<LoginMode>("owner");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const otpRefs = useRef<TextInput[]>([]);

  const selectRole = (mode: LoginMode) => {
    setLoginMode(mode);
    setMobile("");
    setOtp(["", "", "", "", "", ""]);
    setDevOtp(null);
    setStep("mobile");
  };

  const handleSendOtp = async () => {
    if (mobile.length !== 10) {
      Alert.alert("Invalid Number", "Please enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const res = await api.sendOtp(mobile);
      if (res.devOtp) setDevOtp(res.devOtp);
      setStep("otp");
      showToast(`OTP sent to +91 ${mobile}`, "success");
      if (res.devOtp) {
        Alert.alert("OTP Sent (Dev Mode)", `Your OTP is: ${res.devOtp}`);
      } else {
        Alert.alert("OTP Sent", `OTP sent to +91 ${mobile}`);
      }
    } catch (e: any) {
      showToast(e.message || "Failed to send OTP", "error");
      Alert.alert("Error", e.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter complete 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyOtp(mobile, enteredOtp, loginMode);
      const u = res.user;
      const user: User = {
        id: u._id || u.id,
        name: u.name,
        mobile: u.mobile,
        role: u.role,
        parkingId: u.parkingId,
      };
      await loginWithToken(res.token, user, res.parking);
      router.replace("/");
    } catch (e: any) {
      showToast(e.message || "OTP verification failed", "error");
      Alert.alert("Login Failed", e.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, idx: number) => {
    const digits = val.replace(/[^0-9]/g, "");
    const newOtp = [...otp];
    newOtp[idx] = digits.slice(-1);
    setOtp(newOtp);
    if (digits && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKey = (key: string, idx: number) => {
    if (key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const roleScreen = (
    <View style={styles.roleScreen}>
      <View style={styles.header}>
        <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
          <Feather name="map-pin" size={32} color="#fff" />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>ParkEase</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Smart Parking Management
        </Text>
      </View>

      <View style={[styles.card, styles.roleCardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.roleIntro, { backgroundColor: colors.accent }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Choose Your Role</Text>
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
            Select how you want to use ParkEase.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.roleCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => selectRole("owner")}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIcon, { backgroundColor: colors.primary }]}>
            <Feather name="briefcase" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleCardTitle, { color: colors.foreground }]}>Owner Login</Text>
            <Text style={[styles.roleCardSub, { color: colors.mutedForeground }]}>
              Set up your parking, manage staff, and track reports.
            </Text>
            <View style={styles.rolePoints}>
              <Text style={[styles.rolePoint, { color: colors.primary }]}>
                Create and manage your parking
              </Text>
              <Text style={[styles.rolePoint, { color: colors.primary }]}>
                Add attendants and monitor earnings
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={() => selectRole("attendant")}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIcon, { backgroundColor: colors.info }]}>
            <Feather name="user" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleCardTitle, { color: colors.foreground }]}>Attendant Login</Text>
            <Text style={[styles.roleCardSub, { color: colors.mutedForeground }]}>
              Use this if your owner has already added your number.
            </Text>
            <View style={styles.rolePoints}>
              <Text style={[styles.rolePoint, { color: colors.mutedForeground }]}>
                For entry, exit, and daily operations
              </Text>
              <Text style={[styles.rolePoint, { color: colors.mutedForeground }]}>
                Cannot create a new parking
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={colors.info} />
        </TouchableOpacity>

        <View style={[styles.helpBox, { backgroundColor: colors.accent }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.helpText, { color: colors.primary }]}>
            Owners create parkings. Attendants can sign in only after being added by an owner.
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {step === "role" ? (
        <View
          style={[
            styles.container,
            styles.roleContainer,
            {
              backgroundColor: colors.background,
              paddingTop: isWeb ? 80 : insets.top + 20,
              paddingBottom: isWeb ? 34 : insets.bottom + 20,
            },
          ]}
        >
          {roleScreen}
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: isWeb ? 80 : insets.top + 20,
            paddingBottom: isWeb ? 34 : insets.bottom + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {step === "mobile" && (
          <>
            <View style={styles.header}>
              <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
                <Feather name="map-pin" size={32} color="#fff" />
              </View>
              <Text style={[styles.appName, { color: colors.foreground }]}>ParkEase</Text>
              <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
                Smart Parking Management
              </Text>
            </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStep("role")} style={styles.backRow}>
              <Feather name="arrow-left" size={18} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.primary }]}>Change role</Text>
            </TouchableOpacity>

            <View style={[styles.modePill, { backgroundColor: colors.primary + "15" }]}>
              <Feather
                name={loginMode === "owner" ? "briefcase" : "user"}
                size={13}
                color={colors.primary}
              />
              <Text style={[styles.modePillText, { color: colors.primary }]}>
                {loginMode === "owner" ? "Owner Login" : "Attendant Login"}
              </Text>
            </View>

            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Enter Mobile Number</Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
              {loginMode === "attendant"
                ? "Your number must be registered by your parking owner"
                : "Enter your mobile number to receive OTP"}
            </Text>

            <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.flag, { color: colors.foreground }]}>+91</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TextInput
                style={[styles.phoneInput, { color: colors.foreground }]}
                placeholder="Enter mobile number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={setMobile}
                autoFocus
              />
            </View>

            <PrimaryButton label="Send OTP" onPress={handleSendOtp} loading={loading} />
          </View>
          </>
        )}

        {step === "otp" && (
          <>
            <View style={styles.header}>
              <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
                <Feather name="map-pin" size={32} color="#fff" />
              </View>
              <Text style={[styles.appName, { color: colors.foreground }]}>ParkEase</Text>
              <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
                Smart Parking Management
              </Text>
            </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStep("mobile")} style={styles.backRow}>
              <Feather name="arrow-left" size={18} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.primary }]}>Change number</Text>
            </TouchableOpacity>

            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Enter OTP</Text>
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
              Sent to +91 {mobile}
            </Text>

            {devOtp && (
              <View style={[styles.devOtpBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.devOtpText, { color: colors.mutedForeground }]}>
                  Dev OTP: <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>{devOtp}</Text>
                </Text>
              </View>
            )}

            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={r => { if (r) otpRefs.current[idx] = r; }}
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: colors.muted,
                      borderColor: digit ? colors.primary : colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  value={digit}
                  onChangeText={v => handleOtpChange(v, idx)}
                  onKeyPress={({ nativeEvent }) => handleOtpKey(nativeEvent.key, idx)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={idx === 0}
                />
              ))}
            </View>

            <PrimaryButton label="Verify & Login" onPress={handleVerifyOtp} loading={loading} />

            <TouchableOpacity onPress={handleSendOtp} style={styles.resendRow}>
              <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                Did not receive OTP? <Text style={{ color: colors.primary }}>Resend</Text>
              </Text>
            </TouchableOpacity>
          </View>
          </>
        )}
      </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 24 },
  roleContainer: { flex: 1 },
  roleScreen: { flex: 1, justifyContent: "space-between", gap: 20 },
  header: { alignItems: "center", gap: 8, paddingTop: 20, paddingBottom: 10 },
  logoBox: { width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 16 },
  roleCardContainer: { padding: 18, gap: 14 },
  cardTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  cardSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  roleIntro: {
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  roleCardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  roleCardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  rolePoints: {
    marginTop: 8,
    gap: 4,
  },
  rolePoint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  helpBox: {
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modePillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 54, gap: 10 },
  flag: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  divider: { width: 1, height: 24 },
  phoneInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  otpBox: { width: 46, height: 54, borderRadius: 10, borderWidth: 1.5, fontSize: 20, fontFamily: "Inter_700Bold" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: -4 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  resendRow: { alignItems: "center", paddingTop: 4 },
  resendText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  devOtpBox: { borderRadius: 8, borderWidth: 1, padding: 10 },
  devOtpText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
