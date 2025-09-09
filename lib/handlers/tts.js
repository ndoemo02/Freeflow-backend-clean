// /lib/handlers/tts.js
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, message: "TTS placeholder (tu podłączymy Google/ElevenLabs)" }));
};
