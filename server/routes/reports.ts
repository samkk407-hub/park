import { Router, Request, Response } from "express";
import { VehicleEntry } from "../models/VehicleEntry";
import { ActivityLog } from "../models/ActivityLog";
import { Parking } from "../models/Parking";
import { User } from "../models/User";
import { authMiddleware } from "../lib/auth";
import { getAuth, requireOwnerRole, requireParkingAccess } from "../lib/access";

const router = Router();

function baseAmountExpr() {
  return { $ifNull: ["$baseAmount", { $subtract: ["$amount", { $ifNull: ["$overstayAmount", 0] }] }] };
}

router.get("/summary", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId, from, to } = req.query as any;
  if (!requireOwnerRole(req, res)) return;
  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;

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
  if (!requireOwnerRole(req, res)) return;
  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;
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
  if (!requireOwnerRole(req, res)) return;
  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;
  const logs = await ActivityLog.find({ parkingId }).sort({ timestamp: -1 }).limit(Number(limit));
  return res.json({ logs });
});

router.get("/attendant-collections", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId } = req.query as any;
  if (!requireOwnerRole(req, res)) return;
  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;

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
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$paymentStatus", "paid"] },
                        { $eq: ["$paymentType", "offline"] },
                        { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    baseAmountExpr(),
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$overstayPaymentType", "offline"] },
                        { $eq: ["$overstayCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    { $ifNull: ["$overstayAmount", 0] },
                    0,
                  ],
                },
              ],
            },
          },
          onlineCollected: {
            $sum: {
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$paymentStatus", "paid"] },
                        { $eq: ["$paymentType", "online"] },
                        { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    baseAmountExpr(),
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$overstayPaymentType", "online"] },
                        { $eq: ["$overstayCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    { $ifNull: ["$overstayAmount", 0] },
                    0,
                  ],
                },
              ],
            },
          },
          unsettledAmount: {
            $sum: {
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$paymentStatus", "paid"] },
                        { $eq: ["$settlementStatus", "unsettled"] },
                        { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    baseAmountExpr(),
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$overstaySettlementStatus", "unsettled"] },
                        { $eq: ["$overstayCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    { $ifNull: ["$overstayAmount", 0] },
                    0,
                  ],
                },
              ],
            },
          },
          settledAmount: {
            $sum: {
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$paymentStatus", "paid"] },
                        { $eq: ["$settlementStatus", "settled"] },
                        { $eq: ["$paymentCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    baseAmountExpr(),
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$overstaySettlementStatus", "settled"] },
                        { $eq: ["$overstayCollectedByUserId", "$attendantId"] },
                      ],
                    },
                    { $ifNull: ["$overstayAmount", 0] },
                    0,
                  ],
                },
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
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$paymentType", "online"] },
                        { $eq: ["$paymentCollectedByRole", "owner"] },
                      ],
                    },
                    baseAmountExpr(),
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$overstayPaymentType", "online"] },
                        { $eq: ["$overstayCollectedByRole", "owner"] },
                      ],
                    },
                    { $ifNull: ["$overstayAmount", 0] },
                    0,
                  ],
                },
              ],
            },
          },
          ownerOfflineCollected: {
            $sum: {
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$paymentType", "offline"] },
                        { $eq: ["$paymentCollectedByRole", "owner"] },
                      ],
                    },
                    baseAmountExpr(),
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$overstayPaymentType", "offline"] },
                        { $eq: ["$overstayCollectedByRole", "owner"] },
                      ],
                    },
                    { $ifNull: ["$overstayAmount", 0] },
                    0,
                  ],
                },
              ],
            },
          },
          attendantUnsettled: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$settlementStatus", "unsettled"] }, baseAmountExpr(), 0] },
                { $cond: [{ $eq: ["$overstaySettlementStatus", "unsettled"] }, { $ifNull: ["$overstayAmount", 0] }, 0] },
              ],
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
  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) return res.status(401).json({ error: "Unauthorized" });
  const { parkingId } = req.body as { parkingId: string };

  if (!requireOwnerRole(req, res)) return;

  const [owner, parking] = await Promise.all([
    User.findById(userId),
    requireParkingAccess(req, res, parkingId),
  ]);

  if (!owner) return res.status(401).json({ error: "Unauthorized" });
  if (!parking) return;

  const pendingEntries = await VehicleEntry.find({
    parkingId,
    $or: [
      {
        paymentCollectedByUserId: req.params["attendantId"],
        paymentStatus: "paid",
        paymentType: "offline",
        settlementStatus: "unsettled",
      },
      {
        overstayCollectedByUserId: req.params["attendantId"],
        overstayPaymentType: "offline",
        overstaySettlementStatus: "unsettled",
      },
    ],
  });

  const baseEntryIds = pendingEntries
    .filter((entry) =>
      entry.paymentCollectedByUserId === req.params["attendantId"] &&
      entry.paymentStatus === "paid" &&
      entry.paymentType === "offline" &&
      entry.settlementStatus === "unsettled"
    )
    .map((entry) => entry._id);
  const overstayEntryIds = pendingEntries
    .filter((entry) =>
      entry.overstayCollectedByUserId === req.params["attendantId"] &&
      entry.overstayPaymentType === "offline" &&
      entry.overstaySettlementStatus === "unsettled"
    )
    .map((entry) => entry._id);
  const settledAmount = pendingEntries.reduce((sum, entry) => {
    const baseAmount = entry.baseAmount || Math.max(entry.amount - (entry.overstayAmount || 0), 0);
    const baseUnsettled = entry.paymentCollectedByUserId === req.params["attendantId"] &&
      entry.paymentStatus === "paid" &&
      entry.paymentType === "offline" &&
      entry.settlementStatus === "unsettled";
    const overstayUnsettled = entry.overstayCollectedByUserId === req.params["attendantId"] &&
      entry.overstayPaymentType === "offline" &&
      entry.overstaySettlementStatus === "unsettled";
    return sum + (baseUnsettled ? baseAmount : 0) + (overstayUnsettled ? entry.overstayAmount || 0 : 0);
  }, 0);
  if (pendingEntries.length === 0) {
    return res.json({ success: true, settledCount: 0, settledAmount: 0 });
  }

  await Promise.all([
    VehicleEntry.updateMany(
      { _id: { $in: baseEntryIds } },
      {
        $set: {
          settlementStatus: "settled",
          settledAt: new Date(),
          settledByUserId: userId,
          settledByName: owner.name,
        },
      },
    ),
    VehicleEntry.updateMany(
      { _id: { $in: overstayEntryIds } },
      {
        $set: {
          overstaySettlementStatus: "settled",
          overstaySettledAt: new Date(),
          overstaySettledByUserId: userId,
          overstaySettledByName: owner.name,
        },
      },
    ),
  ]);

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
