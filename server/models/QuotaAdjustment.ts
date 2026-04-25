import mongoose, { Schema, Document } from "mongoose";

export interface IQuotaAdjustment extends Document {
  parkingId: string;
  ownerId: string;
  entriesAdded: number;
  reason: string;
  note: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: Date;
}

const QuotaAdjustmentSchema = new Schema<IQuotaAdjustment>({
  parkingId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  entriesAdded: { type: Number, required: true, min: 1 },
  reason: { type: String, default: "admin_topup" },
  note: { type: String, default: "" },
  createdByUserId: { type: String, required: true },
  createdByName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const QuotaAdjustment = mongoose.model<IQuotaAdjustment>(
  "QuotaAdjustment",
  QuotaAdjustmentSchema
);

