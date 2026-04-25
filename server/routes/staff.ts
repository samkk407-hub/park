import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { authMiddleware } from "../lib/auth";
import { getAuth, requireOwnerRole, requireParkingAccess } from "../lib/access";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId } = req.query as { parkingId?: string };
  if (!requireOwnerRole(req, res)) return;
  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;
  const staff = await User.find({ parkingId, role: "attendant" }).sort({ createdAt: -1 });
  return res.json({ staff });
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { mobile, name, role, parkingId } = req.body as any;
  if (!requireOwnerRole(req, res)) return;
  if (!mobile || !name || !parkingId) return res.status(400).json({ error: "mobile, name, parkingId required" });
  if (role && role !== "attendant") return res.status(400).json({ error: "Only attendant staff can be added" });

  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;

  let user = await User.findOne({ mobile });
  if (user) {
    user.name = name;
    user.role = role || "attendant";
    user.parkingId = parkingId;
    await user.save();
  } else {
    user = await User.create({ mobile, name, role: role || "attendant", parkingId });
  }
  return res.status(201).json({ staff: user });
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) return res.status(401).json({ error: "Unauthorized" });
  if (!requireOwnerRole(req, res)) return;
  const { name, role, isActive } = req.body as any;
  const user = await User.findById(req.params["id"]);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (!user.parkingId) return res.status(400).json({ error: "Staff member has no parking assigned" });
  const parking = await requireParkingAccess(req, res, user.parkingId);
  if (!parking) return;
  if (role && role !== "attendant") return res.status(400).json({ error: "Staff role must be attendant" });
  if (name) user.name = name;
  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();
  return res.json({ staff: user });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  if (!requireOwnerRole(req, res)) return;
  const user = await User.findById(req.params["id"]);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (!user.parkingId) return res.status(400).json({ error: "Staff member has no parking assigned" });
  const parking = await requireParkingAccess(req, res, user.parkingId);
  if (!parking) return;
  await user.deleteOne();
  return res.json({ success: true });
});

export default router;
