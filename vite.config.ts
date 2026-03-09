import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'codemirror': ['@codemirror/view', '@codemirror/state', '@codemirror/language', '@codemirror/commands', '@codemirror/search', '@codemirror/autocomplete', '@codemirror/lint'],
          'codemirror-lang': ['@codemirror/lang-markdown'],
          'react-vendor': ['react', 'react-dom'],
          'lezer': ['@lezer/common', '@lezer/highlight', '@lezer/markdown', '@lezer/lr'],
          'katex': ['katex'],
          'mermaid': ['mermaid'],
          'markdown-pipeline': ['unified', 'remark-parse', 'remark-rehype', 'rehype-sanitize', 'rehype-stringify'],
          'lucide': ['lucide-react'],
          'tauri': ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-opener'],
          'zustand': ['zustand'],
          'd3': ['d3-force'],
          'virtualizer': ['@tanstack/react-virtual'],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
