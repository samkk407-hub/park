import mongoose, { Schema, Document } from "mongoose";

export interface IActivityLog extends Document {
  parkingId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>({
  parkingId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const ActivityLog = mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);