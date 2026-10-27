import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { parseChangelog } from './src/lib/release';

const root = dirname(fileURLToPath(import.meta.url));
function pluginsManifest(): Plugin {
  const files = () => {
    try { return readdirSync(resolve(root, 'public/plugins')).filter(file => file.endsWith('.js')).sort().map(file => `/canvas-app/plugins/${file}`); }
    catch { return []; }
  };
  return { name: 'canvas-plugins-manifest', configureServer(server) { server.middlewares.use('/plugins/index.json', (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(files())); }); }, generateBundle() { this.emitFile({ type: 'asset', fileName: 'plugins/index.json', source: JSON.stringify(files()) }); } };
}
export default defineConfig({
  root,
  base: '/canvas-app/',
  plugins: [react(), pluginsManifest()],
  resolve: { alias: { '@': resolve(root, 'src') } },
  define: { __APP_VERSION__: JSON.stringify(readFileSync(resolve(root, 'UPSTREAM_VERSION'), 'utf8').trim()), __APP_RELEASES__: JSON.stringify(parseChangelog(readFileSync(resolve(root, 'UPSTREAM_CHANGELOG.md'), 'utf8'))) },
  build: { outDir: resolve(root, '../web/dist/canvas-app'), emptyOutDir: true },
});
