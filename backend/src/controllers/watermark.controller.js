import { join } from "path";
import fs from "fs/promises";
import { File, memory } from "../models/index.js";
import {
  applyTextWatermark,
  applyImageWatermark,
} from "../services/watermark.service.js";

const usingMemory = !File;

export const applyWatermark = async (req, res) => {
  const {
    fileId,
    type = "text",
    text = "CONFIDENTIAL",
    imageData,
    options = {},
  } = req.body;

  let file;
  if (usingMemory) {
    file = memory.files.find((f) => f.id === Number(fileId));
  } else {
    file = await File.findByPk(fileId);
  }
  if (!file) return res.status(404).json({ message: "File not found" });

  const inputPath = join(
    process.cwd(),
    process.env.UPLOAD_DIR || "uploads",
    file.storedName
  );
  let outBytes;
  try {
    if (type === "image") {
      outBytes = await applyImageWatermark(inputPath, { imageData, options });
    } else {
      outBytes = await applyTextWatermark(inputPath, { text, options });
    }
  } catch (e) {
    return res
      .status(400)
      .json({ message: e.message || "Failed to apply watermark" });
  }
  const outName = `wm-${Date.now()}-${file.storedName}`;
  const outPath = join(
    process.cwd(),
    process.env.UPLOAD_DIR || "uploads",
    outName
  );
  await fs.writeFile(outPath, outBytes);

  if (usingMemory) {
    file.watermarkApplied = true;
  } else {
    await file.update({ watermarkApplied: true });
  }

  res.json({ url: `/static/${outName}`, storedName: outName });
};

export const previewWatermark = async (req, res) => {
  const {
    fileId,
    type = "text",
    text = "CONFIDENTIAL",
    imageData,
    options = {},
  } = req.body;
  let file;
  if (usingMemory) {
    file = memory.files.find((f) => f.id === Number(fileId));
  } else {
    file = await File.findByPk(fileId);
  }
  if (!file) return res.status(404).json({ message: "File not found" });

  const inputPath = join(
    process.cwd(),
    process.env.UPLOAD_DIR || "uploads",
    file.storedName
  );
  let outBytes;
  try {
    if (type === "image") {
      outBytes = await applyImageWatermark(inputPath, { imageData, options });
    } else {
      outBytes = await applyTextWatermark(inputPath, { text, options });
    }
  } catch (e) {
    return res
      .status(400)
      .json({ message: e.message || "Failed to build preview" });
  }
  const b64 = Buffer.from(outBytes).toString("base64");
  res.json({ preview: `data:application/pdf;base64,${b64}` });
};
