import mongoose, { Schema, Document } from "mongoose";

export interface IBankSettlement extends Document {
  parkingId: string;
  ownerId: string;
  bankAccountId: string;
  amount: number;
  transactionCount: number;
  entryIds: string[];
  baseEntryIds: string[];
  overstayEntryIds: string[];
  status: "pending" | "completed" | "rejected";
  reviewedByUserId?: string;
  reviewedByName?: string;
  transferUtr?: string;
  rejectionReason?: string;
  createdAt: Date;
  completedAt?: Date;
  reviewedAt?: Date;
}

const BankSettlementSchema = new Schema<IBankSettlement>({
  parkingId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  bankAccountId: { type: String, required: true },
  amount: { type: Number, required: true },
  transactionCount: { type: Number, required: true },
  entryIds: { type: [String], default: [] },
  baseEntryIds: { type: [String], default: [] },
  overstayEntryIds: { type: [String], default: [] },
  status: { type: String, enum: ["pending", "completed", "rejected"], default: "pending", index: true },
  reviewedByUserId: { type: String },
  reviewedByName: { type: String },
  transferUtr: { type: String },
  rejectionReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  reviewedAt: { type: Date },
});

export const BankSettlement = mongoose.model<IBankSettlement>(
  "BankSettlement",
  BankSettlementSchema
);
