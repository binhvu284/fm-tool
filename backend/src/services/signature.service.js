import fs from "fs/promises";
import { join } from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import signpdf from "node-signpdf";

const { plainAddPlaceholder, sign } = signpdf;

/**
 * Apply simple signature fields to PDF (visual only, no legal value)
 */
export const applySimpleSignature = async (pdfBuffer, fields) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    const targetPageIndex = Math.min(
      Math.max(parseInt(field.page ?? 0, 10) || 0, 0),
      pages.length - 1
    );
    const page = pages[targetPageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();
    // Load font
    let font;
    switch (field.fontFamily) {
      case 'Times-Roman':
        font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        break;
      case 'Courier':
        font = await pdfDoc.embedFont(StandardFonts.Courier);
        break;
      default:
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Calculate position (convert from top-left to bottom-left coordinate system)
    const x = field.x;
    const y = pageHeight - field.y - field.height;

    // Parse color
    const colorMatch = field.color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    const color = colorMatch 
      ? rgb(
          parseInt(colorMatch[1], 16) / 255,
          parseInt(colorMatch[2], 16) / 255,
          parseInt(colorMatch[3], 16) / 255
        )
      : rgb(0, 0, 0);

    // Draw signature box background
  page.drawRectangle({
      x: x,
      y: y,
      width: field.width,
      height: field.height,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    // Draw signature text
    const textLines = field.text.split('\n');
    const lineHeight = field.fontSize * 1.2;
    const totalTextHeight = textLines.length * lineHeight;
    const startY = y + (field.height + totalTextHeight) / 2 - lineHeight;

    textLines.forEach((line, index) => {
    page.drawText(line, {
        x: x + 10,
        y: startY - (index * lineHeight),
        size: field.fontSize,
        font: font,
        color: color,
      });
    });

    // Add timestamp
    const timestamp = new Date().toLocaleString();
  page.drawText(`Signed on: ${timestamp}`, {
      x: x + 10,
      y: y + 5,
      size: Math.max(8, field.fontSize - 2),
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return await pdfDoc.save();
};

/**
 * Apply digital signature to PDF (certificate-based, legally valid)
 */
export const applyDigitalSignature = async (pdfBuffer, fields, certificateData) => {
  // First apply visual signature fields
  const pdfWithFields = await applySimpleSignature(pdfBuffer, fields);
  
  // Then apply digital signature certificate
  if (!certificateData.p12Buffer) {
    throw new Error('Digital signature certificate not available');
  }

  // Add signature placeholder
  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer: pdfWithFields,
    reason: "Digital signature applied",
    location: "PDF Document",
    signatureLength: 8192,
    subFilter: 'adbe.pkcs7.detached',
    widgets: fields.map(field => ({
      left: field.x,
      bottom: field.y,
      right: field.x + field.width,
      top: field.y + field.height,
    }))
  });

  // Sign with certificate
  const signedPdf = sign(pdfWithPlaceholder, certificateData.p12Buffer, {
    passphrase: certificateData.passphrase || "",
  });

  return signedPdf;
};

/**
 * Generate signature field with default styling
 */
export const generateDefaultSignatureField = (signerName, x = 50, y = 50) => {
  return {
    text: `Digitally signed by ${signerName}\nDate: ${new Date().toLocaleDateString()}\nReason: Document approval`,
    x: x,
    y: y,
    width: 250,
    height: 80,
    fontSize: 10,
    fontFamily: 'Helvetica',
    bold: false,
    italic: false,
    underline: false,
    color: '#000000'
  };
};

/**
 * Validate signature fields
 */
export const validateSignatureFields = (fields) => {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { valid: false, error: 'At least one signature field is required' };
  }

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    
    if (!field.text || field.text.trim().length === 0) {
      return { valid: false, error: `Field ${i + 1}: Signature text is required` };
    }
    
    if (typeof field.x !== 'number' || field.x < 0) {
      return { valid: false, error: `Field ${i + 1}: Valid X position is required` };
    }
    
    if (typeof field.y !== 'number' || field.y < 0) {
      return { valid: false, error: `Field ${i + 1}: Valid Y position is required` };
    }
    
    if (typeof field.width !== 'number' || field.width <= 0) {
      return { valid: false, error: `Field ${i + 1}: Valid width is required` };
    }
    
    if (typeof field.height !== 'number' || field.height <= 0) {
      return { valid: false, error: `Field ${i + 1}: Valid height is required` };
    }
    
    if (typeof field.fontSize !== 'number' || field.fontSize < 6 || field.fontSize > 72) {
      return { valid: false, error: `Field ${i + 1}: Font size must be between 6 and 72` };
    }
  }

  return { valid: true };
};

export default {
  applySimpleSignature,
  applyDigitalSignature,
  generateDefaultSignatureField,
  validateSignatureFields
};