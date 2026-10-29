import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchImageModels, generateImage, imageSize, saveApiSettings } from './image-api';

afterEach(() => vi.unstubAllGlobals());
const settings = { model: 'gpt-image-2', ratio: '1:1', resolution: '1K', count: 1 };
function stream(...events: object[]) {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n', { headers: { 'content-type': 'text/event-stream' } });
}
describe('image service', () => {
  it('submits a JSON generation request and ignores partial images', async () => {
    const fetchMock = vi.fn().mockResolvedValue(stream({ type: 'image_generation.partial_image', b64_json: 'partial' }, { type: 'image_generation.completed', b64_json: 'final', mime_type: 'image/webp' }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateImage('一只猫', settings, []);
    expect(fetchMock.mock.calls[0][0]).toBe('/studio-image-api/generations');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: 'gpt-image-2', prompt: '一只猫', stream: true, response_format: 'b64_json', n: 1 });
    expect(result[0].data).toBe('data:image/webp;base64,final');
  });
  it('submits multiple reference images as multipart edits', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(new Blob(['image'], { type: 'image/png' }))).mockResolvedValueOnce(new Response(new Blob(['image'], { type: 'image/png' }))).mockResolvedValueOnce(stream({ type: 'image_generation.completed', data: [{ b64_json: 'edited' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const refs = [{ id: '1', name: 'a.png', data: 'data:image/png;base64,YQ==' }, { id: '2', name: 'b.png', data: 'data:image/png;base64,Yg==' }];
    const result = await generateImage('编辑', settings, refs);
    const [url, request] = fetchMock.mock.calls[2];
    expect(url).toBe('/studio-image-api/edits');
    expect(request.body.getAll('image[]')).toHaveLength(2);
    expect(request.body.get('stream')).toBe('true');
    expect(result[0].data).toBe('data:image/png;base64,edited');
  });
  it('reports incomplete streams instead of treating previews as results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream({ type: 'image_generation.partial_image', b64_json: 'partial' })));
    await expect(generateImage('猫', settings, [])).rejects.toThrow('未返回完整图片');
  });
  it('returns a completed image without waiting for the SSE connection to close', async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"image_generation.partial_image","b64_json":"preview"}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"image_generation.completed","b64_json":"final"}\n\n'));
      },
      cancel,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } })));
    const result = await generateImage('猫', settings, []);
    expect(result[0].data).toBe('data:image/png;base64,final');
    expect(cancel).toHaveBeenCalled();
  });
  it('does not treat a partial event named in the SSE event field as a completed image', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('event: image_generation.partial_image\ndata: {"b64_json":"preview"}\n\ndata: [DONE]\n\n')); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/event-stream' } })));
    await expect(generateImage('猫', settings, [])).rejects.toThrow('未返回完整图片');
  });
  it('handles a completed edit result split across chunks without waiting for a close', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('data: {"item":{"res')); controller.enqueue(encoder.encode('ult":"edited"}}\r\n\r\n')); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(new Blob(['image'], { type: 'image/png' }))).mockResolvedValueOnce(new Response(body, { headers: { 'content-type': 'text/event-stream' } })));
    const result = await generateImage('修改', settings, [{ id: '1', name: 'a.png', data: 'data:image/png;base64,YQ==' }]);
    expect(result[0].data).toBe('data:image/png;base64,edited');
  });
  it('maps size selections to dimensions', () => { expect(imageSize('9:16', '2K')).toBe('1152x2048'); });
});

describe('model settings', () => {
  it('fetches models with draft connection settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: ['gpt-image-2', 'gemini-3-pro-image'] }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchImageModels({ apiUrl: 'https://example.com/v1', apiKey: 'draft' })).toEqual(['gpt-image-2', 'gemini-3-pro-image']);
    expect(fetchMock.mock.calls[0][0]).toBe('/studio-image-api/models');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ apiUrl: 'https://example.com/v1', apiKey: 'draft' });
  });
  it('reports a model listing failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '模型接口请求失败（HTTP 401）' }), { status: 401 })));
    await expect(fetchImageModels({ apiUrl: 'https://example.com/v1' })).rejects.toThrow('HTTP 401');
  });
  it('saves an empty model selection without re-enabling defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ apiUrl: 'https://example.com/v1', hasKey: true, selectedModels: [], availableModels: ['gpt-image-2'] })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await saveApiSettings({ apiUrl: 'https://example.com/v1', selectedModels: [], availableModels: ['gpt-image-2'] });
    expect(result.selectedModels).toEqual([]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).selectedModels).toEqual([]);
  });
});
