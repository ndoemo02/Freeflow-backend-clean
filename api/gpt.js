// /api/gpt.js
// Asystent FreeFlow – krótkie odpowiedzi PL

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY in env' });
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Jesteś asystentem FreeFlow. Odpowiadasz bardzo krótko, naturalnie po polsku. Max 18 słów.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 60
      })
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(500).json({ error: `OpenAI ${r.status}: ${txt}` });
    }

    const data = await r.json();
    let reply = data?.choices?.[0]?.message?.content?.trim() || '';

    // Filtracja – usuń ew. "Użytkownik prosił:" itp.
    reply = reply.replace(/^użytkownik.*?:/i, '').trim();

    return res.status(200).json({ reply });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
