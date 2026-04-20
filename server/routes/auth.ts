import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { Parking } from "../models/Parking";

const router = Router();
const JWT_SECRET = process.env["JWT_SECRET"] || "parkease-jwt-secret-2024";
const SUPER_ADMIN_MOBILE = process.env["SUPER_ADMIN_MOBILE"] || "9999999999";

const otpStore = new Map<string, { otp: string; expires: number }>();

router.post("/send-otp", async (req: Request, res: Response) => {
  const { mobile } = req.body as { mobile: string };
  if (!mobile || mobile.length < 10) {
    return res.status(400).json({ error: "Valid mobile number required" });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(mobile, { otp, expires: Date.now() + 5 * 60 * 1000 });
  console.log(`OTP for ${mobile}: ${otp}`);
  return res.json({
    success: true,
    message: "OTP sent",
    devOtp: process.env["NODE_ENV"] !== "production" ? otp : undefined,
  });
});

router.post("/verify-otp", async (req: Request, res: Response) => {
  const { mobile, otp, loginMode } = req.body as {
    mobile: string;
    otp: string;
    loginMode?: "owner" | "attendant";
  };

  const stored = otpStore.get(mobile);
  if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
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
  }

  const token = jwt.sign(
    { userId: user._id.toString(), mobile, role: user.role },
    JWT_SECRET,
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
    const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    let parking = null;
    if (user.parkingId) parking = await Parking.findById(user.parkingId).lean();
    return res.json({
      user: { id: user._id, mobile: user.mobile, name: user.name, role: user.role, parkingId: user.parkingId },
      parking,
    });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

export default router;