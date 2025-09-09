// /api/health.js
export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    status: 'ok',
    service: 'freeflow-backend',
    ts: new Date().toISOString()
  });
}
