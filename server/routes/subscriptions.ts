import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { authMiddleware } from "../lib/auth";
import { getAuth, requireParkingAccess } from "../lib/access";
import {
  ensureDefaultPlans,
  getOrCreateParkingSubscription,
  summarizeSubscription,
} from "../lib/subscriptions";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { PlanPurchase } from "../models/PlanPurchase";
import { ParkingSubscription } from "../models/ParkingSubscription";

const router = Router();

router.get("/plans", authMiddleware, async (_req: Request, res: Response) => {
  await ensureDefaultPlans();
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }).lean();
  return res.json({ plans });
});

router.get("/summary", authMiddleware, async (req: Request, res: Response) => {
  const { parkingId } = req.query as { parkingId?: string };
  const parking = await requireParkingAccess(req, res, parkingId, { allowAttendant: true });
  if (!parking || !parkingId) return;

  await ensureDefaultPlans();
  const [subscription, plans, purchases] = await Promise.all([
    getOrCreateParkingSubscription(parkingId),
    SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }).lean(),
    PlanPurchase.find({ parkingId }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  if (!subscription) return res.status(404).json({ error: "Subscription not found" });

  return res.json({
    subscription: summarizeSubscription(subscription),
    plans,
    purchases,
  });
});

async function addPurchasedEntries(purchase: {
  parkingId: string;
  ownerId: string;
  entryLimit: number;
}) {
  await ParkingSubscription.findOneAndUpdate(
    { parkingId: purchase.parkingId },
    {
      $setOnInsert: {
        parkingId: purchase.parkingId,
        ownerId: purchase.ownerId,
        freeEntryLimit: 1000,
        usedEntries: 0,
        createdAt: new Date(),
      },
      $inc: { purchasedEntryLimit: purchase.entryLimit },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function createRazorpayOrder(amount: number, receipt: string) {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required");
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt,
      payment_capture: 1,
    }),
  });
  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data?.error?.description || "Failed to create Razorpay order");
  }
  return data as { id: string; amount: number; currency: string };
}

router.post("/purchase", authMiddleware, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { parkingId, planId } = req.body as any;

  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;
  await ensureDefaultPlans();

  const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true }).lean();
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const receipt = `plan_${parkingId}_${Date.now()}`;
  const order = await createRazorpayOrder(plan.price, receipt);

  const purchase = await PlanPurchase.create({
    parkingId,
    ownerId: parking.ownerId,
    planId: plan._id.toString(),
    planName: plan.name,
    price: plan.price,
    entryLimit: plan.entryLimit,
    paymentMode: "upi",
    paymentReference: order.id,
    razorpayOrderId: order.id,
    note: "",
    status: "created",
  });

  return res.status(201).json({
    purchase,
    order,
    keyId: process.env["RAZORPAY_KEY_ID"],
    checkoutUrl: `/api/subscriptions/checkout/${purchase._id.toString()}`,
  });
});

router.get("/checkout/:purchaseId", async (req: Request, res: Response) => {
  const purchase = await PlanPurchase.findById(req.params["purchaseId"]).lean();
  if (!purchase) return res.status(404).send("Purchase not found");
  if (purchase.status === "paid") return res.send("<h2>Payment already completed</h2>");
  const keyId = process.env["RAZORPAY_KEY_ID"];
  if (!keyId) return res.status(500).send("Razorpay key missing");

  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ParkEase Plan Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;background:#f8fafc;color:#0f172a}
    .card{max-width:420px;margin:40px auto;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px}
    button{width:100%;height:44px;border:0;border-radius:10px;background:#d10043;color:white;font-weight:700;font-size:15px}
    .muted{color:#64748b;font-size:14px}
  </style>
</head>
<body>
  <div class="card">
    <h2>${purchase.planName}</h2>
    <p class="muted">${purchase.entryLimit} entries</p>
    <h1>Rs ${purchase.price}</h1>
    <button id="pay">Pay with Razorpay</button>
    <p id="status" class="muted"></p>
  </div>
  <script>
    const options = {
      key: ${JSON.stringify(keyId)},
      amount: ${Math.round(purchase.price * 100)},
      currency: "INR",
      name: "ParkEase",
      description: ${JSON.stringify(purchase.planName)},
      order_id: ${JSON.stringify(purchase.razorpayOrderId)},
      handler: async function (response) {
        document.getElementById("status").textContent = "Verifying payment...";
        const verify = await fetch("/api/subscriptions/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchaseId: ${JSON.stringify(purchase._id.toString())}, ...response })
        });
        const data = await verify.json();
        if (!verify.ok) throw new Error(data.error || "Verification failed");
        document.body.innerHTML = "<div class='card'><h2>Payment successful</h2><p class='muted'>Entries added to your account. You can close this page.</p></div>";
      },
      theme: { color: "#d10043" }
    };
    document.getElementById("pay").onclick = function(){ new Razorpay(options).open(); };
  </script>
</body>
</html>`);
});

router.post("/verify-payment", async (req: Request, res: Response) => {
  const {
    purchaseId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body as any;

  const purchase = await PlanPurchase.findById(purchaseId);
  if (!purchase) return res.status(404).json({ error: "Purchase not found" });
  if (purchase.status === "paid") return res.json({ purchase });

  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keySecret) return res.status(500).json({ error: "Razorpay secret missing" });
  if (purchase.razorpayOrderId !== razorpay_order_id) {
    return res.status(400).json({ error: "Order mismatch" });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (expected !== razorpay_signature) {
    purchase.status = "failed";
    await purchase.save();
    return res.status(400).json({ error: "Invalid Razorpay signature" });
  }

  purchase.status = "paid";
  purchase.razorpayPaymentId = razorpay_payment_id;
  purchase.razorpaySignature = razorpay_signature;
  purchase.paymentReference = razorpay_payment_id;
  purchase.reviewedAt = new Date();
  await purchase.save();
  await addPurchasedEntries(purchase);

  return res.json({ purchase });
});

export default router;
