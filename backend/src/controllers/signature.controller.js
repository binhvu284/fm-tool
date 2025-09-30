import fs from "fs";
import fsPromises from "fs/promises";
import { join } from "path";
import { File, memory } from "../models/index.js";
import { 
  applySimpleSignature, 
  applyDigitalSignature, 
  validateSignatureFields 
} from "../services/signature.service.js";

const usingMemory = !File;

export const signPdf = async (req, res) => {
  try {
    const { fileId, signatureType = 'simple', fields = [], signerName = 'Unknown Signer' } = req.body;
    
    // Validate input
    if (!fileId) {
      return res.status(400).json({ message: "File ID is required" });
    }

    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ message: "At least one signature field is required" });
    }

    // Validate signature fields
    const validation = validateSignatureFields(fields);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    // Find the file
    let file;
    if (usingMemory) {
      file = memory.files.find((f) => f.id === Number(fileId));
    } else {
      file = await File.findByPk(fileId);
    }
    
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Read the PDF file
    const inputPath = join(
      process.cwd(),
      process.env.UPLOAD_DIR || "uploads",
      file.storedName
    );
    
    const pdfBuffer = await fsPromises.readFile(inputPath);
    let signedPdf;

    if (signatureType === 'digital') {
      // Digital signature with certificate
      const certificateData = {
        p12Buffer: process.env.PFX_PATH ? await fsPromises.readFile(process.env.PFX_PATH) : null,
        passphrase: process.env.PFX_PASSPHRASE || ""
      };

      if (!certificateData.p12Buffer) {
        return res.status(400).json({ 
          message: "Digital signature certificate not configured. Please contact administrator." 
        });
      }

      signedPdf = await applyDigitalSignature(pdfBuffer, fields, certificateData);
    } else {
      // Simple signature (visual only)
      signedPdf = await applySimpleSignature(pdfBuffer, fields);
    }

    // Save the signed PDF
    const timestamp = Date.now();
    const outName = `${signatureType}-signed-${timestamp}-${file.storedName}`;
    const outPath = join(
      process.cwd(),
      process.env.UPLOAD_DIR || "uploads",
      outName
    );
    
    await fsPromises.writeFile(outPath, signedPdf);

    // Update file status
    if (usingMemory) {
      file.signatureApplied = true;
      file.signatureType = signatureType;
      file.signedAt = new Date().toISOString();
    } else {
      await file.update({ 
        signatureApplied: true,
        signatureType: signatureType,
        signedAt: new Date()
      });
    }

    // Return success response
    res.json({ 
      message: `${signatureType === 'digital' ? 'Digital' : 'Simple'} signature applied successfully`,
      url: `/static/${outName}`, 
      storedName: outName,
      signatureType: signatureType,
      fieldsCount: fields.length
    });

  } catch (error) {
    console.error('Signature error:', error);
    res.status(500).json({ 
      message: "Failed to apply signature", 
      error: error.message 
    });
  }
};

export const getSignatureInfo = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    let file;
    if (usingMemory) {
      file = memory.files.find((f) => f.id === Number(fileId));
    } else {
      file = await File.findByPk(fileId);
    }
    
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({
      hasSignature: file.signatureApplied || false,
      signatureType: file.signatureType || null,
      signedAt: file.signedAt || null
    });

  } catch (error) {
    console.error('Get signature info error:', error);
    res.status(500).json({ 
      message: "Failed to get signature information", 
      error: error.message 
    });
  }
};
