// /api/search.js  — prosty „TOP N w okolicy” dla FreeFlow
// ESM, bez zewnętrznych zależności

export default async function handler(req, res) {
  try {
    // --- 1) Parametry wejściowe
    const {
      query = 'pizzeria',
      lat,
      lng,
      n = '2',
      radius = '5000',     // m
      lang = 'pl',         // język odpowiedzi Google
      rankby,              // opcjonalnie: 'distance' (wtedy radius ignorowany przez Google)
    } = req.query || {};

    const N = Math.max(1, Math.min(parseInt(n, 10) || 2, 10)); // limit 1..10
    const GMAPS_KEY =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GMAPS_KEY ||
      process.env.GOOGLE_MAPS_APIKEY ||
      process.env.GMAPS_API_KEY;

    if (!GMAPS_KEY) {
      return res.status(500).json({ error: 'Missing Google Maps API key' });
    }

    // --- 2) Budowa URL do Google Places
    const hasGeo = lat && lng;
    let url, method;

    if (hasGeo) {
      // Preferujemy Nearby Search, bo znamy pozycję
      const base = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
      const params = new URLSearchParams({
        key: GMAPS_KEY,
        language: lang,
        location: `${lat},${lng}`,
        keyword: query,
      });
      if (rankby === 'distance') {
        params.set('rankby', 'distance');
      } else {
        params.set('radius', String(parseInt(radius, 10) || 5000));
      }
      // delikatna podpowiedź dla pizzerii/restauracji
      if (/pizz/i.test(query)) params.set('type', 'restaurant');

      url = `${base}?${params.toString()}`;
      method = 'nearbysearch';
    } else {
      // Fallback: Text Search bez pozycji użytkownika
      const base = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
      const params = new URLSearchParams({
        key: GMAPS_KEY,
        language: lang,
        query,
      });
      url = `${base}?${params.toString()}`;
      method = 'textsearch';
    }

    // --- 3) Wywołanie Google
    const r = await fetch(url);
    const data = await r.json();

    if (data.status !== 'OK') {
      return res.status(400).json({
        error: data.status,
        message: data.error_message || null,
      });
    }

    const results = Array.isArray(data.results) ? data.results : [];

    // --- 4) Sortowanie: (rating * reviews) malejąco
    const scored = results
      .map((p) => {
        const rating = Number(p.rating || 0);
        const reviews = Number(p.user_ratings_total || 0);
        const score = rating * reviews;
        return {
          name: p.name,
          address: p.formatted_address || p.vicinity || '',
          rating,
          reviews,
          price_level: p.price_level ?? null,
          place_id: p.place_id,
          open_now: p.opening_hours?.open_now ?? null,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, N);

    return res.status(200).json({
      method,
      query,
      count: scored.length,
      results: scored,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
