import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { DEFAULT_IMAGE_MODELS } from './src/image-models';

const override = process.env.INFINITE_STUDIO_IMAGE_CONFIG_PATH;
const configFile = override && basename(override) === '.image-api-settings.json' ? resolve(override) : resolve(import.meta.dirname, '../../data/.image-api-settings.json');
const defaultUrl = 'https://api.apikey.fan/v1';
type Config = { apiUrl: string; apiKey: string; selectedModels?: string[]; availableModels?: string[] };
const validModels = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 200 && !/[\r\n]/.test(item)).map(item => item.trim()))].slice(0, 2000) : [];
const publicSettings = (config: Config) => ({ apiUrl: config.apiUrl, hasKey: Boolean(config.apiKey), selectedModels: Array.isArray(config.selectedModels) ? validModels(config.selectedModels) : DEFAULT_IMAGE_MODELS, availableModels: validModels(config.availableModels) });
async function readConfig(): Promise<Config> {
  try { return JSON.parse(await readFile(configFile, 'utf8')) as Config; }
  catch { return { apiUrl: defaultUrl, apiKey: '' }; }
}
function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('API 地址必须使用 HTTPS（本机测试地址除外）。');
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能包含账号、查询参数或片段。');
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/images\/(generations|edits)$/, '');
  if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
  return url.toString().replace(/\/$/, '');
}
async function body(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const part = Buffer.from(chunk); size += part.length; if (size > limit) throw new Error('请求内容过大。'); chunks.push(part); }
  return Buffer.concat(chunks);
}
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
export function imageApi(): Plugin {
  return { name: 'local-image-api', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      let path = req.url || '';
      try { path = decodeURIComponent(path); } catch { return json(res, 400, { error: '请求路径无效。' }); }
      if (path.toLowerCase().includes('.image-api-settings.json')) return json(res, 404, { error: '未找到接口。' });
      next();
    });
    server.middlewares.use('/studio-image-api', (req, res) => { void (async () => {
      // Only the local Vite origin may read or change settings or spend credits.
      const host = req.headers.host || '';
      const origin = req.headers.origin;
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host) || (origin && origin !== `http://${host}`) || (req.method !== 'GET' && (!origin || req.headers['x-studio-request'] !== '1'))) return json(res, 403, { error: '请求来源无效。' });
      const path = (req.url || '').split('?')[0];
      if (path === '/settings' && req.method === 'GET') { const config = await readConfig(); return json(res, 200, publicSettings(config)); }
      if (path === '/settings' && req.method === 'POST') {
        try {
          const input = JSON.parse((await body(req, 1024 * 1024)).toString());
          const apiUrl = normalizeUrl(String(input.apiUrl || ''));
          const current = await readConfig();
          const apiKey = input.clearKey ? '' : (String(input.apiKey || '').trim() || current.apiKey);
          if (apiKey.length > 4096 || /[\r\n]/.test(apiKey)) throw new Error('API Key 格式无效。');
          await mkdir(dirname(configFile), { recursive: true });
          const config = { apiUrl, apiKey, selectedModels: Array.isArray(input.selectedModels) ? validModels(input.selectedModels) : publicSettings(current).selectedModels, availableModels: Array.isArray(input.availableModels) ? validModels(input.availableModels) : validModels(current.availableModels) };
          await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
          return json(res, 200, publicSettings(config));
        } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : '保存失败。' }); }
      }
      if (path === '/settings' && req.method === 'DELETE') { await unlink(configFile).catch(() => {}); return json(res, 200, publicSettings({ apiUrl: defaultUrl, apiKey: '' })); }
      if (path === '/models' && req.method === 'POST') {
        let apiUrl: string; let apiKey: string;
        try {
          const input = JSON.parse((await body(req, 16384)).toString());
          const config = await readConfig();
          apiUrl = normalizeUrl(String(input.apiUrl || ''));
          apiKey = String(input.apiKey || '').trim() || config.apiKey;
          if (!apiKey) return json(res, 400, { error: '请先输入或保存 API Key。' });
          if (apiKey.length > 4096 || /[\r\n]/.test(apiKey)) return json(res, 400, { error: 'API Key 格式无效。' });
        } catch { return json(res, 400, { error: 'API 地址或请求格式无效，请检查地址。' }); }
        try {
          const upstream = await fetch(`${apiUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(30000) });
          if (!upstream.ok) return json(res, upstream.status, { error: `模型接口请求失败（HTTP ${upstream.status}），请检查地址、密钥及分组权限。` });
          if (!upstream.body) return json(res, 502, { error: '模型接口未返回内容。' });
          const reader = upstream.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
          for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2 * 1024 * 1024) { await reader.cancel(); return json(res, 502, { error: '模型列表过大。' }); } chunks.push(value); }
          const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { data?: unknown }).data)) return json(res, 502, { error: '模型接口返回格式不符合 OpenAI 模型列表格式。' });
          const ids = (parsed as { data: unknown[] }).data.map(item => item && typeof item === 'object' ? (item as { id?: unknown }).id : null);
          return json(res, 200, { models: validModels(ids) });
        } catch { return json(res, 502, { error: '无法连接模型接口或请求超时，请检查 API 地址与网络。' }); }
      }
      if ((path === '/generations' || path === '/edits') && req.method === 'POST') {
        const config = await readConfig();
        if (!config.apiKey) return json(res, 400, { error: '请先在设置中配置 API Key。' });
        try {
          const payload = await body(req, 45 * 1024 * 1024);
          const type = req.headers['content-type'] || '';
          if ((path === '/generations' && !type.startsWith('application/json')) || (path === '/edits' && !type.startsWith('multipart/form-data; boundary='))) return json(res, 400, { error: '请求格式无效。' });
          const controller = new AbortController();
          res.once('close', () => { if (!res.writableFinished) controller.abort(); });
          const upstream = await fetch(`${normalizeUrl(config.apiUrl)}/images${path}`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': type, Accept: 'text/event-stream, application/json' }, body: new Uint8Array(payload), redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(900000)]) });
          if (!upstream.ok) return json(res, upstream.status, { error: `图片服务请求失败（HTTP ${upstream.status}），请检查密钥、模型分组和参数。` });
          res.writeHead(200, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          if (upstream.body) {
            const stream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream);
            stream.on('error', () => { if (!res.destroyed) res.destroy(); });
            res.once('close', () => stream.destroy());
            stream.pipe(res);
          } else res.end();
        } catch { if (!res.headersSent) json(res, 502, { error: '无法连接图片服务或请求超时，请检查 API 地址与网络。' }); else res.end(); }
        return;
      }
      json(res, 404, { error: '未找到接口。' });
    })().catch(() => { if (!res.headersSent) json(res, 500, { error: '本机服务出错。' }); else res.end(); }); });
  } };
}
