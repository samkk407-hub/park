import mongoose, { Schema, Document } from "mongoose";

export interface IVehicleEntry extends Document {
  ticketId: string;
  parkingId: string;
  vehicleType: "bike" | "car" | "other";
  numberPlate: string;
  customerMobile: string;
  entryTime: Date;
  exitTime?: Date;
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
  amount: number;
  status: "inside" | "exited";
  attendantId: string;
  attendantName: string;
  duration?: number;
  createdAt: Date;
}

const VehicleEntrySchema = new Schema<IVehicleEntry>({
  ticketId: { type: String, required: true, unique: true },
  parkingId: { type: String, required: true, index: true },
  vehicleType: { type: String, enum: ["bike", "car", "other"], required: true },
  numberPlate: { type: String, required: true },
  customerMobile: { type: String, default: "" },
  entryTime: { type: Date, default: Date.now },
  exitTime: { type: Date },
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
  amount: { type: Number, required: true },
  status: { type: String, enum: ["inside", "exited"], default: "inside" },
  attendantId: { type: String, required: true },
  attendantName: { type: String, required: true },
  duration: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

VehicleEntrySchema.index({ parkingId: 1, entryTime: -1 });

export const VehicleEntry = mongoose.model<IVehicleEntry>("VehicleEntry", VehicleEntrySchema);
