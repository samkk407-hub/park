import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Parking } from "../models/Parking";
import { User } from "../models/User";
import { VehicleEntry } from "../models/VehicleEntry";
import { BankSettlement } from "../models/BankSettlement";
import { OwnerBankAccount } from "../models/OwnerBankAccount";
import { ParkingSubscription } from "../models/ParkingSubscription";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { QuotaAdjustment } from "../models/QuotaAdjustment";
import { PlanPurchase } from "../models/PlanPurchase";
import { superAdminMiddleware } from "../lib/auth";
import { getJwtSecret, getRequiredEnv } from "../lib/config";
import { ensureDefaultPlans } from "../lib/subscriptions";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { pin } = req.body as { pin: string };
  const ADMIN_PIN = getRequiredEnv("ADMIN_PIN");
  if (pin !== ADMIN_PIN) return res.status(401).json({ error: "Invalid admin PIN" });
  const token = jwt.sign({ userId: "superadmin", role: "superadmin" }, getJwtSecret(), { expiresIn: "7d" });
  return res.json({ token, role: "superadmin" });
});

router.get("/stats", superAdminMiddleware, async (_req: Request, res: Response) => {
  const [totalParkings, activeParkings, totalUsers, todayEntries, pendingSettlements] = await Promise.all([
    Parking.countDocuments(),
    Parking.countDocuments({ isActive: true }),
    User.countDocuments({ role: { $ne: "superadmin" } }),
    VehicleEntry.countDocuments({ entryTime: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
    BankSettlement.countDocuments({ status: "pending" }),
  ]);

  const [revenueAgg, planEarningsAgg] = await Promise.all([
    VehicleEntry.aggregate([
    { $match: { paymentStatus: "paid" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    PlanPurchase.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$price" }, count: { $sum: 1 }, entriesSold: { $sum: "$entryLimit" } } },
    ]),
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;
  const planEarnings = planEarningsAgg[0]?.total || 0;
  const planSalesCount = planEarningsAgg[0]?.count || 0;
  const planEntriesSold = planEarningsAgg[0]?.entriesSold || 0;

  return res.json({
    totalParkings,
    activeParkings,
    totalUsers,
    todayEntries,
    totalRevenue,
    pendingSettlements,
    planEarnings,
    planSalesCount,
    planEntriesSold,
  });
});

router.get("/parkings", superAdminMiddleware, async (req: Request, res: Response) => {
  const { skip = 0, limit = 50, city, state, search, status } = req.query as any;
  const filter: any = {};
  if (city) filter.city = new RegExp(city, "i");
  if (state) filter.state = new RegExp(state, "i");
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { name: regex },
      { ownerName: regex },
      { location: regex },
      { city: regex },
      { state: regex },
    ];
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);
  const parkings = await Parking.find(filter).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit);
  const total = await Parking.countDocuments(filter);
  return res.json({ parkings, total, skip: safeSkip, limit: safeLimit });
});

router.get("/parkings/:id/detail", superAdminMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const parking = await Parking.findById(id).lean();
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [owner, staff, recentEntries, totalAgg, todayAgg, insideCount] = await Promise.all([
    User.findById(parking.ownerId).lean(),
    User.find({ parkingId: id, role: "attendant" }).sort({ createdAt: -1 }).lean(),
    VehicleEntry.find({ parkingId: id }).sort({ entryTime: -1 }).limit(25).lean(),
    VehicleEntry.aggregate([
      { $match: { parkingId: id } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] } },
          pendingRevenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$amount", 0] } },
        },
      },
    ]),
    VehicleEntry.aggregate([
      { $match: { parkingId: id, entryTime: { $gte: today } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] } },
        },
      },
    ]),
    VehicleEntry.countDocuments({ parkingId: id, status: "inside" }),
  ]);

  return res.json({
    parking,
    owner,
    staff,
    recentEntries,
    stats: {
      total: totalAgg[0] || { count: 0, revenue: 0, pendingRevenue: 0 },
      today: todayAgg[0] || { count: 0, revenue: 0 },
      currentlyInside: insideCount,
      occupancyPercent: parking.totalCapacity > 0 ? Math.round((insideCount / parking.totalCapacity) * 100) : 0,
    },
  });
});

router.patch("/parkings/:id", superAdminMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const fields = [
    "name",
    "ownerName",
    "location",
    "city",
    "state",
    "latitude",
    "longitude",
    "bikeRate",
    "carRate",
    "otherRate",
    "workingHours",
    "totalCapacity",
    "bikeCapacity",
    "carCapacity",
    "notes",
    "isActive",
  ] as const;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const parking = await Parking.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  return res.json({ parking });
});

