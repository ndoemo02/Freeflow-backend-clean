// public/ff-assist.js
(function () {
  // --- Helpers (UI mini-toast + render podsumowania) ---
  const $ = (sel, root = document) => root.querySelector(sel);
  function toast(msg) {
    let box = $("#ff-toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "ff-toast";
      Object.assign(box.style, {
        position: "fixed", left: "50%", bottom: "18px", transform: "translateX(-50%)",
        padding: "10px 14px", background: "rgba(0,0,0,.7)", color: "#fff",
        borderRadius: "10px", fontSize: "14px", zIndex: 99999
      });
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.style.opacity = "1";
    setTimeout(() => (box.style.opacity = "0"), 2500);
  }
  function renderSummary(order) {
    let box = $("#ff-summary");
    if (!box) {
      box = document.createElement("div");
      box.id = "ff-summary";
      Object.assign(box.style, {
        position: "fixed", right: "16px", bottom: "16px", width: "min(420px, 90vw)",
        background: "rgba(20,20,25,.8)", color: "#fff", backdropFilter: "blur(8px)",
        borderRadius: "16px", padding: "16px", zIndex: 99998, boxShadow: "0 10px 30px rgba(0,0,0,.3)"
      });
      document.body.appendChild(box);
    }
    const { pick, city, type, time, notes } = order;
    box.innerHTML = `
      <div style="font-weight:700;font-size:18px;margin-bottom:8px;">Podsumowanie zamówienia</div>
      <div style="line-height:1.6;">
        <div><b>Miasto:</b> ${city}</div>
        <div><b>Kategoria:</b> ${type}</div>
        <div><b>Wybrane:</b> ${pick?.name ?? "-"}</div>
        <div><b>Adres:</b> ${pick?.address ?? "-"}</div>
        <div><b>Telefon:</b> ${pick?.phone ?? "—"}</div>
        <div><b>Strona:</b> ${pick?.website ? `<a href="${pick.website}" target="_blank" style="color:#8bdcff">link</a>` : "—"}</div>
        <div><b>Godzina:</b> ${time ?? "na teraz"}</div>
        <div><b>Uwagi:</b> ${notes ?? "—"}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="ff-confirm" style="flex:1;padding:10px;border-radius:12px;border:none;background:#00c35a;color:#fff;font-weight:700;">Potwierdź</button>
        <button id="ff-cancel" style="padding:10px 14px;border-radius:12px;border:1px solid #666;background:transparent;color:#ddd;">Anuluj</button>
      </div>
    `;
    $("#ff-confirm").onclick = () => {
      speak("Zamówienie potwierdzone. Wysyłam podsumowanie.");
      toast("✔️ Potwierdzono (demo). Tu podpinamy płatność / wysyłkę.");
    };
    $("#ff-cancel").onclick = () => {
      speak("Anulowano.");
      box.remove();
    };
  }

  // --- Speech (Web Speech API) ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  const synth = window.speechSynthesis;

  function speak(text, lang = "pl-PL") {
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    synth.cancel();
    synth.speak(u);
  }

  // --- Parsing: "najlepsze pizzerie w Warszawie" / "best sushi in Krakow" ---
  function parseQuery(text) {
    const t = text.toLowerCase().trim();
    // PL
    let m = t.match(/(pizzerie|pizza|sushi|burgery|kebab|pierogi|restauracje)\s+(w|na|z)\s+([a-ząćęłńóśźż\s\-]+)/);
    if (m) return { type: m[1], city: m[3].trim() };
    m = t.match(/(znajdź|pokaz|pokaż).*?(pizzerie|pizza|sushi|burgery|kebab|restauracje).*?(w|na)\s+([a-ząćęłńóśźż\s\-]+)/);
    if (m) return { type: m[2], city: m[4].trim() };
    // EN (fallback)
    m = t.match(/(pizza|sushi|burgers|kebab|restaurant)s?.*?in\s+([a-z\s\-]+)/);
    if (m) return { type: m[1], city: m[2].trim() };
    return null;
  }

  // --- API call ---
  async function getPlaces(city, type) {
    try {
      const q = `/api/places?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`;
      const res = await fetch(q);
      const data = await res.json();
      return data?.results ?? [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // --- State machine ---
  const state = {
    city: null,
    type: null,
    options: [],
    pick: null,
    time: null,
    notes: null
  };

  async function handleUtterance(text) {
    // 1) Czy to komenda wyszukiwania?
    const parsed = parseQuery(text);
    if (parsed) {
      state.city = parsed.city;
      state.type = parsed.type;
      toast(`Szukam: ${state.type} w ${state.city}…`);
      speak(`Szukam ${state.type} w ${state.city}.`);
      state.options = await getPlaces(state.city, state.type);

      if (!state.options.length) {
        toast("Brak wyników.");
        speak("Niestety nie znalazłem wyników. Spróbuj inną frazę.");
        return;
      }

      // Odegraj 3 opcje
      const lines = state.options
        .map((p, i) => `${i + 1}. ${p.name}, ocena ${p.rating ?? "brak"}, ${p.address}`);
      speak(`Mam trzy opcje. ${lines.join(". ")}. Którą wybierasz? Powiedz: numer 1, 2 lub 3.`);
      toast("Powiedz: numer 1, 2 lub 3.");
      return;
    }

    // 2) Wybór 1/2/3
    if (/numer\s*1|pierwsza|jeden|1/.test(text.toLowerCase())) {
      state.pick = state.options[0];
    } else if (/numer\s*2|druga|dwa|2/.test(text.toLowerCase())) {
      state.pick = state.options[1];
    } else if (/numer\s*3|trzecia|trzy|3/.test(text.toLowerCase())) {
      state.pick = state.options[2];
    }

    if (state.pick && !state.time) {
      speak(`Wybrano ${state.pick.name}. Na kiedy chcesz zamówić? Na teraz, czy podaj godzinę.`);
      toast("Powiedz: na teraz / np. na 19:30.");
      return;
    }

    // 3) Czas
    const timeMatch = text.match(/(\d{1,2}[:.]\d{2})/);
    if (!state.time && (timeMatch || /na teraz|teraz/.test(text.toLowerCase()))) {
      state.time = timeMatch ? timeMatch[1].replace(".", ":") : "teraz";
      speak("Zapisane. Chcesz dodać uwagi do zamówienia?");
      toast("Dodaj uwagi lub powiedz: bez uwag.");
      return;
    }

    // 4) Uwagi
    if (!state.notes) {
      if (/bez uwag|brak/.test(text.toLowerCase())) {
        state.notes = "—";
      } else {
        // bierz wszystko jako uwagi
        state.notes = text;
      }
      // Podsumuj
      renderSummary(state);
      const phone = state.pick?.phone ? ` Telefon: ${state.pick.phone}.` : "";
      speak(`Podsumowanie. ${state.pick.name}, ${state.pick.address}. Czas: ${state.time}. ${phone} Potwierdzasz?`);
    }
  }

  // --- UI: przycisk nasłuchu ---
  function ensureMicButton() {
    if ($("#ff-mic")) return;
    const btn = document.createElement("button");
    btn.id = "ff-mic";
    btn.innerHTML = "🎙️";
    Object.assign(btn.style, {
      position: "fixed", left: "16px", bottom: "16px",
      width: "56px", height: "56px", borderRadius: "28px",
      border: "none", background: "#ff7a00", color: "#fff",
      boxShadow: "0 6px 15px rgba(0,0,0,.25)", fontSize: "24px", zIndex: 99997, cursor: "pointer"
    });
    btn.title = "Naciśnij i mów";
    document.body.appendChild(btn);

    let listening = false;
    if (!recognition) {
      btn.disabled = true;
      btn.style.opacity = ".6";
      btn.title = "SpeechRecognition niedostępny w tej przeglądarce";
      return;
    }

    recognition.lang = "pl-PL";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ");
      handleUtterance(transcript);
    };
    recognition.onerror = () => toast("Błąd rozpoznawania mowy");
    recognition.onend = () => { listening = false; btn.style.filter = "none"; };

    btn.onpointerdown = () => {
      if (listening) return;
      try {
        synth?.cancel();
        listening = true;
        btn.style.filter = "brightness(0.85)";
        recognition.start();
        toast("Słucham…");
      } catch(_) {}
    };
    btn.onpointerup = () => {
      if (!listening) return;
      try { recognition.stop(); } catch(_) {}
    };
  }

  // Init
  window.addEventListener("DOMContentLoaded", () => {
    ensureMicButton();
    // TIP dla usera:
    setTimeout(() => speak("Cześć. Powiedz na przykład: najlepsze pizzerie w Warszawie."), 600);
  });
})();
