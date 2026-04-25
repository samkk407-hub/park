import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";
import { api } from "@/lib/api";
import colorTokens from "@/constants/colors";

export type UserRole = "admin" | "owner" | "attendant" | "superadmin";

export interface User {
  id: string;
  name: string;
  mobile: string;
  role: UserRole;
  parkingId?: string;
}

export interface ParkingProfile {
  id: string;
  name: string;
  ownerName: string;
  location: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  bikeRate: number;
  carRate: number;
  otherRate: number;
  workingHours: string;
  totalCapacity: number;
  bikeCapacity: number;
  carCapacity: number;
  notes: string;
  ownerId: string;
}

export type VehicleType = "bike" | "car" | "other";
export type PaymentType = "online" | "offline";
export type PaymentStatus = "pending" | "paid";
export type EntryStatus = "inside" | "exited";

export interface VehicleEntry {
  id: string;
  ticketId: string;
  publicToken?: string;
  ticketUrl?: string;
  parkingId: string;
  vehicleType: VehicleType;
  numberPlate: string;
  customerMobile: string;
  entryTime: string;
  exitTime?: string;
  plannedDurationDays?: number;
  validUntil?: string;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  paymentCollectedByUserId?: string;
  paymentCollectedByName?: string;
  paymentCollectedByRole?: "owner" | "attendant" | "superadmin";
  paymentCollectedAt?: string;
  settlementStatus?: "not_applicable" | "unsettled" | "settled";
  onlineSettlementStatus?: "not_applicable" | "unsettled" | "pending" | "settled";
  onlineSettledAt?: string;
  onlineSettlementId?: string;
  settledAt?: string;
  settledByUserId?: string;
  settledByName?: string;
  baseAmount?: number;
  overstayAmount?: number;
  overstayPaymentType?: PaymentType;
  overstayCollectedByUserId?: string;
  overstayCollectedByName?: string;
  overstayCollectedByRole?: "owner" | "attendant" | "superadmin";
  overstayCollectedAt?: string;
  overstayOnlineSettlementStatus?: "not_applicable" | "unsettled" | "pending" | "settled";
  overstayOnlineSettledAt?: string;
  overstayOnlineSettlementId?: string;
  overstaySettlementStatus?: "not_applicable" | "unsettled" | "settled";
  overstaySettledAt?: string;
  overstaySettledByUserId?: string;
  overstaySettledByName?: string;
  amount: number;
  status: EntryStatus;
  attendantId: string;
  attendantName: string;
  duration?: number;
}

export interface Staff {
  id: string;
  name: string;
  mobile: string;
  role: UserRole;
  parkingId: string;
  isActive: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  parkingId: string;
}

interface AppContextType {
  user: User | null;
  token: string | null;
  parking: ParkingProfile | null;
  entries: VehicleEntry[];
  staff: Staff[];
  activityLogs: ActivityLog[];
  isLoading: boolean;
  isDataLoading: boolean;
  themeMode: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  showToast: (message: string, type?: ToastType) => void;
  loginWithToken: (token: string, user: User, parking: any) => Promise<void>;
  logout: () => Promise<void>;
  setupParking: (parking: Omit<ParkingProfile, "id" | "ownerId">) => Promise<void>;
  addEntry: (entry: any) => Promise<VehicleEntry>;
  exitVehicle: (entryId: string, _exitTime?: string, extraPaymentType?: PaymentType) => Promise<void>;
  updatePaymentStatus: (entryId: string, status: PaymentStatus, paymentType?: PaymentType) => Promise<void>;
  addStaff: (staff: Omit<Staff, "id" | "parkingId" | "createdAt">) => Promise<void>;
  updateStaff: (id: string, updates: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshEntries: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setThemeMode: (mode: "light" | "dark" | "system") => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);
type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType } | null;

const STORAGE_KEYS = {
  TOKEN: "@parkease_token",
  USER: "@parkease_user",
  PARKING: "@parkease_parking",
  THEME: "@parkease_theme",
};

