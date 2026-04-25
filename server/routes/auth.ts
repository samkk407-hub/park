import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import { User } from "../models/User";
import { Parking } from "../models/Parking";
import { getJwtSecret } from "../lib/config";

const router = Router();
const SUPER_ADMIN_MOBILE = process.env["SUPER_ADMIN_MOBILE"] || "9999999999";
const APP_ENV = process.env["APP_ENV"] || "development";
const isDevelopment = ["development", "dev", "developer"].includes(APP_ENV.toLowerCase());

const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>();
const otpSendTracker = new Map<string, { count: number; resetAt: number }>();

router.post("/send-otp", async (req: Request, res: Response) => {
  const { mobile } = req.body as { mobile: string };
  if (!mobile || !/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: "Valid mobile number required" });
  }

  const now = Date.now();
  const tracker = otpSendTracker.get(mobile);
  if (tracker && tracker.resetAt > now && tracker.count >= 5) {
    return res.status(429).json({ error: "Too many OTP requests. Please try again later." });
  }
  otpSendTracker.set(mobile, {
    count: tracker && tracker.resetAt > now ? tracker.count + 1 : 1,
    resetAt: tracker && tracker.resetAt > now ? tracker.resetAt : now + 15 * 60 * 1000,
  });

  const otp = randomInt(100000, 1000000).toString();
  otpStore.set(mobile, { otp, expires: now + 5 * 60 * 1000, attempts: 0 });
  if (isDevelopment) {
    console.log(`OTP for ${mobile}: ${otp}`);
  }
  return res.json({
    success: true,
    message: "OTP sent",
    devOtp: isDevelopment ? otp : undefined,
  });
});

router.post("/verify-otp", async (req: Request, res: Response) => {
  const { mobile, otp, loginMode } = req.body as {
    mobile: string;
    otp: string;
    loginMode?: "owner" | "attendant";
  };

  const stored = otpStore.get(mobile);
  if (!stored || Date.now() > stored.expires) {
    return res.status(401).json({ error: "Invalid or expired OTP" });
  }
  if (stored.otp !== otp) {
    stored.attempts += 1;
    if (stored.attempts >= 5) otpStore.delete(mobile);
    return res.status(401).json({ error: "Invalid or expired OTP" });
  }
  otpStore.delete(mobile);

  let user = await User.findOne({ mobile });

  if (loginMode === "attendant") {
    if (!user) {
      return res.status(403).json({
        error: "You are not registered as an attendant. Ask your parking owner to add your mobile number.",
      });
    }
    if (user.role !== "attendant") {
      return res.status(403).json({
        error: "This number is not registered as an attendant. Use Owner Login instead.",
      });
    }
    if (!user.parkingId || !user.isActive) {
      return res.status(403).json({
        error: "Your attendant account is inactive. Please contact your parking owner.",
      });
    }
  } else {
    if (!user) {
      const role = mobile === SUPER_ADMIN_MOBILE ? "superadmin" : "owner";
      user = await User.create({ mobile, name: "New User", role });
    } else if (user.role === "attendant") {
      return res.status(403).json({
        error: "This number is registered as an attendant. Please use Attendant Login.",
      });
    }
  }

  user.lastSeen = new Date();
  await user.save();

  let parking = null;
  if (user.parkingId) {
    parking = await Parking.findById(user.parkingId).lean();
    if (
      parking?.ownerName &&
      user.role !== "attendant" &&
      (!user.name || user.name === "New User")
    ) {
      user.name = parking.ownerName;
      await user.save();
    }
  }

  const token = jwt.sign(
    { userId: user._id.toString(), mobile, role: user.role },
    getJwtSecret(),
    { expiresIn: "30d" }
  );

  return res.json({
    token,
    user: {
      id: user._id,
      mobile,
      name: user.name,
      role: user.role,
      parkingId: user.parkingId,
    },
    parking,
  });
});

router.get("/me", async (req: Request, res: Response) => {
  const auth = req.headers["authorization"];
  if (!auth) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(auth.replace("Bearer ", ""), getJwtSecret()) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    let parking = null;
    if (user.parkingId) {
      parking = await Parking.findById(user.parkingId).lean();
      if (
        parking?.ownerName &&
        user.role !== "attendant" &&
        (!user.name || user.name === "New User")
      ) {
        user.name = parking.ownerName;
        await user.save();
      }
    }
    return res.json({
      user: { id: user._id, mobile: user.mobile, name: user.name, role: user.role, parkingId: user.parkingId },
      parking,
    });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
