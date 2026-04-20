const BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `${process.env.EXPO_PUBLIC_DOMAIN.startsWith("http") ? "" : "http://"}${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function req<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
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

  exitVehicle: (id: string, token: string) =>
    req<{ entry: any }>(`/entries/${id}/exit`, { method: "PUT" }, token),

  updatePayment: (id: string, paymentStatus: string, token: string) =>
    req<{ entry: any }>(`/entries/${id}/payment`, {
      method: "PUT", body: JSON.stringify({ paymentStatus }),
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
};
