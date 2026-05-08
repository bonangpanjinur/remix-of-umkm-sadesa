import { Router } from "express";
import authRouter from "./auth";
import dbProxyRouter from "./db-proxy";
import storageRouter from "./storage";
import sseRouter from "./sse";
import pushRouter from "./push";
import publicApiRouter from "./public-api";

const router = Router();

router.use("/auth", authRouter);
router.use("/db", dbProxyRouter);
router.use("/storage", storageRouter);
router.use("/sse", sseRouter);
router.use("/push", pushRouter);
router.use("/v1", publicApiRouter);

export default router;
