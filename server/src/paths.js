import path from "path";

export const DB_PATH = process.env.DB_PATH || "./data/coctelaria.db";
export const UPLOADS_DIR = path.join(path.dirname(DB_PATH), "uploads");
