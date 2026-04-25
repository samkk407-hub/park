import mongoose, { Schema, Document } from "mongoose";

export interface IFrontendErrorLog extends Document {
  area: string;
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  userId?: string;
  parkingId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const FrontendErrorLogSchema = new Schema<IFrontendErrorLog>({
  area: { type: String, required: true, index: true },
  message: { type: String, required: true },
  stack: { type: String },
  path: { type: String },
  method: { type: String },
  userId: { type: String, index: true },
  parkingId: { type: String, index: true },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const FrontendErrorLog = mongoose.model<IFrontendErrorLog>(
  "FrontendErrorLog",
  FrontendErrorLogSchema
);
