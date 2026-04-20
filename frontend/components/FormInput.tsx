import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: keyof typeof Feather.glyphMap;
  suffix?: string;
  required?: boolean;
}

export function FormInput({
  label, error, icon, suffix, required = false, ...props
}: FormInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {label}{required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : focused ? colors.primary : colors.border,
            borderWidth: focused || error ? 1.5 : 1,
          },
        ]}
      >
        {icon && (
          <Feather name={icon} size={16} color={focused ? colors.primary : colors.mutedForeground} style={styles.icon} />
        )}
        <TextInput
          style={[styles.input, { color: colors.foreground, flex: 1 }]}
          placeholderTextColor={colors.mutedForeground}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {suffix && (
          <Text style={[styles.suffix, { color: colors.mutedForeground }]}>{suffix}</Text>
        )}
      </View>
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 12,
  },
  suffix: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginLeft: 6,
  },
  error: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
