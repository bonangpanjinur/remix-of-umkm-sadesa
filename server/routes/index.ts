import { Router } from "express";
import authRouter from "./auth";
import dbProxyRouter from "./db-proxy";
import storageRouter from "./storage";
import sseRouter from "./sse";

const router = Router();

router.use("/auth", authRouter);
router.use("/db", dbProxyRouter);
router.use("/storage", storageRouter);
router.use("/sse", sseRouter);

export default router;
