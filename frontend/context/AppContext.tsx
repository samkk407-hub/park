import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { api } from "@/lib/api";

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
  themeMode: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [parking, setParking] = useState<ParkingProfile | null>(null);
  const [entries, setEntries] = useState<VehicleEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeModeState] = useState<"light" | "dark" | "system">("system");
  const refreshSessionRef = useRef<Promise<void> | null>(null);
  const resolvedTheme: "light" | "dark" =
    themeMode === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : themeMode;

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
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
          await loadStaff(p.id, savedToken);
          await loadLogs(p.id, savedToken);
        }
      }
    } catch (e) {
      console.error("Session load error:", e);
      await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEntries = async (parkingId: string, t: string) => {
    try {
      const { entries: data } = await api.getEntries(parkingId, t, { limit: "100" });
      setEntries(data.map(mapEntry));
    } catch (e) { console.error("Load entries:", e); }
  };

  const loadStaff = async (parkingId: string, t: string) => {
    try {
      const { staff: data } = await api.getStaff(parkingId, t);
      setStaff(data.map((s: any) => ({ id: s._id || s.id, name: s.name, mobile: s.mobile, role: s.role, parkingId: s.parkingId, isActive: s.isActive, createdAt: s.createdAt })));
    } catch (e) { console.error("Load staff:", e); }
  };

  const loadLogs = async (parkingId: string, t: string) => {
    try {
      const { logs } = await api.getActivityLogs(parkingId, t);
      setActivityLogs(logs.map((l: any) => ({ id: l._id || l.id, userId: l.userId, userName: l.userName, action: l.action, details: l.details, timestamp: l.timestamp, parkingId: l.parkingId })));
    } catch (e) { console.error("Load logs:", e); }
  };

  const loginWithToken = useCallback(async (newToken: string, newUser: User, newParking: any) => {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    if (newParking) {
      const p = mapParking(newParking);
      setParking(p);
      await loadEntries(p.id, newToken);
      await loadStaff(p.id, newToken);
      await loadLogs(p.id, newToken);
    }
  }, []);

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
  }, []);

  const setupParking = useCallback(async (data: Omit<ParkingProfile, "id" | "ownerId">) => {
    if (!token || !user) throw new Error("Not authenticated");

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
  }, [token, user, parking]);

  const addEntry = useCallback(async (data: any): Promise<VehicleEntry> => {
    if (!token || !parking) throw new Error("Not authenticated");
    const { entry } = await api.addEntry({ ...data, parkingId: parking.id }, token);
    const mapped = mapEntry(entry);
    setEntries(prev => [mapped, ...prev]);
    return mapped;
  }, [token, parking]);

  const exitVehicle = useCallback(async (entryId: string, _exitTime?: string, extraPaymentType?: PaymentType) => {
    if (!token) throw new Error("Not authenticated");
    const { entry } = await api.exitVehicle(entryId, token, extraPaymentType);
    const mapped = mapEntry(entry);
    setEntries(prev => prev.map(e => e.id === entryId ? mapped : e));
  }, [token]);

  const updatePaymentStatus = useCallback(async (entryId: string, status: PaymentStatus, paymentType?: PaymentType) => {
    if (!token) throw new Error("Not authenticated");
    const { entry } = await api.updatePayment(entryId, status, token, paymentType);
    const mapped = mapEntry(entry);
    setEntries(prev => prev.map(e => e.id === entryId ? mapped : e));
  }, [token]);

  const addStaff = useCallback(async (data: Omit<Staff, "id" | "parkingId" | "createdAt">) => {
    if (!token || !parking) throw new Error("Not authenticated");
    const { staff: s } = await api.addStaff({ ...data, parkingId: parking.id }, token);
    setStaff(prev => [...prev, { id: s._id || s.id, name: s.name, mobile: s.mobile, role: s.role, parkingId: s.parkingId, isActive: s.isActive, createdAt: s.createdAt }]);
  }, [token, parking]);

  const updateStaff = useCallback(async (id: string, updates: Partial<Staff>) => {
    if (!token) throw new Error("Not authenticated");
    const { staff: s } = await api.updateStaff(id, updates, token);
    setStaff(prev => prev.map(m => m.id === id ? { ...m, name: s.name, role: s.role, isActive: s.isActive } : m));
  }, [token]);

  const deleteStaff = useCallback(async (id: string) => {
    if (!token) throw new Error("Not authenticated");
    await api.deleteStaff(id, token);
    setStaff(prev => prev.filter(s => s.id !== id));
  }, [token]);

  const refreshData = useCallback(async () => {
    if (!token || !parking) return;
    await Promise.all([loadEntries(parking.id, token), loadStaff(parking.id, token), loadLogs(parking.id, token)]);
  }, [token, parking]);

  const refreshEntries = useCallback(async () => {
    if (!token || !parking) return;
    await loadEntries(parking.id, token);
  }, [token, parking]);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    if (refreshSessionRef.current) {
      await refreshSessionRef.current;
      return;
    }

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
      await Promise.all([
        loadEntries(mappedParking.id, token),
        loadStaff(mappedParking.id, token),
        loadLogs(mappedParking.id, token),
      ]);
    })();

    refreshSessionRef.current = pendingRefresh;

    try {
      await pendingRefresh;
    } finally {
      refreshSessionRef.current = null;
    }
  }, [token]);

  return (
    <AppContext.Provider value={{
      user, token, parking, entries, staff, activityLogs, isLoading,
      themeMode, resolvedTheme,
      loginWithToken, logout, setupParking, addEntry, exitVehicle,
      updatePaymentStatus, addStaff, updateStaff, deleteStaff,
      refreshData, refreshEntries, refreshSession,
      setThemeMode, toggleTheme,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
