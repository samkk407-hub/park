import mongoose, { Schema, Document } from "mongoose";

export interface IParkingSubscription extends Document {
  parkingId: string;
  ownerId: string;
  freeEntryLimit: number;
  purchasedEntryLimit: number;
  usedEntries: number;
  createdAt: Date;
  updatedAt: Date;
}

const ParkingSubscriptionSchema = new Schema<IParkingSubscription>({
  parkingId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: String, required: true, index: true },
  freeEntryLimit: { type: Number, default: 1000 },
  purchasedEntryLimit: { type: Number, default: 0 },
  usedEntries: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const ParkingSubscription = mongoose.model<IParkingSubscription>(
  "ParkingSubscription",
  ParkingSubscriptionSchema
);

