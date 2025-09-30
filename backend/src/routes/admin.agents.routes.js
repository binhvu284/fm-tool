import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { 
  listUsers, 
  createUser as jsonCreateUser, 
  updateUser as jsonUpdateUser, 
  setUserActive as jsonSetUserActive, 
  deleteUser as jsonDeleteUser 
} from "../utils/jsonDb.js";
import { User, File, memory } from "../models/index.js";

const router = Router();
const usingMemory = !User;

// List agents
router.get("/", authenticate, authorize("admin"), async (_req, res) => {
  try {
    if (usingMemory) {
      const agents = await listUsers({ role: "agent" });
      const files = memory.files || [];
      const withCounts = agents.map((a) => ({
        ...a,
        fileCount: files.filter((f) => Number(f.userId) === Number(a.id)).length,
      }));
      return res.json(withCounts);
    }
    // Sequelize path (minimal):
    return res.status(501).json({ message: "Not implemented for SQL mode yet" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Create agent
router.post("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "email and password are required" });
    if (usingMemory) {
      const user = await jsonCreateUser({ name, email, password, role: "agent", active: true });
      return res.status(201).json(user);
    }
    return res.status(501).json({ message: "Not implemented for SQL mode yet" });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Update agent (name/email/password, partial)
router.put("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body || {};
    if (usingMemory) {
      const user = await jsonUpdateUser(id, { name, email, password });
      return res.json(user);
    }
    return res.status(501).json({ message: "Not implemented for SQL mode yet" });
  } catch (e) {
    const status = e.message?.includes("Email already in use") ? 409 : 400;
    return res.status(status).json({ message: e.message });
  }
});

// Activate
router.post("/:id/activate", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (usingMemory) {
      const user = await jsonSetUserActive(id, true);
      return res.json(user);
    }
    return res.status(501).json({ message: "Not implemented for SQL mode yet" });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Deactivate
router.post("/:id/deactivate", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (usingMemory) {
      const user = await jsonSetUserActive(id, false);
      return res.json(user);
    }
    return res.status(501).json({ message: "Not implemented for SQL mode yet" });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

// Delete agent
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (usingMemory) {
      await jsonDeleteUser(id);
      return res.json({ success: true });
    }
    return res.status(501).json({ message: "Not implemented for SQL mode yet" });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

export default router;
