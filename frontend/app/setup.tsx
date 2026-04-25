import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, View
} from "react-native";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { FormInput } from "@/components/FormInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";

interface Errors {
  name?: string;
  ownerName?: string;
  location?: string;
  city?: string;
  state?: string;
  bikeRate?: string;
  carRate?: string;
  totalCapacity?: string;
}

export default function SetupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { parking, setupParking } = useApp();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    location: "",
    city: "",
    state: "",
    bikeRate: "",
    carRate: "",
    otherRate: "",
    workingHours: "8:00 AM - 10:00 PM",
    totalCapacity: "",
    bikeCapacity: "",
    carCapacity: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!parking) return;

    setForm({
      name: parking.name || "",
      ownerName: parking.ownerName || "",
      location: parking.location || "",
      city: parking.city || "",
      state: parking.state || "",
      bikeRate: parking.bikeRate ? String(parking.bikeRate) : "",
      carRate: parking.carRate ? String(parking.carRate) : "",
      otherRate: parking.otherRate ? String(parking.otherRate) : "",
      workingHours: parking.workingHours || "8:00 AM - 10:00 PM",
      totalCapacity: parking.totalCapacity ? String(parking.totalCapacity) : "",
      bikeCapacity: parking.bikeCapacity ? String(parking.bikeCapacity) : "",
      carCapacity: parking.carCapacity ? String(parking.carCapacity) : "",
      notes: parking.notes || "",
    });
  }, [parking]);

  const set = (key: string, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const newErrors: Errors = {};
    if (!form.name.trim()) newErrors.name = "Parking name is required";
    if (!form.ownerName.trim()) newErrors.ownerName = "Owner name is required";
    if (!form.location.trim()) newErrors.location = "Location is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.state.trim()) newErrors.state = "State is required";
    if (!form.bikeRate || isNaN(Number(form.bikeRate))) newErrors.bikeRate = "Valid bike rate required";
    if (!form.carRate || isNaN(Number(form.carRate))) newErrors.carRate = "Valid car rate required";
    if (!form.totalCapacity || isNaN(Number(form.totalCapacity))) newErrors.totalCapacity = "Total capacity required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await setupParking({
        name: form.name.trim(),
        ownerName: form.ownerName.trim(),
        location: form.location.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        bikeRate: Number(form.bikeRate),
        carRate: Number(form.carRate),
        otherRate: Number(form.otherRate) || Number(form.carRate),
        workingHours: form.workingHours,
        totalCapacity: Number(form.totalCapacity),
        bikeCapacity: Number(form.bikeCapacity) || 0,
        carCapacity: Number(form.carCapacity) || 0,
        notes: form.notes,
      });
      router.replace("/");
    } catch {
      Alert.alert("Error", "Failed to save parking profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader
          title={parking ? "Complete Parking Details" : "Parking Setup"}
          subtitle={parking ? "Update the remaining parking information" : "Configure your parking area"}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Basic Information</Text>
            </View>
            <FormInput
              label="Parking Name"
              placeholder="e.g. City Center Parking"
              value={form.name}
              onChangeText={v => set("name", v)}
              error={errors.name}
              icon="map-pin"
              required
            />
            <FormInput
              label="Owner Name"
              placeholder="Full name of owner"
              value={form.ownerName}
              onChangeText={v => set("ownerName", v)}
              error={errors.ownerName}
              icon="user"
              required
            />
            <FormInput
              label="Location / Address"
              placeholder="Full address"
              value={form.location}
              onChangeText={v => set("location", v)}
              error={errors.location}
              icon="map"
              required
              multiline
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="City"
                  placeholder="e.g. Indore"
                  value={form.city}
                  onChangeText={v => set("city", v)}
                  error={errors.city}
                  icon="map-pin"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="State"
                  placeholder="e.g. Madhya Pradesh"
                  value={form.state}
                  onChangeText={v => set("state", v)}
                  error={errors.state}
                  icon="flag"
                  required
                />
              </View>
            </View>
            <FormInput
              label="Working Hours"
              placeholder="e.g. 8:00 AM - 10:00 PM"
              value={form.workingHours}
              onChangeText={v => set("workingHours", v)}
              icon="clock"
            />
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="tag" size={16} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Parking Rates (per day)</Text>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Bike Rate"
                  placeholder="20"
                  value={form.bikeRate}
                  onChangeText={v => set("bikeRate", v)}
                  error={errors.bikeRate}
                  keyboardType="numeric"
                  icon="zap"
                  suffix="Rs/day"
                  required
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Car Rate"
                  placeholder="40"
                  value={form.carRate}
                  onChangeText={v => set("carRate", v)}
                  error={errors.carRate}
                  keyboardType="numeric"
                  icon="truck"
                  suffix="Rs/day"
                  required
                />
              </View>
            </View>
            <FormInput
              label="Other Vehicle Rate"
              placeholder="Same as car rate if blank"
              value={form.otherRate}
              onChangeText={v => set("otherRate", v)}
              keyboardType="numeric"
              icon="box"
              suffix="Rs/day"
            />
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="layout" size={16} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Capacity</Text>
            </View>
            <FormInput
              label="Total Capacity"
              placeholder="100"
              value={form.totalCapacity}
              onChangeText={v => set("totalCapacity", v)}
              error={errors.totalCapacity}
              keyboardType="numeric"
              icon="layers"
              suffix="vehicles"
              required
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Bike Slots"
                  placeholder="60"
                  value={form.bikeCapacity}
                  onChangeText={v => set("bikeCapacity", v)}
                  keyboardType="numeric"
                  icon="zap"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Car Slots"
                  placeholder="40"
                  value={form.carCapacity}
                  onChangeText={v => set("carCapacity", v)}
                  keyboardType="numeric"
                  icon="truck"
                />
              </View>
            </View>
            <FormInput
              label="Notes (Optional)"
              placeholder="Any additional info"
              value={form.notes}
              onChangeText={v => set("notes", v)}
              multiline
              numberOfLines={3}
            />
          </View>

          <PrimaryButton
            label={parking ? "Save Details" : "Save & Start"}
            onPress={handleSave}
            loading={loading}
          />
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
});
