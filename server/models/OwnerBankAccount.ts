import mongoose, { Schema, Document } from "mongoose";

export interface IOwnerBankAccount extends Document {
  parkingId: string;
  ownerId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OwnerBankAccountSchema = new Schema<IOwnerBankAccount>({
  parkingId: { type: String, required: true, index: true, unique: true },
  ownerId: { type: String, required: true, index: true },
  accountHolderName: { type: String, required: true },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true },
  upiId: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const OwnerBankAccount = mongoose.model<IOwnerBankAccount>(
  "OwnerBankAccount",
  OwnerBankAccountSchema
);
