import type { Request } from "express";
import { getAuth } from "./access";
import { logger } from "./logger";
import { BackendErrorLog } from "../models/BackendErrorLog";
import { FrontendErrorLog } from "../models/FrontendErrorLog";

type ErrorLogInput = {
  area: string;
  error: unknown;
  req?: Request;
  parkingId?: string;
  metadata?: Record<string, unknown>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

export async function logError(input: ErrorLogInput): Promise<void> {
  const { req, error } = input;
  const auth = req ? getAuth(req) : { userId: undefined };

  try {
    await BackendErrorLog.create({
      area: input.area,
      message: getErrorMessage(error),
      stack: getErrorStack(error),
      path: req?.originalUrl,
      method: req?.method,
      userId: auth.userId,
      parkingId: input.parkingId,
      metadata: input.metadata,
    });
  } catch (logErr) {
    logger.error({ err: logErr, originalError: error }, "Failed to write error log");
  }
}

export async function logFrontendError(input: ErrorLogInput): Promise<void> {
  const { req, error } = input;
  const auth = req ? getAuth(req) : { userId: undefined };

  try {
    await FrontendErrorLog.create({
      area: input.area,
      message: getErrorMessage(error),
      stack: getErrorStack(error),
      path: req?.originalUrl,
      method: req?.method,
      userId: auth.userId,
      parkingId: input.parkingId,
      metadata: input.metadata,
    });
  } catch (logErr) {
    logger.error({ err: logErr, originalError: error }, "Failed to write frontend error log");
  }
}

export function publicErrorMessage(error: unknown): string {
  return getErrorMessage(error);
}
