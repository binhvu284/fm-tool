import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { join } from "path";
import fs from "fs";
import { File, memory } from "../models/index.js";
import { findUserById } from "../utils/jsonDb.js";

const router = Router();
const usingMemory = !File;

// List all files with uploader info for admin
router.get("/", authenticate, authorize("admin"), async (_req, res) => {
  try {
    let items = [];
    if (usingMemory) {
      items = memory.files
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const enriched = await Promise.all(
        items.map(async (f) => {
          const u = await findUserById(f.userId);
          return {
            ...f,
            uploader: u ? { id: u.id, email: u.email } : null,
          };
        })
      );
      return res.json(enriched);
    }
    const records = await File.findAll({ order: [["createdAt", "DESC"]] });
    // TODO: join with User model if available; minimal now
    return res.json(records.map((r) => r.get({ plain: true })));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Admin download any file
router.get("/:id/download", authenticate, authorize("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  try {
    let record;
    if (usingMemory) record = memory.files.find((f) => f.id === id);
    else record = await File.findByPk(id);
    if (!record) return res.status(404).json({ message: "File not found" });
    const filePath = join(uploadDir, record.storedName);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ message: "Stored file missing" });
    res.download(filePath, record.originalName);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Update status: approve, disapprove, revert
router.post("/:id/status", authenticate, authorize("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { action } = req.body; // 'approve' | 'disapprove' | 'revert'
  const allowed = new Set(["approve", "disapprove", "revert"]);
  if (!allowed.has(action))
    return res.status(400).json({ message: "Invalid action" });
  try {
    if (usingMemory) {
      const rec = memory.files.find((f) => f.id === id);
      if (!rec) return res.status(404).json({ message: "File not found" });
      if (action === "approve") rec.status = "approved";
      if (action === "disapprove") rec.status = "rejected";
      if (action === "revert") rec.status = "pending";
      return res.json({ success: true, status: rec.status });
    }
    const rec = await File.findByPk(id);
    if (!rec) return res.status(404).json({ message: "File not found" });
    if (action === "approve") await rec.update({ status: "approved" });
    if (action === "disapprove") await rec.update({ status: "rejected" });
    if (action === "revert") await rec.update({ status: "pending" });
    return res.json({ success: true, status: rec.status });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
