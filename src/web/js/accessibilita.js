/* ==============================================================================
 *  PROFESSORE DIGITALE - «Accessibilità vera» (3.2)
 *  Quattro aiuti, attivabili dalle Impostazioni o dal pulsante ♿ in alto:
 *   - Comandi a voce (riconoscimento vocale locale del PC, oppure sul telefono la voce del telefono accesa dall'utente,
 *     vedi voce.js): pulsante «🎙️ Comando» o tasto F2
 *   - Mani che tremano: pulsanti più grandi, protezione dai doppi clic involontari, cursore grande
 *   - Vedo poco: testo almeno 24 px, contorni di messa a fuoco evidenti, link sottolineati
 *   - Leggi ciò che indico: il Professore legge ad alta voce il pulsante o il campo indicato
 *  Sul PC tutto avviene su questo computer: nessun dato esce. Sul telefono (3.5) i comandi a voce usano il riconoscimento
 *  del telefono (Google/Apple) solo se l'utente l'ha acceso dopo la spiegazione.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;

  var CHIAVI = ["voiceCommands", "tremore", "vista", "leggiFocus"];
  var ETICHETTE = {
    voiceCommands: "Comandi a voce (serve il microfono)",
    tremore: "Mani che tremano: pulsanti più grandi e protezione dai doppi clic",
    vista: "Vedo poco: testo grande e contorni evidenti",
    leggiFocus: "Leggi ad alta voce ciò che indico"
  };
  var ELENCO_COMANDI = [
    ["«Avanti», «Prossimo», «Continua»", "passa al passo successivo"],
    ["«Indietro», «Torna»", "torna al passo precedente"],
    ["«Ripeti», «Rileggi», «Leggi»", "il Professore legge la pagina"],
    ["«Stop», «Basta», «Silenzio»", "ferma la voce"],
    ["«Più grande», «Ingrandisci»", "testo più grande"],
    ["«Più piccolo»", "testo più piccolo"],
    ["«Inizio», «Casa»", "torna alla pagina iniziale"],
    ["«Lezioni», «Palestra», «Quiz»", "apre la sezione"],
    ["«Chiedi…» oppure «Domanda…»", "fa una domanda al Professore (es. «Chiedi come si scrive una email»)"],
    ["«Stampa»", "apre il menu della stampa"],
    ["«Esci»", "chiude il Professore"],
    ["«Aiuto», «Cosa posso dire»", "elenca i comandi"]
  ];

  function s() { return PD.settings || {}; }
  function sttOk() { try { return !!(PD.sttReady && PD.sttReady()); } catch (e) { return false; } }
  /* stato del microfono del telefono (voce.js, 3.5): "no" sul PC; "spento" = si può accendere dopo il consenso */
  function micWeb() { try { return PD.micWeb ? PD.micWeb.stato() : "no"; } catch (e) { return "no"; } }

  /* ------------------------------------------------------------------------
   *  Classi sulla pagina
   * ---------------------------------------------------------------------- */
  function applica() {
    var h = document.documentElement;
    h.classList.toggle("pd-tremore", !!s().tremore);
    h.classList.toggle("pd-vista", !!s().vista);
    h.classList.toggle("pd-leggi", !!s().leggiFocus);
    var voce = !!s().voiceCommands && sttOk();
    h.classList.toggle("pd-voce", voce);
    pulsanteVoce(voce);
    aggiornaMenu();
  }
  PD.accessibilitaApplica = applica;

  /* app.js chiama la sua applySettings() interna, ma ogni cambio passa da PD.saveSettings: avvolgiamo entrambe. */
  var prevApply = PD.applySettings;
  PD.applySettings = function () { if (prevApply) prevApply.apply(this, arguments); applica(); };
  var prevSave = PD.saveSettings;
  PD.saveSettings = function () { var r = prevSave.apply(this, arguments); applica(); return r; };
  PD.hooks.dopoCaricamento.push(function () { applica(); });
  var prevReady = PD.onReady;
  PD.onReady = function () { if (prevReady) prevReady(); applica(); };
  window.addEventListener("hashchange", function () { setTimeout(applica, 0); });

  function salva(chiave, valore) {
    PD.settings[chiave] = !!valore;
    PD.saveSettings();
    $$("[data-a11y='" + chiave + "']").forEach(function (c) { c.checked = !!valore; });
  }

  /* ------------------------------------------------------------------------
   *  Testi: normalizzazione tollerante
   * ---------------------------------------------------------------------- */
  var ACCENTI = { "à": "a", "á": "a", "â": "a", "è": "e", "é": "e", "ê": "e", "ì": "i", "í": "i", "î": "i", "ò": "o", "ó": "o", "ô": "o", "ù": "u", "ú": "u", "û": "u" };
  function norm(t) {
    t = String(t || "").toLowerCase();
    t = t.replace(/[àáâèéêìíîòóôùúû]/g, function (c) { return ACCENTI[c]; });
    return t.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function distanza(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var prec = [], i, j;
    for (j = 0; j <= b.length; j++) prec.push(j);
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) cur.push(Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)));
      prec = cur;
    }
    return prec[b.length];
  }
  /* Vero se la frase contiene una delle parole (o frasi) indicate. Con frasi corte (1-3 parole) accetta anche
   * parole quasi uguali, come capita con il riconoscimento vocale («avandi» → «avanti»). */
  function contiene(frase, parole) {
    var f = " " + frase + " ", tok = frase.split(" ");
    for (var i = 0; i < parole.length; i++) {
      var p = parole[i];
      if (f.indexOf(" " + p + " ") >= 0) return true;
      if (tok.length <= 3 && p.indexOf(" ") < 0 && p.length >= 5) {
        for (var k = 0; k < tok.length; k++) if (tok[k].length >= 4 && distanza(tok[k], p) <= 1) return true;
      }
    }
    return false;
  }
  function pulisciVoce(t) {
    return String(t || "").replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, " ").replace(/[←-⇿⌀-➿️⬀-⯿]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  /* ------------------------------------------------------------------------
   *  Pagina attiva: pulsanti e testo
   * ---------------------------------------------------------------------- */
  function vistaAttiva() {
    var v = $$("main .view").filter(function (x) { return !x.hidden; });
    return v[0] || null;
  }
  function visibile(el) {
    if (!el || el.hidden || el.disabled) return false;
    if (!el.getClientRects().length) return false;
    var cs = window.getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  }
  function cercaPulsante(prefissi) {
    var v = vistaAttiva(); if (!v) return null;
    var tutti = $$("button, a[href], [role=button], [data-go]", v).filter(visibile);
    for (var p = 0; p < prefissi.length; p++) {
      for (var i = 0; i < tutti.length; i++) {
        var t = (tutti[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (t.indexOf(prefissi[p]) === 0) return tutti[i];
      }
    }
    return null;
  }
  function testoPagina() {
    var v = vistaAttiva(); if (!v) return "";
    var parti = [], vist = [];
    $$("h1, h2, h3, p, li, dt, dd, blockquote, .quiz-opt, label", v).forEach(function (el) {
      if (!visibile(el)) return;
      for (var i = 0; i < vist.length; i++) if (vist[i].contains(el)) return;
      var t = pulisciVoce(el.innerText || el.textContent);
      if (t) { parti.push(t); vist.push(el); }
    });
    var tutto = parti.join(". ").replace(/\.\s*\./g, ".");
    if (tutto.length > 800) {
      var cut = tutto.slice(0, 800), fine = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
      tutto = fine > 300 ? cut.slice(0, fine + 1) : cut + "…";
    }
    return tutto;
  }
  PD.testoPagina = testoPagina;

  function di(msg) { PD.toast(msg, 4000); try { PD.speak(msg, true); } catch (e) { /* ignora */ } }

  /* ------------------------------------------------------------------------
   *  Comandi a voce
   * ---------------------------------------------------------------------- */
  function vai(hash) { PD.go(hash); return true; }
  function fontDi(d) {
    var f = s().fontSize || 20, n = Math.max(14, Math.min(34, f + d));
    if (n === f) { di(d > 0 ? "Il testo è già al massimo." : "Il testo è già al minimo."); return true; }
    PD.settings.fontSize = n; PD.saveSettings(); PD.toast(d > 0 ? "🔍 Testo più grande" : "🔎 Testo più piccolo", 1500);
    return true;
  }
  function aiuto() {
    var t = "Potete dire: " + ELENCO_COMANDI.map(function (c) { return c[0].replace(/[«»]/g, "") + ", " + c[1]; }).join(". ") + ".";
    PD.toast("🎙️ Comandi: avanti, indietro, ripeti, stop, più grande, più piccolo, inizio, lezioni, palestra, quiz, chiedi…, stampa, esci.", 8000);
    try { PD.speak(t, true); } catch (e) { /* ignora */ }
    return true;
  }

  PD.comando = function (testo) {
    var orig = String(testo || "").trim(), f = norm(orig);
    if (!f) return false;
    var m = orig.match(/^\s*(chiedi|chiedo|domanda|domando)\b[\s,:.]*(?:(?:al|a) professore\b[\s,:.]*)?([\s\S]*)$/i);
    if (m) {
      var resto = m[2].replace(/[.\s]+$/, "").trim();
      if (!resto) { PD.go("#/ask"); di("Dite pure la vostra domanda: premete il microfono e parlate."); return true; }
      resto = resto.charAt(0).toUpperCase() + resto.slice(1);
      PD.go("#/ask/" + encodeURIComponent(resto));
      if (s().autoSendVoice && PD.ask) setTimeout(function () { PD.ask(resto); }, 80);
      return true;
    }
    if (contiene(f, ["aiuto", "cosa posso dire", "che posso dire", "comandi", "help"])) return aiuto();
    if (contiene(f, ["stop", "basta", "silenzio", "zitto", "fermati", "ferma", "taci"])) { PD.stopSpeech(); PD.toast("🔇 Voce fermata.", 1500); return true; }
    if (contiene(f, ["piu grande", "ingrandisci", "ingrandire", "aumenta", "grande"])) return fontDi(2);
    if (contiene(f, ["piu piccolo", "rimpicciolisci", "rimpicciolire", "riduci", "piccolo"])) return fontDi(-2);
    if (contiene(f, ["inizio", "casa", "home", "pagina iniziale", "torna all inizio"])) return vai("#/home");
    if (contiene(f, ["ripeti", "rileggi", "leggi", "ripetere", "rileggere", "leggere"])) {
      var t = testoPagina();
      if (!t) { di("Non trovo niente da leggere in questa pagina."); return false; }
      PD.stopSpeech(); PD.speak(t, true); return true;
    }
    var avanti = contiene(f, ["avanti", "prossimo", "prossima", "continua", "successivo", "successiva", "vai avanti"]);
    var indietro = !avanti && contiene(f, ["indietro", "torna", "precedente", "tornare"]);
    if (avanti || indietro) {
      var b = avanti ? (cercaPulsante(["avanti", "prossima", "prossimo", "continua", "→"]) || cercaPulsante(["al quiz"]))
        : (cercaPulsante(["indietro", "← indietro"]) || cercaPulsante(["←"]));
      if (b) { b.click(); return true; }
      di(avanti ? "In questa pagina non c'è un passo successivo." : "In questa pagina non c'è un passo precedente.");
      return false;
    }
    if (contiene(f, ["lezioni", "lezione"])) return vai("#/lessons");
    if (contiene(f, ["palestra", "esercizi", "allenamento"])) return vai("#/practice");
    if (contiene(f, ["quiz", "attestati", "attestato"])) return vai("#/quiz");
    if (contiene(f, ["stampa", "stampare"])) { var p = $("#btn-print"); if (p) { p.click(); return true; } return false; }
    if (contiene(f, ["esci", "uscire", "chiudi", "chiudere", "arrivederci"])) { if (PD.esci) { PD.esci(); return true; } return false; }
    di("Non ho capito il comando. Dite \"aiuto\" per l'elenco.");
    return false;
  };

  /* Pulsante grande «🎙️ Comando» */
  function ascolta() {
    if (!s().voiceCommands || !sttOk()) return;
    if (PD.recorder.active && PD.recorder.active()) { PD.recorder.toggle(); statoVoce(); return; }
    PD.recorder.toggle(function (testo) { PD.toast("🎙️ «" + testo + "»", 2500); PD.comando(testo); });
    statoVoce();
  }
  var timerVoce = null;
  function statoVoce() {
    var b = document.getElementById("pd-voce-btn"); if (!b) return;
    var on = !!(PD.recorder.active && PD.recorder.active());
    b.classList.toggle("ascolto", on);
    b.innerHTML = on ? "■ <span>Vi ascolto…</span>" : "🎙️ <span>Comando</span>";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    clearTimeout(timerVoce);
    timerVoce = setTimeout(statoVoce, on ? 300 : 1500);
  }
  function posizionaVoce() {
    var b = document.getElementById("pd-voce-btn"); if (!b) return;
    var sb = $(".sidebar"), basso = 16;
    if (sb && window.innerWidth <= 900 && window.getComputedStyle(sb).display !== "none") basso = sb.offsetHeight + 12;
    b.style.bottom = basso + "px";
  }
  function pulsanteVoce(on) {
    var b = document.getElementById("pd-voce-btn");
    if (!on) { if (b) b.parentNode.removeChild(b); clearTimeout(timerVoce); return; }
    if (!b) {
      b = document.createElement("button");
      b.id = "pd-voce-btn"; b.type = "button"; b.className = "pd-voce-btn";
      b.title = "Premete e dite un comando (oppure il tasto F2). Dite «aiuto» per l'elenco.";
      b.setAttribute("aria-label", "Comando a voce");
      b.onclick = ascolta;
      document.body.appendChild(b);
      statoVoce();
    }
    posizionaVoce();
  }
  window.addEventListener("resize", posizionaVoce);
  document.addEventListener("keydown", function (e) {
    if (e.key === "F2" || e.keyCode === 113) {
      if (!s().voiceCommands) return;
      e.preventDefault();
      if (!sttOk()) {
        if (micWeb() === "spento") { PD.micWeb.consenso(function (ok) { if (ok) { applica(); ascolta(); } }); return; }
        PD.toast("Il riconoscimento vocale non è installato: i comandi a voce non sono disponibili."); return;
      }
      ascolta();
    }
  });

  /* ------------------------------------------------------------------------
   *  Mani che tremano: protezione dai doppi clic involontari
   * ---------------------------------------------------------------------- */
  PD.tremore = { attivo: function () { return !!s().tremore; }, sogliaDoppioClic: 900, attesa: 700 };
  var ultimo = { el: null, tg: null, t: 0 };
  var CLICCABILI = "button, a, label, input, select, [role=button], [role=menuitem], [data-go], .quiz-opt, .tile, summary";
  document.addEventListener("click", function (e) {
    if (!PD.tremore.attivo()) return;
    var tg = e.target && e.target.closest ? e.target : null; if (!tg) return;
    if (tg.closest("#view-practice")) return;
    if (/^(TEXTAREA|SELECT)$/.test(tg.tagName) || (tg.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset)$/i.test(tg.type))) return;
    var el = tg.closest("label") || tg.closest(CLICCABILI) || tg;
    var ora = Date.now(), dt = ora - ultimo.t;
    /* clic «di attivazione» che l'etichetta genera da sola sulla sua casella: va lasciato passare */
    if (el === ultimo.el && tg !== ultimo.tg && tg.tagName === "INPUT" && dt < 60) return;
    if (el === ultimo.el && dt < PD.tremore.attesa) {
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      return;
    }
    ultimo.el = el; ultimo.tg = tg; ultimo.t = ora;
  }, true);

  /* ------------------------------------------------------------------------
   *  Leggi ciò che indico
   * ---------------------------------------------------------------------- */
  var INDICABILI = "button, a[href], [role=button], [role=menuitem], [role=option], .quiz-opt, .nav-btn, .tile, [data-go], input, select, textarea, label.switch, summary";
  var letto = { el: null, t: 0 }, mia = false, tastoT = 0, timerHover = null, sopra = null;
  function etichettaCampo(el) {
    var l = el.labels && el.labels.length ? el.labels[0] : el.closest("label");
    var t = (l && (l.innerText || l.textContent)) || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.title || "";
    if (!t && el.id) { var ll = document.querySelector("label[for='" + el.id + "']"); if (ll) t = ll.textContent; }
    t = pulisciVoce(t);
    if (el.type === "checkbox" || el.type === "radio") t += el.checked ? ". Attivo." : ". Spento.";
    else if (el.tagName === "SELECT" && el.selectedIndex >= 0) t += ". Scelta: " + el.options[el.selectedIndex].text;
    return t;
  }
  function testoDi(el) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return etichettaCampo(el);
    var t = el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.textContent || "";
    if (el.matches && el.matches("label.switch")) { var c = el.querySelector("input"); if (c) return etichettaCampo(c); }
    return pulisciVoce(t).slice(0, 200);
  }
  function inLetturaUtente() {
    var stop = document.getElementById("btn-stop");
    return !mia && stop && !stop.hidden;
  }
  function leggi(el) {
    if (!s().leggiFocus || !el) return;
    if (el.closest && el.closest("#pd-voce-btn")) return;
    var ora = Date.now();
    if (el === letto.el && ora - letto.t < 6000) return;
    if (inLetturaUtente()) return;
    var t = testoDi(el); if (!t) return;
    letto.el = el; letto.t = ora;
    try {
      PD.stopSpeech();
      mia = true;
      var p = PD.speak(t, true);
      if (p && p.then) p.then(function () { mia = false; }, function () { mia = false; }); else mia = false;
    } catch (e) { mia = false; }
  }
  PD.leggiIndicato = leggi;
  document.addEventListener("keydown", function (e) { if (e.key === "Tab" || /^Arrow/.test(e.key || "")) tastoT = Date.now(); }, true);
  document.addEventListener("focusin", function (e) {
    if (!s().leggiFocus || Date.now() - tastoT > 1500) return;
    var el = e.target && e.target.closest ? e.target.closest(INDICABILI) : null;
    if (el) leggi(el);
  });
  document.addEventListener("mouseover", function (e) {
    if (!s().leggiFocus) return;
    var el = e.target && e.target.closest ? e.target.closest(INDICABILI) : null;
    if (el === sopra) return;
    sopra = el; clearTimeout(timerHover);
    if (el) timerHover = setTimeout(function () { if (sopra === el) leggi(el); }, 900);
  });
  document.addEventListener("mouseout", function (e) {
    if (sopra && (!e.relatedTarget || !sopra.contains(e.relatedTarget))) { sopra = null; clearTimeout(timerHover); }
  });

  /* ------------------------------------------------------------------------
   *  Interruttori (Impostazioni e menu rapido ♿)
   * ---------------------------------------------------------------------- */
  function interruttore(chiave, pref) {
    var w = micWeb();
    var dis = chiave === "voiceCommands" && !sttOk() && w !== "spento";
    var nota = "";
    if (dis && w === "insicuro") nota = "Su questo tablet il microfono funziona con l'app installata dal sito: i comandi a voce qui non sono disponibili.";
    else if (dis && w === "assente") nota = "Questo browser non sa riconoscere la voce (per esempio Firefox): i comandi a voce non sono disponibili.";
    else if (dis) nota = "Il riconoscimento vocale non è installato su questo computer" +
        (PD.ospite ? " (sui tablet collegati al PC dell'aula non c'è)" : PD.server ? "" : " (nella versione portatile non c'è)") + ": i comandi a voce non sono disponibili." +
        (PD.ospite ? "" : " Vedete il riquadro «🎤 Microfono».");
    else if (chiave === "voiceCommands" && w === "spento") nota = "Accendendoli si accende anche il microfono del telefono (vi spiego prima come funziona).";
    return '<label class="switch' + (dis ? " pd-a11y-off" : "") + '"><input type="checkbox" id="' + pref + chiave + '" data-a11y="' + chiave + '"' +
      (s()[chiave] && !dis && (chiave !== "voiceCommands" || sttOk()) ? " checked" : "") + (dis ? " disabled" : "") + ">" + esc(ETICHETTE[chiave]) + "</label>" +
      (nota ? '<p class="small muted pd-a11y-nota">' + esc(nota) + "</p>" : "");
  }
  function legaInterruttori(box) {
    $$("input[data-a11y]", box).forEach(function (c) {
      c.addEventListener("change", function () {
        var k = c.getAttribute("data-a11y");
        /* telefono: i comandi a voce hanno bisogno del microfono del telefono, che si accende solo dopo il consenso */
        if (k === "voiceCommands" && c.checked && !sttOk() && micWeb() === "spento") {
          c.checked = false;
          PD.micWeb.consenso(function (ok) {
            if (!ok) return;
            salva(k, true);
            PD.toast("Premete il pulsante «🎙️ Comando» in basso a destra e dite «aiuto».", 6000);
          });
          return;
        }
        salva(k, c.checked);
        if (k === "vista" && c.checked && s().theme !== "contrast") PD.toast("Consiglio: attivate anche l'alto contrasto per vedere meglio.", 5000);
        if (k === "voiceCommands" && c.checked) PD.toast("Premete il pulsante «🎙️ Comando» in basso a destra (o il tasto F2) e dite «aiuto».", 6000);
        if (k === "leggiFocus" && c.checked) PD.speak("D'accordo: leggerò ad alta voce ciò che indicate.", true);
      });
    });
  }

  PD.hooks.settingsCards.push({
    html: function () {
      return '<div class="card pd-a11y-card" id="pd-a11y-card"><h2 style="margin-top:0">♿ Accessibilità</h2>' +
        '<p class="small muted">Aiuti per chi ha difficoltà con la vista, con le mani o preferisce usare la voce. Si possono attivare anche dal pulsante ♿ in alto.</p>' +
        CHIAVI.map(function (k) { return interruttore(k, "a11y-"); }).join("") +
        '<p class="pd-a11y-contrasto"><button class="btn ghost" type="button" id="a11y-contrasto">◐ Attiva anche l\'alto contrasto</button></p>' +
        '<details class="pd-a11y-comandi"><summary>🎙️ Cosa si può dire (comandi a voce)</summary><ul>' +
        ELENCO_COMANDI.map(function (c) { return "<li><b>" + esc(c[0]) + "</b>: " + esc(c[1]) + "</li>"; }).join("") +
        "</ul><p class=\"small muted\">Premete «🎙️ Comando» (o il tasto F2), parlate e aspettate un attimo: la registrazione si ferma da sola quando smettete di parlare. " +
        (micWeb() === "no" ? "Tutto resta su questo computer." : "Sul telefono la voce la capisce il servizio di riconoscimento del telefono (vedete il riquadro «🎤 Microfono»).") + "</p></details></div>";
    },
    bind: function (el) {
      var card = $("#pd-a11y-card", el); if (!card) return;
      legaInterruttori(card);
      var bc = $("#a11y-contrasto", card);
      if (bc) bc.onclick = function () {
        PD.settings.theme = s().theme === "contrast" ? "light" : "contrast"; PD.saveSettings();
        var sel = $("#s-theme", el); if (sel) sel.value = PD.settings.theme;
        aggiornaMenu();
      };
      aggiornaMenu();
    }
  });

  /* Menu rapido ♿ nella barra in alto */
  function aggiornaMenu() {
    $$("[data-a11y]").forEach(function (c) {
      var k = c.getAttribute("data-a11y");
      c.checked = !!s()[k] && !c.disabled && (k !== "voiceCommands" || sttOk());
    });
    $$("#a11y-contrasto, #a11y-q-contrasto").forEach(function (b) {
      b.textContent = s().theme === "contrast" ? "◐ Torna ai colori normali" : "◐ Attiva anche l'alto contrasto";
    });
  }
  function chiudiMenu() { var m = document.getElementById("pd-a11y-menu"); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function apriMenu(btn) {
    if (document.getElementById("pd-a11y-menu")) { chiudiMenu(); return; }
    var m = document.createElement("div");
    m.className = "menu-pop pd-a11y-menu"; m.id = "pd-a11y-menu"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Accessibilità");
    m.innerHTML = "<p><b>♿ Accessibilità</b></p>" + CHIAVI.map(function (k) { return interruttore(k, "a11y-q-"); }).join("") +
      '<button type="button" id="a11y-q-contrasto">◐ Attiva anche l\'alto contrasto</button>' +
      '<button type="button" id="a11y-q-altro">⚙️ Altre impostazioni</button>';
    document.body.appendChild(m);
    var r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 6) + "px"; m.style.right = Math.max(8, window.innerWidth - r.right) + "px";
    legaInterruttori(m);
    $("#a11y-q-contrasto", m).onclick = function () { PD.settings.theme = s().theme === "contrast" ? "light" : "contrast"; PD.saveSettings(); };
    $("#a11y-q-altro", m).onclick = function () { chiudiMenu(); PD.go("#/settings"); setTimeout(function () { var c = $("#pd-a11y-card"); if (c) c.scrollIntoView(); }, 100); };
    aggiornaMenu();
    setTimeout(function () {
      document.addEventListener("click", function fuori(e) {
        if (!document.getElementById("pd-a11y-menu")) { document.removeEventListener("click", fuori); return; }
        if (!m.contains(e.target) && !btn.contains(e.target)) { chiudiMenu(); document.removeEventListener("click", fuori); }
      });
    }, 0);
    var primo = m.querySelector("input:not([disabled])"); if (primo) primo.focus();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") chiudiMenu(); });
  document.addEventListener("DOMContentLoaded", function () {
    var tools = $(".topbar .tools"); if (!tools || document.getElementById("btn-a11y")) return;
    var b = document.createElement("button");
    b.className = "icon-btn"; b.id = "btn-a11y"; b.type = "button";
    b.title = "Accessibilità: voce, mani che tremano, vedo poco"; b.setAttribute("aria-label", "Accessibilità"); b.setAttribute("aria-haspopup", "dialog");
    b.textContent = "♿";
    b.onclick = function () { apriMenu(b); };
    var tema = $("#btn-theme", tools);
    tools.insertBefore(b, tema || null);
    applica();
  });
})();
