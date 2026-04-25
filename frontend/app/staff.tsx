import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, Staff } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api } from "@/lib/api";

interface AttendantCollection {
  attendantId: string;
  attendantName: string;
  mobile: string;
  totalHandled: number;
  pendingCount: number;
  pendingAmount: number;
  offlineCollected: number;
  onlineCollected: number;
  unsettledAmount: number;
  settledAmount: number;
}

export default function StaffScreen() {
  const { user, token, parking, staff, addStaff, updateStaff, deleteStaff, refreshSession } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [modalVisible, setModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState({ name: "", mobile: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Record<string, AttendantCollection>>({});
  const [ownerSummary, setOwnerSummary] = useState({
    ownerOnlineCollected: 0,
    ownerOfflineCollected: 0,
    attendantUnsettled: 0,
  });

  const isOwner = user?.role === "owner" || user?.role === "superadmin";

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      const load = async () => {
        await refreshSession();
        if (!token || !parking) return;
        const response = await api.getAttendantCollections(parking.id, token);
        if (!active) return;

        setCollections(
          Object.fromEntries(
            response.collections.map((item: AttendantCollection) => [item.attendantId, item])
          )
        );
        setOwnerSummary(response.ownerSummary);
      };

      void load();
      return () => {
        active = false;
      };
    }, [parking, refreshSession, token])
  );

  const openAdd = () => {
    setEditingStaff(null);
    setForm({ name: "", mobile: "" });
    setErrors({});
    setModalVisible(true);
  };

  const openEdit = (s: Staff) => {
    setEditingStaff(s);
    setForm({ name: s.name, mobile: s.mobile });
    setErrors({});
    setModalVisible(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.mobile || form.mobile.length !== 10) errs.mobile = "Valid 10-digit mobile required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, { name: form.name });
      } else {
        await addStaff({ name: form.name, mobile: form.mobile, role: "attendant", isActive: true });
      }
      if (token && parking) {
        const response = await api.getAttendantCollections(parking.id, token);
        setCollections(
          Object.fromEntries(
            response.collections.map((item: AttendantCollection) => [item.attendantId, item])
          )
        );
        setOwnerSummary(response.ownerSummary);
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = (s: Staff) => {
    if (!isOwner) {
      Alert.alert("Access Denied", "Only owners can remove staff");
      return;
    }
    Alert.alert(
      "Remove Attendant",
      `Remove ${s.name}? They will lose access to this parking.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteStaff(s.id);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to remove");
            }
          },
        },
      ]
    );
  };

  const activeStaff = staff.filter(s => s.isActive);
  const inactiveStaff = staff.filter(s => !s.isActive);

  const handleSettle = (staffMember: Staff) => {
    if (!token || !parking) return;

    const summary = collections[staffMember.id];
    const amount = summary?.unsettledAmount || 0;
    if (amount <= 0) {
      Alert.alert("Nothing to collect", "This attendant has no unsettled cash to collect.");
      return;
    }

    Alert.alert(
      "Collect Cash",
      `Collect Rs ${amount} from ${staffMember.name} and mark it settled?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Collect",
          onPress: async () => {
            try {
              setSettlingId(staffMember.id);
              const result = await api.settleAttendantCollection(staffMember.id, parking.id, token);
              const response = await api.getAttendantCollections(parking.id, token);
              setCollections(
                Object.fromEntries(
                  response.collections.map((item: AttendantCollection) => [item.attendantId, item])
                )
              );
              setOwnerSummary(response.ownerSummary);
              Alert.alert("Collected", `Rs ${result.settledAmount} marked as collected by owner.`);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to settle cash");
            } finally {
              setSettlingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Staff Management"
        subtitle={`${activeStaff.length} active attendant${activeStaff.length !== 1 ? "s" : ""}`}
        showBack
        rightAction={
          isOwner ? (
            <TouchableOpacity onPress={openAdd} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isOwner && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Owner Collection Summary</Text>
            <Text style={[styles.summaryLine, { color: colors.mutedForeground }]}>
              Direct Online: Rs {ownerSummary.ownerOnlineCollected}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.mutedForeground }]}>
              Owner Offline: Rs {ownerSummary.ownerOfflineCollected}
            </Text>
            <Text style={[styles.summaryLine, { color: colors.warning }]}>
              Attendant Cash Pending: Rs {ownerSummary.attendantUnsettled}
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={activeStaff}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <StaffCard
            staff={item}
            collection={collections[item.id]}
            onEdit={() => openEdit(item)}
            onDeactivate={() => handleDeactivate(item)}
            onSettle={() => handleSettle(item)}
            settling={settlingId === item.id}
            colors={colors}
            isOwner={isOwner}
          />
        )}
        ListHeaderComponent={
          activeStaff.length === 0 ? null : (
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIVE ATTENDANTS</Text>
          )
        }
        ListFooterComponent={
          inactiveStaff.length > 0 ? (
            <View>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>REMOVED</Text>
              {inactiveStaff.map(s => (
                <StaffCard
                  key={s.id}
                  staff={s}
                  collection={collections[s.id]}
                  onEdit={() => {}}
                  onDeactivate={() => {}}
                  onSettle={() => {}}
                  settling={false}
                  colors={colors}
                  isOwner={false}
                  inactive
                />
              ))}
            </View>
          ) : null
        }
        contentContainerStyle={{
          padding: 16,
          paddingBottom: isWeb ? 34 : insets.bottom + 20,
          gap: 8,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No attendants added yet</Text>
            {isOwner && (
              <PrimaryButton label="Add First Attendant" onPress={openAdd} size="md" />
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {editingStaff ? "Edit Attendant" : "Add Attendant"}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={22} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
                <FormInput
                  label="Full Name"
                  placeholder="Attendant's name"
                  value={form.name}
                  onChangeText={v => setForm(prev => ({ ...prev, name: v }))}
                  error={errors.name}
                  icon="user"
                  required
                />
                {!editingStaff && (
                  <FormInput
                    label="Mobile Number"
                    placeholder="10-digit mobile"
                    value={form.mobile}
                    onChangeText={v => setForm(prev => ({ ...prev, mobile: v }))}
                    error={errors.mobile}
                    icon="phone"
                    keyboardType="phone-pad"
                    maxLength={10}
                    required
                  />
                )}

                <View style={[styles.infoBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                  <Feather name="info" size={14} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                    Attendant will be able to sign in using this mobile number with OTP
                  </Text>
                </View>

                <PrimaryButton label={editingStaff ? "Save Changes" : "Add Attendant"} onPress={handleSave} loading={loading} />
                <PrimaryButton label="Cancel" onPress={() => setModalVisible(false)} variant="outline" size="md" />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StaffCard({ staff, collection, onEdit, onDeactivate, onSettle, settling, colors, isOwner, inactive }: {
  staff: Staff;
  collection?: AttendantCollection;
  onEdit: () => void;
  onDeactivate: () => void;
  onSettle: () => void;
  settling: boolean;
  colors: any;
  isOwner: boolean;
  inactive?: boolean;
}) {
  const unsettledAmount = collection?.unsettledAmount || 0;

  return (
    <View style={[styles.staffCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: inactive ? 0.5 : 1 }]}>
      <View style={styles.staffTopRow}>
        <View style={[styles.staffAvatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.staffAvatarText, { color: colors.primary }]}>
            {staff.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.staffName, { color: colors.foreground }]}>{staff.name}</Text>
          <Text style={[styles.staffMobile, { color: colors.mutedForeground }]}>+91 {staff.mobile}</Text>
          <View style={[styles.rolePill, { backgroundColor: colors.accent }]}>
            <Text style={[styles.rolePillText, { color: colors.primary }]}>{staff.role.toUpperCase()}</Text>
          </View>
          <Text style={[styles.staffMeta, { color: colors.mutedForeground }]}>
            Pending: Rs {collection?.pendingAmount || 0} | Cash to owner: Rs {collection?.unsettledAmount || 0}
          </Text>
        </View>
        {!inactive && isOwner && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={onEdit} style={[styles.actionBtn, { backgroundColor: colors.accent }]}>
              <Feather name="edit-2" size={15} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDeactivate} style={[styles.actionBtn, { backgroundColor: colors.warningLight }]}>
              <Feather name="user-minus" size={15} color={colors.warning} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {!inactive && isOwner && (
        <View style={styles.collectRow}>
          <TouchableOpacity
            onPress={onSettle}
            style={[
              styles.collectBtn,
              {
                backgroundColor: unsettledAmount > 0 ? colors.successLight : colors.muted,
                borderColor: unsettledAmount > 0 ? colors.success : colors.border,
                opacity: settling ? 0.7 : 1,
              },
            ]}
            disabled={settling}
          >
            <Feather
              name={unsettledAmount > 0 ? "check-circle" : "check"}
              size={15}
              color={unsettledAmount > 0 ? colors.success : colors.mutedForeground}
            />
            <Text
              style={[
                styles.collectBtnText,
                { color: unsettledAmount > 0 ? colors.success : colors.mutedForeground },
              ]}
            >
              {unsettledAmount > 0
                ? `Collect Cash Rs ${unsettledAmount}`
                : "No Cash Pending"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  staffCard: {
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  staffTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  staffAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  staffName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  staffMobile: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  staffMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
  rolePill: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  rolePillText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  actions: { gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  collectRow: {
    marginTop: 4,
  },
  collectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  collectBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  empty: { alignItems: "center", gap: 14, paddingTop: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  summaryLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
