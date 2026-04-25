import { Router, Request, Response } from "express";
import { logFrontendError } from "../lib/errorLog";

const router = Router();

router.post("/errors/frontend", async (req: Request, res: Response) => {
  const { area, message, stack, metadata } = req.body as {
    area?: string;
    message?: string;
    stack?: string;
    metadata?: Record<string, unknown>;
  };

  await logFrontendError({
    area: area || "frontend.runtime",
    error: Object.assign(new Error(message || "Frontend error"), { stack }),
    req,
    metadata,
  });

  return res.status(201).json({ success: true });
});

export default router;
