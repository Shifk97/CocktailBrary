import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Cocktailbrary",
        short_name: "Cocktailbrary",
        description: "Inventario, recetas y compra para tu barra de coctelería",
        lang: "es",
        theme_color: "#17130F",
        background_color: "#17130F",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Solo cachea el "cascarón" de la app (JS/CSS/HTML/iconos).
        // Las llamadas a /api/* SIEMPRE van a la red: los datos del inventario
        // no deben servirse cacheados y quedarse desfasados.
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: /^\/uploads\//,
            handler: "CacheFirst",
            options: { cacheName: "cocktailbrary-uploads", expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
  },
});
