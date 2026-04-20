import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  mobile: string;
  name: string;
  role: "admin" | "owner" | "attendant" | "superadmin";
  parkingId?: string;
  isActive: boolean;
  deviceInfo?: string;
  lastSeen: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  mobile: { type: String, required: true, unique: true },
  name: { type: String, required: true, default: "New User" },
  role: { type: String, enum: ["admin", "owner", "attendant", "superadmin"], default: "attendant" },
  parkingId: { type: String },
  isActive: { type: Boolean, default: true },
  deviceInfo: { type: String },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>("User", UserSchema);