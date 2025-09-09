// /api/env-test.js
export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? 'OK' : 'MISSING',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'OK' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'unknown',
    TIMESTAMP: new Date().toISOString()
  });
}
