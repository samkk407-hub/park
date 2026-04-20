import mongoose from "mongoose";
import { logger } from "./logger";

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) return;
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI environment variable is required");
  await mongoose.connect(uri, { dbName: "parkease" });
  connected = true;
  logger.info("MongoDB connected");
}