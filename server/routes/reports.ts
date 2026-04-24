import { Router, Request, Response } from "express";
import { VehicleEntry } from "../models/VehicleEntry";
import { ActivityLog } from "../models/ActivityLog";
import { Parking } from "../models/Parking";
import { User } from "../models/User";
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

router.get("/attendant-collections", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId } = req.query as any;
  if (!parkingId) return res.status(400).json({ error: "parkingId required" });

  const [attendants, summaryAgg, ownerAgg] = await Promise.all([
    User.find({ parkingId, role: "attendant" }).sort({ createdAt: -1 }).lean(),
    VehicleEntry.aggregate([
      { $match: { parkingId } },
      {
        $group: {
          _id: "$attendantId",
          attendantName: { $last: "$attendantName" },
          totalHandled: { $sum: 1 },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] },
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$amount", 0] },
          },
          offlineCollected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentStatus", "paid"] },
                    { $eq: ["$paymentType", "offline"] },
                    { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          onlineCollected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentStatus", "paid"] },
                    { $eq: ["$paymentType", "online"] },
                    { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          unsettledAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentStatus", "paid"] },
                    { $eq: ["$settlementStatus", "unsettled"] },
                    { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          settledAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentStatus", "paid"] },
                    { $eq: ["$settlementStatus", "settled"] },
                    { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]),
    VehicleEntry.aggregate([
      { $match: { parkingId, paymentStatus: "paid" } },
      {
        $group: {
          _id: null,
          ownerOnlineCollected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentType", "online"] },
                    { $eq: ["$paymentCollectedByRole", "owner"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          ownerOfflineCollected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$paymentType", "offline"] },
                    { $eq: ["$paymentCollectedByRole", "owner"] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          attendantUnsettled: {
            $sum: {
              $cond: [{ $eq: ["$settlementStatus", "unsettled"] }, "$amount", 0],
            },
          },
        },
      },
    ]),
  ]);

  const summaryMap = new Map(summaryAgg.map((item) => [item._id, item]));
  const collections = attendants.map((attendant) => {
    const item = summaryMap.get(attendant._id.toString());
    return {
      attendantId: attendant._id.toString(),
      attendantName: attendant.name,
      mobile: attendant.mobile,
      totalHandled: item?.totalHandled || 0,
      pendingCount: item?.pendingCount || 0,
      pendingAmount: item?.pendingAmount || 0,
      offlineCollected: item?.offlineCollected || 0,
      onlineCollected: item?.onlineCollected || 0,
      unsettledAmount: item?.unsettledAmount || 0,
      settledAmount: item?.settledAmount || 0,
    };
  });

  const ownerSummary = ownerAgg[0] || {
    ownerOnlineCollected: 0,
    ownerOfflineCollected: 0,
    attendantUnsettled: 0,
  };

  return res.json({ collections, ownerSummary });
});

router.post("/attendant-collections/:attendantId/settle", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const userRole = (req as any).userRole as string;
  const { parkingId } = req.body as { parkingId: string };

  if (!parkingId) return res.status(400).json({ error: "parkingId required" });
  if (!["owner", "superadmin"].includes(userRole)) {
    return res.status(403).json({ error: "Only owner can settle attendant collections" });
  }

  const [owner, parking] = await Promise.all([
    User.findById(userId),
    Parking.findById(parkingId),
  ]);

  if (!owner) return res.status(401).json({ error: "Unauthorized" });
  if (!parking) return res.status(404).json({ error: "Parking not found" });
  if (userRole !== "superadmin" && parking.ownerId !== userId) {
    return res.status(403).json({ error: "Unauthorized parking access" });
  }

  const pendingEntries = await VehicleEntry.find({
    parkingId,
    paymentCollectedByUserId: req.params["attendantId"],
    paymentStatus: "paid",
    paymentType: "offline",
    settlementStatus: "unsettled",
  });

  const settledAmount = pendingEntries.reduce((sum, entry) => sum + entry.amount, 0);
  if (pendingEntries.length === 0) {
    return res.json({ success: true, settledCount: 0, settledAmount: 0 });
  }

  await VehicleEntry.updateMany(
    {
      _id: { $in: pendingEntries.map((entry) => entry._id) },
    },
    {
      $set: {
        settlementStatus: "settled",
        settledAt: new Date(),
        settledByUserId: userId,
        settledByName: owner.name,
      },
    }
  );

  await ActivityLog.create({
    parkingId,
    userId,
    userName: owner.name,
    action: "cash_settlement",
    details: `Settled Rs ${settledAmount} from attendant collections`,
  });

  return res.json({
    success: true,
    settledCount: pendingEntries.length,
    settledAmount,
  });
});

export default router;
