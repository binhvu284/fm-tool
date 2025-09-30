import { File, memory } from "../models/index.js";
import fs from "fs";
import { join } from "path";
import archiver from "archiver";

const usingMemory = !File;

export const upload = async (req, res) => {
  const files = req.files || [];
  if (usingMemory) {
    const created = files.map((f) => {
      const id = memory.nextFileId++;
      const rec = {
        id,
        originalName: f.originalname,
        storedName: f.filename,
        size: f.size,
        mimeType: f.mimetype,
        userId: req.user.sub,
        status: "pending",
        watermarkApplied: false,
        signatureApplied: false,
        createdAt: new Date().toISOString(),
      };
      memory.files.push(rec);
      return rec;
    });
    return res.status(201).json(created);
  }

  const created = await Promise.all(
    files.map((f) =>
      File.create({
        originalName: f.originalname,
        storedName: f.filename,
        size: f.size,
        mimeType: f.mimetype,
        userId: req.user.sub,
        watermarkApplied: false,
        signatureApplied: false,
      })
    )
  );
  res.status(201).json(created);
};

export const list = async (req, res) => {
  if (usingMemory) {
    const items = memory.files
      .filter((f) => f.userId === req.user.sub)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(
      items.map((f) => ({
        ...f,
        hasSignature: !!f.signatureApplied, // alias for frontend compatibility
      }))
    );
  }

  const items = await File.findAll({
    where: { userId: req.user.sub },
    order: [["createdAt", "DESC"]],
  });
  res.json(
    items.map((r) => ({
      ...r.get({ plain: true }),
      hasSignature: !!r.signatureApplied,
    }))
  );
};

export const download = async (req, res) => {
  const id = Number(req.params.id);
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  let record;
  if (usingMemory) {
    record = memory.files.find((f) => f.id === id && f.userId === req.user.sub);
  } else {
    record = await File.findOne({ where: { id, userId: req.user.sub } });
  }
  if (!record) return res.status(404).json({ message: "File not found" });
  const filePath = join(uploadDir, record.storedName);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ message: "Stored file missing" });
  res.download(filePath, record.originalName);
};

export const remove = async (req, res) => {
  const id = Number(req.params.id);
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  let record;
  if (usingMemory) {
    record = memory.files.find((f) => f.id === id && f.userId === req.user.sub);
    if (!record) return res.status(404).json({ message: "File not found" });
    const filePath = join(uploadDir, record.storedName);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
    memory.files = memory.files.filter((f) => f !== record);
    return res.json({ success: true });
  }
  record = await File.findOne({ where: { id, userId: req.user.sub } });
  if (!record) return res.status(404).json({ message: "File not found" });
  const filePath = join(uploadDir, record.storedName);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
  await record.destroy();
  res.json({ success: true });
};

export const removeAll = async (_req, res) => {
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  let count = 0;
  if (usingMemory) {
    for (const f of memory.files) {
      const p = join(uploadDir, f.storedName);
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
      count++;
    }
    memory.files = [];
    memory.nextFileId = 1;
  } else {
    const records = await File.findAll();
    for (const r of records) {
      const p = join(uploadDir, r.storedName);
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    }
    count = await File.destroy({ where: {} });
  }
  res.json({ success: true, removed: count });
};

export const bulkDelete = async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ message: "No ids provided" });
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  let removed = 0;
  if (usingMemory) {
    const keep = [];
    for (const f of memory.files) {
      if (f.userId === req.user.sub && ids.includes(f.id)) {
        const p = join(uploadDir, f.storedName);
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {}
        removed++;
      } else {
        keep.push(f);
      }
    }
    memory.files = keep;
  } else {
    const toDelete = await File.findAll({
      where: { id: ids, userId: req.user.sub },
    });
    for (const r of toDelete) {
      const p = join(uploadDir, r.storedName);
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
      await r.destroy();
      removed++;
    }
  }
  res.json({ success: true, removed });
};

export const bulkDownload = async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ message: "No ids provided" });
  const uploadDir = join(process.cwd(), process.env.UPLOAD_DIR || "uploads");
  let records = [];
  if (usingMemory) {
    records = memory.files.filter(
      (f) => f.userId === req.user.sub && ids.includes(f.id)
    );
  } else {
    records = await File.findAll({ where: { id: ids, userId: req.user.sub } });
  }
  if (!records.length)
    return res.status(404).json({ message: "Files not found" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="files.zip"');
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    try {
      res.status(500).end();
    } catch {}
  });
  archive.pipe(res);
  for (const r of records) {
    const p = join(uploadDir, r.storedName);
    if (fs.existsSync(p)) {
      archive.file(p, { name: r.originalName });
    }
  }
  archive.finalize();
};

export const preview = async (req, res) => {
  const id = Number(req.params.id);
  let record;
  if (usingMemory) {
    record = memory.files.find((f) => f.id === id && f.userId === req.user.sub);
  } else {
    record = await File.findOne({ where: { id, userId: req.user.sub } });
  }
  if (!record) return res.status(404).json({ message: "File not found" });

  // For now, return the static file URL for preview
  // In a full implementation, you might want to generate actual thumbnails
  res.json({
    previewUrl: `/static/${record.storedName}`,
    fileName: record.originalName,
    fileSize: record.size,
    mimeType: record.mimeType
  });
};
