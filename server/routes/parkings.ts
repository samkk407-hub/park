import { Router, Request, Response } from "express";
import { Parking } from "../models/Parking";
import { User } from "../models/User";
import { authMiddleware } from "../lib/auth";
import { getAuth, requireParkingAccess } from "../lib/access";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) return res.status(401).json({ error: "Unauthorized" });
  if (userRole === "attendant") {
    return res.status(403).json({ error: "Attendants cannot create parkings" });
  }
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ error: "User not found" });

  const { name, ownerName, location, city, state, latitude, longitude, bikeRate, carRate, otherRate, workingHours, totalCapacity, bikeCapacity, carCapacity, notes } = req.body as any;
  const parking = await Parking.create({
    name, ownerName: ownerName || user.name, ownerId: userId, location, city, state,
    latitude, longitude, bikeRate, carRate, otherRate, workingHours,
    totalCapacity, bikeCapacity, carCapacity, notes,
  });
  user.parkingId = parking._id.toString();
  user.role = "owner";
  user.name = ownerName || user.name;
  await user.save();
  return res.status(201).json({ parking });
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const parking = await requireParkingAccess(req, res, req.params["id"], { allowAttendant: true });
  if (!parking) return;
  return res.json({ parking });
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const parking = await requireParkingAccess(req, res, req.params["id"]);
  if (!parking) return;

  const fields = ["name", "ownerName", "location", "city", "state", "latitude", "longitude", "bikeRate", "carRate", "otherRate", "workingHours", "totalCapacity", "bikeCapacity", "carCapacity", "notes", "isActive"] as const;
  for (const f of fields) {
    if (req.body[f] !== undefined) (parking as any)[f] = req.body[f];
  }
  parking.updatedAt = new Date();
  await parking.save();

  if (req.body.ownerName !== undefined) {
    const ownerName = String(req.body.ownerName || "").trim();
    if (ownerName) {
      await User.findByIdAndUpdate(parking.ownerId, { name: ownerName });
    }
  }

  return res.json({ parking });
});

export default router;
