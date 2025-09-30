import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { join } from "path";
import fs from "fs";
import "./utils/asyncErrors.js";
import logger from "./utils/logger.js";
import { initDatabase } from "./database/index.js";
import apiRouter from "./routes/index.js";

const app = express();

console.log("Startup: server.js loaded, beginning configuration...");

// Ensure storage folders
const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
const tempDir = join(process.cwd(), process.env.TEMP_DIR || "temp");
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

// Security & parsers
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api", limiter);

// Static files (for downloads/previews)
app.use("/static", express.static(uploadDir));

// API routes
app.use("/api", apiRouter);

// Error handler
app.use((err, req, res, next) => {
  logger.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 4000;
const ALLOW_START_WITHOUT_DB = process.env.ALLOW_START_WITHOUT_DB === "true";

(async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    if (ALLOW_START_WITHOUT_DB) {
      logger.warn(
        "DB init failed, but ALLOW_START_WITHOUT_DB=true. Starting server without DB."
      );
      app.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT} (no DB)`);
      });
    } else {
      logger.error("Failed to initialize database", err);
      process.exit(1);
    }
  }
})();
