// /lib/handlers/health.js
module.exports = async (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ status: "ok", service: "freeflow-backend" }));
};
