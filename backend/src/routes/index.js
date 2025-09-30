import { Router } from "express";
import authRoutes from "./auth.routes.js";
import fileRoutes from "./file.routes.js";
import watermarkRoutes from "./watermark.routes.js";
import signatureRoutes from "./signature.routes.js";
import reviewRoutes from "./review.routes.js";
import adminFilesRoutes from "./admin.files.routes.js";
import adminAgentsRoutes from "./admin.agents.routes.js";
import fs from "fs";
import { join } from "path";
import { memory } from "../models/index.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.use("/auth", authRoutes);
router.use("/files", fileRoutes);
router.use("/watermark", watermarkRoutes);
router.use("/signature", signatureRoutes);
router.use("/reviews", reviewRoutes);
router.use("/admin/files", adminFilesRoutes);
router.use("/admin/agents", adminAgentsRoutes);

// Dev utility: reset in-memory data and remove uploaded files (only when auth disabled)
router.post("/dev/reset", (req, res) => {
  if (process.env.DISABLE_AUTH !== "true")
    return res.status(403).json({ message: "Forbidden" });
  try {
    memory.files = [];
    memory.reviews = [];
    memory.signatures = [];
    const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
    if (fs.existsSync(uploadDir)) {
      for (const f of fs.readdirSync(uploadDir)) {
        try {
          fs.unlinkSync(join(uploadDir, f));
        } catch {}
      }
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
