// /.netlify/functions/health-check
// Analyses a plant photo and returns a structured health report.
//
// Expected POST body (JSON):
//   { appSecret, plantName, image }   ← image is a base64-encoded JPEG string
//
// Required environment variables (set in Netlify dashboard):
//   ANTHROPIC_API_KEY   — your Anthropic API key
//   APP_SECRET          — the shared secret that matches the iOS app

exports.handler = async (event) => {
  // ── Method guard ────────────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let appSecret, plantName, image;
  try {
    ({ appSecret, plantName, image } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  if (!process.env.APP_SECRET || appSecret !== process.env.APP_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // ── Prompt ──────────────────────────────────────────────────────────────
  const prompt = `You are an expert botanist and plant health specialist.
This photo shows a ${plantName}. Analyse its current health carefully.

Reply ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "status": "healthy" | "needs_attention" | "critical",
  "observations": ["observation 1", "observation 2"],
  "actions": [
    {
      "type": "repot" | "fertilize" | "pest" | "water" | "prune" | "light" | "other",
      "priority": "low" | "medium" | "high",
      "description": "specific actionable advice"
    }
  ]
}

Guidelines:
- healthy: plant looks vigorous, no visible problems
- needs_attention: minor issues (slight yellowing, small pest presence, dry soil, etc.)
- critical: severe wilting, heavy infestation, root rot signs, major leaf damage
- Provide 2–4 concise observations about what you actually see in the photo
- Only include actions genuinely needed; a healthy plant can have 0–1 preventive action`;

  // ── Call Claude ─────────────────────────────────────────────────────────
  let claudeRes;
  try {
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });
  } catch (err) {
    return { statusCode: 502, body: `Upstream request failed: ${err.message}` };
  }

  if (!claudeRes.ok) {
    return { statusCode: 502, body: `Claude API error: ${claudeRes.status}` };
  }

  // ── Extract JSON from response ──────────────────────────────────────────
  let responseJson;
  try {
    const data = await claudeRes.json();
    const raw  = data.content[0].text.trim();
    // Defensive: strip any accidental markdown fences
    const json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    // Validate it parses cleanly
    responseJson = JSON.stringify(JSON.parse(json));
  } catch (err) {
    return { statusCode: 500, body: `Failed to parse Claude response: ${err.message}` };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: responseJson
  };
};
