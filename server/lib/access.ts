import { Request, Response } from "express";
import { Parking, type IParking } from "../models/Parking";
import { User } from "../models/User";

export type UserRole = "admin" | "owner" | "attendant" | "superadmin";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

export function getAuth(req: Request) {
  return {
    userId: (req as AuthRequest).userId,
    userRole: (req as AuthRequest).userRole,
  };
}

export function isOwnerRole(role?: string): boolean {
  return role === "owner" || role === "superadmin";
}

export async function getAuthorizedParking(
  parkingId: string,
  userId: string,
  userRole: string,
  options: { allowAttendant?: boolean } = {},
): Promise<IParking | null | undefined> {
  const parking = await Parking.findById(parkingId);
  if (!parking) return null;
  if (userRole === "superadmin" || parking.ownerId === userId) return parking;

  if (options.allowAttendant) {
    const user = await User.findById(userId).select("parkingId isActive role");
    if (
      user?.role === "attendant" &&
      user.isActive &&
      user.parkingId === parkingId
    ) {
      return parking;
    }
  }

  return undefined;
}

export async function requireParkingAccess(
  req: Request,
  res: Response,
  parkingId: string | undefined,
  options: { allowAttendant?: boolean } = {},
): Promise<IParking | undefined> {
  if (!parkingId) {
    res.status(400).json({ error: "parkingId required" });
    return undefined;
  }

  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) {
    res.status(401).json({ error: "Unauthorized" });
    return undefined;
  }

  const parking = await getAuthorizedParking(parkingId, userId, userRole, options);
  if (parking === null) {
    res.status(404).json({ error: "Parking not found" });
    return undefined;
  }
  if (parking === undefined) {
    res.status(403).json({ error: "Unauthorized parking access" });
    return undefined;
  }
  if (!parking.isActive && userRole !== "superadmin") {
    res.status(403).json({ error: "Parking is inactive. Please contact admin." });
    return undefined;
  }

  return parking;
}

export function requireOwnerRole(req: Request, res: Response): boolean {
  const { userRole } = getAuth(req);
  if (!isOwnerRole(userRole)) {
    res.status(403).json({ error: "Owner access required" });
    return false;
  }
  return true;
}
