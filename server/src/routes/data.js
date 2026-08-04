import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware.js";

const router = Router();
const ALLOWED_KEYS = new Set(["ingredients", "recipes", "shoppingList", "settings", "manual", "categories"]);

router.use(requireAuth);

router.get("/:key", (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: "Clave no válida" });
  const row = db.prepare("SELECT value FROM user_data WHERE user_id = ? AND key = ?").get(req.userId, key);
  res.json({ value: row ? JSON.parse(row.value) : null });
});

router.put("/:key", (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: "Clave no válida" });
  const value = JSON.stringify(req.body.value ?? null);
  db.prepare(`
    INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(req.userId, key, value);
  res.json({ ok: true });
});

export default router;
