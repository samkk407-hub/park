import { Router, Request, Response } from "express";
import { VehicleEntry } from "../models/VehicleEntry";
import { ActivityLog } from "../models/ActivityLog";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/summary", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId, from, to } = req.query as any;
  if (!parkingId) return res.status(400).json({ error: "parkingId required" });

  const matchFilter: any = { parkingId };
  if (from || to) {
    matchFilter.entryTime = {};
    if (from) matchFilter.entryTime.$gte = new Date(from as string);
    if (to) matchFilter.entryTime.$lte = new Date(to as string);
  }

  const [agg, insideCount] = await Promise.all([
    VehicleEntry.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalVehicles: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] } },
          pendingRevenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$amount", 0] } },
          bikes: { $sum: { $cond: [{ $eq: ["$vehicleType", "bike"] }, 1, 0] } },
          cars: { $sum: { $cond: [{ $eq: ["$vehicleType", "car"] }, 1, 0] } },
          others: { $sum: { $cond: [{ $eq: ["$vehicleType", "other"] }, 1, 0] } },
        },
      },
    ]),
    VehicleEntry.countDocuments({ parkingId, status: "inside" }),
  ]);

  const stats = agg[0] || { totalVehicles: 0, totalRevenue: 0, pendingRevenue: 0, bikes: 0, cars: 0, others: 0 };
  return res.json({ ...stats, currentlyInside: insideCount });
});

router.get("/daily", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId, days = 7 } = req.query as any;
  const from = new Date();
  from.setDate(from.getDate() - Number(days));

  const data = await VehicleEntry.aggregate([
    { $match: { parkingId, entryTime: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$entryTime" } },
        count: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return res.json({ data });
});

router.get("/activity", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId, limit = 20 } = req.query as any;
  const logs = await ActivityLog.find({ parkingId }).sort({ timestamp: -1 }).limit(Number(limit));
  return res.json({ logs });
});

export default router;