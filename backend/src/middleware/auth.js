import jwt from "jsonwebtoken";
import { getDb } from "../utils/jsonDb.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export const authenticate = (req, _res, next) => {
  if (process.env.DISABLE_AUTH === "true") {
    try {
      const db = getDb?.();
      const admin = db?.users?.find?.((u) => u.role === "admin");
      req.user = { sub: admin?.id || 1, role: "admin" };
    } catch {
      req.user = { sub: 1, role: "admin" };
    }
    return next();
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return next({ status: 401, message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    next({ status: 401, message: "Invalid token" });
  }
};

export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.role))
      return next({ status: 403, message: "Forbidden" });
    next();
  };
