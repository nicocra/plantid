/* ─────────────────────────────────────────────────────────
   My Garden – Plants CRUD Netlify Function
   Proxies all plant database operations to Supabase.
   All requests must include the APP_SECRET for authorization.
───────────────────────────────────────────────────────── */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const APP_SECRET   = process.env.APP_SECRET;

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

function unauthorized() {
  return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized' }) };
}

function serverError(msg) {
  return { statusCode: 500, body: JSON.stringify({ error: msg }) };
}

exports.handler = async function (event) {
  // Config check
  if (!SUPABASE_URL || !SUPABASE_KEY || !APP_SECRET) {
    return serverError('Server not configured');
  }

  const method = event.httpMethod;

  // ── GET: list all plants ────────────────────────────────
  if (method === 'GET') {
    const secret = event.headers['x-app-secret'];
    if (!secret || secret !== APP_SECRET) return unauthorized();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/plants?select=*&order=date_added.desc`,
      { headers: HEADERS }
    );
    const data = await res.json();
    return {
      statusCode: res.ok ? 200 : res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  }

  // ── POST / PATCH / DELETE: parse body ──────────────────
  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    if (!body.appSecret || body.appSecret !== APP_SECRET) return unauthorized();

    // POST: insert a new plant
    if (method === 'POST') {
      const { plant } = body;
      if (!plant) return { statusCode: 400, body: JSON.stringify({ error: 'Missing plant' }) };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/plants`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(plant)
      });
      return { statusCode: res.ok ? 201 : res.status, body: '' };
    }

    // PATCH: update an existing plant
    if (method === 'PATCH') {
      const { id, patch } = body;
      if (!id || !patch) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id or patch' }) };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/plants?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
      });
      return { statusCode: res.ok ? 200 : res.status, body: '' };
    }

    // DELETE: remove a plant
    if (method === 'DELETE') {
      const { id } = body;
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/plants?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: HEADERS
      });
      return { statusCode: res.ok ? 200 : res.status, body: '' };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