router.patch("/parkings/:id/status", superAdminMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { isActive } = req.body as { isActive?: boolean };
  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "isActive boolean required" });
  }

  const parking = await Parking.findByIdAndUpdate(
    id,
    { isActive, updatedAt: new Date() },
    { new: true },
  );
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  return res.json({ parking });
});

router.get("/parkings/:id/entries", superAdminMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const {
    status,
    paymentStatus,
    vehicleType,
    search,
    skip = 0,
    limit = 50,
  } = req.query as any;

  const parking = await Parking.findById(id).select("_id").lean();
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  const filter: any = { parkingId: id };
  if (status && ["inside", "exited"].includes(status)) filter.status = status;
  if (paymentStatus && ["pending", "paid"].includes(paymentStatus)) filter.paymentStatus = paymentStatus;
  if (vehicleType && ["bike", "car", "other"].includes(vehicleType)) filter.vehicleType = vehicleType;
  if (search) {
    filter.$or = [
      { numberPlate: new RegExp(search, "i") },
      { ticketId: new RegExp(search, "i") },
      { customerMobile: new RegExp(search, "i") },
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);
  const [entries, total] = await Promise.all([
    VehicleEntry.find(filter)
      .sort({ entryTime: -1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean(),
    VehicleEntry.countDocuments(filter),
  ]);

  return res.json({ entries, total, skip: safeSkip, limit: safeLimit });
});

router.patch("/staff/:id/status", superAdminMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { isActive } = req.body as { isActive?: boolean };
  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "isActive boolean required" });
  }

  const staff = await User.findOneAndUpdate(
    { _id: id, role: "attendant" },
    { isActive },
    { new: true, runValidators: true },
  );
  if (!staff) return res.status(404).json({ error: "Staff not found" });

  return res.json({ staff });
});

router.get("/entries", superAdminMiddleware, async (req: Request, res: Response) => {
  const {
    parkingId,
    status,
    paymentStatus,
    vehicleType,
    search,
    skip = 0,
    limit = 100,
  } = req.query as any;

  const filter: any = {};
  if (parkingId) filter.parkingId = parkingId;
  if (status && ["inside", "exited"].includes(status)) filter.status = status;
  if (paymentStatus && ["pending", "paid"].includes(paymentStatus)) filter.paymentStatus = paymentStatus;
  if (vehicleType && ["bike", "car", "other"].includes(vehicleType)) filter.vehicleType = vehicleType;
  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { numberPlate: regex },
      { ticketId: regex },
      { customerMobile: regex },
      { attendantName: regex },
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const safeSkip = Math.max(Number(skip) || 0, 0);
  const [entries, total] = await Promise.all([
    VehicleEntry.find(filter)
      .sort({ entryTime: -1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean(),
    VehicleEntry.countDocuments(filter),
  ]);

  const parkingIds = [...new Set(entries.map((entry) => entry.parkingId))];
  const parkings = await Parking.find({ _id: { $in: parkingIds } })
    .select("name ownerName city state location")
    .lean();
  const parkingMap = new Map(parkings.map((parking) => [parking._id.toString(), parking]));

  return res.json({
    entries: entries.map((entry) => ({
      ...entry,
      parking: parkingMap.get(entry.parkingId) || null,
    })),
    total,
    skip: safeSkip,
    limit: safeLimit,
  });
});

router.get("/plans", superAdminMiddleware, async (_req: Request, res: Response) => {
  await ensureDefaultPlans();
  const plans = await SubscriptionPlan.find().sort({ sortOrder: 1, price: 1 }).lean();
  return res.json({ plans });
});

router.patch("/plans/:id", superAdminMiddleware, async (req: Request, res: Response) => {
  const fields = ["name", "price", "entryLimit", "isActive", "sortOrder"] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const plan = await SubscriptionPlan.findByIdAndUpdate(req.params["id"], updates, {
    new: true,
    runValidators: true,
  });
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  return res.json({ plan });
});

router.get("/plan-payments", superAdminMiddleware, async (req: Request, res: Response) => {
  const { status = "all", limit = 100 } = req.query as any;
  const filter: any = {};
  if (status !== "all") filter.status = status;
  const purchases = await PlanPurchase.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 300))
    .lean();
  const parkingIds = [...new Set(purchases.map((item) => item.parkingId))];
  const ownerIds = [...new Set(purchases.map((item) => item.ownerId))];
  const [parkings, owners] = await Promise.all([
    Parking.find({ _id: { $in: parkingIds } }).select("name ownerName location city state").lean(),
    User.find({ _id: { $in: ownerIds } }).select("name mobile").lean(),
  ]);
  const parkingMap = new Map(parkings.map((parking) => [parking._id.toString(), parking]));
  const ownerMap = new Map(owners.map((owner) => [owner._id.toString(), owner]));
  const totalPaid = purchases
    .filter((purchase) => purchase.status === "paid")
    .reduce((sum, purchase) => sum + purchase.price, 0);

  return res.json({
    payments: purchases.map((purchase) => ({
      ...purchase,
      parking: parkingMap.get(purchase.parkingId) || null,
      owner: ownerMap.get(purchase.ownerId) || null,
    })),
    totalPaid,
  });
});

