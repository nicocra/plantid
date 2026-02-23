/* ─────────────────────────────────────────────────────────
   PlantID – Netlify Serverless Function
   Acts as a proxy between the browser and Anthropic's API,
   which avoids the CORS restriction that blocks direct
   browser-to-Anthropic calls on hosted sites.
───────────────────────────────────────────────────────── */

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, imageMime, apiKey } = JSON.parse(event.body);

    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or missing API key' })
      };
    }

    if (!imageBase64 || !imageMime) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing image data' })
      };
    }

    const prompt = `You are an expert botanist. Analyze this plant photo carefully and respond with ONLY a JSON object (no markdown, no code fences, just raw JSON).

If you can identify the plant, return:
{
  "identified": true,
  "common_name": "Common Name",
  "latin_name": "Genus species",
  "confidence": 85,
  "watering": "Brief watering advice (1-2 sentences)",
  "light": "Brief light requirements (1-2 sentences)",
  "soil": "Brief soil advice (1-2 sentences)",
  "extra_tip": "One interesting or important care tip"
}

If no plant is visible or you cannot identify it, return:
{
  "identified": false,
  "reason": "Short explanation of why"
}

Confidence is an integer 0-100 representing how certain you are.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageMime,
                data: imageBase64
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return {
        statusCode: anthropicRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data?.error?.message || 'Anthropic API error' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Server error' })
    };
  }
};
