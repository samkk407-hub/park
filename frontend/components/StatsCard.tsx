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
        <Feather name={icon} size={17} color={iconColor} />
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
    padding: 10,
    borderWidth: 1,
    alignItems: "flex-start",
    gap: 2,
    minWidth: 140,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  value: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
