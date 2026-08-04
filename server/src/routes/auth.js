import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { signToken, requireAuth } from "../middleware.js";

const router = Router();
const REGISTRATION_ENABLED = process.env.ALLOW_REGISTRATION !== "false";

function validCreds(username, password) {
  return typeof username === "string" && typeof password === "string" &&
    username.trim().length >= 3 && password.length >= 6;
}

router.post("/register", (req, res) => {
  if (!REGISTRATION_ENABLED) {
    return res.status(403).json({ error: "El registro de nuevos usuarios está desactivado." });
  }

  const username = (req.body.username || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!validCreds(username, password)) {
    return res.status(400).json({ error: "El usuario necesita al menos 3 caracteres y la contraseña 6." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return res.status(409).json({ error: "Ese usuario ya existe." });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
  const user = { id: info.lastInsertRowid, username };
  const token = signToken(user);
  res.json({ token, username: user.username });
});

router.post("/login", (req, res) => {
  const username = (req.body.username || "").trim().toLowerCase();
  const password = req.body.password || "";

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos." });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos." });

  const token = signToken(user);
  res.json({ token, username: user.username });
});

router.post("/change-password", requireAuth, (req, res) => {
  const currentPassword = req.body.currentPassword || "";
  const newPassword = req.body.newPassword || "";

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

  const ok = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: "La contraseña actual no es correcta." });

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "La nueva contraseña necesita al menos 6 caracteres." });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.userId);
  res.json({ ok: true });
});

export const registrationEnabled = REGISTRATION_ENABLED;
export default router;
