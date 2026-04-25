import type { PaymentType, VehicleEntry } from "@/context/AppContext";

export function getEntryPaymentBreakdown(entry: VehicleEntry): Record<PaymentType, number> {
  const total = entry.paymentStatus === "paid" ? Math.max(Number(entry.amount) || 0, 0) : 0;
  if (total <= 0) return { online: 0, offline: 0 };

  const requestedOverstay = Math.max(Number(entry.overstayAmount) || 0, 0);
  const rawBase = Number(entry.baseAmount);
  const requestedBase = Number.isFinite(rawBase) && rawBase > 0
    ? rawBase
    : Math.max(total - requestedOverstay, 0);

  const base = Math.min(requestedBase, total);
  const overstay = entry.overstayPaymentType
    ? Math.min(requestedOverstay, Math.max(total - base, 0))
    : 0;

  const breakdown: Record<PaymentType, number> = { online: 0, offline: 0 };
  breakdown[entry.paymentType] += base;
  if (entry.overstayPaymentType) {
    breakdown[entry.overstayPaymentType] += overstay;
  }

  const remainder = total - breakdown.online - breakdown.offline;
  if (remainder > 0) {
    breakdown[entry.paymentType] += remainder;
  }

  return breakdown;
}

export function getEntryAmountForPaymentType(entry: VehicleEntry, paymentType: PaymentType): number {
  return getEntryPaymentBreakdown(entry)[paymentType];
}

export function getBasePaymentAmount(entry: VehicleEntry): number {
  const total = entry.paymentStatus === "paid" ? Math.max(Number(entry.amount) || 0, 0) : 0;
  if (total <= 0) return 0;

  const rawBase = Number(entry.baseAmount);
  const overstay = Math.max(Number(entry.overstayAmount) || 0, 0);
  const requestedBase = Number.isFinite(rawBase) && rawBase > 0 ? rawBase : Math.max(total - overstay, 0);
  return Math.min(requestedBase, total);
}

export function getOverstayPaymentAmount(entry: VehicleEntry): number {
  if (!entry.overstayPaymentType) return 0;
  const total = entry.paymentStatus === "paid" ? Math.max(Number(entry.amount) || 0, 0) : 0;
  const base = getBasePaymentAmount(entry);
  const overstay = Math.max(Number(entry.overstayAmount) || 0, 0);
  return Math.min(overstay, Math.max(total - base, 0));
}
