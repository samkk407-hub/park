import { Parking } from "../models/Parking";
import { ParkingSubscription } from "../models/ParkingSubscription";
import { SubscriptionPlan } from "../models/SubscriptionPlan";

export const FREE_ENTRY_LIMIT = 1000;

const defaultPlans = [
  { name: "Starter 1000", price: 100, entryLimit: 1000, sortOrder: 1 },
  { name: "Growth 2000", price: 180, entryLimit: 2000, sortOrder: 2 },
];

export async function ensureDefaultPlans() {
  await Promise.all(
    defaultPlans.map((plan) =>
      SubscriptionPlan.findOneAndUpdate(
        { name: plan.name },
        { ...plan, isActive: true, updatedAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );
}

export async function getOrCreateParkingSubscription(parkingId: string) {
  const parking = await Parking.findById(parkingId).select("ownerId").lean();
  if (!parking) return null;

  return ParkingSubscription.findOneAndUpdate(
    { parkingId },
    {
      $setOnInsert: {
        parkingId,
        ownerId: parking.ownerId,
        freeEntryLimit: FREE_ENTRY_LIMIT,
        purchasedEntryLimit: 0,
        usedEntries: 0,
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export function summarizeSubscription(subscription: {
  freeEntryLimit: number;
  purchasedEntryLimit: number;
  usedEntries: number;
}) {
  const totalEntries = subscription.freeEntryLimit + subscription.purchasedEntryLimit;
  const remainingEntries = Math.max(totalEntries - subscription.usedEntries, 0);
  return {
    freeEntryLimit: subscription.freeEntryLimit,
    purchasedEntryLimit: subscription.purchasedEntryLimit,
    usedEntries: subscription.usedEntries,
    totalEntries,
    remainingEntries,
    isLimitReached: remainingEntries <= 0,
  };
}

