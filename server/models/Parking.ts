import mongoose, { Schema, Document } from "mongoose";

export interface IParking extends Document {
  name: string;
  ownerName: string;
  ownerId: string;
  location: string;
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
  bikeRate: number;
  carRate: number;
  otherRate: number;
  workingHours: string;
  totalCapacity: number;
  bikeCapacity: number;
  carCapacity: number;
  notes: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ParkingSchema = new Schema<IParking>({
  name: { type: String, required: true },
  ownerName: { type: String, required: true },
  ownerId: { type: String, required: true },
  location: { type: String, required: true },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "India" },
  latitude: { type: Number },
  longitude: { type: Number },
  bikeRate: { type: Number, required: true },
  carRate: { type: Number, required: true },
  otherRate: { type: Number, required: true },
  workingHours: { type: String, default: "8:00 AM - 10:00 PM" },
  totalCapacity: { type: Number, required: true },
  bikeCapacity: { type: Number, default: 0 },
  carCapacity: { type: Number, default: 0 },
  notes: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Parking = mongoose.model<IParking>("Parking", ParkingSchema);