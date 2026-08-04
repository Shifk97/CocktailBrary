import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { requireAuth } from "../middleware.js";
import { UPLOADS_DIR } from "../paths.js";

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 8 * 1024 * 1024;

const router = Router();
router.use(requireAuth);

router.post("/", (req, res) => {
  const dataUrl = req.body.dataUrl || "";
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "Formato de imagen no válido." });

  const ext = MIME_EXT[match[1]] || "jpg";
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) return res.status(413).json({ error: "La imagen pesa demasiado." });

  const filename = `${req.userId}-${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  res.json({ url: `/uploads/${filename}` });
});

router.delete("/", (req, res) => {
  const paths = Array.isArray(req.body.paths) ? req.body.paths : [];
  let deleted = 0;
  paths.forEach((p) => {
    const base = path.basename(String(p));
    // solo puede borrar imágenes que le pertenecen (el nombre lleva su userId de prefijo)
    if (!base.startsWith(`${req.userId}-`)) return;
    if (!/^[0-9]+-[0-9a-fA-F-]+\.(jpg|jpeg|png|webp|gif)$/.test(base)) return;
    const full = path.join(UPLOADS_DIR, base);
    try {
      if (fs.existsSync(full)) { fs.unlinkSync(full); deleted++; }
    } catch (e) { /* ignorar */ }
  });
  res.json({ deleted });
});

export default router;
