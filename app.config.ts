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
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "Period Tracker",
          short_name: "Period",
          description: "Track cycles, symptoms, and period predictions.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#f5f9ff",
          theme_color: "#0084ce",
          icons: [
            {
              src: "/favicon.svg",
              sizes: "any",
              type: "image/svg+xml"
            }
          ]
        }
      })
    ]
  }
});
