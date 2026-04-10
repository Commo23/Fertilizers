import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { rssProxyPlugin } from "./vite-plugin-rss-proxy";
import { aisRelayPlugin } from "./vite-plugin-ais-relay";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Optional: set VITE_LIVE_NEWS_USE_PROXY=1 and use relative /api/youtube/* in dev to avoid CORS
      "/api/youtube": {
        target: "https://world-watcher.vercel.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    rssProxyPlugin(),
    aisRelayPlugin(),
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react-dom/client', '@react-three/fiber', '@react-three/drei', 'three'],
  },
}));
