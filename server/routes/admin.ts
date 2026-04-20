import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Parking } from "../models/Parking";
import { User } from "../models/User";
import { VehicleEntry } from "../models/VehicleEntry";
import { superAdminMiddleware } from "../lib/auth";

const router = Router();
const JWT_SECRET = process.env["JWT_SECRET"] || "parkease-jwt-secret-2024";
const ADMIN_PIN = process.env["ADMIN_PIN"] || "PARKEASE2024";

router.post("/login", async (req: Request, res: Response) => {
  const { pin } = req.body as { pin: string };
  if (pin !== ADMIN_PIN) return res.status(401).json({ error: "Invalid admin PIN" });
  const token = jwt.sign({ userId: "superadmin", role: "superadmin" }, JWT_SECRET, { expiresIn: "7d" });
  return res.json({ token, role: "superadmin" });
});

router.get("/stats", superAdminMiddleware, async (_req: Request, res: Response) => {
  const [totalParkings, activeParkings, totalUsers, todayEntries] = await Promise.all([
    Parking.countDocuments(),
    Parking.countDocuments({ isActive: true }),
    User.countDocuments({ role: { $ne: "superadmin" } }),
    VehicleEntry.countDocuments({ entryTime: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
  ]);

  const revenueAgg = await VehicleEntry.aggregate([
    { $match: { paymentStatus: "paid" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;

  return res.json({ totalParkings, activeParkings, totalUsers, todayEntries, totalRevenue });
});

router.get("/parkings", superAdminMiddleware, async (req: Request, res: Response) => {
  const { skip = 0, limit = 50, city, state } = req.query as any;
  const filter: any = {};
  if (city) filter.city = new RegExp(city, "i");
  if (state) filter.state = new RegExp(state, "i");
  const parkings = await Parking.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit));
  const total = await Parking.countDocuments(filter);
  return res.json({ parkings, total });
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