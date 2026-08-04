import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido o caducado" });
  }
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}
