import { createServer, defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { imageApi } from './image-api';
import tailwindcss from '@tailwindcss/vite';

function canvasApp(): Plugin {
  return {
    name: 'canvas-app',
    async configureServer(server) {
      const canvas = await createServer({ configFile: resolve(import.meta.dirname, '../canvas/vite.config.ts'), server: { middlewareMode: true, hmr: { server: server.httpServer! } }, appType: 'spa' });
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/canvas-app/')) canvas.middlewares(req, res, next);
        else next();
      });
      server.httpServer?.once('close', () => void canvas.close());
    },
  };
}

export default defineConfig({
  plugins: [imageApi(), canvasApp(), react(), tailwindcss()],
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.image-api-settings.json'] }, proxy: { '/api': 'http://127.0.0.1:8787' } },
});
