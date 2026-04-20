import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface OccupancyBarProps {
  current: number;
  total: number;
  label?: string;
}

export function OccupancyBar({ current, total, label }: OccupancyBarProps) {
  const colors = useColors();
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const isFull = percentage >= 90;
  const isHigh = percentage >= 70;
  const barColor = isFull ? colors.destructive : isHigh ? colors.warning : colors.success;

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.header}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
          <Text style={[styles.count, { color: colors.foreground }]}>
            {current}/{total}
          </Text>
        </View>
      ) : null}
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[styles.fill, { width: `${percentage}%` as any, backgroundColor: barColor }]}
        />
      </View>
      <Text style={[styles.pct, { color: barColor }]}>{Math.round(percentage)}% occupied</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  count: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  pct: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
