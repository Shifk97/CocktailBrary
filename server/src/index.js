import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes, { registrationEnabled } from "./routes/auth.js";
import dataRoutes from "./routes/data.js";
import uploadsRoutes from "./routes/uploads.js";
import haRoutes from "./routes/ha.js";
import { requireAuth } from "./middleware.js";
import { UPLOADS_DIR } from "./paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET no está definido. Usando un valor por defecto NO seguro. Define JWT_SECRET en producción.");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/config", (req, res) => res.json({ registrationEnabled }));
app.get("/api/me", requireAuth, (req, res) => res.json({ username: req.username }));

app.use("/api/auth", authRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/ha", haRoutes);
app.use("/uploads", express.static(UPLOADS_DIR));

// Sirve el frontend ya compilado (generado por el build de Vite en la imagen Docker)
const clientDist = path.join(__dirname, "../public");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Cocktailbrary backend escuchando en http://0.0.0.0:${PORT}`);
});
