import { Router } from "express";
import authRouter from "./auth";
import dbProxyRouter from "./db-proxy";
import storageRouter from "./storage";

const router = Router();

router.use("/auth", authRouter);
router.use("/db", dbProxyRouter);
router.use("/storage", storageRouter);

export default router;
