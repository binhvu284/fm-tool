import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as SignatureController from "../controllers/signature.controller.js";

const router = Router();

router.post("/sign", authenticate, SignatureController.signPdf);
router.get("/info/:fileId", authenticate, SignatureController.getSignatureInfo);

export default router;