function mapEntry(e: any): VehicleEntry {
  return {
    id: e._id || e.id,
    ticketId: e.ticketId,
    publicToken: e.publicToken,
    ticketUrl: e.ticketUrl,
    parkingId: e.parkingId,
    vehicleType: e.vehicleType,
    numberPlate: e.numberPlate,
    customerMobile: e.customerMobile || "",
    entryTime: e.entryTime,
    exitTime: e.exitTime,
    plannedDurationDays: e.plannedDurationDays,
    validUntil: e.validUntil,
    paymentType: e.paymentType,
    paymentStatus: e.paymentStatus,
    paymentCollectedByUserId: e.paymentCollectedByUserId,
    paymentCollectedByName: e.paymentCollectedByName,
    paymentCollectedByRole: e.paymentCollectedByRole,
    paymentCollectedAt: e.paymentCollectedAt,
    settlementStatus: e.settlementStatus,
    onlineSettlementStatus: e.onlineSettlementStatus,
    onlineSettledAt: e.onlineSettledAt,
    onlineSettlementId: e.onlineSettlementId,
    settledAt: e.settledAt,
    settledByUserId: e.settledByUserId,
    settledByName: e.settledByName,
    baseAmount: e.baseAmount,
    overstayAmount: e.overstayAmount,
    overstayPaymentType: e.overstayPaymentType,
    overstayCollectedByUserId: e.overstayCollectedByUserId,
    overstayCollectedByName: e.overstayCollectedByName,
    overstayCollectedByRole: e.overstayCollectedByRole,
    overstayCollectedAt: e.overstayCollectedAt,
    overstayOnlineSettlementStatus: e.overstayOnlineSettlementStatus,
    overstayOnlineSettledAt: e.overstayOnlineSettledAt,
    overstayOnlineSettlementId: e.overstayOnlineSettlementId,
    overstaySettlementStatus: e.overstaySettlementStatus,
    overstaySettledAt: e.overstaySettledAt,
    overstaySettledByUserId: e.overstaySettledByUserId,
    overstaySettledByName: e.overstaySettledByName,
    amount: e.amount,
    status: e.status,
    attendantId: e.attendantId,
    attendantName: e.attendantName,
    duration: e.duration,
  };
}

function mapParking(p: any): ParkingProfile {
  return {
    id: p._id || p.id,
    name: p.name,
    ownerName: p.ownerName,
    location: p.location,
    city: p.city,
    state: p.state,
    latitude: p.latitude,
    longitude: p.longitude,
    bikeRate: p.bikeRate,
    carRate: p.carRate,
    otherRate: p.otherRate,
    workingHours: p.workingHours || "8:00 AM - 10:00 PM",
    totalCapacity: p.totalCapacity,
    bikeCapacity: p.bikeCapacity || 0,
    carCapacity: p.carCapacity || 0,
    notes: p.notes || "",
    ownerId: p.ownerId,
  };
}

