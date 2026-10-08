/* ==============================================================================
 *  PROFESSORE DIGITALE - «Ginnastica per la mente»
 *  Giochi brevi (3-10 minuti) di memoria, attenzione, parole, calcolo e logica, con un diario dei progressi.
 *  Tono sereno: tenere la mente allenata, come una passeggiata quotidiana (nessuna promessa medica).
 *
 *  CONTRATTO per i giochi (usato anche da mente-giochi.js: NON cambiarlo):
 *    PD.mente.registra({ id, icona, titolo, descrizione, categoria: "memoria"|"attenzione"|"parole"|"calcolo"|"logica",
 *                        durata: "5 minuti", ordine: n, livelli: 3, avvia: function (box, ctx) {} })
 *       campi facoltativi: livelliTesto: ["6 carte", "12 carte", "16 carte"] (sotto i pulsanti del livello)
 *    PD.mente.elenco()  -> giochi ordinati per «ordine»
 *    PD.mente.stato(id) -> PD.progress.mente.giochi[id] || null
 *                          { volte, migliore (stelle migliori 1-3), ultimo ("AAAA-MM-GG"), livello (l'ultimo giocato),
 *                            stelle, punti, massimo (dell'ultima partita), livelloMax, minuti }
 *    ctx = {
 *      livello: 1|2|3                    facile / medio / difficile
 *      fine({ punti, massimo, messaggio, misura, unita })   chiude la partita: punteggio, stelle (1-3), salvataggio.
 *                                         misura/unita facoltative (es. 5, "coppie") servono al diario per i miglioramenti
 *      suggerimento(testo)                imposta il testo che appare con «💡 Un aiutino» (non lo mostra subito)
 *      parla(testo)                       mostra la consegna in alto e la legge a voce («🔊 Leggi» la ripete)
 *      esci()                             torna all'elenco dei giochi
 *      casuale()                          come Math.random; con il «gioco del giorno» usa il seme della data
 *    }
 *  Aggiunte facoltative (non fanno parte del contratto minimo):
 *    ctx.aiutino = function () { return "testo" }   se il gioco la imposta, «Un aiutino» la chiama (aiuto attivo)
 *    ctx.messaggio(testo, "ok"|"no"|"info")       riga di esito sotto la consegna (non letta a voce)
 *    ctx.suono("ok"|"no"|"fine"|numero Hz)        piccoli suoni gentili (Web Audio, se c'è)
 *    ctx.dopo(fn, ms)                             setTimeout annullato da solo quando si esce dal gioco
 *    ctx.tasti(function (evento) {})              tasti premuti mentre il gioco è aperto (rimosso all'uscita)
 *    ctx.pesca(lista, n, chiave)                  n elementi a caso evitando quelli usati di recente (niente ripetizioni ravvicinate)
 *    ctx.vivo()                                   false dopo fine() o dopo l'uscita
 *    PD.mente.aiuti                               { mescola, euro, euroVoce, chiave, oggi, seme }
 *    PD.mente.dataProva = "AAAA-MM-GG"            (solo per i test) finge che oggi sia quella data
 *  Dati: PD.progress.mente = { giochi: {id: stato}, giorni: {"AAAA-MM-GG": {minuti, partite}}, storia: [...], recenti: {}, opzioni: {} }
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;

  /* ------------------------------------------------------------------------
   *  Registro dei giochi (contratto)
   * ---------------------------------------------------------------------- */
  var GIOCHI = [];
  PD.mente = {
    registra: function (g) {
      if (!g || !g.id || typeof g.avvia !== "function") return;
      GIOCHI = GIOCHI.filter(function (x) { return x.id !== g.id; });
      GIOCHI.push(g);
    },
    elenco: function () {
      return GIOCHI.slice().sort(function (a, b) { return (a.ordine || 99) - (b.ordine || 99); });
    },
    stato: function (id) {
      var m = PD.progress && PD.progress.mente;
      return (m && m.giochi && m.giochi[id]) || null;
    }
  };
  function trova(id) { return GIOCHI.filter(function (g) { return g.id === id; })[0] || null; }

  var CATEGORIE = [
    { id: "memoria", icona: "🧠", nome: "Memoria", desc: "Ricordare immagini, colori e piccole liste." },
    { id: "attenzione", icona: "👀", nome: "Attenzione", desc: "Osservare con calma e notare i particolari." },
    { id: "parole", icona: "🔤", nome: "Parole", desc: "Giocare con lettere, parole e frasi." },
    { id: "calcolo", icona: "🔢", nome: "Calcolo", desc: "I conti di tutti i giorni, senza fretta." },
    { id: "logica", icona: "🧭", nome: "Logica", desc: "Ragionare, collegare, scegliere." }
  ];
  function categoria(id) { return CATEGORIE.filter(function (c) { return c.id === id; })[0] || { id: id, icona: "🧩", nome: "Altri giochi", desc: "" }; }
  var LIVELLI = [null, { nome: "Facile", ico: "🌱" }, { nome: "Medio", ico: "🌿" }, { nome: "Difficile", ico: "🌳" }];

  /* ------------------------------------------------------------------------
   *  Date, casualità, dati salvati
   * ---------------------------------------------------------------------- */
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var GSETT = ["L", "M", "M", "G", "V", "S", "D"];
  var GSETT_LUNGHI = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
  function due(n) { return (n < 10 ? "0" : "") + n; }
  function chiave(d) { return d.getFullYear() + "-" + due(d.getMonth() + 1) + "-" + due(d.getDate()); }
  function daChiave(k) { var p = String(k).split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0); }
  function oggi() {
    var t = PD.mente.dataProva;
    if (t) return typeof t === "string" ? daChiave(t) : new Date(t.getTime());
    var d = new Date(); d.setHours(12, 0, 0, 0); return d;
  }
  function piuGiorni(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); x.setHours(12, 0, 0, 0); return x; }
  function giorniTra(a, b) { return Math.round((daChiave(b) - daChiave(a)) / 86400000); }
  function hash(s) {
    var h = 2166136261; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619) % 4294967296; }
    return h >>> 0;
  }
  function generatore(seme) {
    var a = seme >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul ? Math.imul(t ^ (t >>> 15), t | 1) : ((t ^ (t >>> 15)) * (t | 1)) >>> 0;
      t ^= t + (Math.imul ? Math.imul(t ^ (t >>> 7), t | 61) : ((t ^ (t >>> 7)) * (t | 61)) >>> 0);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mescola(a, rnd) {
    rnd = rnd || Math.random; a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function euro(c) {
    c = Math.round(c); var e = Math.floor(c / 100), r = c % 100;
    return e + "," + due(r) + " €";
  }
  function euroVoce(c) {
    c = Math.round(c); var e = Math.floor(c / 100), r = c % 100;
    if (!e) return r + " centesimi";
    return (e === 1 ? "un euro" : e + " euro") + (r ? " e " + r + " centesimi" : "");
  }
  /* dati in sola lettura (non crea nulla) e dati da scrivere */
  function leggi() {
    var m = (PD.progress && PD.progress.mente) || {};
    return { giochi: m.giochi || {}, giorni: m.giorni || {}, storia: m.storia || [], recenti: m.recenti || {}, opzioni: m.opzioni || {} };
  }
  function M() {
    var p = PD.progress || (PD.progress = { lessons: {} });
    var m = p.mente && typeof p.mente === "object" ? p.mente : (p.mente = {});
    ["giochi", "giorni", "recenti", "opzioni"].forEach(function (k) { if (!m[k] || typeof m[k] !== "object") m[k] = {}; });
    if (!(m.storia instanceof Array)) m.storia = [];
    return m;
  }
  /* sceglie n elementi evitando quelli usati di recente in quel gioco */
  function pesca(idGioco, lista, n, chiaveFn, rnd) {
    chiaveFn = chiaveFn || function (x) { return typeof x === "string" ? x : JSON.stringify(x); };
    var m = M(), rec = m.recenti[idGioco] || [];
    var nuovi = [], vecchi = [];
    mescola(lista, rnd).forEach(function (x) { (rec.indexOf(chiaveFn(x)) >= 0 ? vecchi : nuovi).push(x); });
    vecchi.sort(function (a, b) { return rec.indexOf(chiaveFn(a)) - rec.indexOf(chiaveFn(b)); });
    var scelti = nuovi.concat(vecchi).slice(0, n);
    scelti.forEach(function (x) { var k = chiaveFn(x), i = rec.indexOf(k); if (i >= 0) rec.splice(i, 1); rec.push(k); });
    var cap = Math.max(n, Math.floor(lista.length * 0.7));
    while (rec.length > cap) rec.shift();
    m.recenti[idGioco] = rec;
    return scelti;
  }

  /* ------------------------------------------------------------------------
   *  Suoni gentili (Web Audio). Se l'audio non c'è, si gioca lo stesso.
   * ---------------------------------------------------------------------- */
  var audioCtx = null;
  function nota(f, durata, ritardo, vol) {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      audioCtx = audioCtx || new C();
      if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + (ritardo || 0);
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (durata || 0.35));
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + (durata || 0.35) + 0.05);
    } catch (e) { /* senza audio va bene lo stesso */ }
  }
  function suono(tipo) {
    if (typeof tipo === "number") { nota(tipo, 0.45); return; }
    if (tipo === "ok") { nota(660, 0.18); nota(880, 0.25, 0.12); }
    else if (tipo === "no") { nota(300, 0.3, 0, 0.05); }
    else if (tipo === "fine") { nota(523, 0.2); nota(659, 0.2, 0.15); nota(784, 0.35, 0.3); }
  }

  PD.mente.aiuti = { mescola: mescola, euro: euro, euroVoce: euroVoce, chiave: chiave, oggi: oggi, seme: hash };
  PD.mente.categorie = CATEGORIE;

  /* ------------------------------------------------------------------------
   *  Gioco del giorno, livello consigliato, diario
   * ---------------------------------------------------------------------- */
  function giocoDelGiorno(d) {
    var L = PD.mente.elenco();
    if (!L.length) return null;
    L.sort(function (a, b) { return hash("pd-mente-" + a.id) - hash("pd-mente-" + b.id); });
    var n = Math.floor(daChiave(chiave(d || oggi())).getTime() / 86400000);
    return L[((n % L.length) + L.length) % L.length];
  }
  PD.mente.delGiorno = function () { return giocoDelGiorno(); };
  function livelloConsigliato(id) {
    var s = PD.mente.stato(id); if (!s) return 1;
    var l = s.livello || 1, st = s.stelle || 2;
    if (st >= 3 && l < 3) return l + 1;
    if (st <= 1 && l > 1) return l - 1;
    return l;
  }
  PD.mente.livelloConsigliato = livelloConsigliato;

  function durataTesto(g) {
    if (g <= 1) return "un giorno";
    if (g < 14) return g + " giorni";
    var s = Math.round(g / 7); return s + " settimane";
  }
  function diario() {
    var D = leggi(), oggiD = oggi(), oggiK = chiave(oggiD);
    /* giorni di fila: se oggi non si è ancora giocato, la serie di ieri vale ancora */
    var d = D.giorni[oggiK] ? oggiD : piuGiorni(oggiD, -1), serie = 0;
    while (D.giorni[chiave(d)] && serie < 4000) { serie++; d = piuGiorni(d, -1); }
    /* serie più lunga di sempre */
    var chiavi = Object.keys(D.giorni).filter(function (k) { return /^\d{4}-\d\d-\d\d$/.test(k); }).sort(), record = 0, cur = 0, prec = null;
    chiavi.forEach(function (k) { cur = prec && giorniTra(prec, k) === 1 ? cur + 1 : 1; if (cur > record) record = cur; prec = k; });
    /* settimana da lunedì */
    var lun = piuGiorni(oggiD, -((oggiD.getDay() + 6) % 7)), sett = [], minSett = 0;
    for (var i = 0; i < 7; i++) {
      var k = chiave(piuGiorni(lun, i)), mi = (D.giorni[k] && D.giorni[k].minuti) || 0;
      sett.push({ k: k, minuti: mi, futuro: k > oggiK }); minSett += mi;
    }
    /* preferiti */
    var pref = Object.keys(D.giochi).map(function (id) { return { id: id, volte: D.giochi[id].volte || 0, g: trova(id) }; })
      .filter(function (x) { return x.g && x.volte; }).sort(function (a, b) { return b.volte - a.volte; }).slice(0, 3);
    /* miglioramenti (ultimi 60 giorni) */
    var per = {}, migl = [];
    D.storia.forEach(function (s) {
      if (!s || !s.g || !s.d || giorniTra(s.d, oggiK) > 60) return;
      var v = typeof s.x === "number" ? s.x : (typeof s.p === "number" ? s.p : null);
      if (v == null) return;
      (per[s.g] = per[s.g] || []).push({ d: s.d, v: v, u: s.x != null ? (s.u || "") : "punti" });
    });
    Object.keys(per).forEach(function (id) {
      var E = per[id], g = trova(id); if (!g || E.length < 2) return;
      var primo = E[0], best = primo;
      E.forEach(function (e) { if (e.v > best.v && e.u === primo.u) best = e; });
      if (best.v > primo.v) {
        var gg = Math.max(1, giorniTra(primo.d, best.d));
        migl.push({ id: id, testo: categoria(g.categoria).nome + ": da " + primo.v + " a " + best.v + (primo.u ? " " + primo.u : "") + " in " + durataTesto(gg),
          gioco: g.titolo, ico: g.icona });
      }
    });
    var partite = 0, minuti = 0;
    Object.keys(D.giorni).forEach(function (k) { partite += D.giorni[k].partite || 0; minuti += D.giorni[k].minuti || 0; });
    return { serie: serie, record: record, settimana: sett, minutiSettimana: minSett, preferiti: pref, miglioramenti: migl,
      giorniTotali: chiavi.length, partite: partite, minuti: minuti, oggiFatto: !!D.giorni[oggiK] };
  }
  PD.mente.diario = diario;

  function registraTempo(minuti, partita) {
    var m = M(), k = chiave(oggi()), g = m.giorni[k] || { minuti: 0, partite: 0 };
    g.minuti = (g.minuti || 0) + minuti; if (partita) g.partite = (g.partite || 0) + 1;
    m.giorni[k] = g;
  }

  /* ------------------------------------------------------------------------
   *  Esecuzione di un gioco
   * ---------------------------------------------------------------------- */
  var corrente = null;
  function ferma() {
    var r = corrente; if (!r) return;
    corrente = null;
    r.timers.forEach(function (t) { clearTimeout(t); });
    r.tasti.forEach(function (h) { document.removeEventListener("keydown", h); });
    if (r.orologio) clearInterval(r.orologio);
    if (!r.finito) {
      var min = Math.floor((Date.now() - r.t0) / 60000);
      if (min >= 1) { registraTempo(Math.min(min, 30), false); PD.saveProgress(); }
    }
    if (PD.stopSpeech) PD.stopSpeech();
  }
  window.addEventListener("hashchange", function () {
    if (corrente && location.hash.indexOf("#/mente/" + corrente.g.id + "/") !== 0) ferma();
  });

  var FRASI = {
    3: ["Splendido! Una mente davvero in forma.", "Bravissimi, un risultato ottimo!", "Che concentrazione: complimenti!",
        "Perfetto, come una bella passeggiata di buon passo.", "Eccellente: oggi siete brillanti!", "Magnifico! Potete esserne fieri."],
    2: ["Molto bene! Un bell'allenamento.", "Bravi, ottimo lavoro!", "Bel risultato: si vede l'impegno.",
        "Ben fatto! Con un po' di pratica arrivano anche le tre stelle.", "Bene così: un passo alla volta.", "Ottimo! La mente si è messa in moto."],
    1: ["Bravi per averci provato: allenarsi è già un successo.", "Ogni partita è un piccolo allenamento: va benissimo così.",
        "Non conta il punteggio, conta allenarsi con costanza.", "La prossima volta andrà ancora meglio: la mente ama la pratica.",
        "Ottimo esercizio! Riprovate quando volete, senza fretta.", "Bravi! Anche i campioni hanno cominciato così."]
  };
  var ultimaFrase = "";
  function frase(stelle) {
    var L = FRASI[stelle].filter(function (f) { return f !== ultimaFrase; });
    ultimaFrase = L[Math.floor(Math.random() * L.length)];
    return ultimaFrase;
  }
  function stelleHTML(n, tot) {
    var s = ""; for (var i = 1; i <= (tot || 3); i++) s += '<span class="' + (i <= n ? "piena" : "vuota") + '">' + (i <= n ? "★" : "☆") + "</span>";
    return '<span class="mente-stelle" role="img" aria-label="' + n + (n === 1 ? " stella" : " stelle") + ' su 3">' + s + "</span>";
  }
  function mmss(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + due(s % 60); }

  function intestazione(g, sotto, destra) {
    var c = categoria(g.categoria);
    return '<div class="lesson-head mente-head"><span class="big-ico" aria-hidden="true">' + esc(g.icona) + "</span><div>" +
      '<div class="small muted">🧩 Ginnastica per la mente · ' + esc(c.icona + " " + c.nome) + (sotto ? " · " + sotto : "") + "</div>" +
      "<h1>" + esc(g.titolo) + "</h1></div>" + (destra || "") + "</div>";
  }

  /* schermata di scelta del livello */
  function sceltaLivello(el, g, oggiFlag) {
    ferma();
    var cons = livelloConsigliato(g.id), st = PD.mente.stato(g.id), opz = leggi().opzioni;
    var nl = Math.max(1, Math.min(3, g.livelli || 3));
    el.innerHTML = '<div class="mente-run">' +
      intestazione(g, g.durata ? "circa " + esc(g.durata) : "", '<button class="btn ghost" type="button" data-go="#/mente" style="margin-left:auto">← Tutti i giochi</button>') +
      '<div class="card mente-intro">' + (oggiFlag ? '<p class="mente-oggi-badge">☀️ Il gioco del giorno</p>' : "") +
      "<p class=\"lead\">" + esc(g.descrizione) + "</p>" +
      (st ? '<p class="small muted">Giocato ' + st.volte + (st.volte === 1 ? " volta" : " volte") + " · migliore risultato " + stelleHTML(st.migliore || 0) + "</p>" : "") +
      "<h2>Scegliete il livello</h2>" +
      '<div class="mente-livelli">' + [1, 2, 3].slice(0, nl).map(function (l) {
        var t = g.livelliTesto && g.livelliTesto[l - 1];
        return '<button type="button" class="mente-livello' + (l === cons ? " consigliato" : "") + '" data-l="' + l + '">' +
          '<span class="mente-liv-ico" aria-hidden="true">' + LIVELLI[l].ico + "</span><b>" + LIVELLI[l].nome + "</b>" +
          (t ? "<small>" + esc(t) + "</small>" : "") + (l === cons ? '<span class="badge done">Consigliato per voi</span>' : "") + "</button>";
      }).join("") + "</div>" +
      '<label class="mente-opz"><input type="checkbox" id="mente-tempo"' + (opz.tempo ? " checked" : "") + "> ⏱️ Mostrare il tempo mentre gioco</label>" +
      '<p class="small muted">Non c\'è nessuna fretta: il tempo non conta per il punteggio.</p></div></div>';
    $("#mente-tempo", el).onchange = function () { M().opzioni.tempo = this.checked; PD.saveProgress(); };
    $$(".mente-livello", el).forEach(function (b) {
      b.onclick = function () { PD.go("#/mente/" + g.id + "/" + b.getAttribute("data-l") + (oggiFlag ? "/oggi" : "")); };
    });
    var c = $(".mente-livello.consigliato", el); if (c) try { c.focus(); } catch (e) { /* ignora */ }
  }

  function avvia(el, g, livello, oggiFlag) {
    ferma();
    var rnd = oggiFlag ? generatore(hash(g.id + "|" + chiave(oggi()))) : Math.random;
    var run = { g: g, livello: livello, t0: Date.now(), timers: [], tasti: [], sugg: "", istr: "", aiutini: 0, finito: false, orologio: null };
    corrente = run;
    el.innerHTML = '<div class="mente-run">' +
      intestazione(g, LIVELLI[livello].ico + " Livello " + LIVELLI[livello].nome.toLowerCase(),
        '<span class="mente-tempo" aria-live="off" hidden></span><button class="btn ghost mente-esci-alto" type="button" style="margin-left:auto">✕ Esci</button>') +
      '<div class="mente-guida"><div class="mente-istr" aria-live="polite"></div><div class="mente-esito" aria-live="polite"></div></div>' +
      '<div class="mente-box"></div>' +
      '<div class="mente-barra">' +
      '<button class="btn ghost mente-aiuto" type="button">💡 Un aiutino</button>' +
      '<button class="btn ghost mente-leggi" type="button">🔊 Leggi</button>' +
      '<button class="btn ghost mente-tempo-btn" type="button"></button>' +
      '<button class="btn ghost mente-esci" type="button">✕ Esci</button></div>' +
      '<div class="mente-fine" hidden></div></div>';
    var box = $(".mente-box", el), istr = $(".mente-istr", el), esito = $(".mente-esito", el);
    var tempoEl = $(".mente-tempo", el), tempoBtn = $(".mente-tempo-btn", el);
    function vivo() { return corrente === run && !run.finito; }
    function aggiornaTempo() {
      var on = !!leggi().opzioni.tempo;
      tempoEl.hidden = !on;
      tempoBtn.textContent = on ? "⏱️ Nascondi il tempo" : "⏱️ Mostra il tempo";
      tempoEl.textContent = "⏱️ " + mmss(Date.now() - run.t0);
    }
    run.orologio = setInterval(function () { if (corrente === run && !tempoEl.hidden) tempoEl.textContent = "⏱️ " + mmss(Date.now() - run.t0); }, 1000);
    aggiornaTempo();

    var ctx = {
      livello: livello,
      casuale: function () { return rnd(); },
      parla: function (t) {
        if (!vivo()) return;
        run.istr = String(t || "");
        istr.innerHTML = PD.md(run.istr);
        if (PD.settings.voice) PD.speak(run.istr);
      },
      suggerimento: function (t) {
        if (!vivo()) return;
        run.sugg = String(t || "");
        var b = $(".mente-aiuto", el); b.classList.remove("pronto"); void b.offsetWidth; if (run.sugg) b.classList.add("pronto");
      },
      messaggio: function (t, tipo) {
        if (!vivo()) return;
        esito.className = "mente-esito" + (tipo ? " " + tipo : "");
        esito.innerHTML = t ? PD.md(t) : "";
      },
      suono: suono,
      dopo: function (fn, ms) {
        var id = setTimeout(function () { if (vivo()) fn(); }, ms || 0);
        run.timers.push(id); return id;
      },
      tasti: function (fn) {
        var h = function (e) {
          if (!vivo() || e.ctrlKey || e.altKey || e.metaKey) return;
          var t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
          fn(e);
        };
        document.addEventListener("keydown", h); run.tasti.push(h);
      },
      pesca: function (lista, n, chiaveFn) { return pesca(g.id, lista, n, chiaveFn, rnd); },
      vivo: vivo,
      aiutino: null,
      esci: function () { ferma(); PD.go("#/mente"); },
      fine: function (o) {
        if (!vivo()) return;
        o = o || {};
        run.finito = true;
        run.timers.forEach(function (t) { clearTimeout(t); });
        var massimo = Math.max(1, +o.massimo || 1), punti = Math.max(0, Math.min(massimo, +o.punti || 0));
        var r = punti / massimo, stelle = r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
        var minuti = Math.max(1, Math.min(30, Math.round((Date.now() - run.t0) / 60000)));
        var m = M(), prima = m.giochi[g.id] || {}, k = chiave(oggi());
        m.giochi[g.id] = { volte: (prima.volte || 0) + 1, migliore: Math.max(prima.migliore || 0, stelle), ultimo: k, livello: livello,
          stelle: stelle, punti: punti, massimo: massimo, livelloMax: Math.max(prima.livelloMax || 0, livello), minuti: (prima.minuti || 0) + minuti };
        registraTempo(minuti, true);
        var voce = { g: g.id, d: k, l: livello, p: punti, m: massimo, s: stelle };
        if (typeof o.misura === "number") { voce.x = o.misura; voce.u = String(o.unita || ""); }
        m.storia.push(voce);
        if (m.storia.length > 400) m.storia.splice(0, m.storia.length - 400);
        PD.saveProgress();
        suono("fine");
        var fr = frase(stelle), di = diario();
        var consiglio = stelle >= 3 && livello < 3 ? "La prossima volta potete provare il livello <b>" + LIVELLI[livello + 1].nome.toLowerCase() + "</b>."
          : stelle <= 1 && livello > 1 ? "Se volete, provate il livello <b>" + LIVELLI[livello - 1].nome.toLowerCase() + "</b>: si impara con calma." : "";
        $(".mente-guida", el).hidden = true; box.hidden = true; $(".mente-barra", el).hidden = true;
        var fin = $(".mente-fine", el);
        fin.innerHTML = '<div class="card mente-fine-card">' + stelleHTML(stelle) +
          "<h2>" + esc(fr) + "</h2>" +
          '<p class="mente-punti">Punti: <b>' + punti + "</b> su " + massimo + "</p>" +
          (o.messaggio ? '<div class="mente-fine-msg">' + PD.md(o.messaggio) + "</div>" : "") +
          (consiglio ? '<p class="notice info">' + consiglio + "</p>" : "") +
          '<p class="small muted">Avete allenato la mente per circa ' + minuti + (minuti === 1 ? " minuto" : " minuti") +
          (di.serie >= 2 ? " · 🔥 " + di.serie + " giorni di fila" : "") + "." + (run.aiutini ? " Aiutini usati: " + run.aiutini + "." : "") + "</p>" +
          '<div class="row mente-fine-row"><button class="btn big mente-rigioca" type="button">🔁 Rigioca</button>' +
          (stelle >= 3 && livello < 3 ? '<button class="btn big ghost mente-sale" type="button">' + LIVELLI[livello + 1].ico + " Livello " + LIVELLI[livello + 1].nome.toLowerCase() + "</button>" : "") +
          '<button class="btn big ghost" type="button" data-go="#/mente">🧩 Altro gioco</button></div></div>';
        fin.hidden = false;
        $(".mente-rigioca", fin).onclick = function () { avvia(el, g, livello, oggiFlag); window.scrollTo(0, 0); };
        var sale = $(".mente-sale", fin); if (sale) sale.onclick = function () { avvia(el, g, livello + 1, oggiFlag); window.scrollTo(0, 0); };
        if (PD.settings.voice) PD.speak(fr + " Avete fatto " + punti + " punti su " + massimo + ". " + PD.plain(o.messaggio || ""));
        window.scrollTo(0, 0);
        try { $(".mente-rigioca", fin).focus(); } catch (e) { /* ignora */ }
      }
    };

    function esci() { ctx.esci(); }
    $(".mente-esci", el).onclick = esci; $(".mente-esci-alto", el).onclick = esci;
    $(".mente-leggi", el).onclick = function () { if (run.istr) PD.speak(run.istr, true); };
    tempoBtn.onclick = function () { var o = M().opzioni; o.tempo = !o.tempo; PD.saveProgress(); aggiornaTempo(); };
    $(".mente-aiuto", el).onclick = function () {
      if (!vivo()) return;
      run.aiutini++;
      var t = null;
      if (typeof ctx.aiutino === "function") { try { t = ctx.aiutino(); } catch (e) { t = null; } }
      t = t || run.sugg || "Prendetevela con calma: non c'è nessuna fretta. Rileggete la consegna in alto.";
      esito.className = "mente-esito info"; esito.innerHTML = PD.md("💡 " + t);
      if (PD.settings.voice) PD.speak(t);
    };
    try { g.avvia(box, ctx); }
    catch (e) {
      if (window.console) console.error(e);
      box.innerHTML = '<div class="notice">Questo gioco non è partito per un errore interno. Tornate indietro e riprovate.</div>';
    }
  }

  /* ------------------------------------------------------------------------
   *  Vista: indice con il gioco del giorno, le categorie e il diario
   * ---------------------------------------------------------------------- */
  var meseVisto = 0; /* 0 = mese corrente, -1 = mese prima… */

  function calendarioHTML(offset, perStampa) {
    var D = leggi(), o = oggi(), oggiK = chiave(o);
    var primo = new Date(o.getFullYear(), o.getMonth() + offset, 1, 12);
    var mese = primo.getMonth(), inizio = (primo.getDay() + 6) % 7;
    var html = '<table class="mente-cal"><caption>' + MESI[mese].charAt(0).toUpperCase() + MESI[mese].slice(1) + " " + primo.getFullYear() + "</caption><thead><tr>" +
      GSETT.map(function (g, i) { return '<th scope="col" abbr="' + GSETT_LUNGHI[i] + '">' + g + "</th>"; }).join("") + "</tr></thead><tbody><tr>";
    var fatti = 0;
    for (var i = 0; i < inizio; i++) html += "<td></td>";
    var d = primo, col = inizio;
    while (d.getMonth() === mese) {
      var k = chiave(d), g = D.giorni[k], cls = (g ? "fatto" : "") + (k === oggiK ? " oggi" : "") + (k > oggiK ? " futuro" : "");
      if (g) fatti++;
      html += '<td class="' + cls + '"' + (g ? ' title="' + (g.minuti || 0) + ' minuti"' : "") + "><span class=\"n\">" + d.getDate() + "</span>" +
        (g ? '<span class="pallino" aria-label="allenamento fatto">' + (perStampa ? "●" : "") + "</span>" : "") + "</td>";
      col++;
      if (col === 7 && piuGiorni(d, 1).getMonth() === mese) { html += "</tr><tr>"; col = 0; }
      d = piuGiorni(d, 1);
    }
    while (col < 7) { html += "<td></td>"; col++; }
    html += "</tr></tbody></table>";
    return { html: html, fatti: fatti };
  }

  function diarioHTML() {
    var di = diario(), cal = calendarioHTML(meseVisto);
    var maxMin = Math.max(10, Math.max.apply(null, di.settimana.map(function (s) { return s.minuti; })));
    return '<section class="card mente-diario" id="mente-diario" aria-labelledby="mente-diario-tit">' +
      '<div class="mente-diario-testa"><h2 id="mente-diario-tit">📔 Il mio diario</h2>' +
      '<button class="btn ghost mente-stampa" type="button">🖨️ Stampa il diario</button></div>' +
      '<div class="mente-numeri">' +
      '<div class="mente-num"><span class="mente-num-v mente-serie">' + di.serie + "</span><span>" + (di.serie === 1 ? "giorno" : "giorni") + " di fila 🔥</span></div>" +
      '<div class="mente-num"><span class="mente-num-v mente-min-sett">' + di.minutiSettimana + "</span><span>minuti questa settimana ⏱️</span></div>" +
      '<div class="mente-num"><span class="mente-num-v">' + di.partite + "</span><span>" + (di.partite === 1 ? "partita" : "partite") + " in tutto 🎲</span></div>" +
      "</div>" +
      (di.partite ? "" : '<p class="muted">Il diario si riempie da solo quando giocate. Basta una partita al giorno!</p>') +
      '<div class="mente-diario-corpo">' +
      '<div class="mente-cal-box"><div class="mente-cal-nav"><button class="btn ghost mente-mese" data-d="-1" type="button" aria-label="Mese precedente">◀</button>' +
      '<button class="btn ghost mente-mese" data-d="1" type="button" aria-label="Mese successivo"' + (meseVisto >= 0 ? " disabled" : "") + ">▶</button></div>" +
      cal.html + '<p class="small muted">Giorni di allenamento in questo mese: <b>' + cal.fatti + "</b></p></div>" +
      '<div class="mente-diario-lato">' +
      "<h3>Questa settimana</h3>" +
      '<div class="mente-sett" role="img" aria-label="Minuti di allenamento giorno per giorno">' + di.settimana.map(function (s, i) {
        return '<div class="mente-sett-g' + (s.futuro ? " futuro" : "") + '"><span class="mente-barretta" style="height:' + Math.round(100 * s.minuti / maxMin) + '%"></span>' +
          "<small>" + GSETT[i] + "</small><small class=\"v\">" + (s.minuti || "") + "</small></div>";
      }).join("") + "</div>" +
      "<h3>Giochi preferiti</h3>" + (di.preferiti.length ? '<ol class="mente-pref">' + di.preferiti.map(function (p) {
        return "<li>" + esc(p.g.icona + " " + p.g.titolo) + ' <span class="small muted">(' + p.volte + (p.volte === 1 ? " volta" : " volte") + ")</span></li>";
      }).join("") + "</ol>" : '<p class="small muted">Ancora nessuno: scegliete un gioco qui sopra.</p>') +
      "<h3>Miglioramenti</h3>" + (di.miglioramenti.length ? '<ul class="mente-migl">' + di.miglioramenti.map(function (x) {
        return "<li>📈 <b>" + esc(x.testo) + '</b> <span class="small muted">(' + esc(x.ico + " " + x.gioco) + ")</span></li>";
      }).join("") + "</ul>" : '<p class="small muted">Giocando più volte allo stesso gioco, qui vedrete i vostri progressi.</p>') +
      (di.record > 1 ? '<p class="small muted">La vostra serie più lunga: ' + di.record + " giorni di fila.</p>" : "") +
      "</div></div></section>";
  }

  function stampaDiario() {
    var di = diario(), nome = PD.settings.studentName || "", o = oggi(), D = leggi();
    var ultime = D.storia.slice(-12).reverse();
    var html = '<header class="p-testa"><div><b>Professore Digitale</b> · Ginnastica per la mente</div><div>' + o.toLocaleDateString("it-IT") + "</div></header>" +
      "<h1>🧩 Il mio diario della ginnastica per la mente</h1>" + (nome ? "<p><b>" + esc(nome) + "</b></p>" : "") +
      '<p>Giorni di fila: <b>' + di.serie + "</b> · Minuti questa settimana: <b>" + di.minutiSettimana + "</b> · Partite in tutto: <b>" + di.partite +
      "</b> · Giorni di allenamento: <b>" + di.giorniTotali + "</b></p>" +
      '<div class="mente-p-cal">' + calendarioHTML(0, true).html + "</div>" +
      "<h2>Giochi preferiti</h2>" + (di.preferiti.length ? "<ol>" + di.preferiti.map(function (p) { return "<li>" + esc(p.g.titolo) + " (" + p.volte + ")</li>"; }).join("") + "</ol>" : "<p>—</p>") +
      "<h2>Miglioramenti</h2>" + (di.miglioramenti.length ? "<ul>" + di.miglioramenti.map(function (x) { return "<li>" + esc(x.testo) + " (" + esc(x.gioco) + ")</li>"; }).join("") + "</ul>" : "<p>—</p>") +
      (ultime.length ? "<h2>Ultime partite</h2><table class=\"mente-p-tab\"><thead><tr><th>Giorno</th><th>Gioco</th><th>Livello</th><th>Punti</th><th>Stelle</th></tr></thead><tbody>" +
        ultime.map(function (s) {
          var g = trova(s.g);
          return "<tr><td>" + esc(daChiave(s.d).toLocaleDateString("it-IT")) + "</td><td>" + esc(g ? g.titolo : s.g) + "</td><td>" + esc((LIVELLI[s.l] || {}).nome || "") +
            "</td><td>" + s.p + " su " + s.m + "</td><td>" + new Array((s.s || 0) + 1).join("★") + "</td></tr>";
        }).join("") + "</tbody></table>" : "") +
      '<p class="p-tip">Tenere la mente allenata è come fare una passeggiata ogni giorno: bastano pochi minuti, con costanza e serenità.</p>' +
      '<footer class="p-piede">Stampato dal Professore Digitale · software libero ideato da Danilo D\'Auria · funziona senza Internet</footer>';
    PD.printHTML(html, "verticale");
  }

  function tileGioco(g, extra) {
    var st = PD.mente.stato(g.id);
    return '<button class="card tile mente-tile' + (extra ? " " + extra : "") + '" type="button" data-go="#/mente/' + esc(g.id) + '" data-gioco="' + esc(g.id) + '">' +
      '<span class="big-ico" aria-hidden="true">' + esc(g.icona) + "</span><h3>" + esc(g.titolo) + "</h3><p>" + esc(g.descrizione) + "</p>" +
      '<span class="mente-tile-piede"><span class="small muted">⏱️ ' + esc(g.durata || "") + "</span>" +
      (st ? stelleHTML(st.migliore || 0) : '<span class="small mente-nuovo">Nuovo</span>') + "</span></button>";
  }

  function indice(el) {
    ferma();
    var L = PD.mente.elenco(), gg = giocoDelGiorno(), D = leggi(), oggiK = chiave(oggi());
    var fattoOggi = gg && D.storia.some(function (s) { return s.g === gg.id && s.d === oggiK; });
    var cats = CATEGORIE.concat(L.filter(function (g) { return !CATEGORIE.some(function (c) { return c.id === g.categoria; }); }).length ? [categoria("altro")] : []);
    el.innerHTML = '<div class="mente-indice">' +
      '<div class="hero mente-hero">' + PD.profHTML() + "<div><h1>🧩 Ginnastica per la mente</h1>" +
      '<p class="lead">Pochi minuti al giorno di giochi sereni per <b>tenere la mente allenata</b>, come una passeggiata quotidiana.</p>' +
      "<p>Memoria, attenzione, parole e conti di tutti i giorni. Non c'è fretta e non si perde mai: ogni partita è un piccolo allenamento.</p></div></div>" +
      (gg ? '<section class="card mente-giorno" aria-labelledby="mente-giorno-tit"><div class="mente-giorno-ico" aria-hidden="true">' + esc(gg.icona) + "</div><div>" +
        '<p class="mente-oggi-badge" id="mente-giorno-tit">☀️ Il gioco del giorno</p><h2>' + esc(gg.titolo) + "</h2><p>" + esc(gg.descrizione) + "</p>" +
        (fattoOggi ? '<p class="notice ok">✅ Fatto oggi! Domani troverete un gioco nuovo.</p>' : "") +
        '<div class="row"><button class="btn big mente-gioca-oggi" type="button" data-go="#/mente/' + esc(gg.id) + '/oggi">▶ ' + (fattoOggi ? "Gioca ancora" : "Gioca") + "</button></div></div></section>" : "") +
      (L.length ? cats.map(function (c) {
        var G = L.filter(function (g) { return c.id === "altro" ? !CATEGORIE.some(function (x) { return x.id === g.categoria; }) : g.categoria === c.id; });
        if (!G.length) return "";
        return '<section class="mente-cat" data-cat="' + esc(c.id) + '"><h2>' + esc(c.icona + " " + c.nome) + ' <small class="muted">' + esc(c.desc) + "</small></h2>" +
          '<div class="grid mente-griglia">' + G.map(function (g) { return tileGioco(g); }).join("") + "</div></section>";
      }).join("") : '<p class="muted">I giochi non sono disponibili.</p>') +
      '<div class="mente-diario-posto">' + diarioHTML() + "</div>" +
      '<p class="small muted mente-nota">Questi giochi sono un passatempo per allenarsi con piacere: non sono esami né esercizi medici. ' +
      "I risultati restano solo su questo computer.</p></div>";
    legaDiario(el);
  }
  function legaDiario(el) {
    var posto = $(".mente-diario-posto", el); if (!posto) return;
    $(".mente-stampa", posto).onclick = stampaDiario;
    $$(".mente-mese", posto).forEach(function (b) {
      b.onclick = function () {
        meseVisto = Math.min(0, meseVisto + (+b.getAttribute("data-d")));
        posto.innerHTML = diarioHTML(); legaDiario(el);
        var nb = $(".mente-mese[data-d='" + b.getAttribute("data-d") + "']", posto); if (nb && !nb.disabled) nb.focus();
      };
    });
  }

  PD.views.mente = function (el, args) {
    args = args || [];
    var g = args[0] ? trova(args[0]) : null;
    if (args[0] === "diario") { meseVisto = 0; indice(el); var d = $("#mente-diario", el); if (d) setTimeout(function () { d.scrollIntoView(); }, 30); return; }
    if (!g) { meseVisto = 0; indice(el); return; }
    var l = parseInt(args[1], 10), oggiFlag = args[1] === "oggi" || args[2] === "oggi";
    if (l >= 1 && l <= 3) avvia(el, g, l, oggiFlag);
    else sceltaLivello(el, g, oggiFlag);
  };

  PD.hooks.homeTiles.push(function () {
    var gg = giocoDelGiorno();
    return PD.tileHTML("🧩", "Ginnastica per la mente",
      gg ? "Il gioco di oggi: " + esc(gg.icona + " " + gg.titolo) + ". Pochi minuti per tenere la mente allenata." : "Giochi sereni di memoria, attenzione e calcolo.", "#/mente", "mente-home");
  });

  /* ==========================================================================
   *  I GIOCHI
   * ======================================================================== */
  var R = PD.mente.registra;
  function bottone(cls, testo, attr) { return '<button type="button" class="' + cls + '"' + (attr || "") + ">" + testo + "</button>"; }

  /* --------------------------------------------------------------------------
   *  a) Le coppie (memoria)
   * ------------------------------------------------------------------------ */
  var FIGURE = [
    ["🍎", "mela"], ["🍐", "pera"], ["🍊", "arancia"], ["🍋", "limone"], ["🍇", "uva"], ["🍓", "fragola"], ["🍒", "ciliegie"], ["🍉", "anguria"],
    ["🥝", "kiwi"], ["🌻", "girasole"], ["🌹", "rosa"], ["🌷", "tulipano"], ["🌼", "margherita"], ["🐱", "gatto"], ["🐶", "cane"], ["🐔", "gallina"],
    ["🐄", "mucca"], ["🐴", "cavallo"], ["🐑", "pecora"], ["🐟", "pesce"], ["🦋", "farfalla"], ["🐌", "lumaca"], ["☕", "caffè"], ["🎩", "cappello"],
    ["👓", "occhiali"], ["🔑", "chiave"], ["⏰", "sveglia"], ["☂️", "ombrello"], ["🚲", "bicicletta"], ["🚗", "automobile"], ["🚂", "treno"], ["⛵", "barca a vela"],
    ["🏠", "casa"], ["⛪", "chiesa"], ["🎈", "palloncino"], ["🎁", "regalo"], ["📚", "libri"], ["✉️", "lettera"], ["🎻", "violino"], ["🎺", "tromba"],
    ["🧀", "formaggio"], ["🍕", "pizza"], ["🌙", "luna"], ["⭐", "stella"], ["☀️", "sole"], ["🐞", "coccinella"], ["🍄", "fungo"], ["⚽", "pallone"]
  ];
  function giocoCoppie(box, ctx) {
    var nCoppie = [3, 6, 8][ctx.livello - 1];
    var figure = ctx.pesca(FIGURE, nCoppie, function (f) { return f[1]; });
    var carte = mescola(figure.concat(figure).map(function (f, i) { return { e: f[0], n: f[1], id: figure.indexOf(f) }; }), ctx.casuale);
    var aperte = [], trovate = 0, mosse = 0, sbagli = 0, blocco = null;
    box.innerHTML = '<p class="mj-stato" aria-live="polite"></p><div class="mj-carte c' + carte.length + '">' + carte.map(function (c, i) {
      return '<button type="button" class="mj-carta" data-i="' + i + '" data-coppia="' + c.id + '" aria-label="Carta coperta ' + (i + 1) + '"><span aria-hidden="true">' + c.e + "</span></button>";
    }).join("") + "</div>";
    var B = $$(".mj-carta", box), stato = $(".mj-stato", box);
    function aggiorna() { stato.textContent = "Coppie trovate: " + trovate + " su " + nCoppie + (mosse ? " · tentativi: " + mosse : ""); }
    function copri() {
      if (blocco) { clearTimeout(blocco); blocco = null; }
      aperte.forEach(function (i) { B[i].classList.remove("su"); B[i].setAttribute("aria-label", "Carta coperta " + (i + 1)); });
      aperte = [];
    }
    B.forEach(function (b, i) {
      b.onclick = function () {
        if (!ctx.vivo() || b.classList.contains("ok") || aperte.indexOf(i) >= 0) return;
        if (aperte.length === 2) copri();
        b.classList.add("su"); b.setAttribute("aria-label", "Carta " + (i + 1) + ": " + carte[i].n);
        aperte.push(i);
        if (aperte.length < 2) return;
        mosse++;
        var a = carte[aperte[0]], c = carte[aperte[1]];
        if (a.id === c.id) {
          aperte.forEach(function (k) { B[k].classList.add("ok"); B[k].setAttribute("aria-label", "Coppia trovata: " + carte[k].n); });
          aperte = []; trovate++; ctx.suono("ok");
          ctx.messaggio("✅ Bene! Una coppia di **" + a.n + "**.", "ok");
          aggiorna();
          if (trovate === nCoppie) {
            var punti = Math.max(Math.ceil(nCoppie / 2), nCoppie - Math.max(0, sbagli - nCoppie));
            ctx.dopo(function () {
              ctx.fine({ punti: punti, massimo: nCoppie, misura: nCoppie, unita: "coppie",
                messaggio: "Avete trovato tutte le **" + nCoppie + " coppie** in " + mosse + " tentativi." });
            }, 700);
          }
        } else {
          sbagli++;
          ctx.messaggio("Non sono uguali: " + a.n + " e " + c.n + ". Ricordate dove sono!", "");
          blocco = ctx.dopo(copri, 1600);
        }
        aggiorna();
      };
    });
    aggiorna();
    ctx.parla("Le carte sono coperte. Giratene due alla volta con un clic: se mostrano lo stesso disegno, avete trovato una coppia. Trovate tutte le " + nCoppie + " coppie.");
    ctx.suggerimento("Girate prima una carta nuova; poi cercate di ricordare dove avete già visto quel disegno.");
    var visti = 0;
    ctx.aiutino = function () {
      copri();
      if (visti >= 2) return "Avete già usato gli aiutini di questa partita. Provate a ricordare: ce la potete fare!";
      visti++;
      B.forEach(function (b) { if (!b.classList.contains("ok")) { b.classList.add("su"); b.classList.add("sbircia"); } });
      ctx.dopo(function () { B.forEach(function (b) { if (!b.classList.contains("ok") && b.classList.contains("sbircia")) { b.classList.remove("su"); b.classList.remove("sbircia"); } }); }, 2000);
      return "Guardate bene: per due secondi vi mostro tutte le carte.";
    };
  }
  R({ id: "coppie", icona: "🃏", titolo: "Le coppie", descrizione: "Girate le carte e trovate i disegni uguali.", categoria: "memoria",
    durata: "5 minuti", ordine: 10, livelli: 3, livelliTesto: ["6 carte", "12 carte", "16 carte"], avvia: giocoCoppie });

  /* --------------------------------------------------------------------------
   *  b) La sequenza dei colori (memoria)
   * ------------------------------------------------------------------------ */
  var TASTI_SEQ = [
    { n: "rosso", forma: "cerchio", f: 330, svg: '<circle cx="50" cy="50" r="30"/>' },
    { n: "blu", forma: "quadrato", f: 392, svg: '<rect x="22" y="22" width="56" height="56" rx="4"/>' },
    { n: "giallo", forma: "triangolo", f: 494, svg: '<polygon points="50,16 84,80 16,80"/>' },
    { n: "verde", forma: "stella", f: 587, svg: '<polygon points="50,12 60,38 88,38 66,56 74,84 50,68 26,84 34,56 12,38 40,38"/>' }
  ];
  function giocoSequenza(box, ctx) {
    var P = [{ da: 2, a: 5, v: 1000 }, { da: 3, a: 7, v: 800 }, { da: 3, a: 9, v: 650 }][ctx.livello - 1];
    var seq = [], pos = 0, ascolto = false, seconda = false, migliore = 0;
    for (var i = 0; i < P.da; i++) seq.push(Math.floor(ctx.casuale() * 4));
    box.innerHTML = '<p class="mj-stato" aria-live="polite"></p><div class="mj-seq">' + TASTI_SEQ.map(function (t, i) {
      return '<button type="button" class="mj-seq-t mj-' + t.n + '" data-i="' + i + '" aria-label="' + t.n + ", " + t.forma + " (tasto " + (i + 1) + ')">' +
        '<svg viewBox="0 0 100 100" aria-hidden="true">' + t.svg + "</svg><span>" + t.n.charAt(0).toUpperCase() + t.n.slice(1) + " <kbd>" + (i + 1) + "</kbd></span></button>";
    }).join("") + '</div><div class="row mj-centro"><button type="button" class="btn big mj-via">▶ Mostrami la sequenza</button></div>';
    var B = $$(".mj-seq-t", box), stato = $(".mj-stato", box), via = $(".mj-via", box);
    function accendi(i, ms) {
      B[i].classList.add("acceso"); ctx.suono(TASTI_SEQ[i].f);
      ctx.dopo(function () { B[i].classList.remove("acceso"); }, ms);
    }
    function blocca(si) { box.classList.toggle("mj-guardate", si); B.forEach(function (b) { b.setAttribute("aria-disabled", si ? "true" : "false"); }); }
    function mostra() {
      ascolto = false; blocca(true); via.hidden = true; pos = 0;
      stato.textContent = "Guardate e ascoltate… (" + seq.length + " colori)";
      seq.forEach(function (k, j) { ctx.dopo(function () { accendi(k, P.v * 0.6); }, 500 + j * P.v); });
      ctx.dopo(function () {
        ascolto = true; blocca(false);
        stato.textContent = "Ora tocca a voi: ripetete la sequenza di " + seq.length + " colori.";
        try { B[0].focus(); } catch (e) { /* ignora */ }
      }, 500 + seq.length * P.v);
    }
    function premi(i) {
      if (!ascolto) return;
      accendi(i, 300);
      if (i === seq[pos]) {
        pos++;
        if (pos < seq.length) return;
        ascolto = false; migliore = seq.length; seconda = false;
        if (seq.length >= P.a) {
          ctx.fine({ punti: migliore, massimo: P.a, misura: migliore, unita: "colori in fila", messaggio: "Avete ripetuto senza errori una sequenza di **" + migliore + " colori**. Straordinario!" });
          return;
        }
        ctx.messaggio("✅ Giusto! Adesso aggiungo un colore.", "ok");
        seq.push(Math.floor(ctx.casuale() * 4));
        ctx.dopo(mostra, 1300);
      } else {
        ascolto = false; ctx.suono("no");
        if (!seconda) {
          seconda = true;
          ctx.messaggio("Quasi! Ve la faccio rivedere con calma: stessa sequenza.", "");
          ctx.dopo(mostra, 1600);
        } else {
          ctx.dopo(function () {
            ctx.fine({ punti: migliore, massimo: P.a, misura: migliore, unita: "colori in fila",
              messaggio: migliore ? "Avete ricordato sequenze fino a **" + migliore + " colori**. Ogni volta si va un po' più lontano!" : "Ricordare le sequenze richiede un po' di pratica: riprovate quando volete." });
          }, 900);
        }
      }
    }
    B.forEach(function (b, i) { b.onclick = function () { premi(i); }; });
    ctx.tasti(function (e) { var k = "1234".indexOf(e.key); if (k >= 0) { e.preventDefault(); premi(k); } });
    via.onclick = mostra;
    ctx.parla("Guardate e ascoltate: i pulsanti colorati si illuminano uno dopo l'altro. Poi ripeteteli nello stesso ordine, con il mouse o con i tasti da 1 a 4. Ogni volta si aggiunge un colore. Premete «Mostrami la sequenza» quando siete pronti.");
    ctx.suggerimento("Provate a dire i colori a voce, come una filastrocca: «rosso, blu, verde…». Ogni colore ha anche una forma diversa.");
    ctx.aiutino = function () {
      if (!ascolto) return "Aspettate che la sequenza finisca, poi toccherà a voi.";
      mostra(); return "Ve la mostro di nuovo, dall'inizio.";
    };
  }
  R({ id: "sequenza", icona: "🚦", titolo: "La sequenza dei colori", descrizione: "Guardate i colori che si accendono e ripeteteli nello stesso ordine.",
    categoria: "memoria", durata: "4 minuti", ordine: 20, livelli: 3, livelliTesto: ["fino a 5 colori", "fino a 7 colori", "fino a 9 colori, più veloce"], avvia: giocoSequenza });

  /* --------------------------------------------------------------------------
   *  c) La lista della spesa (memoria)
   * ------------------------------------------------------------------------ */
  var PRODOTTI = [
    ["🍎", "mele", "frutta"], ["🍐", "pere", "frutta"], ["🍌", "banane", "frutta"], ["🍊", "arance", "frutta"], ["🍋", "limoni", "frutta"], ["🍇", "uva", "frutta"],
    ["🍓", "fragole", "frutta"], ["🍑", "pesche", "frutta"], ["🥕", "carote", "verdura"], ["🍅", "pomodori", "verdura"], ["🥔", "patate", "verdura"],
    ["🥒", "cetrioli", "verdura"], ["🌽", "mais", "verdura"], ["🥦", "broccoli", "verdura"], ["🍆", "melanzane", "verdura"], ["🥬", "insalata", "verdura"],
    ["🥛", "latte", "frigo"], ["🧀", "formaggio", "frigo"], ["🥚", "uova", "frigo"], ["🍗", "pollo", "frigo"], ["🥩", "bistecca", "frigo"], ["🐟", "pesce", "frigo"],
    ["🍝", "pasta", "dispensa"], ["🍚", "riso", "dispensa"], ["🥖", "pane", "dispensa"], ["🍪", "biscotti", "dispensa"], ["☕", "caffè", "dispensa"],
    ["🍯", "miele", "dispensa"], ["🍫", "cioccolato", "dispensa"], ["🍬", "caramelle", "dispensa"], ["🥫", "pelati", "dispensa"], ["🍵", "tè", "dispensa"],
    ["🧻", "carta igienica", "casa"], ["🧼", "sapone", "casa"], ["🕯️", "candele", "casa"], ["🔋", "pile", "casa"], ["💡", "lampadina", "casa"], ["🧽", "spugna", "casa"],
    ["🍷", "vino", "bevande"], ["💧", "acqua", "bevande"], ["🌸", "fiori", "casa"], ["🧂", "sale", "dispensa"]
  ];
  function giocoSpesa(box, ctx) {
    var P = [{ n: 3, s: 9, t: 15 }, { n: 5, s: 12, t: 15 }, { n: 7, s: 16, t: 18 }][ctx.livello - 1];
    var lista = ctx.pesca(PRODOTTI, P.n, function (p) { return p[1]; });
    var altri = PRODOTTI.filter(function (p) { return lista.indexOf(p) < 0; });
    if (ctx.livello === 3) {
      /* al livello difficile i prodotti «trappola» sono dello stesso reparto */
      var reparti = lista.map(function (p) { return p[2]; });
      altri = mescola(altri, ctx.casuale).sort(function (a, b) { return (reparti.indexOf(b[2]) >= 0) - (reparti.indexOf(a[2]) >= 0); });
    } else altri = mescola(altri, ctx.casuale);
    var scaffale = mescola(lista.concat(altri.slice(0, P.s - P.n)), ctx.casuale);
    var timer = null, sbirciate = 0;
    function foglio() {
      return '<div class="mj-foglio" role="list" aria-label="Lista della spesa"><div class="mj-foglio-tit">🛒 Lista della spesa</div>' +
        lista.map(function (p) { return '<div role="listitem" class="mj-foglio-r"><span aria-hidden="true">' + p[0] + "</span> " + esc(p[1]) + "</div>"; }).join("") + "</div>";
    }
    function memorizza() {
      box.innerHTML = '<div class="mj-spesa-mem">' + foglio() +
        '<div class="mj-clessidra" aria-hidden="true"><span style="animation-duration:' + P.t + 's"></span></div>' +
        '<div class="row mj-centro"><button type="button" class="btn big mj-pronto">✔ Ho memorizzato</button></div></div>';
      $(".mj-pronto", box).onclick = scegli;
      timer = ctx.dopo(scegli, P.t * 1000);
      try { $(".mj-pronto", box).focus(); } catch (e) { /* ignora */ }
    }
    function scegli() {
      if (timer) { clearTimeout(timer); timer = null; }
      if ($(".mj-scaffale", box)) return;
      box.innerHTML = '<p class="mj-stato" aria-live="polite">Scelti: 0 su ' + P.n + '</p><div class="mj-scaffale">' + scaffale.map(function (p, i) {
        return '<button type="button" class="mj-prod" data-i="' + i + '" aria-pressed="false"' + (lista.indexOf(p) >= 0 ? ' data-lista="1"' : "") + '><span aria-hidden="true">' + p[0] +
          "</span>" + esc(p[1]) + "</button>";
      }).join("") + '</div><div class="row mj-centro"><button type="button" class="btn big mj-fatto">🧺 Ho finito la spesa</button></div>';
      ctx.parla("Ora prendete dagli scaffali i prodotti che erano nella lista: " + P.n + " in tutto. Cliccate per metterli nel carrello, cliccate di nuovo per toglierli. Poi premete «Ho finito la spesa».");
      $$(".mj-prod", box).forEach(function (b) {
        b.onclick = function () {
          var on = b.getAttribute("aria-pressed") !== "true";
          b.setAttribute("aria-pressed", on ? "true" : "false");
          $(".mj-stato", box).textContent = "Scelti: " + $$(".mj-prod[aria-pressed='true']", box).length + " su " + P.n;
        };
      });
      $(".mj-fatto", box).onclick = controlla;
    }
    function controlla() {
      var giusti = 0, sbagliati = 0, mancanti = [];
      $$(".mj-prod", box).forEach(function (b) {
        var p = scaffale[+b.getAttribute("data-i")], preso = b.getAttribute("aria-pressed") === "true", serve = lista.indexOf(p) >= 0;
        b.disabled = true;
        if (preso && serve) { giusti++; b.classList.add("right"); }
        else if (preso && !serve) { sbagliati++; b.classList.add("wrong"); }
        else if (serve) { mancanti.push(p[1]); b.classList.add("manca"); }
      });
      var punti = Math.max(0, giusti - sbagliati);
      $(".mj-fatto", box).hidden = true;
      ctx.messaggio("Prodotti giusti: **" + giusti + " su " + P.n + "**" + (sbagliati ? ", in più: " + sbagliati : "") + (mancanti.length ? ". Mancavano: " + mancanti.join(", ") : "") + ".", giusti === P.n && !sbagliati ? "ok" : "");
      ctx.suono(giusti === P.n && !sbagliati ? "ok" : "no");
      ctx.dopo(function () {
        ctx.fine({ punti: punti, massimo: P.n, misura: giusti, unita: "prodotti ricordati",
          messaggio: "Avete ricordato **" + giusti + " prodotti su " + P.n + "**" + (sbagliati ? " e ne avete presi " + sbagliati + " in più" : "") + "." +
            (mancanti.length ? " Mancavano: " + mancanti.join(", ") + "." : "") +
            "\n\nUn trucco per la spesa vera: raggruppate i prodotti per reparto (frutta, frigo, dispensa…)." });
      }, 2600);
    }
    ctx.parla("Ecco la lista della spesa. Guardatela con calma per qualche secondo e cercate di ricordare tutti i " + P.n + " prodotti. Quando siete pronti premete «Ho memorizzato».");
    ctx.suggerimento("Provate a immaginare il percorso nel negozio: prima la frutta, poi il frigo, poi la dispensa.");
    ctx.aiutino = function () {
      if (!$(".mj-scaffale", box)) return "Leggete i prodotti ad alta voce: si ricordano meglio.";
      if (sbirciate >= 1) return "Avete già dato un'occhiata alla lista. Fidatevi della vostra memoria!";
      sbirciate++;
      var d = document.createElement("div"); d.className = "mj-sbircia"; d.innerHTML = foglio();
      box.insertBefore(d, box.firstChild);
      ctx.dopo(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3000);
      return "Vi faccio rivedere la lista per tre secondi.";
    };
    memorizza();
  }
  R({ id: "spesa", icona: "🛒", titolo: "La lista della spesa", descrizione: "Ricordate la lista e prendete dagli scaffali i prodotti giusti.",
    categoria: "memoria", durata: "4 minuti", ordine: 30, livelli: 3, livelliTesto: ["3 prodotti", "5 prodotti", "7 prodotti, scaffali simili"], avvia: giocoSpesa });

  /* --------------------------------------------------------------------------
   *  d) Trova le differenze (attenzione)
   * ------------------------------------------------------------------------ */
  var SCENE = [
    { n: "Il giardino", e: ["🌻", "🌷", "🌹", "🌼", "🐝", "🦋", "🐌", "🐞", "🌳", "🍄", "🐦", "🌿"] },
    { n: "Il mare", e: ["🐟", "🐠", "🐚", "⛵", "🦀", "🐙", "🌊", "☀️", "🐬", "⚓", "🏖️", "🦑"] },
    { n: "La cucina", e: ["🍎", "🍐", "🍋", "🍞", "🧀", "🥛", "☕", "🍝", "🍳", "🥄", "🍴", "🍇"] },
    { n: "La città", e: ["🚗", "🚌", "🏠", "🏢", "🚲", "🚦", "⛪", "🌳", "🚕", "🏪", "🚶", "🐕"] },
    { n: "La campagna", e: ["🐄", "🐑", "🐔", "🐴", "🌾", "🚜", "🏡", "🌳", "🐖", "🐓", "🌻", "🐐"] },
    { n: "Il cielo", e: ["☀️", "🌙", "⭐", "☁️", "🌈", "✈️", "🎈", "🐦", "🚁", "⚡", "❄️", "🌧️"] },
    { n: "La festa", e: ["🎈", "🎁", "🎂", "🎉", "🍰", "🎵", "🕯️", "🍬", "🎀", "🥂", "🎶", "🍭"] },
    { n: "Il bosco", e: ["🌲", "🍄", "🦊", "🐿️", "🦉", "🐻", "🌰", "🍂", "🦌", "🐇", "🌳", "🐗"] },
    { n: "La scrivania", e: ["📚", "✏️", "📎", "🖊️", "📒", "💻", "🖱️", "☕", "📏", "✂️", "📌", "🗂️"] },
    { n: "Lo sport", e: ["⚽", "🏀", "🎾", "🚴", "🏊", "⛳", "🏓", "🥇", "🏐", "🎳", "⛷️", "🏆"] }
  ];
  function giocoDifferenze(box, ctx) {
    var P = [{ c: 4, r: 3, d: 3 }, { c: 5, r: 4, d: 4 }, { c: 6, r: 5, d: 6 }][ctx.livello - 1];
    var scena = ctx.pesca(SCENE, 1, function (s) { return s.n; })[0], rnd = ctx.casuale, N = P.c * P.r;
    function a(lista) { return lista[Math.floor(rnd() * lista.length)]; }
    var sx = [];
    for (var i = 0; i < N; i++) sx.push(rnd() < 0.72 ? a(scena.e) : "");
    var dx = sx.slice(), posti = mescola(sx.map(function (x, i) { return i; }), rnd).slice(0, P.d), diff = {};
    posti.forEach(function (i) {
      var v = sx[i];
      if (!v) dx[i] = a(scena.e);
      else if (rnd() < 0.25 && ctx.livello > 1) dx[i] = "";
      else { var altro = v; while (altro === v) altro = a(scena.e); dx[i] = altro; }
      diff[i] = true;
    });
    var trovate = 0, sbagli = 0;
    function griglia(v, lato) {
      return '<div class="mj-scena" style="grid-template-columns:repeat(' + P.c + ',1fr)" role="group" aria-label="Disegno ' + lato + '">' + v.map(function (e, i) {
        return '<button type="button" class="mj-cella" data-i="' + i + '"' + (diff[i] ? ' data-diff="1"' : "") + ' aria-label="Riquadro ' + (Math.floor(i / P.c) + 1) + "-" + (i % P.c + 1) +
          (e ? "" : ", vuoto") + '"><span aria-hidden="true">' + e + "</span></button>";
      }).join("") + "</div>";
    }
    box.innerHTML = '<p class="mj-stato" aria-live="polite"></p><div class="mj-scene"><figure><figcaption>' + esc(scena.n) + " — prima</figcaption>" + griglia(sx, "di sinistra") +
      "</figure><figure><figcaption>" + esc(scena.n) + " — dopo</figcaption>" + griglia(dx, "di destra") + "</figure></div>";
    var stato = $(".mj-stato", box);
    function aggiorna() { stato.textContent = "Differenze trovate: " + trovate + " su " + P.d; }
    $$(".mj-cella", box).forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute("data-i");
        if (!ctx.vivo()) return;
        if (diff[i] === true) {
          diff[i] = "trovata"; trovate++;
          $$(".mj-cella[data-i='" + i + "']", box).forEach(function (c) { c.classList.add("trovata"); c.setAttribute("aria-label", c.getAttribute("aria-label") + ", differenza trovata"); });
          ctx.suono("ok"); ctx.messaggio("✅ Trovata!" + (trovate < P.d ? " Ne mancano " + (P.d - trovate) + "." : ""), "ok");
          aggiorna();
          if (trovate === P.d) ctx.dopo(function () {
            ctx.fine({ punti: Math.max(0, P.d - Math.max(0, sbagli - 2)), massimo: P.d, misura: P.d, unita: "differenze",
              messaggio: "Avete trovato tutte le **" + P.d + " differenze**" + (sbagli ? " (con " + sbagli + " clic su riquadri uguali)" : " senza nessun clic a vuoto") + "." });
          }, 900);
        } else if (diff[i] === "trovata") {
          ctx.messaggio("Questa l'avete già trovata. Cercate le altre!", "info");
        } else {
          sbagli++; ctx.messaggio("Qui i due disegni sono uguali. Guardate con calma, riquadro per riquadro.", "");
          b.classList.remove("no"); void b.offsetWidth; b.classList.add("no");
        }
      };
    });
    aggiorna();
    ctx.parla("Guardate i due disegni: sembrano uguali, ma ci sono " + P.d + " differenze. Quando ne trovate una, cliccate su quel riquadro, in uno dei due disegni.");
    ctx.suggerimento("Confrontate una riga alla volta, da sinistra a destra, come quando si legge.");
    ctx.aiutino = function () {
      var resta = Object.keys(diff).filter(function (k) { return diff[k] === true; })[0];
      if (resta == null) return null;
      var riga = Math.floor(resta / P.c);
      $$(".mj-scena", box).forEach(function (s) {
        $$(".mj-cella", s).forEach(function (c, k) { if (Math.floor(k / P.c) === riga) { c.classList.remove("indica"); void c.offsetWidth; c.classList.add("indica"); } });
      });
      ctx.dopo(function () { $$(".mj-cella.indica", box).forEach(function (c) { c.classList.remove("indica"); }); }, 3500);
      return "Guardate bene la riga numero " + (riga + 1) + ", quella che si illumina.";
    };
  }
  R({ id: "differenze", icona: "🔍", titolo: "Trova le differenze", descrizione: "Due disegni quasi uguali: scoprite che cosa è cambiato.",
    categoria: "attenzione", durata: "5 minuti", ordine: 40, livelli: 3, livelliTesto: ["3 differenze", "4 differenze", "6 differenze"], avvia: giocoDifferenze });

  /* --------------------------------------------------------------------------
   *  e) L'intruso (attenzione e logica)
   *  Ogni gruppo: l = livello minimo, m = membri, i = [intruso, perché], si = che cosa hanno in comune gli altri
   * ------------------------------------------------------------------------ */
  var GRUPPI = [
    { l: 1, si: "sono frutti", m: ["🍎 Mela", "🍐 Pera", "🍌 Banana", "🍊 Arancia", "🍒 Ciliegia", "🍓 Fragola", "🍑 Pesca", "🍇 Uva"], i: [["🥕 Carota", "è una verdura"], ["🥔 Patata", "è un ortaggio"], ["🥦 Broccolo", "è una verdura"]] },
    { l: 1, si: "sono animali della fattoria", m: ["🐄 Mucca", "🐔 Gallina", "🐖 Maiale", "🐑 Pecora", "🐴 Cavallo", "🐐 Capra", "🐇 Coniglio"], i: [["🦁 Leone", "vive nella savana"], ["🦒 Giraffa", "vive nella savana"], ["🐘 Elefante", "vive nella savana o nella foresta"]] },
    { l: 1, si: "sono colori", m: ["Rosso", "Verde", "Giallo", "Blu", "Viola", "Arancione", "Rosa", "Marrone"], i: [["Tavolo", "è un mobile, non un colore"], ["Lunedì", "è un giorno, non un colore"], ["Sedia", "è un mobile, non un colore"]] },
    { l: 1, si: "sono giorni della settimana", m: ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"], i: [["Marzo", "è un mese"], ["Agosto", "è un mese"], ["Primavera", "è una stagione"]] },
    { l: 1, si: "sono mezzi di trasporto", m: ["🚂 Treno", "🚌 Autobus", "🚲 Bicicletta", "🚢 Nave", "✈️ Aereo", "🚋 Tram", "🚗 Automobile"], i: [["Lavatrice", "è un elettrodomestico"], ["Frigorifero", "è un elettrodomestico"], ["Armadio", "è un mobile"]] },
    { l: 1, si: "sono mobili di casa", m: ["Tavolo", "Sedia", "Armadio", "Divano", "Letto", "Comodino", "Libreria", "Poltrona"], i: [["Forchetta", "è una posata"], ["Pentola", "si usa per cucinare"], ["Ombrello", "serve quando piove"]] },
    { l: 1, si: "sono strumenti musicali", m: ["🎻 Violino", "🎸 Chitarra", "🎹 Pianoforte", "🎺 Tromba", "🥁 Tamburo", "Flauto", "Fisarmonica", "Mandolino"], i: [["🔨 Martello", "è un attrezzo da lavoro"], ["Cacciavite", "è un attrezzo da lavoro"], ["Scopa", "serve per pulire"]] },
    { l: 1, si: "sono fiori", m: ["🌹 Rosa", "🌷 Tulipano", "🌼 Margherita", "🌻 Girasole", "Garofano", "Giglio", "Orchidea", "Viola"], i: [["🌲 Pino", "è un albero"], ["Quercia", "è un albero"], ["Basilico", "è un'erba aromatica"]] },
    { l: 1, si: "si indossano", m: ["Camicia", "Pantaloni", "Gonna", "Maglione", "Giacca", "Cappotto", "Sciarpa", "Cappello"], i: [["Cucchiaio", "è una posata"], ["Lampada", "serve per fare luce"], ["Cuscino", "si usa per dormire"]] },
    { l: 1, si: "si bevono", m: ["Acqua", "Latte", "Caffè", "Tè", "Aranciata", "Camomilla", "Succo di frutta", "Vino"], i: [["Pane", "si mangia"], ["Formaggio", "si mangia"], ["Biscotto", "si mangia"]] },
    { l: 1, si: "si usano in cucina", m: ["Pentola", "Padella", "Mestolo", "Colino", "Grattugia", "Tagliere", "Scolapasta"], i: [["Lenzuolo", "si usa per il letto"], ["Pettine", "si usa per i capelli"], ["Spazzolino", "si usa per i denti"]] },
    { l: 1, si: "sono alberi", m: ["Quercia", "Pino", "Abete", "Olivo", "Faggio", "Castagno", "Betulla", "Pioppo"], i: [["Margherita", "è un fiore"], ["Prezzemolo", "è un'erba aromatica"], ["Tulipano", "è un fiore"]] },
    { l: 2, si: "sono capitali di Stati europei", m: ["Roma", "Parigi", "Madrid", "Berlino", "Lisbona", "Vienna", "Atene", "Londra"], i: [["Toscana", "è una regione italiana"], ["Sicilia", "è una regione italiana"], ["Lombardia", "è una regione italiana"]] },
    { l: 2, si: "sono regioni italiane", m: ["Toscana", "Umbria", "Puglia", "Calabria", "Veneto", "Piemonte", "Liguria", "Sardegna"], i: [["Firenze", "è una città (il capoluogo della Toscana)"], ["Napoli", "è una città"], ["Torino", "è una città"]] },
    { l: 2, si: "sono fiumi italiani", m: ["Po", "Tevere", "Arno", "Adige", "Piave", "Volturno", "Ticino", "Brenta"], i: [["Garda", "è un lago"], ["Etna", "è un vulcano"], ["Cervino", "è una montagna"]] },
    { l: 2, si: "sono pianeti", m: ["Mercurio", "Venere", "Terra", "Marte", "Giove", "Saturno", "Urano", "Nettuno"], i: [["Luna", "è un satellite della Terra"], ["Sole", "è una stella"]] },
    { l: 2, si: "sono uccelli", m: ["Passero", "Rondine", "Aquila", "Gabbiano", "Merlo", "Pettirosso", "Cigno", "Gufo"], i: [["Pipistrello", "vola, ma è un mammifero"], ["Farfalla", "vola, ma è un insetto"], ["Ape", "vola, ma è un insetto"]] },
    { l: 2, si: "sono numeri pari", m: ["2", "4", "6", "8", "10", "12", "14", "16", "18", "20"], i: [["7", "è un numero dispari"], ["9", "è un numero dispari"], ["15", "è un numero dispari"]] },
    { l: 2, si: "sono verdure", m: ["Carota", "Zucchina", "Melanzana", "Spinaci", "Lattuga", "Cavolfiore", "Sedano", "Carciofo"], i: [["Ciliegia", "è un frutto"], ["Fragola", "è un frutto"], ["Albicocca", "è un frutto"]] },
    { l: 2, si: "sono formaggi", m: ["Parmigiano", "Mozzarella", "Gorgonzola", "Pecorino", "Ricotta", "Fontina", "Asiago", "Provolone"], i: [["Prosciutto", "è un salume"], ["Mortadella", "è un salume"], ["Salame", "è un salume"]] },
    { l: 2, si: "si giocano con una palla", m: ["Calcio", "Pallavolo", "Tennis", "Pallacanestro", "Rugby", "Golf", "Ping pong", "Pallanuoto"], i: [["Nuoto", "non si usa la palla"], ["Ciclismo", "non si usa la palla"], ["Sci", "non si usa la palla"]] },
    { l: 2, si: "fanno parte del mondo del computer", m: ["Mouse", "Tastiera", "Monitor", "Stampante", "Tablet", "Smartphone", "Chiavetta USB"], i: [["Tostapane", "è un elettrodomestico"], ["Ferro da stiro", "è un elettrodomestico"], ["Frullatore", "è un elettrodomestico"]] },
    { l: 2, si: "sono feste dell'anno", m: ["Natale", "Pasqua", "Capodanno", "Ferragosto", "Epifania", "Carnevale"], i: [["Autunno", "è una stagione"], ["Inverno", "è una stagione"]] },
    { l: 2, si: "sono mari che bagnano l'Italia", m: ["Mar Tirreno", "Mar Adriatico", "Mar Ionio", "Mar Ligure", "Mar di Sardegna"], i: [["Lago Maggiore", "è un lago"], ["Lago di Como", "è un lago"]] },
    { l: 3, si: "erano compositori", m: ["Verdi", "Puccini", "Rossini", "Vivaldi", "Donizetti", "Bellini", "Monteverdi", "Mascagni"], i: [["Leopardi", "era un poeta"], ["Manzoni", "era uno scrittore"], ["Caravaggio", "era un pittore"]] },
    { l: 3, si: "erano pittori", m: ["Giotto", "Raffaello", "Caravaggio", "Botticelli", "Tiziano", "Mantegna", "Canaletto", "Modigliani"], i: [["Galileo", "era uno scienziato"], ["Dante", "era un poeta"], ["Puccini", "era un compositore"]] },
    { l: 3, si: "erano scrittori o poeti", m: ["Dante", "Petrarca", "Boccaccio", "Manzoni", "Leopardi", "Pascoli", "Carducci", "Ungaretti"], i: [["Verdi", "era un compositore"], ["Giotto", "era un pittore"], ["Marconi", "era un inventore"]] },
    { l: 3, si: "sono mammiferi", m: ["Balena", "Delfino", "Pipistrello", "Cane", "Gatto", "Cavallo", "Topo", "Mucca"], i: [["Squalo", "è un pesce"], ["Pinguino", "è un uccello"], ["Coccodrillo", "è un rettile"]] },
    { l: 3, si: "sono capoluoghi di regione", m: ["Milano", "Torino", "Genova", "Bologna", "Firenze", "Bari", "Palermo", "Cagliari", "Perugia", "Ancona"], i: [["Rimini", "non è un capoluogo di regione"], ["Taranto", "non è un capoluogo di regione"], ["Pisa", "non è un capoluogo di regione"]] },
    { l: 3, si: "sono multipli di 3", m: ["3", "6", "9", "12", "15", "18", "21", "24", "27", "30"], i: [["10", "non è un multiplo di 3"], ["14", "non è un multiplo di 3"], ["20", "non è un multiplo di 3"], ["25", "non è un multiplo di 3"]] },
    { l: 3, si: "sono isole italiane", m: ["Capri", "Ischia", "Elba", "Lampedusa", "Procida", "Stromboli", "Giglio", "Favignana"], i: [["Corsica", "è un'isola francese"], ["Malta", "è uno Stato indipendente"]] },
    { l: 3, si: "sono laghi italiani", m: ["Garda", "Maggiore", "Como", "Trasimeno", "Bolsena", "Iseo", "Bracciano", "Orta"], i: [["Arno", "è un fiume"], ["Tevere", "è un fiume"], ["Adige", "è un fiume"]] },
    { l: 3, si: "misurano la lunghezza", m: ["Metro", "Centimetro", "Chilometro", "Millimetro", "Decimetro"], i: [["Litro", "misura i liquidi"], ["Chilogrammo", "misura il peso"], ["Grado", "misura la temperatura o gli angoli"]] },
    { l: 3, si: "sono strumenti a fiato", m: ["Flauto", "Tromba", "Clarinetto", "Sassofono", "Oboe", "Trombone", "Fagotto"], i: [["Violino", "ha le corde"], ["Arpa", "ha le corde"], ["Chitarra", "ha le corde"]] },
    { l: 3, si: "hanno 31 giorni", m: ["Gennaio", "Marzo", "Maggio", "Luglio", "Agosto", "Ottobre", "Dicembre"], i: [["Aprile", "ha 30 giorni"], ["Giugno", "ha 30 giorni"], ["Settembre", "ha 30 giorni"], ["Novembre", "ha 30 giorni"]] },
    { l: 3, si: "sono vulcani italiani", m: ["Etna", "Vesuvio", "Stromboli", "Vulcano", "Campi Flegrei"], i: [["Gran Sasso", "è una montagna, non un vulcano"], ["Monte Bianco", "è una montagna, non un vulcano"]] },
    { l: 3, si: "sono frutta secca", m: ["Noci", "Mandorle", "Nocciole", "Pistacchi", "Pinoli", "Arachidi"], i: [["Ciliegie", "sono frutta fresca"], ["Mirtilli", "sono frutta fresca"]] }
  ];
  function giocoIntruso(box, ctx) {
    var K = [4, 5, 6][ctx.livello - 1], TURNI = 6;
    var adatti = GRUPPI.filter(function (g) { return g.m.length >= K - 1 && (ctx.livello === 1 ? g.l === 1 : ctx.livello === 2 ? g.l <= 2 : g.l >= 2); });
    var turni = ctx.pesca(adatti, TURNI, function (g) { return g.si; }), t = 0, punti = 0, prima = true, tolti = 0;
    function turno() {
      var g = turni[t], intr = g.i[Math.floor(ctx.casuale() * g.i.length)];
      var el = mescola(mescola(g.m, ctx.casuale).slice(0, K - 1).concat([intr[0]]), ctx.casuale);
      prima = true; tolti = 0;
      box.innerHTML = '<p class="mj-stato">Gruppo ' + (t + 1) + " di " + turni.length + '</p><div class="mj-gruppo k' + K + '">' + el.map(function (x) {
        return '<button type="button" class="mj-voce"' + (x === intr[0] ? ' data-intruso="1"' : "") + ">" + esc(x) + "</button>";
      }).join("") + '</div><div class="mj-spiega" aria-live="polite"></div>';
      ctx.messaggio("", "");
      $$(".mj-voce", box).forEach(function (b) {
        b.onclick = function () {
          if (b.disabled) return;
          if (b.getAttribute("data-intruso")) {
            if (prima) punti++;
            $$(".mj-voce", box).forEach(function (c) { c.disabled = true; });
            b.classList.add("right"); ctx.suono("ok");
            var nome = intr[0].replace(/^[^A-Za-zÀ-ÿ0-9]+/, "");
            var sp = $(".mj-spiega", box);
            sp.innerHTML = '<div class="explain"><b>' + (prima ? "✅ Giusto!" : "✅ Ecco l'intruso.") + "</b> «" + esc(nome) + "» " + esc(intr[1]) + ": gli altri " + esc(g.si) + ".</div>" +
              '<div class="row mj-centro"><button type="button" class="btn big mj-avanti">' + (t + 1 < turni.length ? "Avanti ▶" : "Vedi il risultato ▶") + "</button></div>";
            if (PD.settings.voice) PD.speak((prima ? "Giusto! " : "") + nome + " " + intr[1] + ": gli altri " + g.si + ".");
            var av = $(".mj-avanti", box);
            av.onclick = function () { t++; if (t < turni.length) turno(); else fine(); };
            try { av.focus(); } catch (e) { /* ignora */ }
          } else {
            prima = false; b.disabled = true; b.classList.add("wrong"); ctx.suono("no");
            ctx.messaggio("«" + b.textContent.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "") + "» sta bene con gli altri. Cercate quello diverso.", "");
          }
        };
      });
      ctx.suggerimento("Un indizio: quasi tutti " + g.si + ". Quale no?");
    }
    function fine() {
      ctx.fine({ punti: punti, massimo: turni.length, misura: punti, unita: "intrusi al primo colpo",
        messaggio: "Avete scoperto **" + punti + " intrusi su " + turni.length + "** al primo tentativo." });
    }
    ctx.aiutino = function () {
      var no = $$(".mj-voce:not([data-intruso]):not([disabled])", box);
      if (no.length > 1 && tolti < K - 3) {
        var x = no[Math.floor(Math.random() * no.length)]; x.disabled = true; x.classList.add("tolto"); tolti++;
        return "Ho tolto «" + x.textContent.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "") + "»: quello non è l'intruso.";
      }
      return null;
    };
    ctx.parla("In ogni gruppo c'è un intruso: una parola che non c'entra con le altre. Cliccate su quella che secondo voi è diversa. Sono " + turni.length + " gruppi.");
    turno();
  }
  R({ id: "intruso", icona: "🕵️", titolo: "Trova l'intruso", descrizione: "In ogni gruppo una parola non c'entra: scopritela e capite perché.",
    categoria: "logica", durata: "5 minuti", ordine: 50, livelli: 3, livelliTesto: ["gruppi di 4", "gruppi di 5", "gruppi di 6, più sottili"], avvia: giocoIntruso });

  /* --------------------------------------------------------------------------
   *  f) Il resto giusto (calcolo) - prezzi di fantasia, solo per esercizio
   * ------------------------------------------------------------------------ */
  var ARTICOLI = [
    ["pane", "🥖", 120, 250, "in panetteria"], ["cornetto", "🥐", 100, 160, "al bar"], ["cappuccino", "☕", 130, 180, "al bar"], ["latte", "🥛", 110, 170, "al negozio di alimentari"],
    ["uova", "🥚", 180, 320, "al negozio di alimentari"], ["mele", "🍎", 150, 280, "al mercato"], ["pomodori", "🍅", 150, 300, "al mercato"], ["insalata", "🥬", 90, 180, "al mercato"],
    ["patate", "🥔", 120, 250, "al mercato"], ["banane", "🍌", 140, 250, "al mercato"], ["arance", "🍊", 150, 300, "al mercato"], ["caffè", "☕", 250, 450, "al supermercato"],
    ["zucchero", "🍬", 90, 150, "al supermercato"], ["pasta", "🍝", 80, 180, "al supermercato"], ["biscotti", "🍪", 150, 300, "al supermercato"], ["riso", "🍚", 150, 300, "al supermercato"],
    ["olio", "🧴", 600, 1100, "al supermercato"], ["formaggio", "🧀", 300, 600, "al negozio di alimentari"], ["mozzarella", "🧀", 100, 250, "al negozio di alimentari"],
    ["prosciutto", "🥓", 250, 500, "al negozio di alimentari"], ["giornale", "📰", 150, 200, "in edicola"], ["rivista", "📖", 200, 450, "in edicola"], ["quaderno", "📒", 100, 250, "in cartoleria"],
    ["penna", "🖊️", 80, 200, "in cartoleria"], ["busta di lettere", "✉️", 150, 300, "in cartoleria"], ["mazzo di fiori", "💐", 500, 1200, "dal fioraio"], ["piantina", "🌱", 300, 800, "dal fioraio"],
    ["pesce", "🐟", 600, 1500, "in pescheria"], ["pollo", "🍗", 500, 900, "in macelleria"], ["sapone", "🧼", 120, 250, "al supermercato"], ["pile", "🔋", 300, 600, "in ferramenta"],
    ["lampadina", "💡", 250, 500, "in ferramenta"], ["gelato", "🍦", 200, 350, "in gelateria"], ["torta", "🎂", 800, 1600, "in pasticceria"], ["pasticcini", "🧁", 400, 900, "in pasticceria"]
  ];
  var TAGLI = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5];
  function taglioHTML(c, attr) {
    var banconota = c >= 500;
    return '<button type="button" class="mj-soldo ' + (banconota ? "banconota b" + c / 100 : "moneta m" + c) + '" data-c="' + c + '"' + (attr || "") +
      ' aria-label="' + (banconota ? "banconota da " + c / 100 + " euro" : c >= 100 ? "moneta da " + (c / 100) + " euro" : "moneta da " + c + " centesimi") + '">' +
      (banconota ? c / 100 + " €" : c >= 100 ? c / 100 + " €" : c + "<small>cent</small>") + "</button>";
  }
  function giocoResto(box, ctx) {
    var P = [
      { n: [1, 2], arr: 50, carte: [500, 1000], tagli: [500, 200, 100, 50], tot: true },
      { n: [2, 2], arr: 10, carte: [500, 1000, 2000], tagli: [1000, 500, 200, 100, 50, 20, 10], tot: false },
      { n: [2, 3], arr: 5, carte: [1000, 2000, 5000], tagli: [2000, 1000, 500, 200, 100, 50, 20, 10, 5], tot: false }
    ][ctx.livello - 1];
    var TURNI = 5, t = 0, punti = 0, tentativi = 0, dato = [], cur = null;
    function nuovo() {
      var n = P.n[0] + Math.floor(ctx.casuale() * (P.n[1] - P.n[0] + 1));
      var negozi = {};
      ARTICOLI.forEach(function (x) { (negozi[x[4]] = negozi[x[4]] || []).push(x); });
      var adatti = Object.keys(negozi).filter(function (k) { return negozi[k].length >= n; });
      var negozio = adatti[Math.floor(ctx.casuale() * adatti.length)];
      var scelti = ctx.pesca(negozi[negozio], n, function (x) { return x[0]; });
      var voci = scelti.map(function (a) {
        var p = a[2] + Math.floor(ctx.casuale() * (a[3] - a[2]));
        p = Math.max(P.arr, Math.round(p / P.arr) * P.arr);
        if (ctx.livello === 1) p = Math.min(p, 450);
        return { n: a[0], e: a[1], p: p };
      });
      var tot = voci.reduce(function (s, v) { return s + v.p; }, 0);
      var paga = P.carte.filter(function (c) { return c > tot; })[0];
      if (!paga) { voci = voci.slice(0, 1); tot = voci[0].p; paga = P.carte.filter(function (c) { return c > tot; })[0] || 5000; }
      return { voci: voci, tot: tot, paga: paga, resto: paga - tot, negozio: negozio };
    }
    function elenco(v) {
      if (v.length === 1) return v[0].n + " a " + euro(v[0].p);
      return v.slice(0, -1).map(function (x) { return x.n + " a " + euro(x.p); }).join(", ") + " e " + v[v.length - 1].n + " a " + euro(v[v.length - 1].p);
    }
    function elencoVoce(v) {
      return v.map(function (x) { return x.n + " a " + euroVoce(x.p); }).join(", ");
    }
    function turno() {
      cur = nuovo(); dato = []; tentativi = 0;
      box.innerHTML = '<p class="mj-stato">Conto ' + (t + 1) + " di " + TURNI + "</p>" +
        '<div class="mj-resto-scena"><div class="mj-scontrino"><div class="mj-scontrino-tit">' + esc(cur.negozio.charAt(0).toUpperCase() + cur.negozio.slice(1)) + "</div>" +
        cur.voci.map(function (v) { return '<div class="mj-riga"><span>' + v.e + " " + esc(v.n) + "</span><b>" + euro(v.p) + "</b></div>"; }).join("") +
        (P.tot ? '<div class="mj-riga mj-tot"><span>Totale</span><b>' + euro(cur.tot) + "</b></div>" : '<div class="mj-riga mj-tot"><span>Totale</span><b>?</b></div>') +
        '<div class="mj-riga"><span>Pagate con</span><b>' + euro(cur.paga) + "</b></div></div>" +
        '<div class="mj-cassa"><p class="mj-domanda">Quanto resto vi devono dare? Componetelo con monete e banconote.</p>' +
        '<div class="mj-vassoio" data-giusto="' + cur.resto + '" aria-live="polite"><span class="mj-vassoio-vuoto">Il resto: cliccate i soldi qui sotto</span></div>' +
        '<p class="mj-somma">Avete messo: <b>0,00 €</b></p>' +
        '<div class="mj-cassetto">' + P.tagli.map(function (c) { return taglioHTML(c); }).join("") + "</div>" +
        '<div class="row mj-centro"><button type="button" class="btn ghost mj-svuota">↩ Svuota</button><button type="button" class="btn big mj-ecco">💶 Ecco il resto</button></div></div></div>';
      $$(".mj-cassetto .mj-soldo", box).forEach(function (b) { b.onclick = function () { dato.push(+b.getAttribute("data-c")); disegna(); }; });
      $(".mj-svuota", box).onclick = function () { dato = []; disegna(); };
      $(".mj-ecco", box).onclick = verifica;
      ctx.messaggio("", "");
      ctx.parla("Avete comprato " + elencoVoce(cur.voci) + ". Pagate con " + euroVoce(cur.paga) + ". Quanto resto vi spetta? Componetelo cliccando su monete e banconote, poi premete «Ecco il resto».");
      ctx.suggerimento(P.tot ? "Partite dal totale, " + euro(cur.tot) + ", e contate in avanti fino a " + euro(cur.paga) + ", come fanno i negozianti."
        : "Prima sommate i prezzi per sapere il totale; poi contate in avanti fino a " + euro(cur.paga) + ".");
    }
    function disegna() {
      var v = $(".mj-vassoio", box), s = dato.reduce(function (a, b) { return a + b; }, 0);
      v.innerHTML = dato.length ? dato.map(function (c, i) { return taglioHTML(c, ' data-k="' + i + '" title="Togli"'); }).join("") : '<span class="mj-vassoio-vuoto">Il resto: cliccate i soldi qui sotto</span>';
      $$(".mj-soldo", v).forEach(function (b) { b.onclick = function () { dato.splice(+b.getAttribute("data-k"), 1); disegna(); }; });
      $(".mj-somma b", box).textContent = euro(s);
    }
    function verifica() {
      var s = dato.reduce(function (a, b) { return a + b; }, 0);
      if (!dato.length) { ctx.messaggio("Il vassoio è vuoto: cliccate sulle monete e sulle banconote per comporre il resto.", "info"); return; }
      tentativi++;
      if (s === cur.resto) {
        if (tentativi === 1) punti++;
        ctx.suono("ok");
        fineTurno("✅ Giusto! Il conto era " + euro(cur.tot) + " e il resto **" + euro(cur.resto) + "**.", "ok");
      } else {
        ctx.suono("no");
        if (tentativi >= 2) fineTurno("Il conto era " + euro(cur.tot) + ": da " + euro(cur.tot) + " a " + euro(cur.paga) + " il resto giusto è **" + euro(cur.resto) + "**. Va bene così, il prossimo andrà meglio!", "");
        else ctx.messaggio("Avete messo " + euro(s) + ": " + (s > cur.resto ? "è un po' troppo" : "è un po' poco") + ". Ricontrollate con calma e riprovate.", "");
      }
    }
    function fineTurno(testo, tipo) {
      ctx.messaggio(testo, tipo);
      $$(".mj-cassa button", box).forEach(function (b) { b.disabled = true; });
      var r = document.createElement("div"); r.className = "row mj-centro";
      r.innerHTML = '<button type="button" class="btn big mj-avanti">' + (t + 1 < TURNI ? "Avanti ▶" : "Vedi il risultato ▶") + "</button>";
      $(".mj-cassa", box).appendChild(r);
      var av = $(".mj-avanti", box);
      av.onclick = function () {
        t++;
        if (t < TURNI) { turno(); return; }
        ctx.fine({ punti: punti, massimo: TURNI, misura: punti, unita: "resti giusti al primo colpo",
          messaggio: "Avete dato il resto giusto al primo tentativo **" + punti + " volte su " + TURNI + "**.\n\nNella vita reale contate sempre il resto con calma, anche davanti alla cassa: è un vostro diritto." });
      };
      try { av.focus(); } catch (e) { /* ignora */ }
    }
    turno();
  }
  R({ id: "resto", icona: "💶", titolo: "Il resto giusto", descrizione: "Al mercato e nei negozi: calcolate il resto e componetelo con monete e banconote.",
    categoria: "calcolo", durata: "6 minuti", ordine: 60, livelli: 3, livelliTesto: ["prezzi tondi, totale scritto", "due prodotti, centesimi", "tre prodotti, tutte le monete"], avvia: giocoResto });

  /* --------------------------------------------------------------------------
   *  g) Che ore sono? (logica e attenzione) - orologio a lancette in SVG
   * ------------------------------------------------------------------------ */
  var NUMERI = ["dodici", "una", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici"];
  var MINUTI = { 5: "cinque", 10: "dieci", 20: "venti", 25: "venticinque" };
  function ore(h) { h = ((h % 12) + 12) % 12; return h === 1 ? "l'una" : "le " + NUMERI[h]; }
  function oraParole(h, m) {
    if (m === 0) return ore(h) + " in punto";
    if (m === 15) return ore(h) + " e un quarto";
    if (m === 30) return ore(h) + " e mezza";
    if (m === 45) return ore(h + 1) + " meno un quarto";
    if (m < 30) return ore(h) + " e " + MINUTI[m];
    return ore(h + 1) + " meno " + MINUTI[60 - m];
  }
  function oraCifre(h, m) { return (h === 0 ? 12 : h) + ":" + due(m); }
  function orologioSVG(h, m, cls) {
    var s = '<svg class="mj-orologio ' + (cls || "") + '" viewBox="0 0 200 200" role="img" aria-label="Orologio a lancette">' +
      '<circle cx="100" cy="100" r="94" class="mj-quadrante"/><circle cx="100" cy="100" r="94" class="mj-bordo"/>';
    for (var i = 0; i < 60; i++) {
      var a = i * Math.PI / 30, lungo = i % 5 === 0, r1 = lungo ? 78 : 84;
      s += '<line x1="' + (100 + r1 * Math.sin(a)).toFixed(1) + '" y1="' + (100 - r1 * Math.cos(a)).toFixed(1) + '" x2="' + (100 + 88 * Math.sin(a)).toFixed(1) +
        '" y2="' + (100 - 88 * Math.cos(a)).toFixed(1) + '" class="' + (lungo ? "mj-tacca-l" : "mj-tacca") + '"/>';
    }
    for (var n = 1; n <= 12; n++) {
      var b = n * Math.PI / 6;
      s += '<text x="' + (100 + 64 * Math.sin(b)).toFixed(1) + '" y="' + (100 - 64 * Math.cos(b) + 7).toFixed(1) + '" class="mj-num">' + n + "</text>";
    }
    var am = m * 6, ah = (h % 12) * 30 + m * 0.5;
    s += '<line x1="100" y1="100" x2="100" y2="50" class="mj-lancetta-ore" transform="rotate(' + ah + ' 100 100)"/>' +
      '<line x1="100" y1="112" x2="100" y2="22" class="mj-lancetta-min" transform="rotate(' + am + ' 100 100)"/>' +
      '<circle cx="100" cy="100" r="6" class="mj-perno"/></svg>';
    return s;
  }
  function giocoOrologio(box, ctx) {
    var P = [{ min: [0, 30], k: 3 }, { min: [0, 15, 30, 45], k: 4 }, { min: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], k: 4 }][ctx.livello - 1];
    var TURNI = 6, t = 0, punti = 0, prima = true, usate = {};
    function a(l) { return l[Math.floor(ctx.casuale() * l.length)]; }
    function nuovaOra() {
      for (var x = 0; x < 50; x++) { var h = 1 + Math.floor(ctx.casuale() * 12), m = a(P.min); if (!usate[h + ":" + m]) { usate[h + ":" + m] = 1; return [h, m]; } }
      return [3, 0];
    }
    function distrattori(h, m) {
      var c = [[h, (m + 30) % 60], [h % 12 + 1, m], [(h + 10) % 12 + 1, m], [m === 0 ? 12 : m / 5, (h % 12) * 5]];
      if (P.min.length > 2) c.push([h, (m + 15) % 60], [h, (m + 45) % 60]);
      if (P.min.length > 4) c.push([h, (m + 5) % 60], [h, (m + 55) % 60], [h % 12 + 1, (60 - m) % 60]);
      c = c.map(function (x) { return [x[0] === 0 ? 12 : x[0], x[1]]; }).filter(function (x) { return P.min.indexOf(x[1]) >= 0 && !(x[0] === h && x[1] === m) && x[0] >= 1 && x[0] <= 12 && x[0] === Math.floor(x[0]); });
      var vis = {}, out = [];
      mescola(c, ctx.casuale).forEach(function (x) { var k = oraParole(x[0], x[1]); if (!vis[k] && k !== oraParole(h, m)) { vis[k] = 1; out.push(x); } });
      while (out.length < P.k - 1) { var y = [1 + Math.floor(ctx.casuale() * 12), a(P.min)], ky = oraParole(y[0], y[1]); if (!vis[ky] && ky !== oraParole(h, m)) { vis[ky] = 1; out.push(y); } }
      return out.slice(0, P.k - 1);
    }
    function turno() {
      var giusta = nuovaOra(), h = giusta[0], m = giusta[1], opz = mescola([giusta].concat(distrattori(h, m)), ctx.casuale);
      var contrario = t % 2 === 1 && ctx.livello > 1 || (ctx.livello === 1 && (t === 2 || t === 5));
      prima = true;
      if (!contrario) {
        box.innerHTML = '<p class="mj-stato">Orologio ' + (t + 1) + " di " + TURNI + '</p><div class="mj-ora-scena"><div class="mj-ora-grande">' + orologioSVG(h, m) + "</div>" +
          '<div class="mj-opzioni">' + opz.map(function (o) {
            return '<button type="button" class="quiz-opt mj-opz"' + (o === giusta ? ' data-giusta="1"' : "") + ">" + esc(oraParole(o[0], o[1])) + "</button>";
          }).join("") + "</div></div>";
        ctx.parla("Che ore segna l'orologio? Scegliete la risposta giusta.");
      } else {
        box.innerHTML = '<p class="mj-stato">Orologio ' + (t + 1) + " di " + TURNI + '</p><p class="mj-domanda-ora">Quale orologio segna <b>' + esc(oraParole(h, m)) + "</b>?</p>" +
          '<div class="mj-orologi k' + opz.length + '">' + opz.map(function (o, i) {
            return '<button type="button" class="mj-opz mj-opz-or"' + (o === giusta ? ' data-giusta="1"' : "") + ' aria-label="Orologio ' + (i + 1) + '">' + orologioSVG(o[0], o[1], "piccolo") +
              "<span>" + (i + 1) + "</span></button>";
          }).join("") + "</div>";
        ctx.parla("Quale orologio segna " + oraParole(h, m) + "? Cliccate sull'orologio giusto.");
      }
      ctx.suggerimento("La lancetta corta e spessa indica le ore; quella lunga indica i minuti: in alto (sul 12) è «in punto», in basso (sul 6) è «e mezza»" +
        (ctx.livello > 1 ? ", sul 3 è «e un quarto», sul 9 è «meno un quarto»" : "") + (ctx.livello > 2 ? ". Ogni numero vale 5 minuti." : "."));
      ctx.messaggio("", "");
      $$(".mj-opz", box).forEach(function (b) {
        b.onclick = function () {
          if (b.disabled) return;
          if (b.getAttribute("data-giusta")) {
            if (prima) punti++;
            ctx.suono("ok");
            $$(".mj-opz", box).forEach(function (c) { c.disabled = true; });
            b.classList.add("right");
            var r = document.createElement("div");
            var hm = h % 12;
            r.innerHTML = '<div class="explain">✅ ' + (prima ? "Giusto! " : "") + "Sono <b>" + esc(oraParole(h, m)) + "</b>. Sull'orologio digitale si legge <b>" + oraCifre(hm, m) +
              "</b> (di notte o di mattina) oppure <b>" + (hm + 12) + ":" + due(m) + "</b> (di pomeriggio o di sera).</div>" +
              '<div class="row mj-centro"><button type="button" class="btn big mj-avanti">' + (t + 1 < TURNI ? "Avanti ▶" : "Vedi il risultato ▶") + "</button></div>";
            box.appendChild(r);
            var av = $(".mj-avanti", box);
            av.onclick = function () {
              t++;
              if (t < TURNI) turno();
              else ctx.fine({ punti: punti, massimo: TURNI, misura: punti, unita: "orologi letti al primo colpo",
                messaggio: "Avete letto giusto al primo tentativo **" + punti + " orologi su " + TURNI + "**." });
            };
            try { av.focus(); } catch (e) { /* ignora */ }
          } else {
            prima = false; b.disabled = true; b.classList.add("wrong"); ctx.suono("no");
            ctx.messaggio("Non è questa. Guardate prima la lancetta corta (le ore), poi quella lunga (i minuti).", "");
          }
        };
      });
    }
    ctx.aiutino = function () {
      $$(".mj-lancetta-ore", box).forEach(function (l) { l.classList.remove("evidenzia"); void l.getBoundingClientRect(); l.classList.add("evidenzia"); });
      return null;
    };
    turno();
  }
  R({ id: "orologio", icona: "🕰️", titolo: "Che ore sono?", descrizione: "Leggete l'ora sull'orologio a lancette, e scegliete l'orologio giusto.",
    categoria: "logica", durata: "4 minuti", ordine: 70, livelli: 3, livelliTesto: ["in punto e mezza", "anche i quarti d'ora", "ogni 5 minuti"], avvia: giocoOrologio });

  /* per i test: orologio e parole dell'ora */
  PD.mente.aiuti.oraParole = oraParole;
})();
