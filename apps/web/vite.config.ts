import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Servi sous /app par le serveur maides (même origine que l'API).
// En dev, le proxy /api évite tout problème de CORS/cookies.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
