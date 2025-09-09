// --- CORS (wspólne)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// szybka obsługa OPTIONS
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Missing GOOGLE_MAPS_API_KEY' });
    }

    const isGet = req.method === 'GET';
    const params = isGet
      ? req.query
      : (req.headers['content-type'] || '').includes('application/json')
        ? (req.body || {})
        : Object.fromEntries(new URLSearchParams(await readBody(req)));

    const query = params.query || params.keyword || '';
    const lat = parseFloat(params.lat);
    const lng = parseFloat(params.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const language = (params.language || 'pl').toString();
    const n = clampInt(params.n, 3, 1, 10);
    const radius = clampInt(params.radius, 3000, 100, 50000);
    const rankby = (params.rankby || '').toString();
    const type = (params.type || '').toString();

    // --- NAPRAWA: Rozpoznawanie miast i domyślna lokalizacja dla Polski
    const cityPatterns = [
      /\bw\s+(Warszawie|Krakowie|Wrocławiu|Poznaniu|Gdańsku|Łodzi|Szczecinie|Bydgoszczy|Lublinie|Katowicach|Białymstoku|Częstochowie|Gdyni|Radomiu|Sosnowcu|Toruniu|Kielcach|Rzeszowie|Gliwicach|Zabrzu|Olsztynie|Bielsku-Białej|Bytomiu|Zielonej Górze|Rybnik|Tarnowie|Opolu|Gorzowie Wielkopolskim|Płocku|Elblągu|Wałbrzychu|Chorzowie|Tarnobrzegu|Koszalinie|Kaliszu|Legnica|Grudziądzu|Słupsk|Jaworzno|Jastrzębie-Zdroju|Nowy Sącz|Jelenia Góra|Siedlce|Mysłowice|Piła|Ostrów Wielkopolski|Stargard|Siemianowice Śląskie|Pabianice|Gniezno|Lubin|Oświęcim|Tychy|Będzin|Głogów|Leszno|Zawiercie|Świdnica|Piekarach)/i,
      /\b(Warszawa|Kraków|Wrocław|Poznań|Gdańsk|Łódź|Szczecin|Bydgoszcz|Lublin|Katowice|Białystok|Częstochowa|Gdynia|Radom|Sosnowiec|Toruń|Kielce|Rzeszów|Gliwice|Zabrze|Olsztyn|Bielsko-Biała|Bytom|Zielona Góra|Rybnik|Tarnów|Opole|Gorzów Wielkopolski|Płock|Elbląg|Wałbrzych|Chorzów|Tarnobrzeg|Koszalin|Kalisz|Legnica|Grudziądz|Słupsk|Jaworzno|Jastrzębie-Zdrój|Nowy Sącz|Jelenia Góra|Siedlce|Mysłowice|Piła|Ostrów Wielkopolski|Stargard|Siemianowice Śląskie|Pabianice|Gniezno|Lubin|Oświęcim|Tychy|Będzin|Głogów|Leszno|Zawiercie|Świdnica|Piekary)\b/i
    ];
    
    const queryContainsCity = cityPatterns.some(pattern => pattern.test(query));

    // NAPRAWA: Domyślne współrzędne dla centrum Polski (Warszawa) - lepsze dla polskich zapytań
    const DEFAULT_POLAND_LAT = 52.2297; // Warszawa - centrum Polski
    const DEFAULT_POLAND_LNG = 21.0122;
    const DEFAULT_POLAND_RADIUS = 50000; // 50km - pokrywa główne polskie miasta

    // Budujemy URL do Google Places
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    if (query) url.searchParams.set('query', query);

    // NAPRAWA: Zawsze dodaj lokalizację dla lepszych wyników
    if (hasCoords) {
      // Użyj GPS użytkownika jeśli dostępne
      url.searchParams.set('location', `${lat},${lng}`);
      if (rankby === 'distance') {
        url.searchParams.set('rankby', 'distance');
      } else {
        url.searchParams.set('radius', String(radius));
      }
    } else if (queryContainsCity || language === 'pl') {
      // Użyj centrum Polski dla polskich zapytań
      url.searchParams.set('location', `${DEFAULT_POLAND_LAT},${DEFAULT_POLAND_LNG}`);
      url.searchParams.set('radius', String(DEFAULT_POLAND_RADIUS));
    }

    url.searchParams.set('language', language);
    if (type) url.searchParams.set('type', type);
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);

    // Request do Google
    const r = await fetch(url.toString());
    const data = await r.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ status: data.status, error: data.error_message || 'Upstream error' });
    }

    const results = Array.isArray(data.results) ? data.results : [];
    const sorted = results
      .filter(x => x && (typeof x === 'object'))
      .sort((a, b) => {
        const ra = a.rating ?? 0, rb = b.rating ?? 0;
        if (rb !== ra) return rb - ra;
        const va = a.user_ratings_total ?? 0, vb = b.user_ratings_total ?? 0;
        return vb - va;
      })
      .slice(0, n)
      .map(x => ({
        name: x.name || null,
        rating: x.rating ?? null,
        votes: x.user_ratings_total ?? null,
        address: x.formatted_address || x.vicinity || null,
        place_id: x.place_id || null,
      }));

    // NAPRAWA: Poprawny format odpowiedzi zgodny z frontend interfaces
    return res.status(200).json({
      status: data.status || 'OK',
      total: sorted.length,
      results: sorted.map(x => ({
        name: x.name || '',
        rating: x.rating || 0,
        votes: x.votes || 0,
        address: x.address || '',
        place_id: x.place_id || ''
      })),
    });
  } catch (err) {
    console.error('places handler error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// helpers
function clampInt(v, def, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
