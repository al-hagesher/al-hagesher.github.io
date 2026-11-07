// על הגשר — עוזרת AI (פרוקסי ל-Claude Opus)
// מפתח ה-API יושב כסוד ANTHROPIC_API_KEY ב-Supabase. הדפדפן לא יראה אותו.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret is not set' }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }

  const { messages, system, tools, model, max_tokens } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'messages required' }, 400);

  const payload: Record<string, unknown> = {
    model: model || 'claude-opus-5-5',
    max_tokens: max_tokens || 4096,
    messages,
  };
  if (system) payload.system = system;
  if (Array.isArray(tools) && tools.length) payload.tools = tools;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { ...CORS, 'content-type': 'application/json' } });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
