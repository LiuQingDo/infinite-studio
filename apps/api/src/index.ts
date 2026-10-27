import { createClient } from '@supabase/supabase-js';
import type { ServiceStatus } from '@infinite-studio/contracts';

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/api/status') {
    const status: ServiceStatus = {
      generationEnabled: false,
      authenticationConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
    };
    return json(status);
  }
  if (request.method === 'POST' && pathname === '/api/images/generations') {
    return json({ error: 'Image generation is not configured.' }, 503);
  }
  if (request.method !== 'GET' || pathname !== '/api/tasks') return json({ error: 'Not found.' }, 404);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: 'Authentication is not configured.' }, 503);
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') ?? '');
  if (!match) return json({ error: 'Authentication required.' }, 401);
  const token = match[1];
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return json({ error: 'Invalid session.' }, 401);
  const { data, error } = await client.from('image_tasks').select('id, status, created_at')
    .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(50);
  if (error) return json({ error: 'Could not load tasks.' }, 502);
  return json({ tasks: data });
}

export default { fetch: handleRequest };
