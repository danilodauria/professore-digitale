/* ==============================================================================
 *  PROFESSORE DIGITALE - Voce e microfono su telefoni e tablet (3.5)
 *  1) «👋 Toccate qui per cominciare»: i browser dei telefoni (Chrome per Android, Safari per iPhone e iPad)
 *     non lasciano parlare la pagina finché non la si tocca. Se la voce non può partire, un grande invito chiede
 *     UN tocco: sblocca la sintesi vocale, l'audio e l'AudioContext, poi il Professore dice quello che voleva dire.
 *     Sul PC, se il saluto parte, non cambia nulla.
 *  2) «🎤 Parla con la voce»: nell'app per telefono e tablet (PWA) e sui tablet collegati al PC dell'aula non c'è la
 *     trascrizione locale del PC. Lì si può usare il riconoscimento vocale del browser (Web Speech API), che su Android
 *     e su iPhone/iPad manda la voce ai server di Google o di Apple: per questo è SPENTO finché l'utente non lo accende
 *     dopo una spiegazione onesta (impostazione micTelefono). Sul PC con il server resta la trascrizione locale.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, esc = PD.esc;

  /* Indirizzo dell'app sul sito (= BASE_URL di rilascio.conf + "/app/"): sui tablet collegati in http il microfono
   * funziona solo con l'app. Si può cambiare definendo window.PD_SITO_APP prima di questo file. */
  var SITO_APP = window.PD_SITO_APP || "https://danilodauria.github.io/professore-digitale/app/";

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignora */ } }
  function attiva() { return navigator.userActivation ? navigator.userActivation.hasBeenActive : null; }

  /* ===================================================================== 1. SBLOCCO DELLA VOCE */
  var sbloccata = false;         // in questa pagina l'audio è stato sbloccato da un tocco
  var invito = null;             // { el, riprova } mentre l'invito è a schermo
  var silenzio = null, actx = null;

  function wavSilenzioso() {
    if (silenzio) return silenzio;
    try { silenzio = URL.createObjectURL(PD.recorder.encodeWav(new Float32Array(800), 8000)); } catch (e) { silenzio = ""; }
    return silenzio;
  }
  /* Da chiamare DENTRO un tocco o un clic: è il gesto dell'utente che dà il permesso al browser. */
  PD.sbloccaAudio = function () {
    sbloccata = true; ssSet("pd.voceSbloccata", "1");
    var ss = window.speechSynthesis;
    if (ss && window.SpeechSynthesisUtterance) {
      try {
        if (ss.paused) ss.resume();
        if (!ss.speaking && !ss.pending) {   // un'enunciazione vuota e muta: da qui in poi iOS e Android lasciano parlare
          var u = new window.SpeechSynthesisUtterance(" ");
          u.volume = 0; u.lang = "it-IT";
          ss.speak(u);
        }
      } catch (e) { /* ignora */ }
    }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        if (!actx) actx = new Ctx();
        if (actx.state === "suspended" && actx.resume) actx.resume();
        var b = actx.createBuffer(1, 1, 22050), s = actx.createBufferSource();
        s.buffer = b; s.connect(actx.destination); if (s.start) s.start(0);
      }
    } catch (e) { /* ignora */ }
    var a = PD.lettoreAudio && PD.lettoreAudio();   // l'elemento audio della voce del server (tablet), solo sui telefoni
    if (a && a.paused && !a.getAttribute("src") && wavSilenzioso()) {
      try { a.src = wavSilenzioso(); var p = a.play(); if (p && p.catch) p.catch(function () { /* ignora */ }); } catch (e) { /* ignora */ }
    }
  };
  /* parlaFrase (app.js): dopo 1,5 s di silenzio serve un tocco? Solo se nessuno ha ancora sbloccato la voce e
   * (telefono, oppure pagina mai toccata). Sul PC già usato non disturba mai. */
  PD.voceDaSbloccare = function () {
    if (sbloccata) return false;
    var a = attiva();
    return PD.mobile || a === false;
  };
  /* la voce è partita: se l'invito era comparso per una voce solo lenta, sparisce da solo */
  PD.voceSbloccata = function () { if (invito && !invito.toccato) chiudiInvito(); };

  /* PD.speak (app.js) non è riuscito a parlare: invito grande, oppure (se l'invito si è già visto in questa sessione)
   * un avviso piccolo e la voce riparte al prossimo tocco. */
  PD.voceBloccata = function (riprova, esito) {
    if (invito) { invito.riprova = riprova; return; }
    if (sbloccata && esito === "muta") return;
    if (sbloccata || ssGet("pd.invitoVisto") === "1") {
      PD.toast((PD.mobile ? "🔊 Toccate lo schermo" : "🔊 Fate clic sulla pagina") + " per sentire il Professore.", 4000);
      alPrimoGesto(riprova);
      return;
    }
    PD.invitoVoce(riprova);
  };
  var attesaGesto = null;
  function alPrimoGesto(fn) {
    attesaGesto = fn;
  }

  PD.invitoVoce = function (riprova) {
    if (invito) { invito.riprova = riprova; return; }
    ssSet("pd.invitoVisto", "1");
    var tocco = PD.mobile, el = document.createElement("div");
    el.className = "pd-tocca"; el.id = "pd-tocca";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "pd-tocca-tit");
    var neura = !!(PD.neura && PD.neura.attiva());     // 3.6: in Nonni Teach parla Neura
    el.innerHTML = '<button type="button" class="pd-tocca-btn" id="pd-tocca-btn">' +
      (neura ? '<canvas class="neura-tocca" width="150" height="150" aria-hidden="true"></canvas>' : '<svg class="prof riposo" aria-hidden="true"><use href="#prof-svg"/></svg>') +
      '<span class="pd-tocca-tit" id="pd-tocca-tit">👋 ' + (tocco ? "Toccate qui per cominciare" : "Fate clic qui per cominciare") + "</span>" +
      '<span class="pd-tocca-sub">' + (neura ? "Così Neura può parlarvi con la sua voce." : "Così il Professore può parlarvi con la sua voce.") + "</span></button>";
    document.body.appendChild(el);
    if (neura) PD.neura.crea(el.querySelector("canvas"), { mini: true });
    invito = { el: el, riprova: riprova, toccato: false };
    var btn = el.querySelector("button");
    btn.onclick = function () {
      if (!invito) return;
      var fn = invito.riprova; invito.toccato = true;
      PD.sbloccaAudio();
      chiudiInvito();
      /* un attimo, così l'enunciazione muta dello sblocco finisce prima che PD.speak la interrompa */
      if (fn) setTimeout(fn, 350);
    };
    try { btn.focus(); } catch (e) { /* ignora */ }
    if (PD.eyesKick) PD.eyesKick();
  };
  function chiudiInvito() {
    if (!invito) return;
    var el = invito.el; invito = null;
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  /* Il primo tocco di qualunque genere sblocca l'audio (iOS vuole la prima enunciazione dentro un gesto).
   * Solo su telefoni e tablet: sul PC non si tocca niente. */
  function gesto(e) {
    if (e.type === "keydown" && (e.key === "Tab" || e.key === "Shift")) return;
    if (PD.mobile && !sbloccata) PD.sbloccaAudio();
    else if (!sbloccata && attesaGesto) sbloccata = true;
    if (attesaGesto && !(e.target && e.target.closest && e.target.closest("#pd-tocca"))) {
      var fn = attesaGesto; attesaGesto = null;
      /* se quel tocco ha già fatto parlare il Professore (es. «🔊 Riascolta»), non si sovrappone */
      setTimeout(function () { var st = $("#btn-stop"); if (!st || st.hidden) fn(); }, 350);
    }
  }
  ["touchend", "click", "keydown"].forEach(function (t) { document.addEventListener(t, gesto, true); });

  /* ===================================================================== 2. MICROFONO DEL TELEFONO */
  function SR() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
  function apple() { var ua = navigator.userAgent || ""; return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
  function servizio() {
    var ua = navigator.userAgent || "";
    if (apple() || (/Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua))) return "di <b>Apple</b>";
    if (/Android|Chrome/.test(ua)) return "di <b>Google</b>";
    return "del produttore del browser (di solito <b>Google</b> o <b>Apple</b>)";
  }
  var ascolto = null;   // { rec, cb, campo, testo, errore, timer }

  PD.micWeb = {
    /* "no": qui non si propone (PC con il server o versione portatile: microfono come sempre);
     * "insicuro": tablet collegato in http (il browser non dà il microfono); "assente": il browser non riconosce la voce;
     * "spento": si può usare ma l'utente non l'ha acceso; "acceso" */
    stato: function () {
      if (PD.sttLocale && PD.sttLocale()) return "no";
      if (!(window.PD_PWA || PD.ospite)) return "no";
      if (window.isSecureContext === false) return "insicuro";
      if (!SR()) return "assente";
      return PD.settings.micTelefono ? "acceso" : "spento";
    },
    attivo: function () { return !!ascolto; },
    ascolta: function (cb, campo) {
      var st = PD.micWeb.stato();
      if (st === "insicuro") return spiegaInsicuro();
      if (st === "assente") { PD.toast("🎤 Questo browser non sa riconoscere la voce: potete scrivere. Con Chrome (Android) o Safari (iPhone e iPad) il microfono funziona.", 7000); return; }
      if (st === "spento") return PD.micWeb.consenso(function (ok) { if (ok) avvia(cb, campo); });
      if (st === "acceso") avvia(cb, campo);
    },
    ferma: function () {
      var a = ascolto; if (!a) return;
      try { a.rec.stop(); } catch (e) { fine(); return; }
      /* se il browser non avvisa la fine dell'ascolto, la striscia «Vi ascolto…» non deve restare a schermo */
      setTimeout(function () { if (ascolto === a) { try { a.rec.abort(); } catch (e) { /* ignora */ } fine(); } }, 1500);
    },
    /* pulsante «🎤 Parla con la voce» / «🔇 Spegni il microfono» */
    interruttore: function () {
      var st = PD.micWeb.stato();
      if (st === "insicuro") return spiegaInsicuro();
      if (st === "acceso") return PD.micWeb.spegni();
      if (st === "spento") PD.micWeb.consenso(function (ok) { if (ok && $("#mic")) avvia(null, null); });
    },
    spegni: function () {
      PD.micWeb.ferma();
      PD.settings.micTelefono = false; PD.saveSettings(); aggiorna();
      PD.toast("🔇 Microfono spento. Potete riaccenderlo quando volete.", 3500);
    },
    /* spiegazione semplice e onesta, poi «Accendo» / «No grazie». cb(true) se acceso. */
    consenso: function (cb) {
      if (PD.micWeb.stato() === "acceso") { if (cb) cb(true); return; }
      chiudiDialogo();
      var d = document.createElement("div");
      d.className = "pd-dialogo"; d.id = "pd-mic-consenso";
      d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "pd-mic-tit");
      d.innerHTML = '<div class="card pd-dialogo-card"><svg class="prof riposo pd-dialogo-prof" aria-hidden="true"><use href="#prof-svg"/></svg>' +
        '<h2 id="pd-mic-tit">🎤 Parla con la voce</h2>' +
        "<p>Potete farmi le domande parlando, invece di scrivere.</p>" +
        '<p class="notice info">Per capire la vostra voce, il telefono usa il servizio di riconoscimento vocale ' + servizio() +
        ": <b>quello che dite viene inviato a loro</b> per essere trasformato in testo. Serve Internet.</p>" +
        "<p>Il Professore <b>non salva nulla</b> e non manda nient'altro. Potete spegnere il microfono quando volete.</p>" +
        '<div class="row"><button type="button" class="btn big" id="pd-mic-si">✅ Accendo</button>' +
        '<button type="button" class="btn big ghost" id="pd-mic-no">No grazie</button></div></div>';
      document.body.appendChild(d);
      $("#pd-mic-si", d).onclick = function () {
        chiudiDialogo();
        PD.settings.micTelefono = true; PD.saveSettings(); aggiorna();
        if (cb) cb(true); else PD.toast("🎤 Microfono acceso: premete 🎤 e parlate.", 3500);
      };
      $("#pd-mic-no", d).onclick = function () { chiudiDialogo(); aggiorna(); if (cb) cb(false); };
      $("#pd-mic-si", d).focus();
    },
    /* riquadro «🎤 Microfono» delle Impostazioni (al posto di quello del PC) */
    cartaHTML: function () {
      var st = PD.micWeb.stato(), h = '<div class="card" id="pd-mic-carta"><h2 style="margin-top:0">🎤 Microfono</h2>';
      if (st === "insicuro") {
        h += '<p class="notice info small">Su questo tablet il microfono funziona con l\'<b>app installata dal sito</b>: ' +
          "collegati al PC dell'aula il browser non permette di usarlo. Potete sempre scrivere le domande.</p>" +
          '<p><a class="btn ghost" href="' + esc(SITO_APP) + '" target="_blank" rel="noopener">📱 Apri l\'app del Professore</a></p>';
      } else if (st === "assente") {
        h += '<p class="notice small">Questo browser non sa riconoscere la voce (succede per esempio con Firefox). Potete sempre scrivere le domande. ' +
          "Con <b>Chrome</b> su Android o <b>Safari</b> su iPhone e iPad il microfono funziona.</p>";
      } else {
        h += '<label class="switch"><input type="checkbox" id="s-mictel"' + (st === "acceso" ? " checked" : "") + ">🎤 Parla con la voce (riconoscimento vocale del telefono)</label>" +
          '<p class="small muted">Per capire la voce il telefono usa il servizio ' + servizio() + ": quello che dite viene inviato a loro. " +
          "Il Professore non salva nulla. È spento finché non lo accendete voi.</p>" +
          '<label class="switch"><input type="checkbox" id="s-autosend"' + (PD.settings.autoSendVoice ? " checked" : "") + ">Invia subito la domanda dopo aver parlato</label>";
      }
      return h + "</div>";
    },
    cartaBind: function (el) {
      var c = $("#s-mictel", el); if (!c) return;
      c.onchange = function () {
        if (!c.checked) { PD.micWeb.spegni(); return; }
        c.checked = false;
        PD.micWeb.consenso(function (ok) {
          c.checked = !!ok;
          if (ok) PD.toast("🎤 Microfono acceso: in «Chiedi al Professore» premete 🎤 e parlate.", 4000);
        });
      };
    }
  };
  PD.micPronto = function () { return !!(PD.sttReady && PD.sttReady()); };
  /* funzione unica per tutti i moduli: sceglie il motore (PC con Vosk o voce del telefono) */
  PD.ascolta = function (cb, campo) { PD.recorder.toggle(cb, campo); };

  function aggiorna() {
    if (PD.aggiornaMicAsk) PD.aggiornaMicAsk();
    if (PD.accessibilitaApplica) PD.accessibilitaApplica();
    if (PD.renderChips) PD.renderChips();
    var c = $("#s-mictel"); if (c) c.checked = PD.micWeb.stato() === "acceso";
    var lead = $("#view-ask .lead");
    if (lead && lead.firstChild && lead.firstChild.nodeType === 3) {
      lead.firstChild.nodeValue = "Scrivete la vostra domanda" + (PD.sttReady() ? " oppure premete il microfono e parlate" : "") + ". Non esistono domande sbagliate. ";
    }
  }
  PD.micAggiorna = aggiorna;

  function chiudiDialogo() { var d = document.getElementById("pd-mic-consenso"); if (d && d.parentNode) d.parentNode.removeChild(d); }
  function spiegaInsicuro() {
    chiudiDialogo();
    var d = document.createElement("div");
    d.className = "pd-dialogo"; d.id = "pd-mic-consenso";
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "pd-mic-tit");
    d.innerHTML = '<div class="card pd-dialogo-card"><svg class="prof riposo pd-dialogo-prof" aria-hidden="true"><use href="#prof-svg"/></svg>' +
      '<h2 id="pd-mic-tit">🎤 Parla con la voce</h2>' +
      "<p>Su questo tablet il microfono funziona con l'<b>app installata dal sito</b>: collegati al PC dell'aula, il browser non permette di usarlo.</p>" +
      "<p>Per ora potete scrivere la domanda: vi rispondo lo stesso!</p>" +
      '<div class="row"><a class="btn big" href="' + esc(SITO_APP) + '" target="_blank" rel="noopener">📱 Apri l\'app</a>' +
      '<button type="button" class="btn big ghost" id="pd-mic-no">Ho capito</button></div></div>';
    document.body.appendChild(d);
    $("#pd-mic-no", d).onclick = chiudiDialogo;
    $("#pd-mic-no", d).focus();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { chiudiDialogo(); if (ascolto) PD.micWeb.ferma(); } });
  window.addEventListener("hashchange", function () { if (ascolto) PD.micWeb.ferma(); });   // cambiando pagina si smette di ascoltare

  /* ---------------------------------------------------------------- ascolto con la Web Speech API */
  function pillola(testo) {
    var p = document.getElementById("pd-ascolto");
    if (testo === null) { if (p && p.parentNode) p.parentNode.removeChild(p); return; }
    if (!p) {
      p = document.createElement("div"); p.id = "pd-ascolto"; p.className = "pd-ascolto"; p.setAttribute("role", "status"); p.setAttribute("aria-live", "polite");
      p.innerHTML = '<span class="pd-ascolto-onda" aria-hidden="true">🎤</span><span class="pd-ascolto-testo"></span>' +
        '<button type="button" class="btn ghost" id="pd-ascolto-basta">■ Basta</button>';
      document.body.appendChild(p);
      $("#pd-ascolto-basta", p).onclick = function () { PD.micWeb.ferma(); };
    }
    p.querySelector(".pd-ascolto-testo").textContent = testo ? "«" + testo + "»" : "Vi ascolto…";
  }
  function campoDi(cb, campo) {
    if (campo && campo.nodeType === 1) return campo;
    if (typeof campo === "string") return $(campo);
    return cb ? null : $("#question");
  }
  function avvia(cb, campo) {
    var C = SR(); if (!C || ascolto) return;
    PD.stopSpeech();
    var rec;
    try { rec = new C(); } catch (e) { PD.toast("Il microfono non si è acceso: " + e.message); return; }
    rec.lang = "it-IT"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    ascolto = { rec: rec, cb: cb || null, campo: campoDi(cb, campo), testo: "", provv: "", errore: null };
    var a = ascolto;
    rec.onresult = function (e) {
      var fin = "", prov = "";
      for (var i = 0; i < e.results.length; i++) {
        var r = e.results[i], t = r && r[0] ? r[0].transcript : "";
        if (r.isFinal) fin += t; else prov += t;
      }
      a.testo = fin; a.provv = prov;
      var vis = (fin + " " + prov).replace(/\s+/g, " ").trim();
      if (a.campo && "value" in a.campo) a.campo.value = vis;
      pillola(vis);
    };
    rec.onerror = function (e) { a.errore = (e && e.error) || "errore"; };
    rec.onend = function () { if (ascolto === a) fine(); };
    a.timer = setTimeout(function () { if (ascolto === a) PD.micWeb.ferma(); }, 20000);   // non più di 20 s
    try { rec.start(); } catch (e) { ascolto = null; clearTimeout(a.timer); PD.toast("Il microfono non si è acceso: " + e.message); return; }
    if (PD.micBtn) PD.micBtn(true);
    PD.setProf("ascolto"); pillola("");
  }
  var ERRORI = {
    "not-allowed": "Il telefono non ha dato il permesso di usare il microfono. Controllate le autorizzazioni del browser per questo sito, poi riprovate.",
    "service-not-allowed": "Il riconoscimento della voce non è permesso su questo telefono. Potete sempre scrivere la domanda.",
    "no-speech": "Non ho sentito nulla. Riprovate parlando vicino al telefono.",
    "audio-capture": "Non trovo il microfono del telefono.",
    "network": "Per capire la voce serve Internet, che ora sembra assente. Potete scrivere la domanda.",
    "language-not-supported": "Il riconoscimento della voce in italiano non è disponibile su questo telefono."
  };
  function fine() {
    var a = ascolto; if (!a) return;
    ascolto = null; clearTimeout(a.timer);
    if (PD.micBtn) PD.micBtn(false);
    pillola(null);
    if (PD.profState === "ascolto") PD.setProf("riposo");
    var t = (a.testo || a.provv || "").replace(/\s+/g, " ").trim();
    if (!t) {
      if (a.errore && a.errore !== "aborted") PD.toast("🎤 " + (ERRORI[a.errore] || "Non ho capito bene. Potete ripetere?"), 6000);
      else if (!a.errore) PD.toast("Non ho sentito nulla. Riprovate parlando vicino al telefono.");
      if (a.campo && "value" in a.campo && !a.cb) a.campo.value = "";
      return;
    }
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (a.cb) { a.cb(t); return; }
    if (PD.settings.autoSendVoice && PD.ask) PD.ask(t);
    else if (a.campo) { a.campo.value = t; a.campo.focus(); }
  }
})();
