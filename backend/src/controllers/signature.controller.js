import fs from "fs";
import fsPromises from "fs/promises";
import { join } from "path";
import signpdf from "node-signpdf";
import { File, memory } from "../models/index.js";

const { plainAddPlaceholder, sign } = signpdf;
const usingMemory = !File;

export const signPdf = async (req, res) => {
  const { fileId } = req.body;
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
  const pdfBuffer = await fsPromises.readFile(inputPath);

  // Prepare placeholder for signature
  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: "Document signed",
    signatureLength: 8192,
  });

  const p12Buffer = process.env.PFX_PATH
    ? await fsPromises.readFile(process.env.PFX_PATH)
    : null;
  if (!p12Buffer)
    return res.status(400).json({ message: "PFX certificate not configured" });

  const signedPdf = sign(pdfWithPlaceholder, p12Buffer, {
    passphrase: process.env.PFX_PASSPHRASE || "",
  });

  const outName = `signed-${Date.now()}-${file.storedName}`;
  const outPath = join(
    process.cwd(),
    process.env.UPLOAD_DIR || "uploads",
    outName
  );
  await fsPromises.writeFile(outPath, signedPdf);

  if (usingMemory) {
    file.signatureApplied = true;
  } else {
    await file.update({ signatureApplied: true });
  }

  res.json({ url: `/static/${outName}`, storedName: outName });
};
