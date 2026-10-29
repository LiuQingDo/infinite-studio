export type ImageReference = { id: string; name: string; data: string };
export type ImageSettings = { model: string; ratio: string; resolution: string; count: number };
export type ApiSettings = { apiUrl: string; hasKey: boolean; selectedModels: string[]; availableModels: string[] };
const base = '/studio-image-api';
export async function apiSettings(): Promise<ApiSettings> {
  const response = await fetch(`${base}/settings`);
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('本机图片服务不可用，请使用开发服务启动项目。');
  return response.json() as Promise<ApiSettings>;
}
export async function saveApiSettings(data: { apiUrl: string; apiKey?: string; clearKey?: boolean; selectedModels?: string[]; availableModels?: string[] }): Promise<ApiSettings> {
  const response = await fetch(`${base}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Request': '1' }, body: JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || '保存失败。'); return result as ApiSettings;
}
export async function fetchImageModels(data: { apiUrl: string; apiKey?: string }): Promise<string[]> {
  const response = await fetch(`${base}/models`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Request': '1' }, body: JSON.stringify(data) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `模型接口请求失败（HTTP ${response.status}）。`);
  if (!Array.isArray(result.models)) throw new Error('模型接口返回格式无效。');
  return result.models;
}
export function imageSize(ratio: string, resolution: string): string {
  const presets: Record<string, Record<string, string>> = {
    '1K': { '1:1': '1024x1024', '4:5': '1024x1280', '3:4': '768x1024', '16:9': '1536x864', '9:16': '864x1536' },
    '2K': { '1:1': '2048x2048', '4:5': '1632x2048', '3:4': '1536x2048', '16:9': '2048x1152', '9:16': '1152x2048' },
    '4K': { '1:1': '2880x2880', '4:5': '2560x3200', '3:4': '2480x3312', '16:9': '3840x2160', '9:16': '2160x3840' },
  };
  const sizes = presets[resolution] || presets['1K'];
  return sizes[ratio] || sizes['1:1'];
}
function imagesFrom(payload: any): string[] {
  const list = Array.isArray(payload?.data) ? payload.data : [payload];
  return list.flatMap((item: any) => {
    const value = item?.b64_json || item?.item?.result;
    if (typeof value === 'string' && value) return [value.startsWith('data:') ? value : `data:${item.mime_type || payload.mime_type || 'image/png'};base64,${value}`];
    if (typeof item?.url === 'string' && /^https:\/\//.test(item.url)) return [item.url];
    return [];
  });
}
export async function generateImage(prompt: string, settings: ImageSettings, references: ImageReference[]): Promise<ImageReference[]> {
  const fields = { model: settings.model, prompt, n: 1, size: imageSize(settings.ratio, settings.resolution), stream: true, response_format: 'b64_json' };
  let body: BodyInit; const headers: Record<string, string> = { 'X-Studio-Request': '1' };
  if (references.length) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.set(key, String(value)));
    const name = references.length > 1 ? 'image[]' : 'image';
    for (const ref of references) { const blob = await (await fetch(ref.data)).blob(); form.append(name, blob, ref.name || 'reference.png'); }
    body = form;
  } else { headers['Content-Type'] = 'application/json'; body = JSON.stringify(fields); }
  const response = await fetch(`${base}/${references.length ? 'edits' : 'generations'}`, { method: 'POST', headers, body });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || `请求失败（HTTP ${response.status}）。`); }
  let results: string[] = [];
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    if (!response.body) throw new Error('图片服务未返回内容。');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    let terminal = false;
    const process = (frame: string) => {
      const lines = frame.split(/\r?\n/);
      const eventName = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || '';
      const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data) return;
      if (data === '[DONE]') { terminal = true; return; }
      let event: any; try { event = JSON.parse(data); } catch { throw new Error('图片服务返回了无法解析的事件。'); }
      const type = String(event.type || eventName);
      if (event.error || type === 'error' || type.endsWith('.failed')) throw new Error('图片服务返回错误，请检查模型分组、参数与账户状态。');
      if (type.includes('partial')) return;
      const found = imagesFrom(event);
      if (found.length) { results = found; terminal = true; }
      else if (type === 'image_generation.completed' || type === 'image_edit.completed') terminal = true;
    };
    try {
      while (!terminal) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() || '';
        for (const frame of frames) { process(frame); if (terminal) break; }
        if (done) { if (!terminal && buffer.trim()) process(buffer); break; }
      }
    } finally {
      // A gateway may keep the SSE connection open after the final image.
      // Do not wait for cancellation before displaying the result.
      void reader.cancel().catch(() => {});
    }
  } else results = imagesFrom(await response.json());
  if (!results.length) throw new Error('图片服务未返回完整图片，请检查模型是否支持图片生成。');
  return results.map((data, i) => ({ id: crypto.randomUUID(), name: `生成图片 ${i + 1}`, data }));
}
