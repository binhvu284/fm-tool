import jwt from "jsonwebtoken";

export const authenticate = (req, _res, next) => {
  if (process.env.DISABLE_AUTH === "true") {
    req.user = { sub: 1, role: "admin" };
    return next();
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return next({ status: 401, message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
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
