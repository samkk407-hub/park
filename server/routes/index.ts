import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import parkingsRouter from "./parkings";
import entriesRouter from "./entries";
import staffRouter from "./staff";
import reportsRouter from "./reports";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/parkings", parkingsRouter);
router.use("/entries", entriesRouter);
router.use("/staff", staffRouter);
router.use("/reports", reportsRouter);
router.use("/admin", adminRouter);




export default router;