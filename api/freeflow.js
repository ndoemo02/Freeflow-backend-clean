// /api/freeflow.js
// Router, który kieruje żądania do poszczególnych handlerów

const health = require("../lib/handlers/health");
const nlu = require("../lib/handlers/nlu");
const tts = require("../lib/handlers/tts");

module.exports = async (req, res) => {
  try {
    const path = (req.url || "").toLowerCase();

    if (path.startsWith("/api/health")) {
      return health(req, res);
    }
    if (path.startsWith("/api/nlu")) {
      return nlu(req, res);
    }
    if (path.startsWith("/api/tts")) {
      return tts(req, res);
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: "NOT_FOUND" }));
  } catch (err) {
    console.error("Router error:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: "ROUTER_ERROR", detail: String(err) }));
  }
};
