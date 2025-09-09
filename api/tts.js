// /api/tts.js
// Serverless TTS (OpenAI tts-1) → MP3
export default async function handler(req, res) {
  // CORS
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
    const { text, voice = 'alloy', format = 'mp3' } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing "text"' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    // OpenAI TTS (tts-1)
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,            // 'alloy', 'verse', 'coral', 'sage'...
        input: text,
        format            // 'mp3' | 'wav' | 'opus' | 'aac'
      })
    });

    if (!r.ok) {
      const msg = await r.text().catch(()=> '');
      return res.status(502).json({ error: `OpenAI TTS ${r.status}: ${msg}` });
    }

    // strumień → Buffer
    const arrayBuf = await r.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    const mime =
      format === 'wav'  ? 'audio/wav'  :
      format === 'opus' ? 'audio/ogg'  :
      format === 'aac'  ? 'audio/aac'  : 'audio/mpeg';

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
