/* ==============================================================================
 *  PROFESSORE DIGITALE - Cattedra Digitale Portatile
 *  Nucleo dell'interfaccia (JavaScript puro, nessuna libreria esterna richiesta)
 *  Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";

  var PD = window.PD = { version: window.PD_VERSION || "" };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  var esc = PD.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  PD.$ = $; PD.$$ = $$;

  /* ------------------------------------------------------------------------
   *  Stato e impostazioni
   * ---------------------------------------------------------------------- */
  var DEFAULTS = {
    fontSize: 20, theme: "light", projector: false,
    voice: true, autoReadAnswers: true, autoReadLessons: false, rate: 0.95,
    ttsMode: "auto", browserVoice: "",
    aiEnabled: true, model: "", useKbContext: true, autoSendVoice: true,
    updateUrl: "", teacherName: "", eyesFollow: true,
    voiceId: "", netCheck: true, idleTips: true, greet: true, goodbye: true, studentName: "",
    aulaRuolo: "", aulaNome: "Aula", aulaCodice: "", aulaServer: "",
    voiceCommands: false, tremore: false, vista: false, leggiFocus: false, domandaGiorno: true, aulaManoSuono: true,
    tabletCondividi: false
  };
  PD.server = false;
  /* Modalità ospite (3.4): questo browser è un tablet o un telefono collegato al PC dell'aula (tablet.js, pd_tablet.py).
   * PD.server resta vero per voce, IA e contenuti del PC, ma i dati si salvano SOLO in questo browser. */
  PD.ospite = false;
  PD.status = null;
  PD.settings = Object.assign({}, DEFAULTS);
  PD.progress = { lessons: {} };
  PD.history = [];
  /* Punti di aggancio per i moduli (profili.js, ripasso.js, accessibilita.js, enti.js…):
   *  dopoCaricamento: funzioni chiamate dopo aver letto i dati e prima di mostrare la pagina (possono restituire una Promise)
   *  homeCards / settingsCards: { html: function () -> stringa, bind: function (el) } aggiunti in fondo all'Inizio / alle Impostazioni
   *  homeTiles: funzioni che restituiscono l'HTML di un riquadro (usare PD.tileHTML) */
  PD.hooks = { dopoCaricamento: [], homeCards: [], settingsCards: [], homeTiles: [] };
  PD.lastDiagram = null;

  /* ------------------------------------------------------------------------
   *  Archiviazione: server locale (file JSON utente) + copia nel browser
   * ---------------------------------------------------------------------- */
  function lsGet(k) { try { var v = localStorage.getItem("pd." + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem("pd." + k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } }
  var saveTimers = {};
  PD.store = {
    load: function (key) {
      if (!PD.server || PD.ospite) return Promise.resolve(lsGet(key));
      return api("/api/data/" + key).then(function (r) { return r.value != null ? r.value : lsGet(key); })
        .catch(function () { return lsGet(key); });
    },
    save: function (key, value) {
      lsSet(key, value);
      if (!PD.server || PD.ospite) return;
      clearTimeout(saveTimers[key]);
      saveTimers[key] = setTimeout(function () {
        api("/api/data/" + key, { value: value }).catch(function () { /* riprova al prossimo salvataggio */ });
      }, 400);
    }
  };
  PD.saveSettings = function () { PD.store.save("settings", PD.settings); applySettings(); };
  PD.saveProgress = function () { PD.store.save("progress", PD.progress); };

  function api(path, body, opts) {
    opts = opts || {};
    var init = { method: body === undefined ? "GET" : "POST", headers: {} };
    if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    if (opts.signal) init.signal = opts.signal;
    return fetch(path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  PD.api = api;

  function timeout(ms, p) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("timeout")); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }

  /* ------------------------------------------------------------------------
   *  Rilevamento componenti
   * ---------------------------------------------------------------------- */
  PD.detect = function () {
    if (!/^https?:$/.test(location.protocol)) { PD.server = false; PD.status = null; renderChips(); return Promise.resolve(); }
    return timeout(8000, api("/api/status")).then(function (s) {
      PD.server = true; PD.status = s; PD.version = s.version; PD.ospite = !!s.ospite;
    }).catch(function (e) {
      if (PD.ospite && e && e.status === 403) PD.toast("📱 Il collegamento con il PC dell'aula è scaduto: ricaricate la pagina e inserite il nuovo codice.", 8000);
      PD.server = false; PD.status = null;
    }).then(renderChips);
  };
  PD.aiReady = function () {
    return PD.server && PD.settings.aiEnabled && PD.status && PD.status.ai.available && PD.status.ai.models.length > 0;
  };
  PD.currentModel = function () {
    if (!PD.status) return "";
    var m = PD.status.ai.models;
    if (PD.settings.model && m.indexOf(PD.settings.model) >= 0) return PD.settings.model;
    return m[0] || "";
  };
  PD.sttReady = function () { return PD.server && !PD.ospite && PD.status && !!PD.status.stt.engine; };

  var TTS_NAME = { sapi: "voce di Windows", piper: "voce naturale", pico: "pico", "espeak-ng": "espeak-ng", espeak: "espeak" };
  PD.isWindows = function () { return !!(PD.status && PD.status.platform === "windows"); };
  function renderChips() {
    var nb = $('.nav-btn[data-view="setup"]'); if (nb) nb.hidden = !(PD.server && PD.status && PD.status.setup);
    var c = $("#chips"); if (!c) return;
    var html = [];
    if (PD.server) {
      html.push(PD.aiReady() ? chip(true, "🤖 " + PD.currentModel()) : chip(false, "🤖 Guida interna"));
      var tts = PD.status.tts.engines;
      html.push(chip(tts.length > 0, "🔊 " + (TTS_NAME[tts[0]] || tts[0] || "voce browser")));
      if (!PD.ospite) html.push(chip(PD.sttReady(), "🎤 " + (PD.status.stt.engine || "microfono spento")));
    } else {
      html.push(chip(false, window.PD_PWA ? "📱 App per telefono e tablet" : "📄 Versione portatile (solo browser)"));
      html.push(chip("speechSynthesis" in window, "🔊 Voce del browser"));
    }
    html.push(chip(true, "🔒 Offline"));
    document.documentElement.classList.toggle("pd-ospite", !!PD.ospite);
    if (PD.ospite) html.unshift('<span class="chip on pd-ospite-chip" title="Questo tablet usa la voce, l\'IA e i contenuti del PC del facilitatore. I progressi restano su questo tablet.">📱 Collegato al PC dell\'aula</span>');
    c.innerHTML = html.join("");
    renderNet();
    function chip(on, t) { return '<span class="chip ' + (on ? "on" : "off") + '" title="' + esc(t) + '">' + esc(t) + "</span>"; }
  }
  PD.renderChips = renderChips;

  /* Indicatore "Online": si illumina quando la connessione a Internet funziona davvero.
   * Il server prova solo ad aprire una connessione verso un indirizzo pubblico neutrale (nessun dato inviato);
   * nella versione portatile si usa lo stato di rete del browser. Si spegne dalle Impostazioni. */
  PD.net = { online: null, t: 0 };
  function renderNet() {
    var n = $("#net"); if (!n) return;
    var on = PD.net.online, off = !PD.settings.netCheck;
    n.className = "net " + (off ? "spento" : on ? "on" : on === false ? "off" : "attesa");
    n.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="lbl">' + (off ? "Online: non controllato" : on ? "Online" : on === false ? "Non in linea" : "Online…") + "</span>";
    n.title = off ? "Il controllo della connessione è spento (Impostazioni → Vista)" :
      on ? "Connessione a Internet attiva" : on === false ? "Nessuna connessione a Internet: il Professore funziona lo stesso" : "Controllo della connessione…";
  }
  PD.checkNet = function (force) {
    if (!PD.settings.netCheck) { PD.net.online = null; renderNet(); return Promise.resolve(null); }
    var p = PD.server ? api("/api/rete" + (force ? "?forza=1" : "")).then(function (r) { return !!r.online; })
      : Promise.resolve(navigator.onLine !== false);
    return p.catch(function () { return navigator.onLine !== false && PD.server ? false : null; }).then(function (on) {
      var prima = PD.net.online; PD.net.online = on; PD.net.t = Date.now(); renderNet();
      if (prima != null && on != null && prima !== on) PD.toast(on ? "🌐 La connessione a Internet è tornata." : "📴 Connessione a Internet assente: il Professore continua a funzionare.", 3500);
      return on;
    });
  };
  PD.renderNet = renderNet;

  /* ------------------------------------------------------------------------
   *  Aspetto: dimensione testo, tema, proiettore
   * ---------------------------------------------------------------------- */
  function applySettings() {
    var s = PD.settings;
    document.documentElement.style.setProperty("--fs", Math.max(14, Math.min(34, s.fontSize)) + "px");
    document.documentElement.setAttribute("data-theme", s.theme);
    document.body.classList.toggle("projector", !!s.projector);
    if (typeof measureTop === "function") setTimeout(measureTop, 50);
    if (PD.mermaidReady) PD.mermaidTheme();
  }
  PD.applySettings = applySettings;

  /* ------------------------------------------------------------------------
   *  Messaggi a comparsa
   * ---------------------------------------------------------------------- */
  var toastTimer;
  PD.toast = function (msg, ms) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500);
  };

  /* ------------------------------------------------------------------------
   *  Mini-Markdown sicuro (tutto l'HTML viene prima neutralizzato)
   * ---------------------------------------------------------------------- */
  function inline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }
  PD.md = function (text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var out = [], list = null, para = [];
    function flushPara() { if (para.length) { out.push("<p>" + para.join("<br>") + "</p>"); para = []; } }
    function flushList() { if (list) { out.push("<" + list.type + ">" + list.items.join("") + "</" + list.type + ">"); list = null; } }
    lines.forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) { flushPara(); flushList(); return; }
      if ((m = line.match(/^#{1,4}\s+(.*)$/))) { flushPara(); flushList(); out.push("<h3>" + inline(m[1]) + "</h3>"); return; }
      if ((m = line.match(/^[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; } list.items.push("<li>" + inline(m[1]) + "</li>"); return; }
      if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; } list.items.push("<li>" + inline(m[1]) + "</li>"); return; }
      flushList(); para.push(inline(line));
    });
    flushPara(); flushList();
    return out.join("");
  };
  PD.plain = function (text) {
    return String(text || "").replace(/\[DIAGRAMMA\][\s\S]*?(\[\/DIAGRAMMA\]|$)/g, " ")
      .replace(/```[\s\S]*?```/g, " ").replace(/[*_#`>|]+/g, "").replace(/^\s*[-•]\s+/gm, "")
      .replace(/→/g, ", poi ").replace(/\s+\n/g, "\n").trim();
  };

  /* ------------------------------------------------------------------------
   *  Avatar del professore
   * ---------------------------------------------------------------------- */
  var STATE_LABEL = { riposo: "Pronto ad aiutarvi", ascolto: "Vi ascolto…", pensiero: "Sto pensando…", spiegazione: "Sto spiegando…",
    attesa: "In attesa… muovete il mouse per svegliarmi" };
  PD.profState = "riposo";
  PD.setProf = function (state) {
    PD.profState = state;
    $$(".prof").forEach(function (el) { el.setAttribute("class", "prof " + state); });
    $$(".prof-state").forEach(function (el) { el.textContent = STATE_LABEL[state] || ""; });
    if (PD.eyesKick) PD.eyesKick();
  };
  PD.profHTML = function () {
    return '<div><svg class="prof ' + PD.profState + '" role="img" aria-label="Il Professore"><use href="#prof-svg"/></svg>' +
      '<div class="prof-state" aria-live="polite">' + STATE_LABEL[PD.profState] + "</div></div>";
  };

  /* ------------------------------------------------------------------------
   *  Sintesi vocale: motore locale del server (espeak-ng/pico/piper) o browser
   * ---------------------------------------------------------------------- */
  var speech = { gen: 0, audio: null, ctrl: null };
  function splitSentences(text) {
    var parts = text.replace(/\n+/g, ". ").match(/[^.!?;:]+[.!?;:]*/g) || [text];
    var chunks = [], cur = "";
    parts.forEach(function (p) {
      p = p.trim(); if (!p) return;
      if ((cur + " " + p).length > 220 && cur) { chunks.push(cur); cur = p; } else { cur = cur ? cur + " " + p : p; }
    });
    if (cur) chunks.push(cur);
    return chunks.filter(function (c) { return /[a-zA-Z0-9àèéìòù]/.test(c); });
  }
  function speechEngine() {
    var mode = PD.settings.ttsMode;
    var serverOk = PD.server && PD.status && PD.status.tts.engines.length > 0;
    var browserOk = "speechSynthesis" in window;
    if (mode === "server" && serverOk) return "server";
    if (mode === "browser" && browserOk) return "browser";
    if (serverOk) return "server";
    if (browserOk) return "browser";
    return null;
  }
  function speakingUI(on) {
    $("#btn-stop").hidden = !on;
    if (on) PD.setProf("spiegazione");
    else if (PD.profState === "spiegazione") PD.setProf("riposo");
  }
  PD.stopSpeech = function () {
    speech.gen++;
    if (speech.ctrl) { try { speech.ctrl.abort(); } catch (e) { /* ignora */ } speech.ctrl = null; }
    if (speech.audio) { speech.audio.pause(); speech.audio.src = ""; speech.audio = null; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speakingUI(false);
  };
  PD.speak = function (text, force) {
    if (!PD.settings.voice && !force) return Promise.resolve();
    PD.stopSpeech();
    var chunks = splitSentences(PD.plain(text));
    if (!chunks.length) return Promise.resolve();
    var engine = speechEngine();
    if (!engine) { PD.toast("Nessuna voce disponibile su questo computer."); return Promise.resolve(); }
    var gen = speech.gen;
    speakingUI(true);
    var done = function () { if (gen === speech.gen) speakingUI(false); };
    if (engine === "browser") return speakBrowser(chunks, gen).then(done, done);
    return speakServer(chunks, gen).then(done, function (err) {
      if (gen !== speech.gen) return;
      if ("speechSynthesis" in window) return speakBrowser(chunks, gen).then(done, done);
      PD.toast("Voce non disponibile: " + err.message); done();
    });
  };
  function fetchWav(text, gen) {
    var ctrl = new AbortController(); speech.ctrl = ctrl;
    return fetch("/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ text: text, rate: PD.settings.rate, voice: PD.settings.voiceId || "" })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "errore voce"); });
      return r.blob();
    }).then(function (b) { if (gen !== speech.gen) throw new Error("annullato"); return URL.createObjectURL(b); });
  }
  function speakServer(chunks, gen) {
    var i = 0, next = fetchWav(chunks[0], gen);
    function playNext() {
      if (gen !== speech.gen || i >= chunks.length) return Promise.resolve();
      var current = next; i++;
      if (i < chunks.length) { next = current.then(function () { return fetchWav(chunks[i], gen); }); next.catch(function () {}); }
      return current.then(function (url) {
        return new Promise(function (res, rej) {
          if (gen !== speech.gen) { URL.revokeObjectURL(url); return res(); }
          var a = new Audio(url); speech.audio = a;
          a.onended = function () { URL.revokeObjectURL(url); res(); };
          a.onerror = function () { URL.revokeObjectURL(url); rej(new Error("riproduzione non riuscita")); };
          a.play().catch(rej);
        });
      }).then(playNext);
    }
    return playNext();
  }
  function pickVoice() {
    var voices = window.speechSynthesis.getVoices() || [];
    if (PD.settings.browserVoice) {
      var v = voices.filter(function (x) { return x.name === PD.settings.browserVoice; })[0];
      if (v) return v;
    }
    return voices.filter(function (x) { return /^it/i.test(x.lang); })[0] || null;
  }
  function speakBrowser(chunks, gen) {
    return chunks.reduce(function (p, chunk) {
      return p.then(function () {
        if (gen !== speech.gen) return;
        return new Promise(function (res) {
          var u = new SpeechSynthesisUtterance(chunk);
          u.lang = "it-IT"; u.rate = PD.settings.rate; var v = pickVoice(); if (v) u.voice = v;
          u.onend = res; u.onerror = res;
          window.speechSynthesis.speak(u);
        });
      });
    }, Promise.resolve());
  }

  /* ------------------------------------------------------------------------
   *  Schemi Mermaid (caricati solo quando servono: leggeri anche su PC datati)
   * ---------------------------------------------------------------------- */
  var mermaidPromise = null, diagramSeq = 0;
  PD.mermaidTheme = function () {
    var dark = PD.settings.theme !== "light";
    window.mermaid.initialize({
      startOnLoad: false, securityLevel: "strict", theme: dark ? "neutral" : "default", themeVariables: { fontSize: "18px" },
      fontFamily: "DejaVu Sans, Liberation Sans, Arial, sans-serif", flowchart: { useMaxWidth: true, htmlLabels: true }
    });
  };
  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (mermaidPromise) return mermaidPromise;
    mermaidPromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      var inlineSrc = document.getElementById("pd-mermaid-src");
      if (inlineSrc) s.src = URL.createObjectURL(new Blob([inlineSrc.textContent], { type: "text/javascript" }));
      else s.src = "vendor/mermaid.min.js";
      s.onload = function () {
        if (!window.mermaid) return rej(new Error("motore schemi assente"));
        PD.mermaidReady = true; PD.mermaidTheme(); res(window.mermaid);
      };
      s.onerror = function () { mermaidPromise = null; rej(new Error("motore schemi non caricato")); };
      document.head.appendChild(s);
    });
    return mermaidPromise;
  }
  PD.cleanDiagram = function (code) {
    code = String(code || "").replace(/```(mermaid)?/gi, "").trim();
    code = code.replace(/^mermaid\s*\n/i, "");
    // corregge virgolette "tipografiche" frequenti nei modelli piccoli
    code = code.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    return code.trim();
  };
  PD.renderDiagram = function (el, code, title) {
    code = PD.cleanDiagram(code);
    // su lavagne strette le catene orizzontali lunghe diventano verticali (piu' leggibili)
    var w = el.clientWidth || 800, arrows = (code.match(/-->|---|-- /g) || []).length;
    if (w < 620 && arrows >= 3 && /^(flowchart|graph)\s+LR\b/.test(code)) code = code.replace(/^(flowchart|graph)\s+LR/, "$1 TD");
    var head = title ? '<p class="chalk-title">' + esc(title) + "</p>" : "";
    if (!code) { el.innerHTML = head + '<div class="empty">Qui compariranno gli schemi della lezione.</div>'; return Promise.resolve(false); }
    el.innerHTML = head + '<div class="empty">✏️ Il Professore sta disegnando lo schema…</div>';
    return loadMermaid().then(function (m) {
      var id = "pd-diagram-" + (++diagramSeq);
      return Promise.resolve(m.parse(code)).then(function () { return m.render(id, code); });
    }).then(function (r) {
      el.innerHTML = head + '<div class="diagram">' + r.svg + "</div>";
      return true;
    }).catch(function (err) {
      var junk = document.getElementById("d" + "pd-diagram-" + diagramSeq); if (junk) junk.remove();
      el.innerHTML = head + '<div class="empty">Lo schema non si può disegnare, ma ecco il testo:</div>' +
        '<details class="code" open><summary>Descrizione dello schema</summary><pre>' + esc(code) + "</pre></details>";
      if (window.console) console.warn("Mermaid:", err && err.message);
      return false;
    });
  };

  /* ------------------------------------------------------------------------
   *  Ricerca nella guida interna (funziona sempre, anche senza IA)
   * ---------------------------------------------------------------------- */
  var STOP = ("il lo la i gli le un uno una di a da in con su per tra fra e ed o ma se che chi cosa come dove quando perche " +
    "non mi ti si ci vi del dello della dei degli delle al allo alla ai agli alle dal dalla dai nel nello nella nei " +
    "sul sulla sui col questo questa quello quella sono sei e ho hai ha abbiamo avete hanno fare faccio fa posso puo " +
    "voglio vorrei devo mio mia miei mie tuo tua suo sua nostro vostro loro qual quale quali cos cose serve servono " +
    "io tu lui lei noi voi essere avere c al po piu molto anche gia ancora solo sempre mai proprio allora ecco ciao " +
    "salve buongiorno grazie professore prof spiegami spiega dimmi sapere capire aiuto aiutami per favore").split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/@/g, " chiocciola ").replace(/\bwi[\s-]?fi\b/g, "wifi").replace(/\be-mail\b/g, "email")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  function stem(w) {
    if (w.length <= 3) return w;
    w = w.replace(/(azioni|azione|mente|ando|endo|are|ere|ire|ato|ata|ati|ate|uto|uta|ito|ita|zione|zioni)$/, "");
    if (w.length > 4) w = w.replace(/[aeiou]$/, "");
    return w;
  }
  function terms(s) {
    return norm(s).split(" ").filter(function (w) { return w && !STOPSET[w] && (w.length > 1 || /\d/.test(w)); }).map(stem);
  }
  var INDEX = null;
  function buildIndex() {
    var docs = [];
    (window.PD_KB || []).forEach(function (e, i) {
      var qt = terms(e.q);
      docs.push({ kind: "kb", id: "kb" + i, title: e.q, answer: e.a, diagram: e.d, lesson: e.l,
        platform: e.pack === "windows-primi-passi" ? "windows" : /\blinux\b/i.test(e.q) ? "linux" : "",
        f: [[terms(e.k.join(" ")), 3], [qt, 3.2 / Math.sqrt(Math.max(1, qt.length))], [terms(e.a), 0.6]], phrases: e.k.map(norm) });
    });
    (window.PD_LESSONS || []).forEach(function (L) {
      L.steps.forEach(function (st, si) {
        docs.push({ kind: "lesson", id: L.id + ":" + si, title: L.title + " — " + st.t, answer: st.x + (st.tip ? "\n\n💡 " + st.tip : ""),
          diagram: st.d, lesson: L.id, step: si, f: [[terms(st.t), 2], [terms(L.title), 1], [terms(st.x), 0.7]], phrases: [] });
      });
    });
    var df = {};
    docs.forEach(function (d) {
      var seen = {};
      d.f.forEach(function (f) { f[0].forEach(function (t) { seen[t] = 1; }); });
      d.set = seen;
      Object.keys(seen).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    INDEX = { docs: docs, df: df, n: docs.length };
  }
  PD.search = function (query, n) {
    if (!INDEX) buildIndex();
    var q = terms(query), nq = " " + norm(query) + " ", win = PD.isWindows && PD.isWindows();
    if (!q.length) return [];
    var res = INDEX.docs.map(function (d) {
      var score = 0, presi = 0;
      q.forEach(function (t) {
        if (!d.set[t]) return;
        presi++;
        var idf = Math.log(1 + INDEX.n / (INDEX.df[t] || 1));
        d.f.forEach(function (f) { if (f[0].indexOf(t) >= 0) score += f[1] * idf; });
      });
      d.phrases.forEach(function (p) { if (p.indexOf(" ") > 0 && nq.indexOf(" " + p + " ") >= 0) score += 6; });
      // su Windows le risposte pensate per Windows passano davanti a quelle scritte per Linux
      if (win && d.platform) score *= d.platform === "windows" ? 1.1 : 0.6;
      score = score / Math.sqrt(q.length);
      // una sola parola in comune su due o piu' (es. "ricetta" della carbonara): suggerimento, non risposta
      if (presi === 1 && q.length >= 2 && d.kind === "lesson" && score >= PD.KB_THRESHOLD) score = PD.KB_THRESHOLD * 0.9;
      return { doc: d, score: score };
    }).filter(function (r) { return r.score > 0; });
    res.sort(function (a, b) { return b.score - a.score || (a.doc.kind === "kb" ? -1 : 1); });
    return res.slice(0, n || 3);
  };
  PD.KB_THRESHOLD = 3.2;
  PD.resetIndex = function () { INDEX = null; };

  /* ------------------------------------------------------------------------
   *  Router (#/sezione/...), compatibile con il tasto "indietro" del browser
   * ---------------------------------------------------------------------- */
  PD.views = {};
  PD.go = function (hash) { if (location.hash === hash) route(); else location.hash = hash; };
  function route() {
    var parts = (location.hash.replace(/^#\/?/, "") || "home").split("/");
    var name = PD.views[parts[0]] ? parts[0] : "home";
    $$(".view").forEach(function (v) { v.hidden = v.id !== "view-" + name; });
    $$(".nav-btn").forEach(function (b) {
      if (b.getAttribute("data-view") === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    PD.views[name]($("#view-" + name), parts.slice(1));
    window.scrollTo(0, 0);
  }
  PD.route = route;

  /* ------------------------------------------------------------------------
   *  INIZIO
   * ---------------------------------------------------------------------- */
  /* Le lezioni appartengono a un "percorso": il corso di informatica (lezioni di base e pacchetti generici),
   * la cultura generale (pacchetti cultura-*), FeniceOS e riuso, il libro Tecnologia Gentile. */
  var AREE = {
    corso: { back: "#/lessons", label: "← Tutte le lezioni" },
    cultura: { back: "#/cultura", label: "← Cultura generale" },
    fenice: { back: "#/fenice", label: "← FeniceOS" },
    libro: { back: "#/libro", label: "← Tecnologia Gentile" }
  };
  PD.lessonArea = function (L) {
    var p = (L && L.pack) || "";
    if (/^cultura-/.test(p)) return "cultura";
    if (p === "feniceos") return "fenice";
    if (p === "tecnologia-gentile") return "libro";
    return "corso";
  };
  PD.lessonsOf = function (area, pack) {
    return (window.PD_LESSONS || []).filter(function (L) { return PD.lessonArea(L) === area && (!pack || L.pack === pack); });
  };
  function lessonStats(list) {
    var L = list || PD.lessonsOf("corso"), done = 0;
    L.forEach(function (l) { if ((PD.progress.lessons[l.id] || {}).done) done++; });
    return { done: done, total: L.length };
  }
  PD.lessonStats = lessonStats;
  function nextLesson() {
    var L = PD.lessonsOf("corso");
    for (var i = 0; i < L.length; i++) if (!(PD.progress.lessons[L[i].id] || {}).done) return L[i];
    return null;
  }
  PD.nextLesson = nextLesson;
  PD.greeting = function (d) {
    var h = (d || new Date()).getHours();
    return h >= 5 && h < 13 ? "Buongiorno" : h >= 13 && h < 18 ? "Buon pomeriggio" : "Buonasera";
  };
  PD.isLate = function (d) { var h = (d || new Date()).getHours(); return h >= 22 || h < 5; };
  PD.vademecumUrl = function () {
    return PD.server ? "docs/" + (PD.isWindows() ? "Vademecum_Professore_Digitale_Windows.pdf" : "Vademecum_Professore_Digitale.pdf") : "";
  };
  PD.tileHTML = function (ico, t, d, go, cls) {
    return '<button class="card tile' + (cls ? " " + cls : "") + '" data-go="' + go + '"><span class="big-ico">' + ico + "</span><h3>" + t + "</h3><p>" + d + "</p></button>";
  };
  PD.views.home = function (el) {
    var st = lessonStats(), nx = nextLesson();
    var name = PD.settings.studentName || PD.settings.teacherName;
    var hello = PD.greeting() + (name ? ", " + esc(name) : "");
    var cult = lessonStats(PD.lessonsOf("cultura"));
    var nAtt = (PD.progress.attestati || []).length;
    var prove = PD.prove ? PD.prove() : [];
    var big = prove.filter(function (q) { return q.id === "informatica"; })[0];
    var libro = (window.PD_PROVE || []).some(function (q) { return q.pack === "tecnologia-gentile"; }) ||
      (window.PD_KB || []).some(function (k) { return k.pack === "tecnologia-gentile"; });
    el.innerHTML =
      '<div class="hero">' + PD.profHTML() + "<div>" +
      "<h1>" + hello + "!</h1>" +
      '<p class="lead">Sono il vostro <b>Professore Digitale</b>. Vi accompagno passo dopo passo nel mondo del computer, ' +
      "con parole semplici e senza fretta. Funziono <b>senza Internet</b> e ciò che dite resta su questo " + (window.PD_PWA || PD.ospite ? "dispositivo" : "computer") + ".</p>" +
      '<div class="row">' +
      (nx ? '<button class="btn big" data-go="#/lessons/' + nx.id + '">▶ ' + (st.done ? "Continua: " : "Inizia: ") + esc(nx.title) + "</button>"
          : '<span class="notice ok">🎉 Avete completato tutte le lezioni del corso. Complimenti!</span>') +
      '<button class="btn big ghost" data-go="#/ask">💬 Fai una domanda</button></div>' +
      '<div style="max-width:28rem;margin-top:1rem"><div class="small muted">Corso di informatica: ' + st.done + " di " + st.total + " lezioni" +
      (nAtt ? " · 🎓 " + nAtt + (nAtt === 1 ? " attestato" : " attestati") : "") + "</div>" +
      '<div class="progress"><span style="width:' + Math.round(100 * st.done / Math.max(1, st.total)) + '%"></span></div></div>' +
      "</div></div>" +
      '<div class="grid">' +
      tile("📚", "Lezioni", "Un percorso di " + st.total + " lezioni con schemi e quiz.", "#/lessons") +
      tile("💬", "Chiedi al Professore", "Scrivete o parlate: vi risponde a voce e con uno schema.", "#/ask") +
      tile("🖊️", "Lavagna", "Schemi pronti da proiettare e un foglio per disegnare.", "#/board") +
      tile("🎯", "Palestra", "Esercizi per allenare mouse e tastiera, divertendosi.", "#/practice") +
      (big ? tile("🏆", "Il Grande Quiz dell'Informatica", big.domande_per_prova + " domande a sorpresa. Superatelo e stampate il vostro attestato!", "#/quiz/informatica", "spicca") : "") +
      tile("🌍", "Cultura generale", "Storia, geografia, scienze, arte e attualità" + (cult.total ? ": " + cult.total + " lezioni" : "") + ", con domande e quiz.", "#/cultura") +
      tile("📖", "Tecnologia Gentile", libro ? "Domande e risposte sul libro di Danilo D'Auria, con quiz e attestato." : "Il libro di Danilo D'Auria sull'informatica sostenibile.", "#/libro") +
      tile("🔥", "FeniceOS", "Il sistema che fa rinascere i vecchi computer: riuso ed economia circolare.", "#/fenice") +
      tile("🎓", "Quiz e attestati", "Tutti i grandi quiz e gli attestati da stampare con il vostro nome.", "#/quiz") +
      (PD.server ? '<a class="card tile" href="' + PD.vademecumUrl() + '" target="_blank" rel="noopener"><span class="big-ico">📘</span><h3>Vademecum</h3><p>Il libretto di istruzioni completo, da leggere o stampare.</p></a>' : "") +
      (PD.ospite ? tile("🏫", "Aula", "Il vostro nome nel quadro del facilitatore e il pulsante per chiedere aiuto.", "#/aula") :
        PD.server ? tile("🏫", "Aula", "Il quadro dell'aula: PC collegati, progressi degli allievi, messaggi.", "#/aula") : "") +
      PD.hooks.homeTiles.map(function (f) { try { return f() || ""; } catch (e) { return ""; } }).join("") +
      "</div>" +
      PD.hooks.homeCards.map(function (c) { try { return c.html() || ""; } catch (e) { return ""; } }).join("") +
      '<div class="card promemoria" id="home-promemoria"></div>' +
      '<p class="sostieni-riga small muted">Il Professore Digitale è gratuito e libero. <a href="#/sostieni" data-go="#/sostieni">❤️ Sostieni il progetto</a></p>' +
      (!PD.server && window.PD_PWA ? '<p class="notice info small">Questa è l\'<b>app per telefono e tablet</b>: lezioni, guida, palestra, quiz e lettura delle lettere funzionano anche senza Internet. ' +
      "I vostri progressi restano su questo dispositivo.</p>" : "") +
      (!PD.server && !window.PD_PWA ? '<p class="notice info small">Questa è la <b>versione portatile</b>: lezioni, guida, lavagna, palestra e quiz funzionano ovunque. ' +
      "Per l'intelligenza artificiale locale, le voci naturali, il microfono e l'aula installate il programma completo (<b>.exe</b> per Windows, <b>.deb</b> per Linux).</p>" : "") +
      (PD.isWindows() && !PD.aiReady() && PD.status.ai.recommended && !PD.status.ai.engine ? '<p class="notice info small">💡 Su questo computer può funzionare anche l\'<b>intelligenza artificiale locale</b> ' +
      '(consigliata: ' + esc(PD.status.ai.recommended) + '). <a href="#/setup" data-go="#/setup">Configuratela con un clic</a>.</p>' : "");
    if (PD.renderPromemoria) PD.renderPromemoria($("#home-promemoria", el));
    PD.hooks.homeCards.forEach(function (c) { try { if (c.bind) c.bind(el); } catch (e) { if (window.console) console.error(e); } });
    function tile(ico, t, d, go, cls) {
      return '<button class="card tile' + (cls ? " " + cls : "") + '" data-go="' + go + '"><span class="big-ico">' + ico + "</span><h3>" + t + "</h3><p>" + d + "</p></button>";
    }
  };

  /* ------------------------------------------------------------------------
   *  LEZIONI
   * ---------------------------------------------------------------------- */
  function lp(id) { if (!PD.progress.lessons[id]) PD.progress.lessons[id] = { seen: [], done: false }; return PD.progress.lessons[id]; }
  PD.views.lessons = function (el, args) {
    if (args[0]) return openLesson(el, args[0], args[1]);
    var st = lessonStats(), groups = {}, order = [];
    PD.lessonsOf("corso").forEach(function (L) { if (!groups[L.level]) { groups[L.level] = []; order.push(L.level); } groups[L.level].push(L); });
    var html = '<h1>📚 Lezioni</h1><p class="lead">Scegliete una lezione. Ogni lezione ha pochi passi, uno schema alla lavagna e un piccolo quiz finale.</p>' +
      '<div style="max-width:30rem;margin-bottom:1.2rem"><div class="small muted">Completate ' + st.done + " su " + st.total + '</div><div class="progress"><span style="width:' +
      Math.round(100 * st.done / st.total) + '%"></span></div></div>';
    order.forEach(function (lvl) {
      html += '<h2 style="font-size:1.2rem;margin:1.4rem 0 .6rem">' + esc(lvl) + '</h2><div class="grid">';
      groups[lvl].forEach(function (L) {
        var p = PD.progress.lessons[L.id] || {}, seen = (p.seen || []).length;
        var badge = p.done ? '<span class="badge done">✓ Completata' + (p.quiz ? " · quiz " + p.quiz.score + "/" + p.quiz.total : "") + "</span>"
          : seen ? '<span class="badge">In corso · ' + seen + "/" + L.steps.length + "</span>" : '<span class="badge">' + L.minutes + " min</span>";
        html += '<button class="card tile" data-go="#/lessons/' + L.id + '"><span class="big-ico">' + L.icon + "</span><h3>" + esc(L.title) + "</h3><p>" + esc(L.goal) + "</p>" + badge + "</button>";
      });
      html += "</div>";
    });
    el.innerHTML = html;
  };

  function openLesson(el, id, stepArg) {
    var L = window.PD_LESSONS.filter(function (x) { return x.id === id; })[0];
    if (!L) { PD.go("#/lessons"); return; }
    var nSteps = L.steps.length, isQuiz = stepArg === "quiz";
    var idx = isQuiz ? nSteps : Math.max(0, Math.min(nSteps - 1, parseInt(stepArg || "0", 10) || 0));
    var p = lp(L.id), area = AREE[PD.lessonArea(L)];
    if (!isQuiz && p.seen.indexOf(idx) < 0) { p.seen.push(idx); PD.saveProgress(); }
    p.last = idx; PD.progress.lastLesson = L.id;

    var stepper = L.steps.map(function (s, i) {
      return '<button data-go="#/lessons/' + L.id + "/" + i + '" class="' + (p.seen.indexOf(i) >= 0 ? "seen" : "") + '"' +
        (i === idx ? ' aria-current="step"' : "") + ' title="' + esc(s.t) + '">' + (i + 1) + "</button>";
    }).join("") + '<button data-go="#/lessons/' + L.id + '/quiz" class="' + (p.done ? "seen" : "") + '"' + (isQuiz ? ' aria-current="step"' : "") + ' title="Quiz finale">?</button>';

    var head = '<div class="lesson-head"><span class="big-ico">' + L.icon + '</span><div><div class="small muted">' + esc(L.level) + " · circa " + L.minutes +
      " minuti</div><h1>" + esc(L.title) + '</h1></div><button class="btn ghost" data-go="' + area.back + '" style="margin-left:auto">' + area.label + "</button></div>" +
      '<div class="stepper" aria-label="Passi della lezione">' + stepper + "</div>";

    if (isQuiz) { el.innerHTML = head + '<div id="quiz"></div>'; renderQuiz($("#quiz", el), L); return; }

    var st = L.steps[idx];
    var body = '<div class="lesson-body' + (st.d ? "" : " nodiag") + '"><article class="card step-text"><h2>' + (idx + 1) + ". " + esc(st.t) + "</h2>" + PD.md(st.x) +
      (st.tip ? '<div class="tip">💡 ' + inline(st.tip) + "</div>" : "") +
      '<div class="row" style="margin-top:1rem"><button class="btn ghost" id="read-step">🔊 Leggi ad alta voce</button>' +
      '<button class="btn ghost" data-ask="' + esc(st.t) + '">💬 Ho una domanda</button></div></article>' +
      (st.d ? '<div class="chalkboard" id="lesson-board"></div>' : "") + "</div>" +
      '<div class="lesson-nav">' + (idx > 0 ? '<button class="btn ghost big" data-go="#/lessons/' + L.id + "/" + (idx - 1) + '">← Indietro</button>' : "<span></span>") +
      (idx < nSteps - 1 ? '<button class="btn big" data-go="#/lessons/' + L.id + "/" + (idx + 1) + '">Avanti →</button>'
        : '<button class="btn big" data-go="#/lessons/' + L.id + '/quiz">Al quiz finale ✓</button>') + "</div>";
    el.innerHTML = head + body;
    if (st.d) { PD.lastDiagram = { code: st.d, title: st.t }; PD.renderDiagram($("#lesson-board", el), st.d, st.t); }
    var speakText = st.t + ". " + st.x + (st.tip ? ". Consiglio: " + st.tip : "");
    $("#read-step", el).onclick = function () { PD.speak(speakText, true); };
    if (PD.settings.autoReadLessons) PD.speak(speakText);
  }

  function renderQuiz(box, L) {
    var answered = 0, score = 0;
    box.innerHTML = '<div class="card"><h2 style="margin-top:0">✓ Quiz finale</h2><p class="muted">Nessun voto: serve solo a ripassare. Se sbagliate, leggete la spiegazione.</p>' +
      L.quiz.map(function (q, qi) {
        return '<div class="quiz-q" data-q="' + qi + '"><h3>' + (qi + 1) + ". " + esc(q.q) + "</h3>" +
          q.o.map(function (o, oi) { return '<button class="quiz-opt" data-o="' + oi + '">' + esc(o) + "</button>"; }).join("") +
          '<div class="explain" aria-live="polite"></div></div>';
      }).join("") + '<div id="quiz-end"></div></div>';
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest(".quiz-opt"); if (!b || b.disabled) return;
      var qd = b.closest(".quiz-q"), qi = +qd.getAttribute("data-q"), oi = +b.getAttribute("data-o"), q = L.quiz[qi];
      $$(".quiz-opt", qd).forEach(function (x) { x.disabled = true; if (+x.getAttribute("data-o") === q.a) x.classList.add("right"); });
      var ok = oi === q.a; if (!ok) b.classList.add("wrong");
      $(".explain", qd).innerHTML = (ok ? "✅ <b>Esatto!</b> " : "❌ <b>Non proprio.</b> ") + esc(q.e);
      if (ok) score++;
      answered++;
      if (PD.registraRisposta) PD.registraRisposta({ q: q.q, o: q.o, a: q.a, e: q.e, fonte: L.title, lezione: L.id }, ok);
      PD.speak((ok ? "Esatto! " : "Non proprio. ") + q.e);
      if (answered === L.quiz.length) {
        var p = lp(L.id); p.done = true; p.quiz = { score: score, total: L.quiz.length }; p.when = new Date().toISOString(); PD.saveProgress();
        var same = PD.lessonsOf(PD.lessonArea(L), PD.lessonArea(L) === "corso" ? null : L.pack), idx = same.indexOf(L), nx = same[idx + 1];
        $("#quiz-end", box).innerHTML = '<div class="notice ok"><b>🎉 Lezione completata!</b> Risposte giuste: ' + score + " su " + L.quiz.length + ".</div>" +
          '<div class="row">' + (L.practice ? '<button class="btn ghost big" data-go="#/practice/' + L.practice + '">🎯 Allenati in Palestra</button>' : "") +
          (nx ? '<button class="btn big" data-go="#/lessons/' + nx.id + '">Prossima: ' + esc(nx.title) + " →</button>" : '<button class="btn big" data-go="' + (PD.lessonArea(L) === "corso" ? "#/home" : AREE[PD.lessonArea(L)].back) + '">' + (PD.lessonArea(L) === "corso" ? "🏠 Torna all\'inizio" : "✓ Fine del percorso") + "</button>") + "</div>";
      }
    });
  }

  /* ------------------------------------------------------------------------
   *  CHIEDI AL PROFESSORE
   * ---------------------------------------------------------------------- */
  var SYSTEM_PROMPT =
    "Sei il Professore Digitale, un insegnante di informatica paziente, gentile e inclusivo. " +
    "Parli a principianti e a persone anziane durante un corso di alfabetizzazione digitale. Rispondi SEMPRE in italiano semplice.\n" +
    "Regole:\n" +
    "- Risposte brevi: al massimo 150 parole, frasi corte, tono caldo e incoraggiante.\n" +
    "- Per i concetti difficili usa una metafora della vita quotidiana.\n" +
    "- Per le procedure usa un elenco numerato di passi.\n" +
    "- Evita i termini tecnici inglesi; se li usi, spiegali.\n" +
    "- Sulla sicurezza sii prudente: banche, Poste ed enti pubblici non chiedono mai password, PIN o codici.\n" +
    "- Se non sei sicuro di qualcosa, dillo e consiglia di chiedere a una persona di fiducia.\n" +
    "- Solo se aiuta a capire una sequenza o una struttura, aggiungi alla fine UN solo schema Mermaid semplice, " +
    "racchiuso tra [DIAGRAMMA] e [/DIAGRAMMA], ad esempio:\n[DIAGRAMMA]\nflowchart TD\n  A[\"Primo passo\"] --> B[\"Secondo passo\"]\n[/DIAGRAMMA]\n" +
    "Metti sempre le etichette dei nodi tra virgolette e non usare altri tipi di codice.";
  var SUGGESTIONS = ["Come si scrive la chiocciola?", "Cos'è il phishing?", "Come faccio una videochiamata?", "Come creo una password sicura?",
    "Dove trovo i file scaricati?", "Cos'è lo SPID?", "Come si copia e incolla?", "Il computer è bloccato, cosa faccio?"];
  var chatCtrl = null, busy = false;
  function pickSuggestions(n) {
    var extra = (PD.extraSuggestions || []).slice(), out = SUGGESTIONS.slice(0, Math.ceil(n * 0.6));
    while (out.length < n && extra.length) out.push(extra.splice(Math.floor(Math.random() * extra.length), 1)[0]);
    return out.concat(SUGGESTIONS.slice(out.length)).slice(0, n);
  }

  PD.views.ask = function (el, args) {
    var aiLine = PD.aiReady()
      ? '<span class="badge done">🤖 IA locale attiva: ' + esc(PD.currentModel()) + "</span>"
      : '<span class="badge">📚 Risponde la guida interna' + (PD.server ? " (IA locale non attiva)" : "") + "</span>";
    el.innerHTML =
      '<h1>💬 Chiedi al Professore</h1><p class="lead">Scrivete la vostra domanda' + (PD.sttReady() ? " oppure premete il microfono e parlate" : "") +
      ". Non esistono domande sbagliate. " + aiLine + "</p>" +
      '<div class="ask-layout"><div class="card"><div class="chat" id="chat" aria-live="polite"></div>' +
      '<div class="suggest" id="suggest">' + pickSuggestions(PD.history.length ? 4 : 8).map(function (s) { return "<button>" + esc(s) + "</button>"; }).join("") + "</div>" +
      '<form class="composer" id="composer"><button type="button" class="mic" id="mic" title="' +
      (PD.sttReady() ? "Premete e parlate; premete di nuovo per finire" : "Microfono non disponibile: vedi Impostazioni") + '" aria-label="Microfono"' +
      (PD.sttReady() ? "" : " disabled") + (PD.ospite ? " hidden" : "") + '>🎤</button>' +
      '<textarea id="question" rows="2" placeholder="Scrivete qui la domanda…" aria-label="La vostra domanda"></textarea>' +
      '<button class="btn big" id="send" type="submit">Invia</button></form>' +
      '<div class="row small" style="margin-top:.6rem"><button class="btn ghost" id="clear-chat" type="button">🧹 Nuova conversazione</button>' +
      '<button class="btn ghost" id="stop-gen" type="button" hidden>■ Ferma la risposta</button></div></div>' +
      '<aside class="ask-side"><div class="card" style="text-align:center">' + PD.profHTML() + '</div><div class="chalkboard" id="ask-board"></div></aside></div>';
    renderChat();
    var board = $("#ask-board", el);
    var lastWithDiagram = PD.history.slice().reverse().filter(function (m) { return m.diagram; })[0];
    PD.renderDiagram(board, lastWithDiagram ? lastWithDiagram.diagram : "", "La lavagna");
    $("#composer", el).onsubmit = function (e) { e.preventDefault(); PD.ask($("#question").value); };
    $("#question", el).onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); PD.ask(this.value); } };
    $("#suggest", el).onclick = function (e) { if (e.target.tagName === "BUTTON") PD.ask(e.target.textContent); };
    $("#clear-chat", el).onclick = function () { PD.history = []; PD.store.save("history", []); renderChat(); PD.renderDiagram(board, "", "La lavagna"); };
    $("#stop-gen", el).onclick = function () { if (chatCtrl) chatCtrl.abort(); };
    $("#mic", el).onclick = function () { PD.recorder.toggle(); };
    if (args[0]) { var q = decodeURIComponent(args.join("/")); history.replaceState(null, "", "#/ask"); $("#question").value = q; $("#question").focus(); }
  };

  function renderChat() {
    var box = $("#chat"); if (!box) return;
    if (!PD.history.length) {
      box.innerHTML = '<div class="msg bot"><p>Buongiorno! Sono qui per voi. Potete chiedermi qualsiasi cosa sul computer, su Internet, sulla posta o sulla sicurezza.</p></div>';
      return;
    }
    box.innerHTML = PD.history.map(msgHTML).join("");
    box.scrollTop = box.scrollHeight;
  }
  function msgHTML(m, i) {
    if (m.role === "user") return '<div class="msg user">' + esc(m.content) + "</div>";
    var meta = '<div class="meta"><span>' + (m.source === "ai" ? "🤖 " + esc(m.model || "IA locale") : "📚 Guida interna") + "</span>" +
      '<button data-speak="' + i + '">🔊 Riascolta</button>' + (m.diagram ? '<button data-diagram="' + i + '">📊 Schema</button>' : "") +
      (m.lesson ? '<button data-go="#/lessons/' + esc(m.lesson) + (m.step != null ? "/" + m.step : "") + '">📚 Apri la lezione</button>' : "") + "</div>";
    return '<div class="msg bot">' + PD.md(m.content) + meta + "</div>";
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-speak]");
    if (t) { var m = PD.history[+t.getAttribute("data-speak")]; if (m) PD.speak(m.content, true); return; }
    t = e.target.closest("[data-diagram]");
    if (t) { var d = PD.history[+t.getAttribute("data-diagram")]; var b = $("#ask-board"); if (d && b) { PD.renderDiagram(b, d.diagram, "La lavagna"); b.scrollIntoView({ behavior: "smooth" }); } }
  });

  function splitDiagram(text) {
    var m = text.match(/\[DIAGRAMMA\]([\s\S]*?)(\[\/DIAGRAMMA\]|$)/i) || text.match(/```mermaid([\s\S]*?)(```|$)/i);
    if (!m) return { text: text.trim(), diagram: "" };
    return { text: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim(), diagram: PD.cleanDiagram(m[1]) };
  }
  /* alcuni modelli recenti "ragionano ad alta voce" tra <think> e </think>: quel testo non va mostrato */
  function stripThink(text) { return String(text || "").replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").replace(/^\s+/, ""); }
  PD.stripThink = stripThink;
  function visibleWhileStreaming(text) {
    text = stripThink(text);
    var i = text.search(/\[DIAGR|```mermaid/i);
    return i >= 0 ? text.slice(0, i) : text;
  }

  PD.ask = function (text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    PD.stopSpeech();
    var qEl = $("#question"); if (qEl) qEl.value = "";
    PD.history.push({ role: "user", content: text });
    renderChat();
    if (PD.aiReady()) return askAI(text);
    return askKB(text);
  };

  function kbContext(text) {
    if (!PD.settings.useKbContext) return "";
    var r = PD.search(text, 2).filter(function (x) { return x.score >= PD.KB_THRESHOLD; });
    if (!r.length) return "";
    return "\n\nInformazioni affidabili dalla guida del corso (usale se pertinenti, senza citarle):\n" +
      r.map(function (x) { return "- " + x.doc.title + ": " + PD.plain(x.doc.answer).replace(/\s+/g, " ").slice(0, 600); }).join("\n");
  }

  function finishAnswer(msg) {
    PD.history.push(msg);
    if (PD.history.length > 60) PD.history = PD.history.slice(-60);
    PD.store.save("history", PD.history);
    renderChat();
    var b = $("#ask-board");
    if (msg.diagram) { PD.lastDiagram = { code: msg.diagram, title: "Schema della risposta" }; if (b) PD.renderDiagram(b, msg.diagram, "La lavagna"); }
    if (PD.settings.autoReadAnswers) PD.speak(msg.content); else PD.setProf("riposo");
  }

  function askKB(text, prefix) {
    var r = PD.search(text, 4);
    var best = r[0];
    if (best && best.score >= PD.KB_THRESHOLD) {
      var others = r.slice(1).filter(function (x) { return x.score >= PD.KB_THRESHOLD && x.doc.kind === "kb"; }).slice(0, 2);
      var extra = others.length ? "\n\nPotrebbe interessarvi anche:\n" + others.map(function (x) { return "- " + x.doc.title; }).join("\n") : "";
      finishAnswer({ role: "assistant", source: "kb", content: (prefix || "") + (best.doc.kind === "lesson" ? "**" + best.doc.title + "**\n\n" : "") + best.doc.answer + extra,
        diagram: best.doc.diagram || "", lesson: best.doc.lesson, step: best.doc.step });
    } else {
      var near = r.filter(function (x) { return x.score >= 1.6; });
      var sugg = near.length ? "\n\nForse cercavate:\n" + near.slice(0, 3).map(function (x) { return "- " + x.doc.title; }).join("\n")
        : "\n\nProvate con parole semplici, per esempio: *come si salva un file*, *cos'è il Wi-Fi*, *truffa SMS*.";
      finishAnswer({ role: "assistant", source: "kb",
        content: (prefix || "") + "Non ho trovato una risposta precisa nella mia guida interna." + sugg + (PD.server ? "" : "\n\nCon il pacchetto completo e l'IA locale potrò rispondere a domande più libere.") });
    }
  }

  function askAI(text) {
    busy = true; PD.setProf("pensiero");
    var box = $("#chat"), bubble = document.createElement("div");
    bubble.className = "msg bot typing"; bubble.textContent = "";
    if (box) { box.appendChild(bubble); box.scrollTop = box.scrollHeight; }
    var stopBtn = $("#stop-gen"); if (stopBtn) stopBtn.hidden = false;
    var sys = SYSTEM_PROMPT + (PD.settings.teacherName ? "\nIl corso è tenuto da " + PD.settings.teacherName + "." : "") + kbContext(text);
    var past = PD.history.slice(0, -1).slice(-8).map(function (m) { return { role: m.role, content: m.role === "assistant" ? m.content.slice(0, 1500) : m.content }; });
    var messages = [{ role: "system", content: sys }].concat(past, [{ role: "user", content: text }]);
    var model = PD.currentModel(), full = "";
    chatCtrl = new AbortController();
    var cleanup = function () { busy = false; chatCtrl = null; if (stopBtn) stopBtn.hidden = true; if (bubble.parentNode) bubble.parentNode.removeChild(bubble); };

    fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: chatCtrl.signal,
      body: JSON.stringify({ model: model, messages: messages }) })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "errore IA"); });
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = "";
        function pump() {
          return reader.read().then(function (res) {
            if (res.done) return;
            buf += dec.decode(res.value, { stream: true });
            var lines = buf.split("\n"); buf = lines.pop();
            lines.forEach(function (ln) {
              if (!ln.trim()) return;
              try {
                var o = JSON.parse(ln);
                if (o.error) throw new Error(o.error);
                if (o.t) { full += o.t; bubble.innerHTML = PD.md(visibleWhileStreaming(full)); if (box) box.scrollTop = box.scrollHeight; }
              } catch (e) { if (e.message && ln.indexOf('"error"') >= 0) throw e; }
            });
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        cleanup();
        full = stripThink(full);
        if (!full.trim()) throw new Error("risposta vuota");
        var parts = splitDiagram(full);
        finishAnswer({ role: "assistant", source: "ai", model: model, content: parts.text || "Ecco lo schema sulla lavagna.", diagram: parts.diagram });
      })
      .catch(function (err) {
        var aborted = err && err.name === "AbortError";
        cleanup();
        if (aborted) {
          full = stripThink(full);
          if (full.trim()) { var p = splitDiagram(full); finishAnswer({ role: "assistant", source: "ai", model: model, content: p.text + "\n\n*(risposta interrotta)*", diagram: p.diagram }); }
          else PD.setProf("riposo");
          return;
        }
        askKB(text, "*L'IA locale non ha risposto (" + esc(err.message) + "): rispondo con la guida interna.*\n\n");
      });
  }

  /* ------------------------------------------------------------------------
   *  Microfono: registrazione WAV 16 kHz nel browser + trascrizione locale
   * ---------------------------------------------------------------------- */
  PD.recorder = (function () {
    var st = null;
    function encodeWav(samples, rate) {
      var buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
      function w(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
      w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
      v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, samples.length * 2, true);
      for (var i = 0, o = 44; i < samples.length; i++, o += 2) { var s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
      return new Blob([buf], { type: "audio/wav" });
    }
    function downsample(chunks, inRate, outRate) {
      var len = 0; chunks.forEach(function (c) { len += c.length; });
      var all = new Float32Array(len), off = 0; chunks.forEach(function (c) { all.set(c, off); off += c.length; });
      if (inRate === outRate) return all;
      var ratio = inRate / outRate, n = Math.floor(len / ratio), out = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var start = Math.floor(i * ratio), end = Math.min(len, Math.floor((i + 1) * ratio)), sum = 0, cnt = 0;
        for (var j = start; j < end; j++) { sum += all[j]; cnt++; }
        out[i] = cnt ? sum / cnt : 0;
      }
      return out;
    }
    function setBtn(on) { var b = $("#mic"); if (b) { b.classList.toggle("rec", on); b.textContent = on ? "■" : "🎤"; } }
    var onText = null;
    function start(cb) {
      onText = cb || null;
      if (!PD.sttReady()) { PD.toast("Il riconoscimento vocale non è installato. Vedi Impostazioni."); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { PD.toast("Il browser non permette l'uso del microfono."); return; }
      PD.stopSpeech();
      navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
        var Ctx = window.AudioContext || window.webkitAudioContext, ctx = new Ctx();
        var src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1);
        st = { stream: stream, ctx: ctx, src: src, proc: proc, chunks: [], t0: Date.now(), heard: false, lastLoud: Date.now() };
        proc.onaudioprocess = function (e) {
          if (!st) return;
          var d = e.inputBuffer.getChannelData(0); st.chunks.push(new Float32Array(d));
          var rms = 0; for (var i = 0; i < d.length; i += 4) rms += d[i] * d[i]; rms = Math.sqrt(rms / (d.length / 4));
          var now = Date.now();
          if (rms > 0.02) { st.heard = true; st.lastLoud = now; }
          if ((st.heard && now - st.lastLoud > 1800) || now - st.t0 > 30000) stop();
        };
        src.connect(proc); proc.connect(ctx.destination);
        setBtn(true); PD.setProf("ascolto"); PD.toast("🎤 Vi ascolto… parlate pure.", 2500);
      }).catch(function (e) { PD.toast("Microfono non accessibile: " + e.message); });
    }
    function stop() {
      if (!st) return;
      var s = st; st = null; setBtn(false);
      try { s.proc.disconnect(); s.src.disconnect(); } catch (e) { /* ignora */ }
      s.stream.getTracks().forEach(function (t) { t.stop(); });
      var rate = s.ctx.sampleRate; s.ctx.close();
      var pcm = downsample(s.chunks, rate, 16000);
      if (pcm.length < 16000 * 0.4) { PD.setProf("riposo"); PD.toast("Non ho sentito nulla. Riprovate parlando vicino al microfono."); return; }
      PD.setProf("pensiero"); PD.toast("✍️ Trascrivo quello che avete detto…", 4000);
      fetch("/api/stt", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: encodeWav(pcm, 16000) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          PD.setProf("riposo");
          if (!j.ok) throw new Error(j.error || "errore");
          var t = (j.text || "").trim();
          if (!t) { PD.toast("Non ho capito bene. Potete ripetere?"); return; }
          t = t.charAt(0).toUpperCase() + t.slice(1);
          if (onText) { var f = onText; onText = null; f(t); return; }
          if (PD.settings.autoSendVoice) PD.ask(t); else { var q = $("#question"); if (q) { q.value = t; q.focus(); } }
        })
        .catch(function (e) { PD.setProf("riposo"); PD.toast("Trascrizione non riuscita: " + e.message); });
    }
    /* toggle(cb): con cb il testo riconosciuto va a cb invece che alla domanda (comandi vocali, «È una truffa?») */
    return { toggle: function (cb) { if (st) stop(); else start(cb); }, stop: stop, encodeWav: encodeWav, active: function () { return !!st; } };
  })();

  /* ------------------------------------------------------------------------
   *  IMPOSTAZIONI
   * ---------------------------------------------------------------------- */
  PD.views.settings = function (el) {
    var s = PD.settings, S = PD.status;
    var models = S && S.ai.models.length ? S.ai.models : [];
    var voices = ("speechSynthesis" in window) ? window.speechSynthesis.getVoices() : [];
    el.innerHTML = '<h1>⚙️ Impostazioni</h1><p class="lead">Adattate la Cattedra alla vostra classe. Le scelte vengono salvate su questo computer.</p>' +
      '<div class="settings">' +
      '<div class="card"><h2 style="margin-top:0">👁️ Vista</h2>' +
      field("Dimensione del testo: <b id='fs-val'>" + s.fontSize + "px</b>", '<input type="range" min="14" max="34" step="1" id="s-font" value="' + s.fontSize + '">') +
      field("Colori", select("s-theme", [["light", "Chiaro"], ["dark", "Scuro"], ["contrast", "Alto contrasto"]], s.theme)) +
      sw("s-projector", "Modalità proiettore (testo grande, menu nascosto)", s.projector) +
      sw("s-eyes", "Gli occhi del Professore seguono il mouse", s.eyesFollow) +
      sw("s-net", "Indicatore «Online»: controlla ogni minuto se Internet funziona (nessun dato inviato)", s.netCheck) +
      field("Nome dell'allievo (per i saluti e gli attestati)", '<input type="text" id="s-student" maxlength="60" value="' + esc(s.studentName) + '" placeholder="es. Maria Rossi">') +
      field("Nome dell'insegnante o del corso (facoltativo, firma gli attestati)", '<input type="text" id="s-teacher" maxlength="60" value="' + esc(s.teacherName) + '">') + "</div>" +

      '<div class="card"><h2 style="margin-top:0">🔊 Voce</h2>' +
      sw("s-voice", "Voce attiva", s.voice) + sw("s-autoread", "Leggi automaticamente le risposte", s.autoReadAnswers) +
      sw("s-autolessons", "Leggi automaticamente i passi delle lezioni", s.autoReadLessons) +
      (S && S.tts.voices && S.tts.voices.length ? field("Voce del Professore", select("s-voiceid", [["", "Automatica (consigliata)"]].concat(S.tts.voices.map(function (v) {
        return [v.id, (v.genere === "m" ? "👨 " : v.genere === "f" ? "👩 " : "🔈 ") + v.nome];
      })), s.voiceId) + '<span class="small muted">' + S.tts.voices.filter(function (v) { return v.genere === "m"; }).length + " voci maschili e " +
        S.tts.voices.filter(function (v) { return v.genere === "f"; }).length + " femminili su questo computer.</span>") : "") +
      field("Velocità della voce: <b id='rate-val'>" + s.rate.toFixed(2) + "</b>", '<input type="range" min="0.6" max="1.4" step="0.05" id="s-rate" value="' + s.rate + '">') +
      field("Motore vocale", select("s-tts", [["auto", "Automatico (consigliato)"], ["server", "Motore del computer (" + (S ? (S.tts.engines.join(", ") || "nessuno") : "non disponibile") + ")"], ["browser", "Voce del browser"]], s.ttsMode)) +
      (voices.length ? field("Voce del browser", select("s-bvoice", [["", "Automatica (italiano)"]].concat(voices.map(function (v) { return [v.name, v.name + " (" + v.lang + ")"]; })), s.browserVoice)) : "") +
      '<button class="btn ghost" id="test-voice">▶ Prova la voce</button>' +
      sw("s-greet", "Il Professore saluta a voce all'avvio (buongiorno, buon pomeriggio, buonasera)", s.greet) +
      sw("s-goodbye", "All'uscita ricorda i promemoria e saluta (buona notte se è tardi)", s.goodbye) +
      sw("s-idle", "Quando nessuno lo usa per un po', il Professore dà qualche consiglio e poi si mette in attesa", s.idleTips) + "</div>" +

      '<div class="card"><h2 style="margin-top:0">🤖 Intelligenza artificiale locale</h2>' +
      (PD.ospite ? '<p class="notice info small">📱 Questo tablet usa l\'intelligenza artificiale del <b>PC dell\'aula</b>' +
        (models.length ? ": è attiva." : ", che in questo momento non è attiva: risponde la guida interna.") + "</p>" :
      PD.server ? (S.ai.available
        ? (models.length ? '<p class="notice ok small">' + esc(S.ai.engine_title || "Ollama") + " è attivo. Modelli installati: " + models.length + ".</p>"
          : '<p class="notice small">Ollama è attivo ma non ha modelli. ' + (PD.isWindows() ? 'Andate in <a href="#/setup" data-go="#/setup">Configura IA e voce</a>.' : "Installate un modello con <code>professore-digitale-setup-ia</code>.") + "</p>")
        : (PD.isWindows() ? '<p class="notice small">L\'IA locale non è attiva: il Professore risponde con la <b>guida interna</b>. <a href="#/setup" data-go="#/setup">Configurate l\'IA con un clic</a> (il programma sceglie il modello adatto a questo computer).</p>'
          : '<p class="notice small">Ollama non è in esecuzione: il Professore risponde con la <b>guida interna</b>. Per attivare l\'IA aprite un terminale e date il comando <code>professore-digitale-setup-ia</code>.</p>'))
        : '<p class="notice info small">Nella versione portatile l\'IA non è disponibile: installate il programma completo (.exe o .deb).</p>') +
      sw("s-ai", "Usa l'IA quando disponibile", s.aiEnabled) +
      (models.length ? field("Modello", select("s-model", models.map(function (m) { return [m, m]; }), PD.currentModel())) : "") +
      sw("s-kbctx", "Suggerisci all'IA le informazioni della guida (risposte più precise)", s.useKbContext) +
      (S && !PD.ospite ? '<p class="small muted">Modello consigliato per questo computer (' + Math.round(S.system.ram_mb / 1024 * 10) / 10 + " GB di RAM): <b>" + esc(S.ai.recommended) + "</b></p>" : "") + "</div>" +

      (PD.ospite ? "" : '<div class="card"><h2 style="margin-top:0">🎤 Microfono</h2>' +
      (PD.sttReady() ? '<p class="notice ok small">Riconoscimento vocale attivo: <b>' + esc(S.stt.engine) + "</b>.</p>"
        : (PD.isWindows() ? '<p class="notice small">Riconoscimento vocale non installato. Attivatelo da <a href="#/setup" data-go="#/setup">Configura IA e voce</a> (circa 50 MB, una sola volta con Internet, oppure dalla chiavetta).</p>'
          : '<p class="notice small">Riconoscimento vocale non installato. Per attivarlo (circa 50 MB, una sola volta con Internet) aprite un terminale e date il comando <code>professore-digitale-setup-voce</code>.</p>')) +
      sw("s-autosend", "Invia subito la domanda dopo aver parlato", s.autoSendVoice) +
      (PD.server ? '<button class="btn ghost" id="reprobe">🔄 Ricontrolla i componenti</button>' : "") + "</div>") +

      '<div class="card"><h2 style="margin-top:0">📦 Dati e progressi</h2><p class="small muted">' + (PD.ospite ?
        "I progressi delle lezioni e la conversazione restano <b>su questo tablet</b>, nel suo browser: il PC dell'aula non li salva. Per conservarli usate «Esporta progressi»." :
        "I progressi delle lezioni e la conversazione restano su questo computer" + (S ? " nella cartella <code>" + esc(S.system.data_dir) + "</code>" : " nel browser") + ".") + "</p>" +
      '<div class="row"><button class="btn ghost" id="export">⬇️ Esporta progressi</button><label class="btn ghost">⬆️ Importa<input type="file" id="import" accept="application/json" hidden></label>' +
      '<button class="btn danger" id="reset">Azzera progressi</button></div></div>' +

      '<div class="card"><h2 style="margin-top:0">🧩 Contenuti aggiuntivi</h2><p class="small muted">Pacchetti di domande e lezioni preparati da voi o dal progetto. Si aggiungono senza reinstallare il programma.</p>' +
      '<div id="packs-list"></div><div class="row" style="margin-top:.6rem">' + (PD.ospite ? "" : '<label class="btn ghost">➕ Importa pacchetto<input type="file" id="pack-import" accept="application/json,.json" hidden></label>') +
      '<button class="btn ghost" id="pack-template">⬇️ Scarica il modello</button></div><div id="pack-res" class="small" style="margin-top:.5rem"></div></div>' +

      (PD.ospite ? "" : '<div class="card"><h2 style="margin-top:0">🔄 Aggiornamenti</h2><p class="small muted">Il Professore <b>non</b> si collega mai a Internet da solo. Il controllo avviene solo se premete il pulsante. L\'indirizzo può essere un sito <b>https</b> oppure un computer della <b>rete locale</b> (es. http://192.168.1.10:8080/aggiornamenti.json).</p>' +
      field("Indirizzo del file di versione", '<input type="url" id="s-upd" value="' + esc(s.updateUrl || (S ? S.update_url : "")) + '">') +
      '<button class="btn ghost" id="check-upd"' + (PD.server ? "" : " disabled") + '>🌐 Controlla aggiornamenti</button><div id="upd-res" class="small" style="margin-top:.6rem"></div></div>') +

      '<div class="card"><h2 style="margin-top:0">🩺 Diagnostica</h2><div class="diag" id="diag"></div></div>' +

      PD.hooks.settingsCards.map(function (c) { try { return c.html() || ""; } catch (e) { return ""; } }).join("") +
      (PD.sostieniHTML ? PD.sostieniHTML(true) : "") +

      '<div class="card"><h2 style="margin-top:0">ℹ️ Informazioni</h2><dl class="kv"><dt>Programma</dt><dd>Professore Digitale – Cattedra Digitale Portatile</dd>' +
      "<dt>Versione</dt><dd>" + PD.version + "</dd><dt>Ideazione e sviluppo</dt><dd>Danilo D'Auria – Tecnico IT &amp; Divulgatore Digitale per il Sociale</dd>" +
      "<dt>Contatti</dt><dd>danilodauria.site@gmail.com</dd><dt>Licenza</dt><dd>MIT (software libero)</dd>" +
      "<dt>Componenti</dt><dd>" + (PD.isWindows() ? "Mermaid (MIT) per gli schemi; voce di Windows; Ollama o KoboldCpp, Vosk, Piper (facoltativi)" : "Mermaid (MIT) per gli schemi; Ollama, espeak-ng, Vosk (facoltativi)") + "</dd></dl>" +
      (PD.server ? '<p class="row"><a class="btn ghost" href="docs/' + (PD.isWindows() ? "Vademecum_Professore_Digitale_Windows.pdf" : "Vademecum_Professore_Digitale.pdf") + '" target="_blank" rel="noopener">📖 Apri il vademecum (PDF)</a>' +
        (PD.isWindows() ? '<button class="btn ghost" id="open-data">📂 Cartella dei progressi</button>' : "") + "</p>" : "") + "</div>" +
      "</div>";

    function field(label, ctrl) { return '<div class="field"><label>' + label + "</label>" + ctrl + "</div>"; }
    function sw(id, label, on) { return '<label class="switch"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + ">" + esc(label) + "</label>"; }
    function select(id, opts, val) {
      return '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
    }
    function bind(id, ev, fn) { var n = $("#" + id, el); if (n) n.addEventListener(ev, fn); }
    function chk(id, key) { bind(id, "change", function () { s[key] = this.checked; PD.saveSettings(); renderChips(); }); }

    PD.hooks.settingsCards.forEach(function (c) { try { if (c.bind) c.bind(el); } catch (e) { if (window.console) console.error(e); } });
    bind("s-font", "input", function () { s.fontSize = +this.value; $("#fs-val").textContent = s.fontSize + "px"; PD.saveSettings(); });
    bind("s-theme", "change", function () { s.theme = this.value; PD.saveSettings(); });
    chk("s-projector", "projector"); chk("s-eyes", "eyesFollow"); chk("s-greet", "greet"); chk("s-goodbye", "goodbye"); chk("s-idle", "idleTips");
    bind("s-net", "change", function () { s.netCheck = this.checked; PD.saveSettings(); PD.checkNet(true); });
    bind("s-student", "change", function () { s.studentName = this.value.trim(); PD.saveSettings(); });
    bind("s-voiceid", "change", function () { s.voiceId = this.value; if (this.value) s.ttsMode = "server"; PD.saveSettings(); PD.speak("Buongiorno! Questa è la mia nuova voce.", true); }); chk("s-voice", "voice"); chk("s-autoread", "autoReadAnswers"); chk("s-autolessons", "autoReadLessons");
    chk("s-ai", "aiEnabled"); chk("s-kbctx", "useKbContext"); chk("s-autosend", "autoSendVoice");
    bind("s-teacher", "change", function () { s.teacherName = this.value.trim(); PD.saveSettings(); });
    bind("s-rate", "input", function () { s.rate = +this.value; $("#rate-val").textContent = s.rate.toFixed(2); PD.saveSettings(); });
    bind("s-tts", "change", function () { s.ttsMode = this.value; PD.saveSettings(); });
    bind("s-bvoice", "change", function () { s.browserVoice = this.value; PD.saveSettings(); });
    bind("s-model", "change", function () { s.model = this.value; PD.saveSettings(); renderChips(); });
    bind("s-upd", "change", function () { s.updateUrl = this.value.trim(); PD.saveSettings(); });
    bind("test-voice", "click", function () { PD.speak("Buongiorno! Sono il Professore Digitale. Questa è la mia voce.", true); });
    bind("open-data", "click", function () { api("/api/open", { what: "data" }); });
    bind("reprobe", "click", function () {
      api("/api/stt-reprobe", {}).then(PD.detect).then(function () { PD.toast("Componenti ricontrollati."); route(); });
    });
    bind("export", "click", function () {
      var blob = new Blob([JSON.stringify({ app: "professore-digitale", version: PD.version, progress: PD.progress, settings: PD.settings }, null, 1)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "professore-digitale-progressi.json"; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
    bind("import", "change", function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) {
        var j = JSON.parse(t);
        if (j.app !== "professore-digitale" || !j.progress) throw new Error("file non valido");
        PD.progress = j.progress; PD.saveProgress(); PD.toast("Progressi importati.");
      }).catch(function (e) { PD.toast("Importazione non riuscita: " + e.message); });
    });
    bind("reset", "click", function () {
      var b = this;
      if (b.getAttribute("data-confirm")) { PD.progress = { lessons: {} }; PD.saveProgress(); PD.toast("Progressi azzerati."); b.removeAttribute("data-confirm"); b.textContent = "Azzera progressi"; return; }
      b.setAttribute("data-confirm", "1"); b.textContent = "Sicuri? Premete di nuovo per confermare";
      setTimeout(function () { b.removeAttribute("data-confirm"); b.textContent = "Azzera progressi"; }, 5000);
    });
    bind("check-upd", "click", function () {
      var out = $("#upd-res"); out.textContent = "Controllo in corso…";
      api("/api/update-check", { url: $("#s-upd").value.trim() }).then(function (r) { renderUpdate(out, r); })
        .catch(function (e) { out.innerHTML = '<div class="notice">Controllo non riuscito: ' + esc(e.message) + "</div>"; });
    });
    renderPacks();
    bind("pack-import", "change", function () {
      var f = this.files[0], res = $("#pack-res"); if (!f) return; this.value = "";
      res.textContent = "Importazione…";
      f.text().then(function (t) { return PD.packs.importText(t); }).then(function (p) {
        res.innerHTML = '<div class="notice ok">✅ Importato «' + esc(p.titolo) + "» versione " + esc(p.versione) + ".</div>"; renderPacks();
      }).catch(function (e) { res.innerHTML = '<div class="notice">Pacchetto non importato: ' + esc(e.message) + "</div>"; });
    });
    bind("pack-template", "click", function () {
      var blob = new Blob([JSON.stringify(PD.packs.template(), null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "modello-contenuti.json"; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
    var diag = {
      modalita: PD.ospite ? "tablet collegato al PC dell'aula" : PD.server ? "applicazione installata (server locale)" : window.PD_PWA ? "app per telefono e tablet (PWA)" : "versione portatile (file HTML)",
      browser: navigator.userAgent, lingua: navigator.language,
      voci_browser: voices.filter(function (v) { return /^it/i.test(v.lang); }).map(function (v) { return v.name; }).join(", ") || "nessuna voce italiana",
      stato_server: S || "non disponibile"
    };
    $("#diag", el).textContent = JSON.stringify(diag, null, 2);
  };

  function renderPacks() {
    var box = $("#packs-list"); if (!box || !PD.packs) return;
    var L = PD.packs.list;
    var html = L.length ? L.map(function (en) {
      var p = en.pacchetto;
      return '<div class="notice info small" style="display:flex;gap:.8rem;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>' + esc(p.titolo) +
        "</b> · v" + esc(p.versione) + (p.autore ? " · " + esc(p.autore) : "") + "<br>" + (p.domande || []).length + " domande, " + (p.lezioni || []).length +
        " lezioni · " + ({ sistema: "incluso nel programma", computer: "installato per tutti gli utenti" }[en.origine] || "importato") + "</div>" +
        (en.origine === "utente" && !PD.ospite ? '<button class="btn ghost" data-pack-remove="' + esc(p.id) + '">Rimuovi</button>' : "") + "</div>";
    }).join("") : '<p class="small muted">Nessun pacchetto aggiuntivo.</p>';
    if (PD.packs.errors.length) html += '<div class="notice small"><b>Pacchetti ignorati perché non validi:</b><br>' +
      PD.packs.errors.map(function (x) { return esc(x.file) + ": " + esc(x.errori.join("; ")); }).join("<br>") + "</div>";
    box.innerHTML = html;
    PD.$$("[data-pack-remove]", box).forEach(function (b) {
      b.onclick = function () { PD.packs.remove(b.getAttribute("data-pack-remove")).then(function () { PD.toast("Pacchetto rimosso."); renderPacks(); }); };
    });
  }

  function renderUpdate(out, r) {
    var h = "";
    if (r.newer) {
      h += '<div class="notice">🆕 È disponibile la versione <b>' + esc(r.online) + "</b>" + (r.data ? " del " + esc(r.data) : "") + " (installata: " + esc(r.current) + ")." +
        (r.note.length ? "<ul>" + r.note.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
      if (r.pacchetto && r.sha256) h += '<button class="btn" id="upd-deb">⬇️ Scarica il nuovo pacchetto</button> ';
      if (r.pagina) h += '<a class="btn ghost" href="' + esc(r.pagina) + '" target="_blank" rel="noopener">Pagina del progetto</a>';
      h += '<div id="upd-deb-res" style="margin-top:.5rem"></div>';
    } else {
      h += '<div class="notice ok">✅ Avete già la versione più recente del programma (' + esc(r.current) + ").</div>";
    }
    // i contenuti pensati per un solo sistema (es. "windows-...") si mostrano solo li'
    r.contenuti = r.contenuti.filter(function (c) { return PD.isWindows() || !/^windows-/.test(c.id); });
    if (r.contenuti.length) {
      h += "<p><b>Contenuti disponibili</b></p>" + r.contenuti.map(function (c, i) {
        var lab = c.stato === "nuovo" ? "➕ Aggiungi" : c.stato === "aggiornamento" ? "🔄 Aggiorna (" + esc(c.installata) + " → " + esc(c.versione) + ")" : "";
        return '<div class="notice info small"><b>' + esc(c.titolo) + "</b> · v" + esc(c.versione) + (c.descrizione ? "<br>" + esc(c.descrizione) : "") +
          (lab ? '<br><button class="btn ghost" data-pack-dl="' + i + '" style="margin-top:.4rem">' + lab + "</button>" : "<br>✔ già installato") + "</div>";
      }).join("");
    }
    out.innerHTML = h;
    var b = $("#upd-deb");
    if (b) b.onclick = function () {
      var o = $("#upd-deb-res"); o.textContent = "Scaricamento e verifica in corso…"; b.disabled = true;
      api("/api/update-download", { url: r.pacchetto, sha256: r.sha256 }).then(function (x) {
        if (x.installabile) {
          o.innerHTML = '<div class="notice ok">✅ Aggiornamento scaricato e verificato:<br><code>' + esc(x.file) + '</code><br>Impostazioni e progressi verranno conservati.' +
            '<div class="row" style="margin-top:.6rem"><button class="btn" id="upd-run">▶ Installa adesso</button></div><span class="small muted">Il Professore si chiude e si riapre al termine dell\'installazione.</span></div>';
          $("#upd-run").onclick = function () { api("/api/update-install", { file: x.file }).then(function () { PD.toast("Avvio dell'installazione…", 5000); }).catch(function (e) { PD.toast("Non riuscito: " + e.message); }); };
          return;
        }
        o.innerHTML = '<div class="notice ok">✅ Pacchetto scaricato e verificato:<br><code>' + esc(x.file) + "</code><br>Per installarlo aprite un terminale e date:<br><code>sudo apt install " +
          esc(x.file.replace(/'/g, "")) + "</code><br>Impostazioni e progressi verranno conservati.</div>";
      }).catch(function (e) { b.disabled = false; o.innerHTML = '<div class="notice">Download non riuscito: ' + esc(e.message) + "</div>"; });
    };
    PD.$$("[data-pack-dl]", out).forEach(function (btn) {
      btn.onclick = function () {
        var c = r.contenuti[+btn.getAttribute("data-pack-dl")]; btn.disabled = true; btn.textContent = "Scaricamento…";
        PD.packs.download(c.url, c.sha256).then(function () { btn.outerHTML = "✔ installato"; renderPacks(); PD.toast("Contenuti «" + c.titolo + "» installati."); })
          .catch(function (e) { btn.disabled = false; btn.textContent = "Riprova"; PD.toast("Download non riuscito: " + e.message); });
      };
    });
  }

  /* ------------------------------------------------------------------------
   *  Avvio
   * ---------------------------------------------------------------------- */
  function bindGlobal() {
    document.addEventListener("click", function (e) {
      var g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); PD.go(g.getAttribute("data-go")); return; }
      var a = e.target.closest("[data-ask]"); if (a) { PD.go("#/ask/" + encodeURIComponent("Non ho capito bene: " + a.getAttribute("data-ask"))); }
    });
    $$(".nav-btn[data-view]").forEach(function (b) { b.onclick = function () { PD.go("#/" + b.getAttribute("data-view")); }; });
    var nb = $("#net"); if (nb) nb.onclick = function () { PD.checkNet(true).then(function (on) { PD.toast(on ? "🌐 Connessione a Internet attiva." : on === false ? "📴 Nessuna connessione a Internet: il Professore funziona lo stesso, tutto offline." : "Il controllo della connessione è spento (Impostazioni → Vista)."); }); };
    $("#btn-stop").onclick = PD.stopSpeech;
    $("#btn-font-up").onclick = function () { PD.settings.fontSize = Math.min(34, PD.settings.fontSize + 2); PD.saveSettings(); };
    $("#btn-font-down").onclick = function () { PD.settings.fontSize = Math.max(14, PD.settings.fontSize - 2); PD.saveSettings(); };
    $("#btn-theme").onclick = function () {
      var order = ["light", "dark", "contrast"]; PD.settings.theme = order[(order.indexOf(PD.settings.theme) + 1) % 3]; PD.saveSettings();
      PD.toast({ light: "Colori chiari", dark: "Colori scuri", contrast: "Alto contrasto" }[PD.settings.theme], 1500);
    };
    $("#btn-projector").onclick = function () {
      PD.settings.projector = !PD.settings.projector; PD.saveSettings();
      try { if (PD.settings.projector && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ignora */ }
    };
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") PD.stopSpeech(); });
    window.addEventListener("hashchange", route);
    if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = function () { renderChips(); };
  }

  function measureTop() {
    var t = $(".topbar"); if (t) document.documentElement.style.setProperty("--top-h", t.offsetHeight + "px");
  }
  window.addEventListener("resize", measureTop);

  /* Migrazione dei dati salvati tra versioni: ogni cambio di struttura incrementa DATA_SCHEMA
   * e aggiunge qui un passo (es. da 1 a 2). Cosi' i progressi degli allievi non si perdono mai. */
  var DATA_SCHEMA = 1;
  function migrate(p) {
    p = p || PD.progress;
    if (!p.schema) p.schema = 1;
    // esempio futuro:  if (p.schema < 2) { ...trasforma p...; p.schema = 2; }
    if (p.schema !== DATA_SCHEMA) p.schema = DATA_SCHEMA;
    return p;
  }
  /* Impostazioni: dalla 3.3 la voce «Riccardo» (bassa qualità) è sostituita da «Giorgio» */
  function migraImpostazioni(s) {
    if (s && /riccardo/.test(s.voiceId || "")) s.voiceId = "piper:it_IT-giorgio-medium";
    return s;
  }
  PD.migraProgressi = migrate;   // usata anche da profili.js per i progressi delle altre persone

  function heartbeat() {
    if (!PD.server) return;
    if (PD.ospite) { if (PD.aulaPresenza) PD.aulaPresenza(); return; }   // tablet: niente heartbeat, solo la presenza in aula
    fetch("/api/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(function () { /* server spento */ });
    if (PD.settings.aulaRuolo === "allievo" && PD.aulaPresenza) PD.aulaPresenza();
  }

  PD.init = function () {
    bindGlobal();
    applySettings();
    return PD.detect().then(function () {
      return Promise.all([PD.store.load("settings"), PD.store.load("progress"), PD.store.load("history")]);
    }).then(function (r) {
      if (r[0] && typeof r[0] === "object") PD.settings = migraImpostazioni(Object.assign({}, DEFAULTS, r[0]));
      if (r[1] && r[1].lessons) PD.progress = r[1];
      migrate();
      if (Array.isArray(r[2])) PD.history = r[2];
      return PD.packs ? PD.packs.load() : null;
    }).then(function () {
      return PD.hooks.dopoCaricamento.reduce(function (p, fn) {
        return p.then(function () { try { return fn(); } catch (e) { if (window.console) console.error(e); } });
      }, Promise.resolve());
    }).then(function () {
      applySettings(); renderChips(); measureTop();
      $("#app-version").textContent = PD.version;
      if (PD.server) { setInterval(heartbeat, 20000); setInterval(function () { PD.detect(); }, 60000); setTimeout(heartbeat, 3000); }
      PD.checkNet(); setInterval(function () { if (!document.hidden) PD.checkNet(); }, 60000);
      window.addEventListener("online", function () { PD.checkNet(true); });
      window.addEventListener("offline", function () { PD.checkNet(true); });
      route();
      if (PD.onReady) PD.onReady();
    });
  };
  document.addEventListener("DOMContentLoaded", function () { PD.init(); });
})();
