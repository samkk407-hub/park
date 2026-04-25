import mongoose, { Schema, Document } from "mongoose";
import { randomBytes } from "node:crypto";

export interface IVehicleEntry extends Document {
  ticketId: string;
  publicToken: string;
  parkingId: string;
  vehicleType: "bike" | "car" | "other";
  numberPlate: string;
  customerMobile: string;
  entryTime: Date;
  exitTime?: Date;
  plannedDurationDays: number;
  validUntil: Date;
  paymentType: "online" | "offline";
  paymentStatus: "pending" | "paid";
  paymentCollectedByUserId?: string;
  paymentCollectedByName?: string;
  paymentCollectedByRole?: "owner" | "attendant" | "superadmin";
  paymentCollectedAt?: Date;
  onlineSettlementStatus: "not_applicable" | "unsettled" | "pending" | "settled";
  onlineSettledAt?: Date;
  onlineSettlementId?: string;
  settlementStatus: "not_applicable" | "unsettled" | "settled";
  settledAt?: Date;
  settledByUserId?: string;
  settledByName?: string;
  baseAmount: number;
  overstayAmount: number;
  overstayPaymentType?: "online" | "offline";
  overstayCollectedByUserId?: string;
  overstayCollectedByName?: string;
  overstayCollectedByRole?: "owner" | "attendant" | "superadmin";
  overstayCollectedAt?: Date;
  overstayOnlineSettlementStatus: "not_applicable" | "unsettled" | "pending" | "settled";
  overstayOnlineSettledAt?: Date;
  overstayOnlineSettlementId?: string;
  overstaySettlementStatus: "not_applicable" | "unsettled" | "settled";
  overstaySettledAt?: Date;
  overstaySettledByUserId?: string;
  overstaySettledByName?: string;
  amount: number;
  status: "inside" | "exited";
  attendantId: string;
  attendantName: string;
  duration?: number;
  createdAt: Date;
}

const VehicleEntrySchema = new Schema<IVehicleEntry>({
  ticketId: { type: String, required: true, unique: true },
  publicToken: { type: String, required: true, unique: true, default: () => randomBytes(16).toString("hex") },
  parkingId: { type: String, required: true, index: true },
  vehicleType: { type: String, enum: ["bike", "car", "other"], required: true },
  numberPlate: { type: String, required: true },
  customerMobile: { type: String, default: "" },
  entryTime: { type: Date, default: Date.now },
  exitTime: { type: Date },
  plannedDurationDays: { type: Number, default: 1 },
  validUntil: { type: Date },
  paymentType: { type: String, enum: ["online", "offline"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
  paymentCollectedByUserId: { type: String },
  paymentCollectedByName: { type: String },
  paymentCollectedByRole: { type: String, enum: ["owner", "attendant", "superadmin"] },
  paymentCollectedAt: { type: Date },
  onlineSettlementStatus: {
    type: String,
    enum: ["not_applicable", "unsettled", "pending", "settled"],
    default: "not_applicable",
  },
  onlineSettledAt: { type: Date },
  onlineSettlementId: { type: String },
  settlementStatus: {
    type: String,
    enum: ["not_applicable", "unsettled", "settled"],
    default: "not_applicable",
  },
  settledAt: { type: Date },
  settledByUserId: { type: String },
  settledByName: { type: String },
  baseAmount: { type: Number, default: 0 },
  overstayAmount: { type: Number, default: 0 },
  overstayPaymentType: { type: String, enum: ["online", "offline"] },
  overstayCollectedByUserId: { type: String },
  overstayCollectedByName: { type: String },
  overstayCollectedByRole: { type: String, enum: ["owner", "attendant", "superadmin"] },
  overstayCollectedAt: { type: Date },
  overstayOnlineSettlementStatus: {
    type: String,
    enum: ["not_applicable", "unsettled", "pending", "settled"],
    default: "not_applicable",
  },
  overstayOnlineSettledAt: { type: Date },
  overstayOnlineSettlementId: { type: String },
  overstaySettlementStatus: {
    type: String,
    enum: ["not_applicable", "unsettled", "settled"],
    default: "not_applicable",
  },
  overstaySettledAt: { type: Date },
  overstaySettledByUserId: { type: String },
  overstaySettledByName: { type: String },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["inside", "exited"], default: "inside" },
  attendantId: { type: String, required: true },
  attendantName: { type: String, required: true },
  duration: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

VehicleEntrySchema.index({ parkingId: 1, entryTime: -1 });

VehicleEntrySchema.pre("validate", function assignPublicToken(next) {
  if (!this.publicToken) {
    this.publicToken = randomBytes(16).toString("hex");
  }
  if (!this.baseAmount) {
    this.baseAmount = Math.max((this.amount || 0) - (this.overstayAmount || 0), 0);
  }
  if (!this.plannedDurationDays || this.plannedDurationDays < 1) {
    this.plannedDurationDays = 1;
  }
  if (!this.validUntil) {
    const start = this.entryTime || new Date();
    this.validUntil = new Date(start.getTime() + this.plannedDurationDays * 24 * 60 * 60 * 1000);
  }
  next();
});

export const VehicleEntry = mongoose.model<IVehicleEntry>("VehicleEntry", VehicleEntrySchema);