function canLoadOwnerData(role?: UserRole): boolean {
  return role === "owner" || role === "superadmin" || role === "admin";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [parking, setParking] = useState<ParkingProfile | null>(null);
  const [entries, setEntries] = useState<VehicleEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [themeMode, setThemeModeState] = useState<"light" | "dark" | "system">("system");
  const refreshSessionRef = useRef<Promise<void> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedTheme: "light" | "dark" =
    themeMode === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : themeMode;

  useEffect(() => {
    loadSession();
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const logAndLogoutForError = useCallback(async (area: string, error: unknown) => {
    const message = error instanceof Error ? error.message : "App error";
    const stack = error instanceof Error ? error.stack : undefined;

    await api.logFrontendError({
      area,
      message,
      stack,
      metadata: {
        userId: user?.id,
        userRole: user?.role,
        parkingId: parking?.id,
      },
    });

    setUser(null);
    setToken(null);
    setParking(null);
    setEntries([]);
    setStaff([]);
    setActivityLogs([]);
    await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER, STORAGE_KEYS.PARKING]);
    showToast("App me dikkat aayi. Please re-login karo.", "error");
  }, [parking?.id, showToast, user?.id, user?.role]);

  const loadSession = async () => {
    setIsDataLoading(true);
    try {
      const [savedToken, savedUser, savedTheme] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
      ]);
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
        setThemeModeState(savedTheme);
      }
      if (savedToken && savedUser) {
        const userObj = JSON.parse(savedUser) as User;
        setToken(savedToken);
        setUser(userObj);
        const { user: freshUser, parking: freshParking } = await api.getMe(savedToken);
        const u: User = { id: freshUser._id || freshUser.id, name: freshUser.name, mobile: freshUser.mobile, role: freshUser.role, parkingId: freshUser.parkingId };
        setUser(u);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u));
        if (freshParking) {
          const p = mapParking(freshParking);
          setParking(p);
          await loadEntries(p.id, savedToken);
          if (canLoadOwnerData(u.role)) {
            await loadStaff(p.id, savedToken);
            await loadLogs(p.id, savedToken);
          } else {
            setStaff([]);
            setActivityLogs([]);
          }
        }
      }
    } catch (e) {
      console.error("Session load error:", e);
      await api.logFrontendError({
        area: "session.load",
        message: e instanceof Error ? e.message : "Session load error",
        stack: e instanceof Error ? e.stack : undefined,
      });
      await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER, STORAGE_KEYS.PARKING]);
    } finally {
      setIsDataLoading(false);
      setIsLoading(false);
    }
  };

  const loadEntries = async (parkingId: string, t: string) => {
    try {
      const { entries: data } = await api.getEntries(parkingId, t, { limit: "100" });
      setEntries(data.map(mapEntry));
    } catch (e) {
      console.error("Load entries:", e);
      throw e;
    }
  };

  const loadStaff = async (parkingId: string, t: string) => {
    try {
      const { staff: data } = await api.getStaff(parkingId, t);
      setStaff(data.map((s: any) => ({ id: s._id || s.id, name: s.name, mobile: s.mobile, role: s.role, parkingId: s.parkingId, isActive: s.isActive, createdAt: s.createdAt })));
    } catch (e) {
      console.error("Load staff:", e);
      throw e;
    }
  };

  const loadLogs = async (parkingId: string, t: string) => {
    try {
      const { logs } = await api.getActivityLogs(parkingId, t);
      setActivityLogs(logs.map((l: any) => ({ id: l._id || l.id, userId: l.userId, userName: l.userName, action: l.action, details: l.details, timestamp: l.timestamp, parkingId: l.parkingId })));
    } catch (e) {
      console.error("Load logs:", e);
      throw e;
    }
  };

  const loginWithToken = useCallback(async (newToken: string, newUser: User, newParking: any) => {
    try {
      setIsDataLoading(true);
      setToken(newToken);
      setUser(newUser);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      if (newParking) {
        const p = mapParking(newParking);
        setParking(p);
        await loadEntries(p.id, newToken);
        if (canLoadOwnerData(newUser.role)) {
          await loadStaff(p.id, newToken);
          await loadLogs(p.id, newToken);
        } else {
          setStaff([]);
          setActivityLogs([]);
        }
      }
      showToast("Login successful", "success");
    } catch (e: any) {
      showToast(e.message || "Login failed", "error");
      await logAndLogoutForError("session.loginWithToken", e);
      throw e;
    } finally {
      setIsDataLoading(false);
    }
  }, [logAndLogoutForError, showToast]);

  const setThemeMode = useCallback(async (mode: "light" | "dark" | "system") => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, mode);
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode = resolvedTheme === "dark" ? "light" : "dark";
    setThemeModeState(nextMode);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, nextMode);
  }, [resolvedTheme]);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    setParking(null);
    setEntries([]);
    setStaff([]);
    setActivityLogs([]);
    await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER, STORAGE_KEYS.PARKING]);
    showToast("Signed out", "info");
  }, [showToast]);

  const setupParking = useCallback(async (data: Omit<ParkingProfile, "id" | "ownerId">) => {
    if (!token || !user) throw new Error("Not authenticated");

    try {
      const payload = { ...data, ownerName: data.ownerName || user.name };
      const response = parking
        ? await api.updateParking(parking.id, payload, token)
        : await api.createParking(payload, token);
      const { parking: p } = response;
      const mapped = mapParking(p);
      setParking(mapped);
      const updatedUser = {
        ...user,
        name: mapped.ownerName || user.name,
        parkingId: mapped.id,
      };
      setUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      showToast("Parking profile saved", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to save parking", "error");
      throw e;
    }
  }, [token, user, parking, showToast]);

  const addEntry = useCallback(async (data: any): Promise<VehicleEntry> => {
    if (!token || !parking) throw new Error("Not authenticated");
    try {
      const { entry } = await api.addEntry({ ...data, parkingId: parking.id }, token);
      const mapped = mapEntry(entry);
      setEntries(prev => [mapped, ...prev]);
      showToast("Entry saved and ticket generated", "success");
      return mapped;
    } catch (e: any) {
      showToast(e.message || "Failed to save entry", "error");
      throw e;
    }
  }, [token, parking, showToast]);

  const exitVehicle = useCallback(async (entryId: string, _exitTime?: string, extraPaymentType?: PaymentType) => {
    if (!token) throw new Error("Not authenticated");
    try {
      const { entry } = await api.exitVehicle(entryId, token, extraPaymentType);
      const mapped = mapEntry(entry);
      setEntries(prev => prev.map(e => e.id === entryId ? mapped : e));
      showToast("Vehicle exit completed", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to process exit", "error");
      throw e;
    }
  }, [token, showToast]);

  const updatePaymentStatus = useCallback(async (entryId: string, status: PaymentStatus, paymentType?: PaymentType) => {
    if (!token) throw new Error("Not authenticated");
    try {
      const { entry } = await api.updatePayment(entryId, status, token, paymentType);
      const mapped = mapEntry(entry);
      setEntries(prev => prev.map(e => e.id === entryId ? mapped : e));
      showToast("Payment updated", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to update payment", "error");
      throw e;
    }
  }, [token, showToast]);

  const addStaff = useCallback(async (data: Omit<Staff, "id" | "parkingId" | "createdAt">) => {
    if (!token || !parking) throw new Error("Not authenticated");
    try {
      const { staff: s } = await api.addStaff({ ...data, parkingId: parking.id }, token);
      setStaff(prev => [...prev, { id: s._id || s.id, name: s.name, mobile: s.mobile, role: s.role, parkingId: s.parkingId, isActive: s.isActive, createdAt: s.createdAt }]);
      showToast("Attendant added", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to add attendant", "error");
      throw e;
    }
  }, [token, parking, showToast]);

  const updateStaff = useCallback(async (id: string, updates: Partial<Staff>) => {
    if (!token) throw new Error("Not authenticated");
    try {
      const { staff: s } = await api.updateStaff(id, updates, token);
      setStaff(prev => prev.map(m => m.id === id ? { ...m, name: s.name, role: s.role, isActive: s.isActive } : m));
      showToast("Attendant updated", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to update attendant", "error");
      throw e;
    }
  }, [token, showToast]);

  const deleteStaff = useCallback(async (id: string) => {
    if (!token) throw new Error("Not authenticated");
    try {
      await api.deleteStaff(id, token);
      setStaff(prev => prev.filter(s => s.id !== id));
      showToast("Attendant removed", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to remove attendant", "error");
      throw e;
    }
  }, [token, showToast]);

  const refreshData = useCallback(async () => {
    if (!token || !parking) return;
    setIsDataLoading(true);
    try {
      if (canLoadOwnerData(user?.role)) {
        await Promise.all([loadEntries(parking.id, token), loadStaff(parking.id, token), loadLogs(parking.id, token)]);
      } else {
        await loadEntries(parking.id, token);
        setStaff([]);
        setActivityLogs([]);
      }
    } catch (e: any) {
      await logAndLogoutForError("session.refreshData", e);
    } finally {
      setIsDataLoading(false);
    }
  }, [logAndLogoutForError, token, parking, user?.role]);

  const refreshEntries = useCallback(async () => {
    if (!token || !parking) return;
    setIsDataLoading(true);
    try {
      await loadEntries(parking.id, token);
    } catch (e) {
      await logAndLogoutForError("session.refreshEntries", e);
    } finally {
      setIsDataLoading(false);
    }
  }, [logAndLogoutForError, token, parking]);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    if (refreshSessionRef.current) {
      try {
        await refreshSessionRef.current;
      } catch (e) {
        await logAndLogoutForError("session.refreshSession.shared", e);
      }
      return;
    }

    setIsDataLoading(true);
    const pendingRefresh = (async () => {
      const { user: freshUser, parking: freshParking } = await api.getMe(token);
      const mappedUser: User = {
        id: freshUser._id || freshUser.id,
        name: freshUser.name,
        mobile: freshUser.mobile,
        role: freshUser.role,
        parkingId: freshUser.parkingId,
      };

      setUser(mappedUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mappedUser));

      if (!freshParking) {
        setParking(null);
        setEntries([]);
        setStaff([]);
        setActivityLogs([]);
        return;
      }

      const mappedParking = mapParking(freshParking);
      setParking(mappedParking);
      if (canLoadOwnerData(mappedUser.role)) {
        await Promise.all([
          loadEntries(mappedParking.id, token),
          loadStaff(mappedParking.id, token),
          loadLogs(mappedParking.id, token),
        ]);
      } else {
        await loadEntries(mappedParking.id, token);
        setStaff([]);
        setActivityLogs([]);
      }
    })();

    refreshSessionRef.current = pendingRefresh;

    try {
      await pendingRefresh;
    } catch (e: any) {
      await logAndLogoutForError("session.refreshSession", e);
    } finally {
      refreshSessionRef.current = null;
      setIsDataLoading(false);
    }
  }, [logAndLogoutForError, token]);

  const toastColors = colorTokens[resolvedTheme];
  const toastBg = toast?.type === "error"
    ? toastColors.destructive
    : toast?.type === "success"
      ? toastColors.success
      : toastColors.primary;

  return (
    <AppContext.Provider value={{
      user, token, parking, entries, staff, activityLogs, isLoading, isDataLoading,
      themeMode, resolvedTheme, showToast,
      loginWithToken, logout, setupParking, addEntry, exitVehicle,
      updatePaymentStatus, addStaff, updateStaff, deleteStaff,
      refreshData, refreshEntries, refreshSession,
      setThemeMode, toggleTheme,
    }}>
      {children}
      {isDataLoading && !isLoading ? (
        <View pointerEvents="none" style={styles.dataOverlay}>
          <View style={[styles.dataLoader, { backgroundColor: toastColors.card, borderColor: toastColors.border }]}>
            <ActivityIndicator size="small" color={toastColors.primary} />
            <Text style={[styles.dataLoaderText, { color: toastColors.foreground }]}>Loading data...</Text>
          </View>
        </View>
      ) : null}
      {toast ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={[styles.toast, { backgroundColor: toastBg }]}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

const styles = StyleSheet.create({
  dataOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    zIndex: 20,
  },
  dataLoader: {
    minWidth: 150,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 8,
  },
  dataLoaderText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    alignItems: "center",
    zIndex: 30,
  },
  toast: {
    maxWidth: 520,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
