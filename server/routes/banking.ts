import { Router, Request, Response } from "express";
import { authMiddleware } from "../lib/auth";
import { OwnerBankAccount } from "../models/OwnerBankAccount";
import { BankSettlement } from "../models/BankSettlement";
import { Parking } from "../models/Parking";
import { VehicleEntry } from "../models/VehicleEntry";
import { User } from "../models/User";
import { ActivityLog } from "../models/ActivityLog";

const router = Router();

async function getAuthorizedParking(
  parkingId: string,
  userId: string,
  userRole: string
) {
  const parking = await Parking.findById(parkingId);
  if (!parking) return null;
  if (userRole === "superadmin" || parking.ownerId === userId) return parking;
  return undefined;
}

router.get("/account", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const userRole = (req as any).userRole as string;
  const { parkingId } = req.query as any;

  if (!parkingId) return res.status(400).json({ error: "parkingId required" });

  const parking = await getAuthorizedParking(parkingId, userId, userRole);
  if (parking === null) return res.status(404).json({ error: "Parking not found" });
  if (parking === undefined) return res.status(403).json({ error: "Unauthorized parking access" });

  const [bankAccount, walletAgg, settledAgg, recentSettlements] = await Promise.all([
    OwnerBankAccount.findOne({ parkingId, isActive: true }).lean(),
    VehicleEntry.aggregate([
      {
        $match: {
          parkingId,
          paymentStatus: "paid",
          paymentType: "online",
          paymentCollectedByRole: "owner",
        },
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$amount" },
          walletBalance: {
            $sum: {
              $cond: [{ $eq: ["$onlineSettlementStatus", "unsettled"] }, "$amount", 0],
            },
          },
          pendingToBank: {
            $sum: {
              $cond: [{ $eq: ["$onlineSettlementStatus", "pending"] }, "$amount", 0],
            },
          },
          unsettledCount: {
            $sum: {
              $cond: [{ $eq: ["$onlineSettlementStatus", "unsettled"] }, 1, 0],
            },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ["$onlineSettlementStatus", "pending"] }, 1, 0],
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
  const userId = (req as any).userId as string;
  const userRole = (req as any).userRole as string;
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

  const parking = await getAuthorizedParking(parkingId, userId, userRole);
  if (parking === null) return res.status(404).json({ error: "Parking not found" });
  if (parking === undefined) return res.status(403).json({ error: "Unauthorized parking access" });

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
  const userId = (req as any).userId as string;
  const userRole = (req as any).userRole as string;
  const { parkingId } = req.body as any;

  if (!parkingId) return res.status(400).json({ error: "parkingId required" });

  const parking = await getAuthorizedParking(parkingId, userId, userRole);
  if (parking === null) return res.status(404).json({ error: "Parking not found" });
  if (parking === undefined) return res.status(403).json({ error: "Unauthorized parking access" });

  const [user, bankAccount, unsettledEntries] = await Promise.all([
    User.findById(userId),
    OwnerBankAccount.findOne({ parkingId, isActive: true }),
    VehicleEntry.find({
      parkingId,
      paymentStatus: "paid",
      paymentType: "online",
      paymentCollectedByRole: "owner",
      onlineSettlementStatus: "unsettled",
    }),
  ]);

  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!bankAccount) return res.status(400).json({ error: "Add bank account first" });

  const amount = unsettledEntries.reduce((sum, entry) => sum + entry.amount, 0);
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
    status: "pending",
  });

  await VehicleEntry.updateMany(
    { _id: { $in: unsettledEntries.map((entry) => entry._id) } },
    {
      $set: {
        onlineSettlementStatus: "pending",
        onlineSettledAt: undefined,
        onlineSettlementId: settlement._id.toString(),
      },
    }
  );

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
