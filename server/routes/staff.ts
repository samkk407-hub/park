import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId } = req.query;
  const staff = await User.find({ parkingId, role: "attendant" }).sort({ createdAt: -1 });
  return res.json({ staff });
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { mobile, name, role, parkingId } = req.body as any;
  if (!mobile || !name || !parkingId) return res.status(400).json({ error: "mobile, name, parkingId required" });

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
  const { name, role, isActive } = req.body as any;
  const user = await User.findById(req.params["id"]);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (name) user.name = name;
  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();
  return res.json({ staff: user });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  await User.findByIdAndDelete(req.params["id"]);
  return res.json({ success: true });
});

export default router;
