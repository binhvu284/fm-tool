import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.js";
import * as FileController from "../controllers/file.controller.js";
import { join } from "path";
import fs from "fs";

const router = Router();

const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf")
      return cb(new Error("Only PDF files are allowed"));
    cb(null, true);
  },
});

router.post(
  "/upload",
  authenticate,
  upload.array("files", 20),
  FileController.upload
);
router.get("/", authenticate, FileController.list);
router.get("/:id/preview", authenticate, FileController.preview);
router.delete("/all", authenticate, FileController.removeAll);
router.post("/bulk/delete", authenticate, FileController.bulkDelete);
router.post("/bulk/download", authenticate, FileController.bulkDownload);
router.get("/:id/download", authenticate, FileController.download);
router.delete("/:id", authenticate, FileController.remove);

export default router;
