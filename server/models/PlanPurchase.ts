import mongoose, { Schema, Document } from "mongoose";

export interface IPlanPurchase extends Document {
  parkingId: string;
  ownerId: string;
  planId: string;
  planName: string;
  price: number;
  entryLimit: number;
  paymentMode: "upi" | "bank_transfer" | "cash" | "other";
  paymentReference: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  note: string;
  status: "created" | "paid" | "failed";
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

const PlanPurchaseSchema = new Schema<IPlanPurchase>({
  parkingId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  planId: { type: String, required: true },
  planName: { type: String, required: true },
  price: { type: Number, required: true },
  entryLimit: { type: Number, required: true },
  paymentMode: {
    type: String,
    enum: ["upi", "bank_transfer", "cash", "other"],
    default: "upi",
  },
  paymentReference: { type: String, default: "" },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  note: { type: String, default: "" },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },
  reviewedByUserId: { type: String },
  reviewedByName: { type: String },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const PlanPurchase = mongoose.model<IPlanPurchase>(
  "PlanPurchase",
  PlanPurchaseSchema
);
