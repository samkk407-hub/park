import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PrimaryButtonProps extends Omit<TouchableOpacityProps, "style"> {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "destructive" | "outline";
  size?: "sm" | "md" | "lg";
}

export function PrimaryButton({
  label, loading = false, variant = "primary", size = "lg", disabled, ...props
}: PrimaryButtonProps) {
  const colors = useColors();

  const bgColor = {
    primary: colors.primary,
    secondary: colors.secondary,
    destructive: colors.destructive,
    outline: "transparent",
  }[variant];

  const textColor = {
    primary: colors.primaryForeground,
    secondary: colors.secondaryForeground,
    destructive: colors.destructiveForeground,
    outline: colors.foreground,
  }[variant];

  const height = { sm: 40, md: 48, lg: 54 }[size];
  const fontSize = { sm: 14, md: 15, lg: 16 }[size];

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        {
          backgroundColor: bgColor,
          height,
          borderRadius: 12,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: colors.border,
          opacity: disabled || loading ? 0.6 : 1,
        },
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
  },
});
