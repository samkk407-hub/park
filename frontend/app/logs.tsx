import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import {
  FlatList, Platform, StyleSheet, Text, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, ActivityLog } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { ScreenHeader } from "@/components/ScreenHeader";

const ACTION_CONFIG: Record<string, { icon: any; color: string }> = {
  VEHICLE_ENTRY: { icon: "log-in", color: "#1d4ed8" },
  VEHICLE_EXIT: { icon: "log-out", color: "#16a34a" },
  PAYMENT_UPDATE: { icon: "credit-card", color: "#d97706" },
  STAFF_ADDED: { icon: "user-plus", color: "#0891b2" },
  STAFF_UPDATED: { icon: "edit-2", color: "#7c3aed" },
  STAFF_DELETED: { icon: "user-minus", color: "#dc2626" },
};

export default function LogsScreen() {
  const { activityLogs, refreshSession } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession])
  );

  const renderLog = ({ item }: { item: ActivityLog }) => {
    const cfg = ACTION_CONFIG[item.action] || { icon: "activity", color: colors.primary };
    return (
      <View style={[styles.logItem, { borderBottomColor: colors.border }]}>
        <View style={[styles.iconBox, { backgroundColor: cfg.color + "18" }]}>
          <Feather name={cfg.icon} size={16} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.logDetails, { color: colors.foreground }]}>{item.details}</Text>
          <View style={styles.logMeta}>
            <Text style={[styles.logUser, { color: colors.primary }]}>{item.userName}</Text>
            <Text style={[styles.logTime, { color: colors.mutedForeground }]}>
              · {formatDateTime(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Activity Logs"
        subtitle={`${activityLogs.length} events recorded`}
        showBack
      />
      <FlatList
        data={activityLogs}
        keyExtractor={item => item.id}
        renderItem={renderLog}
        contentContainerStyle={[
          { paddingBottom: isWeb ? 34 : insets.bottom + 20 },
          activityLogs.length === 0 && { flex: 1 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="list" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No activity recorded yet</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

const styles = StyleSheet.create({
  logItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logDetails: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  logMeta: {
    flexDirection: "row",
    marginTop: 3,
  },
  logUser: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  logTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
