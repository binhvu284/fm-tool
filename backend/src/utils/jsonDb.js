import fs from "fs";
import { join, dirname } from "path";
import bcrypt from "bcryptjs";

const DB_FILE = process.env.JSON_DB_FILE || join(process.cwd(), "data", "database.json");

let db = null;
let loading = false;
const nowIso = () => new Date().toISOString();

function ensureDir(filePath) {
  const dir = dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function recalcSequences() {
  const maxId = (arr) => (arr.length ? Math.max(...arr.map((x) => x.id || 0)) : 0);
  const userMax = maxId(db.users);
  const fileMax = maxId(db.files);
  const reviewMax = maxId(db.reviews);
  const signatureMax = maxId(db.signatures);
  db.sequences.userId = Math.max(db.sequences.userId || 1, userMax + 1);
  db.sequences.fileId = Math.max(db.sequences.fileId || 1, fileMax + 1);
  db.sequences.reviewId = Math.max(db.sequences.reviewId || 1, reviewMax + 1);
  db.sequences.signatureId = Math.max(db.sequences.signatureId || 1, signatureMax + 1);
}

async function loadDb() {
  if (db || loading) return db;
  loading = true;
  ensureDir(DB_FILE);
  if (!fs.existsSync(DB_FILE)) {
    db = {
      meta: { version: 1, updatedAt: nowIso() },
      sequences: { userId: 1, fileId: 1, reviewId: 1, signatureId: 1 },
      users: [],
      files: [],
      reviews: [],
      signatures: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } else {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    db = JSON.parse(raw);
    // Normalize sequences in case the file was edited manually or seeded previously without updating counters
    db.meta = db.meta || { version: 1, updatedAt: nowIso() };
    db.sequences = db.sequences || { userId: 1, fileId: 1, reviewId: 1, signatureId: 1 };
    db.users = Array.isArray(db.users) ? db.users : [];
    db.files = Array.isArray(db.files) ? db.files : [];
    db.reviews = Array.isArray(db.reviews) ? db.reviews : [];
    db.signatures = Array.isArray(db.signatures) ? db.signatures : [];
    // Migrate legacy roles (uploader -> agent, approver -> admin)
    let migrated = false;
    for (const u of db.users) {
      if (u.role === "uploader") {
        u.role = "agent";
        migrated = true;
      }
      if (u.role === "approver") {
        u.role = "admin";
        migrated = true;
      }
    }
    if (migrated) {
      db.meta.version = (db.meta.version || 1) + 1;
    }
    recalcSequences();
    if (migrated) {
      // persist migration immediately
      db.meta.updatedAt = nowIso();
      ensureDir(DB_FILE);
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
  }
  loading = false;
  return db;
}

async function saveDb() {
  if (!db) await loadDb();
  db.meta.updatedAt = nowIso();
  ensureDir(DB_FILE);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export async function initJsonDb() {
  await loadDb();
  await ensureSeedAdmin();
}

export async function ensureSeedAdmin() {
  await loadDb();
  // Seed default admin only if not exists
  const adminUser = db.users.find((u) => u.email === "admin");
  if (!adminUser) {
    const id = db.sequences.userId++;
    const passwordHash = await bcrypt.hash("12345", 10);
    db.users.push({
      id,
      email: "admin",
      passwordHash,
      role: "admin",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await saveDb();
  }
}

export async function findUserByEmail(email) {
  await loadDb();
  return db.users.find((u) => u.email === email) || null;
}

export async function findUserById(id) {
  await loadDb();
  return db.users.find((u) => Number(u.id) === Number(id)) || null;
}

export async function createUser({ name = null, email, password, role = "agent", active = true }) {
  await loadDb();
  const existing = db.users.find((u) => u.email === email);
  if (existing) throw new Error("Email already in use");
  const passwordHash = await bcrypt.hash(password, 10);
  const id = db.sequences.userId++;
  const user = { id, name, email, passwordHash, role, active, createdAt: nowIso(), updatedAt: nowIso() };
  db.users.push(user);
  await saveDb();
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
}

export async function validateUserPassword(email, plainPassword) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  // Block inactive users
  if (user.active === false) return null;
  const valid = await bcrypt.compare(plainPassword, user.passwordHash);
  if (!valid) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
}

export function getDb() {
  return db;
}

// Admin helpers
export async function listUsers(filter = {}) {
  await loadDb();
  const { role } = filter;
  let users = db.users.slice();
  if (role) users = users.filter((u) => u.role === role);
  return users.map((u) => ({ id: u.id, name: u.name || null, email: u.email, role: u.role, active: u.active !== false, createdAt: u.createdAt, updatedAt: u.updatedAt }));
}

export async function updateUser(id, changes = {}) {
  await loadDb();
  const u = db.users.find((x) => Number(x.id) === Number(id));
  if (!u) throw new Error("User not found");
  if (changes.email && changes.email !== u.email) {
    const exist = db.users.find((x) => x.email === changes.email && Number(x.id) !== Number(id));
    if (exist) throw new Error("Email already in use");
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'password')) {
    const password = String(changes.password || "");
    if (password) u.passwordHash = await bcrypt.hash(password, 10);
    delete changes.password;
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'name')) u.name = changes.name;
  if (Object.prototype.hasOwnProperty.call(changes, 'email')) u.email = changes.email;
  if (Object.prototype.hasOwnProperty.call(changes, 'active')) u.active = !!changes.active;
  u.updatedAt = nowIso();
  await saveDb();
  return { id: u.id, name: u.name || null, email: u.email, role: u.role, active: u.active !== false, createdAt: u.createdAt, updatedAt: u.updatedAt };
}

export async function setUserActive(id, active) {
  return updateUser(id, { active: !!active });
}

export async function deleteUser(id) {
  await loadDb();
  const idx = db.users.findIndex((x) => Number(x.id) === Number(id));
  if (idx === -1) throw new Error("User not found");
  const u = db.users[idx];
  if (u.role === 'admin') throw new Error('Cannot delete admin');
  db.users.splice(idx, 1);
  await saveDb();
  return true;
}
