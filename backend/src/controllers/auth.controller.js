import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { createUser as jsonCreateUser, validateUserPassword as jsonValidateUserPassword, findUserByEmail as jsonFindUserByEmail } from "../utils/jsonDb.js";
// Prefer JSON DB when explicitly enabled or when server is allowed to run without DB
const useMemory =
  process.env.USE_INMEMORY_STORAGE === "true" ||
  process.env.ALLOW_START_WITHOUT_DB === "true" ||
  !User;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export const register = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    if (useMemory) {
      const user = await jsonCreateUser({ email, password, role });
      return res.status(201).json(user);
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, role });
    return res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Registration failed" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Always try JSON DB first if user exists there (dev/in-memory convenience)
    try {
      const fileUser = await jsonFindUserByEmail(email);
      if (fileUser) {
        if (fileUser.active === false)
          return res.status(401).json({ message: "Invalid credentials" });
        const validFile = await bcrypt.compare(password, fileUser.passwordHash);
        if (!validFile)
          return res.status(401).json({ message: "Invalid credentials" });
        const token = jwt.sign({ sub: fileUser.id, role: fileUser.role }, JWT_SECRET, { expiresIn: "1d" });
        return res.json({ token, user: { id: fileUser.id, email: fileUser.email, role: fileUser.role, name: fileUser.name || null, active: fileUser.active !== false } });
      }
    } catch {}

    if (useMemory) {
      const user = await jsonValidateUserPassword(email, password);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
      return res.json({ token, user });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Login failed" });
  }
};
