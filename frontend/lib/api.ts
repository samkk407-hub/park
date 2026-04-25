import Constants from "expo-constants";

export function getApiDomain(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN || Constants.expoConfig?.extra?.apiDomain;
  if (!domain) {
    throw new Error("EXPO_PUBLIC_DOMAIN is missing. Please set it in frontend/.env and rebuild the app.");
  }
  return `${domain.startsWith("http") ? "" : "http://"}${domain}`.replace(/\/$/, "");
}

const BASE = `${getApiDomain()}/api`;

export type LocationSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type LocationDetails = {
  placeId: string;
  address: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
};

async function req<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(text.slice(0, 160) || `HTTP ${res.status}`);
      throw new Error("Invalid JSON response from server");
    }
  }
  if (!res.ok) throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
  return json as T;
}

export const api = {
  sendOtp: (mobile: string) =>
    req<{ success: boolean; devOtp?: string }>("/auth/send-otp", {
      method: "POST", body: JSON.stringify({ mobile }),
    }),

  verifyOtp: (mobile: string, otp: string, loginMode: "owner" | "attendant" = "owner") =>
    req<{ token: string; user: any; parking: any }>("/auth/verify-otp", {
      method: "POST", body: JSON.stringify({ mobile, otp, loginMode }),
    }),

  getMe: (token: string) =>
    req<{ user: any; parking: any }>("/auth/me", {}, token),

  autocompleteLocations: (input: string, token: string) =>
    req<{ suggestions: LocationSuggestion[] }>(
      `/locations/autocomplete?${new URLSearchParams({ input }).toString()}`,
      {},
      token
    ),

  getLocationDetails: (placeId: string, token: string) =>
    req<{ location: LocationDetails }>(
      `/locations/details/${encodeURIComponent(placeId)}`,
      {},
      token
    ),

  createParking: (data: any, token: string) =>
    req<{ parking: any }>("/parkings", { method: "POST", body: JSON.stringify(data) }, token),

  getParking: (id: string, token: string) =>
    req<{ parking: any }>(`/parkings/${id}`, {}, token),

  updateParking: (id: string, data: any, token: string) =>
    req<{ parking: any }>(`/parkings/${id}`, { method: "PUT", body: JSON.stringify(data) }, token),

  getEntries: (parkingId: string, token: string, params?: Record<string, string>) => {
    const qs = new URLSearchParams({ parkingId, ...params }).toString();
    return req<{ entries: any[]; total: number }>(`/entries?${qs}`, {}, token);
  },

  addEntry: (data: any, token: string) =>
    req<{ entry: any }>("/entries", { method: "POST", body: JSON.stringify(data) }, token),

  exitVehicle: (id: string, token: string, extraPaymentType?: "online" | "offline") =>
    req<{ entry: any }>(`/entries/${id}/exit`, {
      method: "PUT",
      body: JSON.stringify(extraPaymentType ? { extraPaymentType } : {}),
    }, token),

  updatePayment: (id: string, paymentStatus: string, token: string, paymentType?: string) =>
    req<{ entry: any }>(`/entries/${id}/payment`, {
      method: "PUT", body: JSON.stringify({ paymentStatus, ...(paymentType ? { paymentType } : {}) }),
    }, token),

  getStaff: (parkingId: string, token: string) =>
    req<{ staff: any[] }>(`/staff?parkingId=${parkingId}`, {}, token),

  addStaff: (data: any, token: string) =>
    req<{ staff: any }>("/staff", { method: "POST", body: JSON.stringify(data) }, token),

  updateStaff: (id: string, data: any, token: string) =>
    req<{ staff: any }>(`/staff/${id}`, { method: "PUT", body: JSON.stringify(data) }, token),

  deleteStaff: (id: string, token: string) =>
    req<{ success: boolean }>(`/staff/${id}`, { method: "DELETE" }, token),

  getReportSummary: (parkingId: string, token: string, from?: string, to?: string) => {
    const qs = new URLSearchParams({ parkingId, ...(from && { from }), ...(to && { to }) }).toString();
    return req<any>(`/reports/summary?${qs}`, {}, token);
  },

  getDailyReport: (parkingId: string, token: string, days = 7) =>
    req<{ data: any[] }>(`/reports/daily?parkingId=${parkingId}&days=${days}`, {}, token),

  getActivityLogs: (parkingId: string, token: string) =>
    req<{ logs: any[] }>(`/reports/activity?parkingId=${parkingId}&limit=50`, {}, token),

  getAttendantCollections: (parkingId: string, token: string) =>
    req<{ collections: any[]; ownerSummary: any }>(`/reports/attendant-collections?parkingId=${parkingId}`, {}, token),

  settleAttendantCollection: (attendantId: string, parkingId: string, token: string) =>
    req<{ success: boolean; settledCount: number; settledAmount: number }>(
      `/reports/attendant-collections/${attendantId}/settle`,
      { method: "POST", body: JSON.stringify({ parkingId }) },
      token
    ),

  getBankingAccount: (parkingId: string, token: string) =>
    req<{ bankAccount: any; walletSummary: any; recentSettlements: any[] }>(
      `/banking/account?parkingId=${parkingId}`,
      {},
      token
    ),

  saveBankingAccount: (data: any, token: string) =>
    req<{ bankAccount: any }>(
      "/banking/account",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  settleWalletToBank: (parkingId: string, token: string) =>
    req<{ success: boolean; amount: number; transactionCount: number; settlement: any }>(
      "/banking/settle-wallet",
      { method: "POST", body: JSON.stringify({ parkingId }) },
      token
    ),

  getSubscriptionSummary: (parkingId: string, token: string) =>
    req<{ subscription: any; plans: any[]; purchases: any[] }>(
      `/subscriptions/summary?parkingId=${parkingId}`,
      {},
      token
    ),

  getSubscriptionPlans: (token: string) =>
    req<{ plans: any[] }>("/subscriptions/plans", {}, token),

  createPlanPurchase: (data: any, token: string) =>
    req<{ purchase: any; order: any; keyId: string; checkoutUrl: string }>(
      "/subscriptions/purchase",
      { method: "POST", body: JSON.stringify(data) },
      token
    ),

  logFrontendError: (data: { area: string; message: string; stack?: string; metadata?: any }) =>
    req<{ success: boolean }>("/errors/frontend", {
      method: "POST",
      body: JSON.stringify(data),
    }).catch(() => ({ success: false })),
};
