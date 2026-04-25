import { Router, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { VehicleEntry } from "../models/VehicleEntry";
import { Parking } from "../models/Parking";
import { ActivityLog } from "../models/ActivityLog";
import { User } from "../models/User";
import { authMiddleware } from "../lib/auth";
import { getAuth, requireParkingAccess } from "../lib/access";
import { getOrCreateParkingSubscription, summarizeSubscription } from "../lib/subscriptions";
import { ParkingSubscription } from "../models/ParkingSubscription";

const router = Router();
const DAY_MS = 24 * 60 * 60 * 1000;

function getDailyRate(parking: { bikeRate?: number; carRate?: number; otherRate?: number }, vehicleType: string): number {
  if (vehicleType === "car") return parking.carRate || 40;
  if (vehicleType === "other") return parking.otherRate || 30;
  return parking.bikeRate || 20;
}

function getUsedDays(entryTime: Date, exitTime: Date): number {
  return Math.max(1, Math.ceil((exitTime.getTime() - entryTime.getTime()) / DAY_MS));
}

function getPublicTicketUrl(req: Request, publicToken: string): string {
  const configuredBase = process.env["PUBLIC_TICKET_BASE_URL"] || process.env["APP_PUBLIC_URL"];
  const base = configuredBase
    ? configuredBase.replace(/\/$/, "")
    : `${req.protocol}://${req.get("host")}`;
  return `${base}/api/entries/public-ticket/${publicToken}`;
}

function logTicketMessage(req: Request, entry: any, parking: any) {
  if (!entry.customerMobile) return;
  const ticketUrl = getPublicTicketUrl(req, entry.publicToken);
  const entryTime = new Date(entry.entryTime).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const validUntil = new Date(entry.validUntil).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  console.log(
    [
      "----- CUSTOMER TICKET MESSAGE -----",
      `To: +91${entry.customerMobile}`,
      `Your parking ticket is ${entry.ticketId}.`,
      `Parking: ${parking.name}`,
      `Vehicle: ${entry.numberPlate}`,
      `Entry: ${entryTime}`,
      `Valid till: ${validUntil}`,
      `Amount: Rs ${entry.amount}`,
      `Ticket link: ${ticketUrl}`,
      "-----------------------------------",
    ].join("\n"),
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.get("/public-ticket/:token", async (req: Request, res: Response) => {
  const entry = await VehicleEntry.findOne({ publicToken: req.params["token"] }).lean();
  if (!entry) return res.status(404).send("Ticket not found");
  const parking = await Parking.findById(entry.parkingId).lean();
  if (!parking) return res.status(404).send("Parking not found");

  const entryTime = new Date(entry.entryTime).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const exitTime = entry.exitTime
    ? new Date(entry.exitTime).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "Vehicle inside";
  const validUntil = entry.validUntil
    ? new Date(entry.validUntil).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "Not set";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Parking Ticket ${escapeHtml(entry.ticketId)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f7fb; color: #111827; font-family: Arial, sans-serif; }
    .page { min-height: 100vh; padding: 24px 14px; display: flex; align-items: center; justify-content: center; }
    .ticket { width: 100%; max-width: 430px; background: #fff; border: 1px solid #dfe5ef; border-radius: 22px; overflow: hidden; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12); }
    .head { background: #16a34a; color: #fff; padding: 22px; }
    .eyebrow { margin: 0 0 5px; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: .85; }
    h1 { margin: 0; font-size: 24px; }
    .loc { margin: 8px 0 0; font-size: 14px; opacity: .9; line-height: 1.4; }
    .body { padding: 22px; }
    .id { text-align: center; padding: 18px; border: 1px dashed #cbd5e1; border-radius: 18px; background: #f8fafc; }
    .id span { display: block; font-size: 11px; color: #64748b; letter-spacing: 1.4px; text-transform: uppercase; }
    .id strong { display: block; margin-top: 6px; font-size: 26px; color: #16a34a; letter-spacing: 1.5px; }
    .grid { margin-top: 20px; display: grid; gap: 12px; }
    .row { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #eef2f7; padding-bottom: 10px; }
    .row:last-child { border-bottom: 0; padding-bottom: 0; }
    .label { color: #64748b; font-size: 13px; }
    .value { color: #111827; font-weight: 700; text-align: right; }
    .note { margin-top: 18px; border-radius: 14px; background: #ecfdf5; color: #166534; padding: 13px; font-size: 13px; line-height: 1.45; }
  </style>
</head>
<body>
  <main class="page">
    <section class="ticket">
      <header class="head">
        <p class="eyebrow">Parking Ticket</p>
        <h1>${escapeHtml(parking.name)}</h1>
        <p class="loc">${escapeHtml(parking.location)}</p>
      </header>
      <div class="body">
        <div class="id"><span>Ticket Number</span><strong>${escapeHtml(entry.ticketId)}</strong></div>
        <div class="grid">
          <div class="row"><span class="label">Vehicle</span><span class="value">${escapeHtml(entry.numberPlate)} (${escapeHtml(entry.vehicleType).toUpperCase()})</span></div>
          <div class="row"><span class="label">Entry Time</span><span class="value">${escapeHtml(entryTime)}</span></div>
          <div class="row"><span class="label">Paid Days</span><span class="value">${escapeHtml(entry.plannedDurationDays || 1)} day(s)</span></div>
          <div class="row"><span class="label">Valid Till</span><span class="value">${escapeHtml(validUntil)}</span></div>
          <div class="row"><span class="label">Exit Status</span><span class="value">${escapeHtml(exitTime)}</span></div>
          <div class="row"><span class="label">Created By</span><span class="value">${escapeHtml(entry.attendantName)}</span></div>
          <div class="row"><span class="label">Payment</span><span class="value">${escapeHtml(entry.paymentStatus)} / ${escapeHtml(entry.paymentType)}</span></div>
          <div class="row"><span class="label">Base Amount</span><span class="value">Rs ${escapeHtml(entry.baseAmount || entry.amount)}</span></div>
          <div class="row"><span class="label">Extra Amount</span><span class="value">Rs ${escapeHtml(entry.overstayAmount || 0)}</span></div>
          <div class="row"><span class="label">Amount</span><span class="value">Rs ${escapeHtml(entry.amount)}</span></div>
        </div>
        <div class="note">This is your parking ticket for ${escapeHtml(parking.name)}. Please show this ticket number or vehicle number at exit.</div>
      </div>
    </section>
  </main>
</body>
</html>`);
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { parkingId, vehicleType, numberPlate, customerMobile, paymentType, paymentStatus, plannedDurationDays } = req.body as any;
  const parking = await requireParkingAccess(req, res, parkingId, { allowAttendant: true });
  if (!parking) return;
  if (!vehicleType || !["bike", "car", "other"].includes(vehicleType)) {
    return res.status(400).json({ error: "Valid vehicleType required" });
  }
  if (!numberPlate || typeof numberPlate !== "string") {
    return res.status(400).json({ error: "numberPlate required" });
  }
  if (!paymentType || !["online", "offline"].includes(paymentType)) {
    return res.status(400).json({ error: "Valid paymentType required" });
  }
  if (paymentStatus && !["pending", "paid"].includes(paymentStatus)) {
    return res.status(400).json({ error: "Valid paymentStatus required" });
  }
  const days = Math.min(365, Math.max(1, Math.ceil(Number(plannedDurationDays) || 1)));
  const dailyRate = getDailyRate(parking, vehicleType);
  const amount = dailyRate * days;
  const entryTime = new Date();
  const validUntil = new Date(entryTime.getTime() + days * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Valid daily parking rate required" });
  }

  const subscription = await getOrCreateParkingSubscription(parkingId);
  if (!subscription) return res.status(404).json({ error: "Subscription not found" });
  const summary = summarizeSubscription(subscription);
  if (summary.isLimitReached) {
    return res.status(402).json({
      error: "Entry plan khatam ho gaya hai. Naya ticket katne ke liye Entry Plan purchase karo.",
      subscription: summary,
    });
  }

  const ticketId = "TKT" + Date.now().toString().slice(-8) + Math.random().toString(36).slice(-3).toUpperCase();
  const publicToken = randomBytes(16).toString("hex");
  const isPaid = paymentStatus === "paid";
  const collectionFields = isPaid
    ? paymentType === "online"
      ? {
          paymentCollectedByUserId: parking.ownerId,
          paymentCollectedByName: parking.ownerName,
          paymentCollectedByRole: "owner",
          paymentCollectedAt: new Date(),
          onlineSettlementStatus: "unsettled",
          settlementStatus: "not_applicable",
        }
      : {
          paymentCollectedByUserId: userId,
          paymentCollectedByName: user.name,
          paymentCollectedByRole: user.role === "attendant" ? "attendant" : user.role === "superadmin" ? "superadmin" : "owner",
          paymentCollectedAt: new Date(),
          onlineSettlementStatus: "not_applicable",
          settlementStatus: user.role === "attendant" ? "unsettled" : "settled",
          settledAt: user.role === "attendant" ? undefined : new Date(),
          settledByUserId: user.role === "attendant" ? undefined : userId,
          settledByName: user.role === "attendant" ? undefined : user.name,
        }
    : {};
  const entry = await VehicleEntry.create({
    ticketId, publicToken, parkingId, vehicleType, numberPlate: numberPlate.toUpperCase(),
    customerMobile: customerMobile || "", entryTime, plannedDurationDays: days, validUntil,
    paymentType, paymentStatus: isPaid ? "paid" : "pending", amount, baseAmount: amount,
    status: "inside", attendantId: userId, attendantName: user.name,
    ...collectionFields,
  });

  await ActivityLog.create({
    parkingId, userId, userName: user.name,
    action: "vehicle_entry",
    details: `${vehicleType.toUpperCase()} ${numberPlate} entered for ${days} day(s) (Ticket: ${ticketId})`,
  });

  await ParkingSubscription.updateOne(
    { parkingId },
    { $inc: { usedEntries: 1 }, $set: { updatedAt: new Date() } },
  );

  const ticketUrl = getPublicTicketUrl(req, entry.publicToken);
  logTicketMessage(req, entry, parking);

  return res.status(201).json({ entry: { ...entry.toObject(), ticketUrl } });
});

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId, status, date, limit = 50, skip = 0 } = req.query as any;
  const parking = await requireParkingAccess(req, res, parkingId, { allowAttendant: true });
  if (!parking) return;
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
  const parking = await requireParkingAccess(req, res, entry.parkingId, { allowAttendant: true });
  if (!parking) return;
  return res.json({ entry });
});

router.put("/:id/exit", authMiddleware, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { extraPaymentType } = req.body as { extraPaymentType?: "online" | "offline" };
  const user = await User.findById(userId);
  const entry = await VehicleEntry.findById(req.params["id"]);
  if (!entry || entry.status === "exited") return res.status(400).json({ error: "Entry not found or already exited" });

  const authorizedParking = await requireParkingAccess(req, res, entry.parkingId, { allowAttendant: true });
  if (!authorizedParking) return;

  const exitTime = new Date();
  const durationMs = exitTime.getTime() - entry.entryTime.getTime();

  const parking = await Parking.findById(entry.parkingId);
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  const usedDays = getUsedDays(entry.entryTime, exitTime);
  const dailyRate = getDailyRate(parking, entry.vehicleType);
  const finalAmount = usedDays * dailyRate;
  const paidBaseAmount = entry.baseAmount || entry.amount;
  const extraAmount = Math.max(0, finalAmount - paidBaseAmount);

  if (extraAmount > 0 && !extraPaymentType) {
    return res.status(402).json({
      error: `Extra Rs ${extraAmount} required for ${usedDays} day(s) parking before exit.`,
      extraAmount,
      finalAmount,
      usedDays,
    });
  }
  if (extraPaymentType && !["online", "offline"].includes(extraPaymentType)) {
    return res.status(400).json({ error: "Valid extraPaymentType required" });
  }

  entry.exitTime = exitTime;
  entry.duration = Math.ceil(durationMs / (1000 * 60));
  entry.status = "exited";
  entry.amount = finalAmount;
  entry.paymentStatus = "paid";
  if (extraAmount > 0 && extraPaymentType) {
    entry.overstayAmount = extraAmount;
    entry.overstayPaymentType = extraPaymentType;
    entry.overstayCollectedByUserId = extraPaymentType === "online" ? parking.ownerId : userId;
    entry.overstayCollectedByName = extraPaymentType === "online" ? parking.ownerName : user?.name;
    entry.overstayCollectedByRole = extraPaymentType === "online" ? "owner" : ((user?.role || "attendant") as any);
    entry.overstayCollectedAt = new Date();
    entry.overstayOnlineSettlementStatus = extraPaymentType === "online" ? "unsettled" : "not_applicable";
    entry.overstaySettlementStatus = extraPaymentType === "offline" && user?.role === "attendant" ? "unsettled" : "settled";
    entry.overstaySettledAt = extraPaymentType === "offline" && user?.role !== "attendant" ? new Date() : undefined;
    entry.overstaySettledByUserId = extraPaymentType === "offline" && user?.role !== "attendant" ? userId : undefined;
    entry.overstaySettledByName = extraPaymentType === "offline" && user?.role !== "attendant" ? user?.name : undefined;
  }
  await entry.save();

  if (user && entry.parkingId) {
    await ActivityLog.create({
      parkingId: entry.parkingId, userId, userName: user.name,
      action: "vehicle_exit",
      details: `${entry.vehicleType.toUpperCase()} ${entry.numberPlate} exited. Used ${usedDays} day(s), Amount: Rs ${finalAmount}${extraAmount > 0 ? `, Extra paid: Rs ${extraAmount} via ${extraPaymentType}` : ""}`,
    });
  }
  return res.json({ entry });
});

router.put("/:id/payment", authMiddleware, async (req: Request, res: Response) => {
  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) return res.status(401).json({ error: "Unauthorized" });
  const { paymentStatus, paymentType } = req.body as any;
  if (paymentStatus && !["pending", "paid"].includes(paymentStatus)) {
    return res.status(400).json({ error: "Valid paymentStatus required" });
  }
  if (paymentType && !["online", "offline"].includes(paymentType)) {
    return res.status(400).json({ error: "Valid paymentType required" });
  }
  const user = await User.findById(userId);
  const entry = await VehicleEntry.findById(req.params["id"]);
  if (!entry) return res.status(404).json({ error: "Not found" });
  const authorizedParking = await requireParkingAccess(req, res, entry.parkingId, { allowAttendant: true });
  if (!authorizedParking) return;
  const parking = await Parking.findById(entry.parkingId);
  if (!parking) return res.status(404).json({ error: "Parking not found" });

  if (paymentStatus) entry.paymentStatus = paymentStatus;
  if (paymentType) entry.paymentType = paymentType;

  if (entry.paymentStatus === "paid") {
    entry.paymentCollectedAt = new Date();

    if (entry.paymentType === "online") {
      entry.paymentCollectedByUserId = parking.ownerId;
      entry.paymentCollectedByName = parking.ownerName;
      entry.paymentCollectedByRole = "owner";
      entry.onlineSettlementStatus = "unsettled";
      entry.onlineSettledAt = undefined;
      entry.onlineSettlementId = undefined;
      entry.settlementStatus = "not_applicable";
      entry.settledAt = undefined;
      entry.settledByUserId = undefined;
      entry.settledByName = undefined;
    } else if (user) {
      entry.onlineSettlementStatus = "not_applicable";
      entry.onlineSettledAt = undefined;
      entry.onlineSettlementId = undefined;
      entry.paymentCollectedByUserId = userId;
      entry.paymentCollectedByName = user.name;
      entry.paymentCollectedByRole = userRole as "owner" | "attendant" | "superadmin";

      if (userRole === "attendant") {
        entry.settlementStatus = "unsettled";
        entry.settledAt = undefined;
        entry.settledByUserId = undefined;
        entry.settledByName = undefined;
      } else {
        entry.settlementStatus = "settled";
        entry.settledAt = new Date();
        entry.settledByUserId = userId;
        entry.settledByName = user.name;
      }
    }
  } else {
    entry.paymentCollectedByUserId = undefined;
    entry.paymentCollectedByName = undefined;
    entry.paymentCollectedByRole = undefined;
    entry.paymentCollectedAt = undefined;
    entry.onlineSettlementStatus = "not_applicable";
    entry.onlineSettledAt = undefined;
    entry.onlineSettlementId = undefined;
    entry.settlementStatus = "not_applicable";
    entry.settledAt = undefined;
    entry.settledByUserId = undefined;
    entry.settledByName = undefined;
    entry.overstayAmount = 0;
    entry.overstayPaymentType = undefined;
    entry.overstayCollectedByUserId = undefined;
    entry.overstayCollectedByName = undefined;
    entry.overstayCollectedByRole = undefined;
    entry.overstayCollectedAt = undefined;
    entry.overstayOnlineSettlementStatus = "not_applicable";
    entry.overstayOnlineSettledAt = undefined;
    entry.overstayOnlineSettlementId = undefined;
    entry.overstaySettlementStatus = "not_applicable";
    entry.overstaySettledAt = undefined;
    entry.overstaySettledByUserId = undefined;
    entry.overstaySettledByName = undefined;
    entry.amount = entry.baseAmount || entry.amount;
  }

  await entry.save();

  if (user) {
    await ActivityLog.create({
      parkingId: entry.parkingId,
      userId,
      userName: user.name,
      action: "payment_update",
      details: `${entry.numberPlate} payment marked ${entry.paymentStatus} via ${entry.paymentType}`,
    });
  }

  return res.json({ entry });
});

export default router;
