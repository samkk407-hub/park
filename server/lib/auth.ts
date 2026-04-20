
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] || "parkease-jwt-secret-2024";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"];
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as { userId: string; role: string };
    (req as any).userId = decoded.userId;
    (req as any).userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function superAdminMiddleware(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if ((req as any).userRole !== "superadmin") {
      res.status(403).json({ error: "Super admin access required" });
      return;
    }
    next();
  });
}