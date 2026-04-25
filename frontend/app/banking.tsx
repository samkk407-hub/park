import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface BankAccountForm {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
}

export default function BankingScreen() {
  const { user, token, parking } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [walletSummary, setWalletSummary] = useState({
    totalCollected: 0,
    walletBalance: 0,
    pendingToBank: 0,
    settledToBank: 0,
    unsettledCount: 0,
    pendingCount: 0,
  });
  const [recentSettlements, setRecentSettlements] = useState<any[]>([]);
  const [form, setForm] = useState<BankAccountForm>({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
  });

  const isOwner = user?.role === "owner" || user?.role === "superadmin";

  const loadData = React.useCallback(async () => {
    if (!token || !parking || !isOwner) return;
    const response = await api.getBankingAccount(parking.id, token);
    setWalletSummary(response.walletSummary);
    setRecentSettlements(response.recentSettlements || []);
    if (response.bankAccount) {
      setForm({
        accountHolderName: response.bankAccount.accountHolderName || "",
        bankName: response.bankAccount.bankName || "",
        accountNumber: response.bankAccount.accountNumber || "",
        ifscCode: response.bankAccount.ifscCode || "",
        upiId: response.bankAccount.upiId || "",
      });
    }
  }, [isOwner, parking, token]);

  useFocusEffect(
    React.useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    if (!token || !parking) return;
    if (!form.accountHolderName.trim() || !form.bankName.trim() || !form.accountNumber.trim() || !form.ifscCode.trim()) {
      Alert.alert("Missing Details", "Please fill account holder, bank name, account number and IFSC.");
      return;
    }

    try {
      setLoading(true);
      await api.saveBankingAccount(
        {
          parkingId: parking.id,
          accountHolderName: form.accountHolderName.trim(),
          bankName: form.bankName.trim(),
          accountNumber: form.accountNumber.trim(),
          ifscCode: form.ifscCode.trim().toUpperCase(),
          upiId: form.upiId.trim(),
        },
        token
      );
      Alert.alert("Saved", "Bank account saved successfully.");
      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save bank account");
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!token || !parking) return;
    if (walletSummary.walletBalance <= 0) {
      Alert.alert("Wallet Empty", "No online balance is waiting to settle.");
      return;
    }

    Alert.alert(
      "Settle To Bank",
      `Send Rs ${walletSummary.walletBalance} from owner wallet to bank?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Settle",
          onPress: async () => {
            try {
              setSettling(true);
              const result = await api.settleWalletToBank(parking.id, token);
              Alert.alert(
                "Settlement Requested",
                `Rs ${result.amount} moved to pending bank settlement. Wait 24 hours, amount will reach the bank account after admin approval.`
              );
              await loadData();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to settle wallet");
            } finally {
              setSettling(false);
            }
          },
        },
      ]
    );
  };

  if (!isOwner) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Banking" showBack />
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>Only owners can access banking.</Text>
        </View>
      </View>
    );
  }

  const botPad = isWeb ? 34 : insets.bottom + 20;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Banking" subtitle="Owner wallet and bank settlement" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: botPad }}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Owner Wallet</Text>
          <View style={styles.walletGrid}>
            <WalletItem label="Wallet Balance" value={`Rs ${walletSummary.walletBalance}`} color={colors.success} />
            <WalletItem label="Pending To Bank" value={`Rs ${walletSummary.pendingToBank}`} color={colors.warning} />
            <WalletItem label="Settled To Bank" value={`Rs ${walletSummary.settledToBank}`} color={colors.info} />
          </View>
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            When the owner settles the wallet, the amount moves to pending. It will be marked successful only after admin approval.
          </Text>
          <PrimaryButton label="Settle Wallet To Bank" onPress={handleSettle} loading={settling} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Settlement Bank Account</Text>
          <FormInput
            label="Account Holder Name"
            value={form.accountHolderName}
            onChangeText={(v) => setForm((prev) => ({ ...prev, accountHolderName: v }))}
            icon="user"
            required
          />
          <FormInput
            label="Bank Name"
            value={form.bankName}
            onChangeText={(v) => setForm((prev) => ({ ...prev, bankName: v }))}
            icon="briefcase"
            required
          />
          <FormInput
            label="Account Number"
            value={form.accountNumber}
            onChangeText={(v) => setForm((prev) => ({ ...prev, accountNumber: v }))}
            icon="credit-card"
            keyboardType="number-pad"
            required
          />
          <FormInput
            label="IFSC Code"
            value={form.ifscCode}
            onChangeText={(v) => setForm((prev) => ({ ...prev, ifscCode: v.toUpperCase() }))}
            icon="hash"
            autoCapitalize="characters"
            required
          />
          <FormInput
            label="UPI ID (Optional)"
            value={form.upiId}
            onChangeText={(v) => setForm((prev) => ({ ...prev, upiId: v }))}
            icon="at-sign"
          />
          <PrimaryButton label="Save Bank Account" onPress={handleSave} loading={loading} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent Bank Settlements</Text>
          {recentSettlements.length === 0 ? (
            <Text style={{ color: colors.mutedForeground }}>No bank settlements yet.</Text>
          ) : (
            recentSettlements.map((item) => (
              <View key={item._id} style={[styles.settlementRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.settlementIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="arrow-down-circle" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
                    Rs {item.amount} {item.status === "completed" ? "settled to bank" : "waiting for bank settlement"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {item.transactionCount} online payments | {new Date(item.createdAt).toLocaleString("en-IN")} | {item.status === "completed" ? "Success" : "Pending"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function WalletItem({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={styles.walletItem}>
      <Text style={[styles.walletValue, { color }]}>{value}</Text>
      <Text style={styles.walletLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  walletGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  walletItem: {
    width: "47%",
    gap: 4,
  },
  walletValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  walletLabel: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter_400Regular",
  },
  settlementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  settlementIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
