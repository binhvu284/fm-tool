import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as WatermarkController from "../controllers/watermark.controller.js";

const router = Router();

router.post("/apply", authenticate, WatermarkController.applyWatermark);
router.post("/preview", authenticate, WatermarkController.previewWatermark);

export default router;
