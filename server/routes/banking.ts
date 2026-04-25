import { Router, Request, Response } from "express";
import { authMiddleware } from "../lib/auth";
import { OwnerBankAccount } from "../models/OwnerBankAccount";
import { BankSettlement } from "../models/BankSettlement";
import { VehicleEntry } from "../models/VehicleEntry";
import { User } from "../models/User";
import { ActivityLog } from "../models/ActivityLog";
import { getAuth, requireParkingAccess } from "../lib/access";

const router = Router();

function baseAmountExpr() {
  return { $ifNull: ["$baseAmount", { $subtract: ["$amount", { $ifNull: ["$overstayAmount", 0] }] }] };
}

router.get("/account", authMiddleware, async (req: Request, res: Response) => {
  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) return res.status(401).json({ error: "Unauthorized" });
  const { parkingId } = req.query as any;

  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;

  const [bankAccount, walletAgg, settledAgg, recentSettlements] = await Promise.all([
    OwnerBankAccount.findOne({ parkingId, isActive: true }).lean(),
    VehicleEntry.aggregate([
      {
        $match: {
          parkingId,
          paymentStatus: "paid",
          $or: [
            {
              paymentType: "online",
              paymentCollectedByRole: "owner",
            },
            {
              overstayPaymentType: "online",
              overstayCollectedByRole: "owner",
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalCollected: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$paymentType", "online"] }, baseAmountExpr(), 0] },
                { $cond: [{ $eq: ["$overstayPaymentType", "online"] }, { $ifNull: ["$overstayAmount", 0] }, 0] },
              ],
            },
          },
          walletBalance: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$onlineSettlementStatus", "unsettled"] }, baseAmountExpr(), 0] },
                { $cond: [{ $eq: ["$overstayOnlineSettlementStatus", "unsettled"] }, { $ifNull: ["$overstayAmount", 0] }, 0] },
              ],
            },
          },
          pendingToBank: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$onlineSettlementStatus", "pending"] }, baseAmountExpr(), 0] },
                { $cond: [{ $eq: ["$overstayOnlineSettlementStatus", "pending"] }, { $ifNull: ["$overstayAmount", 0] }, 0] },
              ],
            },
          },
          unsettledCount: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$onlineSettlementStatus", "unsettled"] }, 1, 0] },
                { $cond: [{ $eq: ["$overstayOnlineSettlementStatus", "unsettled"] }, 1, 0] },
              ],
            },
          },
          pendingCount: {
            $sum: {
              $add: [
                { $cond: [{ $eq: ["$onlineSettlementStatus", "pending"] }, 1, 0] },
                { $cond: [{ $eq: ["$overstayOnlineSettlementStatus", "pending"] }, 1, 0] },
              ],
            },
          },
        },
      },
    ]),
    BankSettlement.aggregate([
      { $match: { parkingId, status: "completed" } },
      {
        $group: {
          _id: null,
          settledToBank: { $sum: "$amount" },
        },
      },
    ]),
    BankSettlement.find({ parkingId }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const walletSummary = walletAgg[0] || {
    totalCollected: 0,
    walletBalance: 0,
    pendingToBank: 0,
    settledToBank: 0,
    unsettledCount: 0,
    pendingCount: 0,
  };

  const settledToBank = settledAgg[0]?.settledToBank || 0;

  walletSummary.settledToBank = settledToBank;

  return res.json({ bankAccount, walletSummary, recentSettlements });
});

