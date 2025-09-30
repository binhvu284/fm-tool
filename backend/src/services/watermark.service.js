import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import fs from "fs/promises";

function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const h = hex.replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16) / 255;
    const g = parseInt(h[1] + h[1], 16) / 255;
    const b = parseInt(h[2] + h[2], 16) / 255;
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    return { r, g, b };
  }
  return { r: 0, g: 0, b: 0 };
}

function resolvePosition(
  position,
  pageWidth,
  pageHeight,
  elemWidth,
  elemHeight
) {
  switch (position) {
    case "top-left":
      return { x: 20, y: pageHeight - elemHeight - 20 };
    case "top-center":
      return {
        x: (pageWidth - elemWidth) / 2,
        y: pageHeight - elemHeight - 20,
      };
    case "top-right":
      return { x: pageWidth - elemWidth - 20, y: pageHeight - elemHeight - 20 };
    case "middle-left":
      return { x: 20, y: (pageHeight - elemHeight) / 2 };
    case "middle-right":
      return {
        x: pageWidth - elemWidth - 20,
        y: (pageHeight - elemHeight) / 2,
      };
    case "bottom-left":
      return { x: 20, y: 20 };
    case "bottom-center":
      return { x: (pageWidth - elemWidth) / 2, y: 20 };
    case "bottom-right":
      return { x: pageWidth - elemWidth - 20, y: 20 };
    case "center":
    default:
      return {
        x: (pageWidth - elemWidth) / 2,
        y: (pageHeight - elemHeight) / 2,
      };
  }
}

export async function applyTextWatermark(
  inputPath,
  { text = "CONFIDENTIAL", options = {} } = {}
) {
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const {
    opacity = 0.25,
    fontSize = 50,
    color = { r: 0.8, g: 0.1, b: 0.1 },
    rotate = 0,
    x = null,
    y = null,
    font = "Helvetica",
    bold = true,
    underline = false,
    position = "center",
    hexColor,
    mosaic = false,
  } = options;

  const fontMap = {
    Helvetica: bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica,
    Times: bold ? StandardFonts.TimesBold : StandardFonts.TimesRoman,
    Courier: bold ? StandardFonts.CourierBold : StandardFonts.Courier,
  };
  const fontName = fontMap[font] || fontMap.Helvetica;
  const embeddedFont = await pdfDoc.embedFont(fontName);
  const rgbColor = hexColor ? hexToRgb(hexColor) : color;

  pages.forEach((p) => {
    const { width, height } = p.getSize();
    const textWidth = embeddedFont.widthOfTextAtSize(text, fontSize);
    const textHeight = embeddedFont.heightAtSize(fontSize);
    let drawX = x;
    let drawY = y;
    if (drawX == null || drawY == null) {
      const pos = resolvePosition(
        position,
        width,
        height,
        textWidth,
        textHeight
      );
      drawX = drawX == null ? pos.x : drawX;
      drawY = drawY == null ? pos.y : drawY;
    }
    if (mosaic) {
      const tileX = textWidth * 3;
      const tileY = textHeight * 3;
      for (let yPos = 40; yPos < height; yPos += tileY) {
        for (let xPos = 40; xPos < width; xPos += tileX) {
          p.drawText(text, {
            x: xPos,
            y: yPos,
            size: fontSize,
            font: embeddedFont,
            color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
            opacity,
            rotate: degrees(rotate),
          });
          if (underline) {
            const lineY = yPos - 2;
            const rotateRad = (rotate * Math.PI) / 180; // Convert to radians
            const cosAngle = Math.cos(rotateRad);
            const sinAngle = Math.sin(rotateRad);

            // Calculate rotated underline start and end points
            const lineStartX = xPos;
            const lineStartY = lineY;
            const lineEndX = xPos + textWidth * cosAngle;
            const lineEndY = lineY + textWidth * sinAngle;

            try {
              p.drawLine({
                start: { x: lineStartX, y: lineStartY },
                end: { x: lineEndX, y: lineEndY },
                thickness: Math.max(1, fontSize / 20),
                opacity: Math.min(1, opacity + 0.1),
                color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
              });
            } catch {}
          }
        }
      }
    } else {
      p.drawText(text, {
        x: drawX,
        y: drawY,
        size: fontSize,
        font: embeddedFont,
        color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
        opacity,
        rotate: degrees(rotate),
      });
      if (underline) {
        const lineY = drawY - 2;
        const rotateRad = (rotate * Math.PI) / 180; // Convert to radians
        const cosAngle = Math.cos(rotateRad);
        const sinAngle = Math.sin(rotateRad);

        // Calculate rotated underline start and end points
        const lineStartX = drawX;
        const lineStartY = lineY;
        const lineEndX = drawX + textWidth * cosAngle;
        const lineEndY = lineY + textWidth * sinAngle;

        try {
          p.drawLine({
            start: { x: lineStartX, y: lineStartY },
            end: { x: lineEndX, y: lineEndY },
            thickness: Math.max(1, fontSize / 20),
            opacity: Math.min(1, opacity + 0.1),
            color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
          });
        } catch {}
      }
    }
  });

  return pdfDoc.save();
}

export async function applyImageWatermark(
  inputPath,
  { imageData, options = {} } = {}
) {
  if (!imageData) throw new Error("imageData required for image watermark");
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const {
    opacity = 0.25,
    rotate = 0,
    position = "center",
    mosaic = false,
    imageSize = 0.5, // Size as decimal (e.g., 0.5 = 50%)
    width: targetW,
    height: targetH,
  } = options;

  const base64 = imageData.includes(",") ? imageData.split(",")[1] : imageData;
  const bytes = Buffer.from(base64, "base64");
  let embedded;
  try {
    embedded = await pdfDoc.embedPng(bytes);
  } catch {
    embedded = await pdfDoc.embedJpg(bytes);
  }

  const naturalW = embedded.width;
  const naturalH = embedded.height;
  
  // Calculate size based on imageSize percentage if no explicit width/height provided
  let imgW, imgH;
  if (targetW && targetH) {
    imgW = targetW;
    imgH = targetH;
  } else {
    // Use imageSize percentage to scale the image
    imgW = naturalW * imageSize;
    imgH = naturalH * imageSize;
  }

  pages.forEach((p) => {
    const { width, height } = p.getSize();
    if (mosaic) {
      const tileX = imgW * 2.5;
      const tileY = imgH * 2.5;
      for (let yPos = 40; yPos < height; yPos += tileY) {
        for (let xPos = 40; xPos < width; xPos += tileX) {
          p.drawImage(embedded, {
            x: xPos,
            y: yPos,
            width: imgW,
            height: imgH,
            opacity,
            rotate: degrees(rotate),
          });
        }
      }
    } else {
      const pos = resolvePosition(position, width, height, imgW, imgH);
      p.drawImage(embedded, {
        x: pos.x,
        y: pos.y,
        width: imgW,
        height: imgH,
        opacity,
        rotate: degrees(rotate),
      });
    }
  });

  return pdfDoc.save();
}
