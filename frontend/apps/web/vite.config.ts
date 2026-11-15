import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self' https: ws: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const cspPlugin = {
  name: "nextcrop-csp",
  apply: "build" as const,
  transformIndexHtml(html: string) {
    return html.replace(
      "  </head>",
      `    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`,
    );
  },
};

const resolvePath = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    cspPlugin,
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/icon.svg", "icons/maskable.svg"],
      manifest: {
        name: "NextCrop",
        short_name: "NextCrop",
        description:
          "Satellite-informed crop rotation advice for smallholder farmers in the Lango sub-region, Uganda.",
        lang: "en",
        theme_color: "#1f6f43",
        background_color: "#f7f5ee",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,json}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/v1\//, /^\/mockServiceWorker\.js$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" && url.pathname.startsWith("/v1/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "nextcrop-api",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/[^/]*tile\.openstreetmap\.org\//,
            handler: "CacheFirst",
            options: {
              cacheName: "nextcrop-map-tiles",
              expiration: {
                maxEntries: 240,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@nextcrop/api-client": resolvePath("../../packages/api-client/src/index.ts"),
      "@nextcrop/i18n": resolvePath("../../packages/i18n/src/index.tsx"),
      "@nextcrop/ui": resolvePath("../../packages/ui/src/index.ts"),
      "@nextcrop/testing": resolvePath("../../packages/testing/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/v1": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
  build: {
    target: "es2020",
    sourcemap: true,
    cssCodeSplit: true,
    manifest: true,
    chunkSizeWarningLimit: 220,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
});
