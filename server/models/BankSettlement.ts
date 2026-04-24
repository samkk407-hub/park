import mongoose, { Schema, Document } from "mongoose";

export interface IBankSettlement extends Document {
  parkingId: string;
  ownerId: string;
  bankAccountId: string;
  amount: number;
  transactionCount: number;
  entryIds: string[];
  status: "pending" | "completed";
  createdAt: Date;
  completedAt?: Date;
}

const BankSettlementSchema = new Schema<IBankSettlement>({
  parkingId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  bankAccountId: { type: String, required: true },
  amount: { type: Number, required: true },
  transactionCount: { type: Number, required: true },
  entryIds: { type: [String], default: [] },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

export const BankSettlement = mongoose.model<IBankSettlement>(
  "BankSettlement",
  BankSettlementSchema
);
