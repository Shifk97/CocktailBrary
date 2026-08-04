import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware.js";

const router = Router();
router.use(requireAuth);

function cleanUrl(u) {
  return (u || "").trim().replace(/\/+$/, "");
}

router.get("/", (req, res) => {
  const cfg = db.prepare("SELECT url, token, list_entity_id FROM ha_config WHERE user_id = ?").get(req.userId);
  // El token nunca se devuelve al cliente, solo si hay uno configurado.
  res.json({ url: cfg ? cfg.url : "", configured: !!(cfg && cfg.token), listEntityId: cfg ? (cfg.list_entity_id || "") : "" });
});

router.put("/", (req, res) => {
  const url = cleanUrl(req.body.url);
  const tokenInput = typeof req.body.token === "string" ? req.body.token.trim() : "";
  const listEntityId = typeof req.body.listEntityId === "string" ? req.body.listEntityId.trim() : "";

  if (!url) {
    db.prepare("DELETE FROM ha_config WHERE user_id = ?").run(req.userId);
    return res.json({ ok: true, configured: false });
  }

  const existing = db.prepare("SELECT token, list_entity_id FROM ha_config WHERE user_id = ?").get(req.userId);
  const finalToken = tokenInput || (existing ? existing.token : "");
  if (!finalToken) return res.status(400).json({ error: "Falta el token de acceso." });
  const finalListEntityId = listEntityId || (existing ? existing.list_entity_id : "") || "";

  db.prepare(`
    INSERT INTO ha_config (user_id, url, token, list_entity_id, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET url = excluded.url, token = excluded.token, list_entity_id = excluded.list_entity_id, updated_at = excluded.updated_at
  `).run(req.userId, url, finalToken, finalListEntityId);

  res.json({ ok: true, configured: true, listEntityId: finalListEntityId });
});

router.delete("/", (req, res) => {
  db.prepare("DELETE FROM ha_config WHERE user_id = ?").run(req.userId);
  res.json({ ok: true });
});

router.post("/test", async (req, res) => {
  const url = cleanUrl(req.body.url);
  const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
  const existing = db.prepare("SELECT token FROM ha_config WHERE user_id = ?").get(req.userId);
  const finalToken = token || (existing ? existing.token : "");
  if (!url || !finalToken) return res.status(400).json({ error: "Falta la URL o el token." });

  try {
    const r = await fetch(`${url}/api/`, { headers: { Authorization: `Bearer ${finalToken}` } });
    if (!r.ok) return res.status(502).json({ error: `Home Assistant respondió con el código ${r.status}. Revisa la URL y el token.` });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "No se ha podido contactar con esa URL de Home Assistant." });
  }
});

// Devuelve las listas "todo" disponibles (Home Assistant permite varias: Compra, Bar, etc.)
router.post("/lists", async (req, res) => {
  const url = cleanUrl(req.body.url);
  const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
  const existing = db.prepare("SELECT token FROM ha_config WHERE user_id = ?").get(req.userId);
  const finalToken = token || (existing ? existing.token : "");
  if (!url || !finalToken) return res.status(400).json({ error: "Falta la URL o el token." });

  try {
    const r = await fetch(`${url}/api/states`, { headers: { Authorization: `Bearer ${finalToken}` } });
    if (!r.ok) return res.status(502).json({ error: `Home Assistant respondió con el código ${r.status}` });
    const states = await r.json();
    const lists = states
      .filter((s) => typeof s.entity_id === "string" && s.entity_id.startsWith("todo."))
      .map((s) => ({ entityId: s.entity_id, name: (s.attributes && s.attributes.friendly_name) || s.entity_id }));
    res.json({ lists });
  } catch (e) {
    res.status(502).json({ error: "No se ha podido contactar con Home Assistant." });
  }
});

router.post("/add-item", async (req, res) => {
  const cfg = db.prepare("SELECT url, token, list_entity_id FROM ha_config WHERE user_id = ?").get(req.userId);
  if (!cfg || !cfg.token) return res.status(400).json({ error: "Home Assistant no está configurado." });
  if (!cfg.list_entity_id) return res.status(400).json({ error: "No has elegido a qué lista enviar los ingredientes." });

  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Falta el nombre del artículo." });

  try {
    const r = await fetch(`${cfg.url}/api/services/todo/add_item`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: cfg.list_entity_id, item: name }),
    });
    if (!r.ok) return res.status(502).json({ error: `Home Assistant respondió con el código ${r.status}` });
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "No se ha podido contactar con Home Assistant." });
  }
});

export default router;
