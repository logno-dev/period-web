import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  ssr: true, // false for client-side rendering only
  server: { preset: "" }, // your deployment
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: false,
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        includeAssets: [
          "favicon.ico",
          "favicon.svg",
          "favicon-16x16.png",
          "favicon-32x32.png",
          "favicon-48x48.png",
          "favicon-180x180.png",
          "favicon-192x192.png",
          "favicon-512x512.png"
        ],
        manifest: {
          id: "/",
          name: "Period Tracker",
          short_name: "Period",
          description: "Track cycles, symptoms, and period predictions.",
          start_url: "/",
          display_override: ["standalone", "minimal-ui", "browser"],
          scope: "/",
          display: "standalone",
          background_color: "#f5f9ff",
          theme_color: "#0084ce",
          orientation: "portrait",
          categories: ["health", "lifestyle"],
          icons: [
            {
              src: "/favicon-16x16.png",
              sizes: "16x16",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon-32x32.png",
              sizes: "32x32",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon-48x48.png",
              sizes: "48x48",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon-180x180.png",
              sizes: "180x180",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "/favicon.svg",
              sizes: "any",
              type: "image/svg+xml"
            },
            {
              src: "/favicon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "/favicon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        }
      })
    ]
  }
});
