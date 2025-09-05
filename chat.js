// _worker.js — Cloudflare Worker (Modules)
// Variables → OPENROUTER_API_KEY = "sk-..."
// URL del endpoint: https://TU-WORKER.workers.dev/complete  (y /health para probar)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Healthcheck
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Chat completion
    if (req.method === 'POST' && url.pathname === '/complete') {
      let payload = {};
      try { payload = await req.json(); } catch {}
      const {
        messages = [{ role: 'user', content: 'Hola' }],
        model = 'deepseek/deepseek-r1:free',   // puedes cambiar a 'tngtech/deepseek-r1t-chimera:free'
        stream = true,
        temperature = 0.6,
        max_tokens = 400
      } = payload;

      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://tu-dominio-ejemplo.com',
          'X-Title': 'Chat'
        },
        body: JSON.stringify({ model, messages, stream, temperature, max_tokens })
      });

      // Si OpenRouter responde error, propágalo como JSON
      if (!upstream.ok) {
        const text = await upstream.text().catch(()=> '');
        return new Response(JSON.stringify({ error: true, status: upstream.status, detail: text }), {
          status: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }

      // Respuesta en streaming (SSE) o JSON normal
      if (stream) {
        const headers = new Headers(upstream.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        headers.set('Content-Type', 'text/event-stream; charset=utf-8');
        return new Response(upstream.body, { headers });
      } else {
        const data = await upstream.text(); // JSON completo sin streaming
        return new Response(data, { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Not Found', { status: 404, headers: CORS });
  }
};
