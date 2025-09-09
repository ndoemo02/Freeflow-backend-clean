cat > api/health.js <<'EOF'
const { setCors, handlePreflight } = require('../lib/cors');

module.exports = (req, res) => {
  if (handlePreflight(req, res)) return; // Obsłuż OPTIONS

  setCors(res);
  res.status(200).json({ ok: true, msg: "Backend działa poprawnie ✅" });
};
EOF