router.post("/account", authMiddleware, async (req: Request, res: Response) => {
  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) return res.status(401).json({ error: "Unauthorized" });
  const {
    parkingId,
    accountHolderName,
    bankName,
    accountNumber,
    ifscCode,
    upiId,
  } = req.body as any;

  if (!parkingId || !accountHolderName || !bankName || !accountNumber || !ifscCode) {
    return res.status(400).json({ error: "Required bank account fields are missing" });
  }

  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;

  const bankAccount = await OwnerBankAccount.findOneAndUpdate(
    { parkingId },
    {
      parkingId,
      ownerId: parking.ownerId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      upiId,
      isActive: true,
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const user = await User.findById(userId);
  if (user) {
    await ActivityLog.create({
      parkingId,
      userId,
      userName: user.name,
      action: "bank_account_update",
      details: `Updated settlement bank account for ${bankName}`,
    });
  }

  return res.json({ bankAccount });
});

router.post("/settle-wallet", authMiddleware, async (req: Request, res: Response) => {
  const { userId, userRole } = getAuth(req);
  if (!userId || !userRole) return res.status(401).json({ error: "Unauthorized" });
  const { parkingId } = req.body as any;

  const parking = await requireParkingAccess(req, res, parkingId);
  if (!parking) return;

  const [user, bankAccount, unsettledEntries] = await Promise.all([
    User.findById(userId),
    OwnerBankAccount.findOne({ parkingId, isActive: true }),
    VehicleEntry.find({
      parkingId,
      paymentStatus: "paid",
      $or: [
        {
          paymentType: "online",
          paymentCollectedByRole: "owner",
          onlineSettlementStatus: "unsettled",
        },
        {
          overstayPaymentType: "online",
          overstayCollectedByRole: "owner",
          overstayOnlineSettlementStatus: "unsettled",
        },
      ],
    }),
  ]);

  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!bankAccount) return res.status(400).json({ error: "Add bank account first" });

  const baseEntryIds = unsettledEntries
    .filter((entry) =>
      entry.paymentType === "online" &&
      entry.paymentCollectedByRole === "owner" &&
      entry.onlineSettlementStatus === "unsettled"
    )
    .map((entry) => entry._id.toString());
  const overstayEntryIds = unsettledEntries
    .filter((entry) =>
      entry.overstayPaymentType === "online" &&
      entry.overstayCollectedByRole === "owner" &&
      entry.overstayOnlineSettlementStatus === "unsettled"
    )
    .map((entry) => entry._id.toString());
  const amount = unsettledEntries.reduce((sum, entry) => {
    const baseAmount = entry.baseAmount || Math.max(entry.amount - (entry.overstayAmount || 0), 0);
    const baseOnline = entry.paymentType === "online" &&
      entry.paymentCollectedByRole === "owner" &&
      entry.onlineSettlementStatus === "unsettled";
    const overstayOnline = entry.overstayPaymentType === "online" &&
      entry.overstayCollectedByRole === "owner" &&
      entry.overstayOnlineSettlementStatus === "unsettled";
    return sum + (baseOnline ? baseAmount : 0) + (overstayOnline ? entry.overstayAmount || 0 : 0);
  }, 0);
  if (unsettledEntries.length === 0) {
    return res.json({ success: true, amount: 0, transactionCount: 0 });
  }

  const settlement = await BankSettlement.create({
    parkingId,
    ownerId: parking.ownerId,
    bankAccountId: bankAccount._id.toString(),
    amount,
    transactionCount: unsettledEntries.length,
    entryIds: unsettledEntries.map((entry) => entry._id.toString()),
    baseEntryIds,
    overstayEntryIds,
    status: "pending",
  });

  await Promise.all([
    VehicleEntry.updateMany(
      { _id: { $in: baseEntryIds } },
      {
        $set: {
          onlineSettlementStatus: "pending",
          onlineSettledAt: undefined,
          onlineSettlementId: settlement._id.toString(),
        },
      }
    ),
    VehicleEntry.updateMany(
      { _id: { $in: overstayEntryIds } },
      {
        $set: {
          overstayOnlineSettlementStatus: "pending",
          overstayOnlineSettledAt: undefined,
          overstayOnlineSettlementId: settlement._id.toString(),
        },
      }
    ),
  ]);

  await ActivityLog.create({
    parkingId,
    userId,
    userName: user.name,
    action: "wallet_settlement",
    details: `Moved Rs ${amount} from wallet to bank settlement queue`,
  });

  return res.json({
    success: true,
    settlement,
    amount,
    transactionCount: unsettledEntries.length,
  });
});

export default router;
