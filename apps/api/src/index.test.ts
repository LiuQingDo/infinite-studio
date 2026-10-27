import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from './index';

afterEach(() => vi.unstubAllGlobals());

describe('API safety gates', () => {
  it('reports unconfigured services without exposing configuration', async () => {
    const response = await handleRequest(new Request('http://localhost/api/status'), {});
    expect(await response.json()).toEqual({ generationEnabled: false, authenticationConfigured: false });
  });
  it('never accepts a generation while providers and budgets are unconfigured', async () => {
    const response = await handleRequest(new Request('http://localhost/api/images/generations', { method: 'POST' }), {});
    expect(response.status).toBe(503);
  });
  it('rejects task access without configured authentication or a bearer token', async () => {
    const req = new Request('http://localhost/api/tasks');
    expect((await handleRequest(req, {})).status).toBe(503);
    expect((await handleRequest(req, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public' })).status).toBe(401);
  });
  it('verifies the token and queries tasks for that user with the user token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/v1/user') return Response.json({ id: 'user-123', aud: 'authenticated' });
      expect(url.pathname).toBe('/rest/v1/image_tasks');
      expect(url.searchParams.get('owner_id')).toBe('eq.user-123');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer user-token');
      return Response.json([{ id: 'task-1', status: 'queued', created_at: '2026-01-01T00:00:00Z' }]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('http://localhost/api/tasks', { headers: { Authorization: 'Bearer user-token' } });
    const response = await handleRequest(req, { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public' });
    expect(response.status).toBe(200);
    expect((await response.json() as { tasks: unknown[] }).tasks).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
