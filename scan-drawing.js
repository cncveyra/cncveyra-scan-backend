// api/scan-drawing.js
// Deploy this on Vercel. It keeps your Anthropic API key on the server
// and exposes POST /api/scan-drawing for the frontend to call.

export default async function handler(req, res) {
  // Allow calls from your site (tighten this to your real domain once live)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { imageBase64, mediaType } = req.body || {};
    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: 'imageBase64 and mediaType are required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text: "This is a photo of a 2D mechanical/turning drawing. Extract every dimension you can read: diameters, lengths, radii, chamfers, angles, overall length. Respond ONLY with a JSON array, no markdown fences, no preamble. Each item: {\"label\": short feature name e.g. 'Ø16 section' or 'Overall length', \"type\": one of diameter/length/radius/chamfer/angle/other, \"value\": number as string, \"unit\": \"mm\", \"confidence\": one of high/medium/low based on how clearly it was printed/legible in the image}."
            }
          ]
        }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).json({ error: 'Anthropic API error', detail: errText });
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ rows: parsed });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
