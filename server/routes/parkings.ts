import { Router, Request, Response } from "express";
import { Parking } from "../models/Parking";
import { User } from "../models/User";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
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
  const parking = await Parking.findById(req.params["id"]);
  if (!parking) return res.status(404).json({ error: "Parking not found" });
  return res.json({ parking });
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parking = await Parking.findOne({ _id: req.params["id"], ownerId: userId });
  if (!parking) return res.status(404).json({ error: "Not found or unauthorized" });

  const fields = ["name", "ownerName", "location", "city", "state", "latitude", "longitude", "bikeRate", "carRate", "otherRate", "workingHours", "totalCapacity", "bikeCapacity", "carCapacity", "notes", "isActive"] as const;
  for (const f of fields) {
    if (req.body[f] !== undefined) (parking as any)[f] = req.body[f];
  }
  parking.updatedAt = new Date();
  await parking.save();
  return res.json({ parking });
});

export default router;