// /lib/handlers/nlu.js
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function parseDish(text) {
  if (text.includes("pepperoni")) return "Pizza Pepperoni";
  if (text.includes("margherita") || text.includes("margerita")) return "Pizza Margherita";
  if (text.includes("carbonara")) return "Spaghetti Carbonara";
  if (text.includes("schabowy")) return "Schabowy z ziemniakami";
  if (text.includes("sushi")) return "Sushi";
  return "Danie";
}

function parseQty(text) {
  const mNum = text.match(/\b(\d{1,2})\b/);
  if (mNum) return parseInt(mNum[1], 10);
  return 1;
}

function parseWhen(text) {
  const m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  if (text.includes("teraz")) return "jak najszybciej";
  return "-";
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.end();

  try {
    const body = req.method === "POST" ? req.body : {};
    const text = String(body.text || "").toLowerCase();

    if (!text) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: false, error: "NO_TEXT" }));
    }

    const parsed = {
      restaurant: text.includes("włoska") ? "Trattoria Napoli" :
                  text.includes("polska") ? "Złota Łyżka" : "Demo Resto",
      items: [{ name: parseDish(text), qty: parseQty(text) }],
      when: parseWhen(text)
    };

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, parsed, raw: text }));
  } catch (err) {
    console.error("NLU error:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: "NLU_ERROR", detail: String(err) }));
  }
};
