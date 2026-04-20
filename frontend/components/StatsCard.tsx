import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
  bgColor?: string;
  subtitle?: string;
}

export function StatsCard({ label, value, icon, color, bgColor, subtitle }: StatsCardProps) {
  const colors = useColors();
  const iconColor = color || colors.primary;
  const iconBg = bgColor || colors.accent;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: iconColor }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    alignItems: "flex-start",
    gap: 4,
    minWidth: 140,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
