// /api/agent.js  — lekki „planner” z Places + syntetyczne menu (fallback).
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = req.method === "POST" ? (req.body || {}) : {};
    const text = String(body.text || "").trim();
    const lat  = (typeof body.lat === "number") ? body.lat : null;
    const lng  = (typeof body.lng === "number") ? body.lng : null;

    if (!text) {
      return res.status(200).json({ ok:false, error:"NO_TEXT", message:"Brak 'text'." });
    }

    const q = text.toLowerCase();

    // 1) zamiar
    const intent = /taxi|uber|bolt/.test(q) ? "taxi"
                 : /hotel|nocleg|pokój/.test(q) ? "hotel"
                 : "food";

    // 2) podstawowe atrybuty
    const whenMatch = q.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const when = whenMatch ? `${whenMatch[1].padStart(2,"0")}:${whenMatch[2]}` : null;

    const qty = (() => {
      const m = q.match(/\b(\d{1,2})\b/);
      if (m) return parseInt(m[1],10);
      if (/\bdwie\b| 2\b/.test(q)) return 2;
      return 1;
    })();

    // 3) zapytanie do miejsc (lub fallback)
    const placesQuery =
      intent === "food"
        ? (q.includes("indyj") ? "indian restaurant"
           : q.includes("pizza") ? "pizzeria"
           : "restaurant")
        : intent;

    const places = await searchPlaces(placesQuery, lat, lng); // ↓ helper
    const pick   = places[0] || null;

    // 4) menu (syntetyczne na demo)
    const menu = pick ? await syntheticMenu(pick) : [];

    // 5) parsowanie dania + modyfikatory
    const without = parseWithout(q);
    const dish = pickDishFromText(q, menu) || (q.includes("pepperoni") ? {name:"Pepperoni", price:38} : null);

    const summary = {
      intent,
      when,
      qty,
      restaurant: pick ? { name: pick.name, address: pick.formatted_address || "" } : null,
      item: dish ? { ...dish, without } : null
    };

    // 6) follow-ups
    const followups = [];
    if (!summary.restaurant && intent === "food") followups.push("Podaj dzielnicę lub nazwę lokalu.");
    if (!summary.item && intent === "food")       followups.push("Jaką potrawę wybierasz?");
    if (!when)                                    followups.push("Na którą godzinę przygotować?");

    const tts = followups.length
      ? followups.join(" ")
      : buildTTS(summary);

    return res.status(200).json({
      ok: true,
      summary,
      followups,
      tts,
      debug: { placesCount: places.length, usedMaps: Boolean(process.env.GOOGLE_MAPS_API_KEY) }
    });

  } catch (err) {
    console.error("AGENT error:", err);
    return res.status(500).json({ ok:false, error:"AGENT_INTERNAL", detail: String(err?.message || err) });
  }
}

// ---------- Helpers ----------

function buildTTS(s){
  if (s.intent === "food" && s.restaurant && s.item) {
    const w = s.when ? ` na ${s.when}` : "";
    const wout = (s.item.without && s.item.without.length) ? ` bez ${s.item.without.join(", ")}` : "";
    return `Potwierdź: ${s.qty} × ${s.item.name}${wout} w ${s.restaurant.name}${w}. Potwierdzasz?`;
  }
  if (s.intent === "taxi")  return "Zamawiasz taxi. Skąd i dokąd jedziemy?";
  if (s.intent === "hotel") return "Rezerwacja hotelu. Na kiedy i w jakim mieście?";
  return "Doprecyzuj proszę zamówienie.";
}

async function searchPlaces(query, lat, lng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return fallbackPlaces(query);

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  if (lat && lng) url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "6000");
  url.searchParams.set("key", key);

  const r = await fetch(url);
  const j = await r.json().catch(()=>({}));
  if (!j || (j.status !== "OK" && j.status !== "ZERO_RESULTS")) return fallbackPlaces(query);
  const list = (j.results || []).slice(0, 5).map(p => ({
    name: p.name,
    formatted_address: p.formatted_address || "",
    rating: p.rating
  }));
  return list.length ? list : fallbackPlaces(query);
}

function fallbackPlaces(query){
  // minimalny katalog „na czarną godzinę”
  if (/indian|indyj/.test(query))     return [{name:"Bombaj Tandoori", formatted_address:"Bytom"}];
  if (/pizza|pizzeria/.test(query))   return [{name:"Calzone",          formatted_address:"Piekary Śląskie"}];
  if (/taxi/.test(query))             return [{name:"Taxi Demo",        formatted_address:"Centrum"}];
  if (/hotel|nocleg|pokój/.test(query)) return [{name:"Hotel Demo",     formatted_address:"Centrum"}];
  return [{name:"Złota Łyżka", formatted_address:"Rynek"}];
}

async function syntheticMenu(place){
  // heurystyka po nazwie/kuchni
  if (/bombaj|tandoori|ind/i.test(place.name)) {
    return [
      {name:"Butter Chicken", price:45},
      {name:"Tikka Masala",   price:44},
      {name:"Palak Paneer",   price:41}
    ];
  }
  return [
    {name:"Margherita", price:32},
    {name:"Pepperoni",  price:38},
    {name:"Capricciosa",price:39},
    {name:"Veggie",     price:35},
  ];
}

function pickDishFromText(q, menu){
  const t = q.toLowerCase();
  return menu.find(m => t.includes(m.name.toLowerCase())) || null;
}

function parseWithout(q){
  const m = q.match(/bez\s+([a-ząćęłńóśźż ,\-]+)/i);
  if (!m) return [];
  return m[1]
    .replace(/ i /g, ",")
    .split(/[,\s]+/)
    .map(s=>s.trim())
    .filter(Boolean);
}