router.get("/subscriptions/usage", superAdminMiddleware, async (req: Request, res: Response) => {
  const { threshold = 100 } = req.query as any;
  const allParkings = await Parking.find().select("_id ownerId").lean();
  await Promise.all(
    allParkings.map((parking) =>
      ParkingSubscription.findOneAndUpdate(
        { parkingId: parking._id.toString() },
        {
          $setOnInsert: {
            parkingId: parking._id.toString(),
            ownerId: parking.ownerId,
            freeEntryLimit: 1000,
            purchasedEntryLimit: 0,
            usedEntries: 0,
            createdAt: new Date(),
          },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );
  const subscriptions = await ParkingSubscription.find().sort({ updatedAt: -1 }).lean();
  const parkingIds = subscriptions.map((item) => item.parkingId);
  const ownerIds = subscriptions.map((item) => item.ownerId);
  const [parkings, owners] = await Promise.all([
    Parking.find({ _id: { $in: parkingIds } }).select("name ownerName location city state isActive").lean(),
    User.find({ _id: { $in: ownerIds } }).select("name mobile role isActive").lean(),
  ]);
  const parkingMap = new Map(parkings.map((parking) => [parking._id.toString(), parking]));
  const ownerMap = new Map(owners.map((owner) => [owner._id.toString(), owner]));
  const safeThreshold = Math.max(Number(threshold) || 100, 0);

  const usage = subscriptions.map((subscription) => {
    const totalEntries = subscription.freeEntryLimit + subscription.purchasedEntryLimit;
    const remainingEntries = Math.max(totalEntries - subscription.usedEntries, 0);
    const usedPercent = totalEntries > 0 ? Math.round((subscription.usedEntries / totalEntries) * 100) : 0;
    return {
      subscription,
      parking: parkingMap.get(subscription.parkingId) || null,
      owner: ownerMap.get(subscription.ownerId) || null,
      totalEntries,
      remainingEntries,
      usedPercent,
      isLowBalance: remainingEntries <= safeThreshold,
      isLimitReached: remainingEntries <= 0,
    };
  });

  return res.json({
    usage,
    lowBalanceCount: usage.filter((item) => item.isLowBalance).length,
    threshold: safeThreshold,
  });
});

router.post("/subscriptions/:parkingId/topup", superAdminMiddleware, async (req: Request, res: Response) => {
  const { parkingId } = req.params as { parkingId: string };
  const { entriesAdded, reason = "admin_topup", note = "" } = req.body as any;
  const count = Number(entriesAdded);
  if (!Number.isFinite(count) || count <= 0) {
    return res.status(400).json({ error: "entriesAdded must be greater than 0" });
  }

  const parking = await Parking.findById(parkingId).select("ownerId").lean();
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  const subscription = await ParkingSubscription.findOneAndUpdate(
    { parkingId },
    {
      $setOnInsert: {
        parkingId,
        ownerId: parking.ownerId,
        freeEntryLimit: 1000,
        usedEntries: 0,
        createdAt: new Date(),
      },
      $inc: { purchasedEntryLimit: count },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await QuotaAdjustment.create({
    parkingId,
    ownerId: parking.ownerId,
    entriesAdded: count,
    reason,
    note,
    createdByUserId: "superadmin",
    createdByName: "Super Admin",
  });

  return res.json({ subscription });
});

router.get("/bank-settlements", superAdminMiddleware, async (req: Request, res: Response) => {
  const { status = "pending", limit = 100 } = req.query as any;
  const filter: any = {};
  if (status !== "all") filter.status = status;
  const settlements = await BankSettlement.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 100, 200)).lean();
  const parkingIds = [...new Set(settlements.map((item) => item.parkingId))];
  const bankIds = [...new Set(settlements.map((item) => item.bankAccountId))];
  const [parkings, bankAccounts] = await Promise.all([
    Parking.find({ _id: { $in: parkingIds } }).select("name ownerName location city state").lean(),
    OwnerBankAccount.find({ _id: { $in: bankIds } }).lean(),
  ]);
  const parkingMap = new Map(parkings.map((parking) => [parking._id.toString(), parking]));
  const bankMap = new Map(bankAccounts.map((bank) => [bank._id.toString(), bank]));
  return res.json({
    settlements: settlements.map((settlement) => ({
      ...settlement,
      parking: parkingMap.get(settlement.parkingId) || null,
      bankAccount: bankMap.get(settlement.bankAccountId) || null,
    })),
  });
});

router.patch("/bank-settlements/:id/review", superAdminMiddleware, async (req: Request, res: Response) => {
  const { action, reason = "", transferUtr = "" } = req.body as { action?: "completed" | "rejected"; reason?: string; transferUtr?: string };
  if (!action || !["completed", "rejected"].includes(action)) {
    return res.status(400).json({ error: "Valid action required" });
  }
  if (action === "completed" && !transferUtr.trim()) {
    return res.status(400).json({ error: "UTR number required for successful transfer" });
  }

  const settlement = await BankSettlement.findById(req.params["id"]);
  if (!settlement) return res.status(404).json({ error: "Settlement not found" });
  if (settlement.status !== "pending") return res.status(400).json({ error: "Settlement already reviewed" });

  settlement.status = action;
  settlement.reviewedByUserId = "superadmin";
  settlement.reviewedByName = "Super Admin";
  settlement.reviewedAt = new Date();
  if (action === "completed") settlement.completedAt = new Date();
  if (action === "completed") settlement.transferUtr = transferUtr.trim();
  if (action === "rejected") settlement.rejectionReason = reason;
  await settlement.save();

  if (action === "completed") {
    const baseEntryIds = settlement.baseEntryIds?.length ? settlement.baseEntryIds : settlement.entryIds;
    const overstayEntryIds = settlement.overstayEntryIds || [];
    await Promise.all([
      VehicleEntry.updateMany(
        { _id: { $in: baseEntryIds } },
        {
          $set: {
            onlineSettlementStatus: "settled",
            onlineSettledAt: new Date(),
            onlineSettlementId: settlement._id.toString(),
          },
        },
      ),
      VehicleEntry.updateMany(
        { _id: { $in: overstayEntryIds } },
        {
          $set: {
            overstayOnlineSettlementStatus: "settled",
            overstayOnlineSettledAt: new Date(),
            overstayOnlineSettlementId: settlement._id.toString(),
          },
        },
      ),
    ]);
  } else {
    const baseEntryIds = settlement.baseEntryIds?.length ? settlement.baseEntryIds : settlement.entryIds;
    const overstayEntryIds = settlement.overstayEntryIds || [];
    await Promise.all([
      VehicleEntry.updateMany(
        { _id: { $in: baseEntryIds } },
        {
          $set: {
            onlineSettlementStatus: "unsettled",
          },
          $unset: {
            onlineSettlementId: "",
            onlineSettledAt: "",
          },
        },
      ),
      VehicleEntry.updateMany(
        { _id: { $in: overstayEntryIds } },
        {
          $set: {
            overstayOnlineSettlementStatus: "unsettled",
          },
          $unset: {
            overstayOnlineSettlementId: "",
            overstayOnlineSettledAt: "",
          },
        },
      ),
    ]);
  }

  return res.json({ settlement });
});

router.get("/parkings/:id/stats", superAdminMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params as any;
  const parking = await Parking.findById(id);
  if (!parking) return res.status(404).json({ error: "Not found" });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [todayAgg, totalAgg, insideCount] = await Promise.all([
    VehicleEntry.aggregate([
      { $match: { parkingId: id, entryTime: { $gte: today } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] } } } },
    ]),
    VehicleEntry.aggregate([
      { $match: { parkingId: id } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] } } } },
    ]),
    VehicleEntry.countDocuments({ parkingId: id, status: "inside" }),
  ]);

  return res.json({
    parking,
    today: todayAgg[0] || { count: 0, revenue: 0 },
    total: totalAgg[0] || { count: 0, revenue: 0 },
    currentlyInside: insideCount,
    occupancyPercent: parking.totalCapacity > 0 ? Math.round((insideCount / parking.totalCapacity) * 100) : 0,
  });
});

router.get("/area-stats", superAdminMiddleware, async (_req: Request, res: Response) => {
  const data = await Parking.aggregate([
    {
      $group: {
        _id: { state: "$state", city: "$city" },
        count: { $sum: 1 },
        totalCapacity: { $sum: "$totalCapacity" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);
  return res.json({ data });
});

router.get("/growth", superAdminMiddleware, async (_req: Request, res: Response) => {
  const data = await Parking.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);
  return res.json({ data });
});

export default router;
