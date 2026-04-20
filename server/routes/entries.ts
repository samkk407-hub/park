import { Router, Request, Response } from "express";
import { VehicleEntry } from "../models/VehicleEntry";
import { Parking } from "../models/Parking";
import { ActivityLog } from "../models/ActivityLog";
import { User } from "../models/User";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { parkingId, vehicleType, numberPlate, customerMobile, paymentType, amount } = req.body as any;
  const parking = await Parking.findById(parkingId);
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  const ticketId = "TKT" + Date.now().toString().slice(-8) + Math.random().toString(36).slice(-3).toUpperCase();
  const entry = await VehicleEntry.create({
    ticketId, parkingId, vehicleType, numberPlate: numberPlate.toUpperCase(),
    customerMobile: customerMobile || "", paymentType, amount,
    status: "inside", attendantId: userId, attendantName: user.name,
  });

  await ActivityLog.create({
    parkingId, userId, userName: user.name,
    action: "vehicle_entry",
    details: `${vehicleType.toUpperCase()} ${numberPlate} entered (Ticket: ${ticketId})`,
  });

  return res.status(201).json({ entry });
});

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId, status, date, limit = 50, skip = 0 } = req.query as any;
  const filter: any = { parkingId };
  if (status) filter.status = status;
  if (date) {
    const start = new Date(date as string);
    const end = new Date(date as string);
    end.setDate(end.getDate() + 1);
    filter.entryTime = { $gte: start, $lt: end };
  }
  const entries = await VehicleEntry.find(filter).sort({ entryTime: -1 }).skip(Number(skip)).limit(Number(limit));
  const total = await VehicleEntry.countDocuments(filter);
  return res.json({ entries, total });
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const entry = await VehicleEntry.findById(req.params["id"]);
  if (!entry) return res.status(404).json({ error: "Not found" });
  return res.json({ entry });
});

router.put("/:id/exit", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const user = await User.findById(userId);
  const entry = await VehicleEntry.findById(req.params["id"]);
  if (!entry || entry.status === "exited") return res.status(400).json({ error: "Entry not found or already exited" });

  const exitTime = new Date();
  const durationMs = exitTime.getTime() - entry.entryTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  const parking = await Parking.findById(entry.parkingId);
  let rate = parking?.bikeRate || 20;
  if (entry.vehicleType === "car") rate = parking?.carRate || 40;
  if (entry.vehicleType === "other") rate = parking?.otherRate || 30;

  const amount = Math.max(rate, Math.ceil(durationHours) * rate);
  entry.exitTime = exitTime;
  entry.duration = Math.ceil(durationMs / (1000 * 60));
  entry.status = "exited";
  entry.amount = amount;
  await entry.save();

  if (user && entry.parkingId) {
    await ActivityLog.create({
      parkingId: entry.parkingId, userId, userName: user.name,
      action: "vehicle_exit",
      details: `${entry.vehicleType.toUpperCase()} ${entry.numberPlate} exited. Duration: ${entry.duration}min, Amount: ₹${amount}`,
    });
  }
  return res.json({ entry });
});

router.put("/:id/payment", authMiddleware, async (req: Request, res: Response) => {
  const { paymentStatus, paymentType } = req.body as any;
  const entry = await VehicleEntry.findById(req.params["id"]);
  if (!entry) return res.status(404).json({ error: "Not found" });
  if (paymentStatus) entry.paymentStatus = paymentStatus;
  if (paymentType) entry.paymentType = paymentType;
  await entry.save();
  return res.json({ entry });
});

export default router;