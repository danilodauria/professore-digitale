/* ==========================================================================
 *  PROFESSORE DIGITALE - 🌐 Lingue del programma (dalla 3.7, come nel Consulente Digitale)
 *  Lingue: italiano (originale), English, Français, Español, Deutsch, Română.
 *  1. L'INTERFACCIA si traduce con i dizionari src/web/i18n/<lingua>.json (scritti a mano, CC BY-NC-SA 4.0):
 *     ogni testo mostrato viene cercato nel dizionario; numeri, giorni e mesi si conservano (segnaposto #, @g, @m).
 *  2. I CONTENUTI LUNGHI che il dizionario non conosce (lezioni, risposte della guida, quiz) si traducono, se si vuole,
 *     con l'IA LOCALE già usata da «Chiedi al Professore» (/api/chat): sul computer, senza inviare nulla fuori.
 *     Le traduzioni si conservano nella chiave dati «traduzioni» (server Python e Windows) per le volte successive.
 *  3. Il Professore risponde nella lingua scelta; la voce usa le voci del sistema in quella lingua; date e giorni pure.
 *  Senza IA locale i testi che il dizionario non conosce restano in italiano (e li legge la voce italiana).
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Codice MIT, traduzioni CC BY-NC-SA 4.0
 * ========================================================================== */
(function () {
  "use strict";
  var PD = window.PD;
  var $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var L = PD.i18n = { lingua: "it", diz: {}, mancanti: {}, cache: {} };
  L.LINGUE = {
    it: { nome: "Italiano", bandiera: "🇮🇹", bcp: "it-IT", ia: "italiano" },
    en: { nome: "English", bandiera: "🇬🇧", bcp: "en-GB", ia: "inglese (English)" },
    fr: { nome: "Français", bandiera: "🇫🇷", bcp: "fr-FR", ia: "francese (Français)" },
    es: { nome: "Español", bandiera: "🇪🇸", bcp: "es-ES", ia: "spagnolo (Español)" },
    de: { nome: "Deutsch", bandiera: "🇩🇪", bcp: "de-DE", ia: "tedesco (Deutsch)" },
    ro: { nome: "Română", bandiera: "🇷🇴", bcp: "ro-RO", ia: "rumeno (Română)" }
  };
  var INGLESE = { en: "English", fr: "French (Français)", es: "Spanish (Español)", de: "German (Deutsch)", ro: "Romanian (Română)" };
  var DATE = {
    en: [["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]],
    fr: [["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]],
    es: [["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"], ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]],
    de: [["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"], ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]],
    ro: [["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"], ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"]]
  };
  L.bcp = function () { return (L.LINGUE[L.lingua] || L.LINGUE.it).bcp; };
  L.attiva = function () { return L.lingua !== "it"; };

  /* chiave del dizionario: numeri → «#», giorni → «@g», mesi → «@m» (riempiti poi nella lingua scelta) */
  var RE_NUM = /\d+(?:[.,]\d+)?/g;
  var GIORNI_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  var MESI_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var RE_GM = new RegExp("\\b(" + GIORNI_IT.concat(MESI_IT).join("|") + ")(?![A-Za-zÀ-ÿ])", "gi");
  function chiave(t) {
    return t.replace(RE_NUM, "#").replace(RE_GM, function (w) { return GIORNI_IT.indexOf(w.toLowerCase()) >= 0 ? "@g" : "@m"; });
  }
  L.chiave = chiave;
  function nomeData(w) {
    var l = w.toLowerCase(), g = GIORNI_IT.indexOf(l), m = MESI_IT.indexOf(l), d = DATE[L.lingua];
    if (!d) return w;
    var r = g >= 0 ? d[0][g] : d[1][m];
    return w.charAt(0) === w.charAt(0).toUpperCase() ? r.charAt(0).toUpperCase() + r.slice(1) : r;
  }
  function riempi(tr, orig) {
    var n = orig.match(RE_NUM) || [], gm = orig.match(RE_GM) || [], i = 0, j = 0;
    return tr.replace(/#|@g|@m/g, function (x) { if (x === "#") return i < n.length ? n[i++] : "#"; return j < gm.length ? nomeData(gm[j++]) : x; });
  }
  function cerca(core) {
    var k = chiave(core), tr = L.diz[k];
    if (tr == null) tr = L.cache[core];
    return tr == null ? null : riempi(tr, core);
  }
  /* traduce una stringa; se non la conosce la annota (per l'IA) e la restituisce com'è */
  L.t = function (s) {
    if (!L.attiva() || !s) return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2].replace(/\s+/g, " ");
    if (!core || !/[A-Za-zÀ-ÿ]{2}/.test(core)) return s;
    var tr = cerca(core);
    if (tr == null) {                             // icona davanti (🔊, ✅…) o due punti in fondo: si traduce il resto
      var e = /^([^A-Za-zÀ-ÿ0-9«“"'(¿¡]+)(\S[\s\S]*)$/.exec(core), r;
      if (e && (r = cerca(e[2])) != null) return m[1] + e[1] + r + m[3];
      var c = /^([\s\S]*?[A-Za-zÀ-ÿ)»])(\s*[:…]+)$/.exec(core);
      if (c && (r = cerca(c[1])) != null) return m[1] + r + c[2] + m[3];
      if (core.length < 4000) L.mancanti[core] = 1;
      return s;
    }
    return m[1] + tr + m[3];
  };
  /* testo già tradotto? (per decidere la voce) */
  L.conosce = function (s) { return !L.attiva() || cerca(String(s || "").trim().replace(/\s+/g, " ")) != null; };

  var ORIG = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  var SALTA = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|INPUT|SELECT_NO)$/;
  var ESCLUSI = "[data-no-trad],pre,code,.msg.user,.msg.bot.da-ia,[contenteditable],.mermaid-src,.qr";
  function nodoTesto(n) {
    var p = n.parentNode;
    if (!p || SALTA.test(p.nodeName) || (p.closest && p.closest(ESCLUSI))) return;
    var v = n.nodeValue, prima = ORIG && ORIG.get(n);
    if (prima && prima.tr === v) return;                 // già tradotto da noi
    var tr = L.t(v);
    if (tr !== v) { if (ORIG) ORIG.set(n, { it: v, tr: tr }); n.nodeValue = tr; }
  }
  var ATTR = ["placeholder", "title", "aria-label", "alt"];
  function elemento(e) {
    if (e.closest && e.closest(ESCLUSI)) return;
    for (var i = 0; i < ATTR.length; i++) {
      var a = e.getAttribute && e.getAttribute(ATTR[i]);
      if (a && e.getAttribute("data-trad-" + ATTR[i]) !== a) {
        var tr = L.t(a);
        if (tr !== a) { e.setAttribute(ATTR[i], tr); e.setAttribute("data-trad-" + ATTR[i], tr); }
      }
    }
    if (e.nodeName === "INPUT" && /^(button|submit|reset)$/i.test(e.type) && e.value && e.getAttribute("data-trad-value") !== e.value) {
      var v = L.t(e.value); if (v !== e.value) { e.value = v; e.setAttribute("data-trad-value", v); }
    }
  }
  L.traduciAlbero = function (radice) {
    if (!L.attiva() || !radice) return;
    if (radice.nodeType === 3) { nodoTesto(radice); pianificaIA(); return; }
    if (radice.nodeType !== 1 && radice.nodeType !== 9 && radice.nodeType !== 11) return;
    if (radice.nodeType === 1) elemento(radice);
    var w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) nodoTesto(n); else elemento(n); }
    pianificaIA();
  };
  /* le pagine da stampare: si traduce l'HTML prima di stamparlo */
  L.traduciHtml = function (html) {
    if (!L.attiva()) return html;
    var d = document.createElement("div"); d.innerHTML = html; L.traduciAlbero(d); return d.innerHTML;
  };
  var titolo0 = null;
  function titoloPagina() {
    if (!L.attiva()) return;
    if (titolo0 == null) titolo0 = document.title;
    document.title = L.t(titolo0);
  }

  /* ------------------------------------------------------------------ traduzione con l'IA locale (facoltativa) */
  L.iaPronta = function () { return !!(PD.settings.traduzioneIA && PD.aiReady && PD.aiReady()); };
  /* frase da aggiungere ai prompt dell'IA (Chiedi al Professore, È una truffa?, Spiegami una lettera) */
  L.istruzioneIA = function () {
    if (!L.attiva()) return "";
    return "\n\nIMPORTANTE: l'utente ha scelto la lingua " + L.LINGUE[L.lingua].ia + ". Rispondi SEMPRE e solo in questa lingua, " +
      "anche se le istruzioni e le informazioni qui sopra sono in italiano.";
  };
  function chiamaIA(testi) {
    var istr = "You translate texts of an Italian educational program for beginners and elderly people called «Professore Digitale» " +
      "(by Danilo D'Auria) from Italian into " + INGLESE[L.lingua] + ". Keep the same meaning, a polite and simple tone, emoji, symbols, " +
      "numbers, «#» signs, Markdown (**bold**, *italic*, lists, line breaks) and leading/trailing punctuation. Do not translate brand or " +
      "program names (Windows, Linux, FeniceOS, Neura, Nonni Teach, Professore Digitale, Tecnologia Gentile...). " +
      "Answer ONLY with JSON: {\"t\": [translations in the same order]}.";
    return fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: PD.currentModel(), temperature: 0.1, num_ctx: 8192,
        messages: [{ role: "system", content: istr }, { role: "user", content: JSON.stringify({ testi: testi }) }] }) })
      .then(function (r) {
        if (!r.ok) throw new Error("IA non disponibile");
        return r.text();
      }).then(function (corpo) {
        var full = "";
        corpo.split("\n").forEach(function (ln) { if (!ln.trim()) return; try { var o = JSON.parse(ln); if (o.t) full += o.t; } catch (e) { /* riga incompleta */ } });
        full = (PD.stripThink ? PD.stripThink(full) : full).trim();
        var a = full.indexOf("{"), b = full.lastIndexOf("}"), lista = null;
        if (a >= 0 && b > a) { try { var j = JSON.parse(full.slice(a, b + 1)); lista = Array.isArray(j) ? j : j.t; } catch (e) { lista = null; } }
        if (!Array.isArray(lista) || lista.length !== testi.length) return testi.map(function () { return null; });
        return lista.map(function (x) { return typeof x === "string" && x.trim() ? x.trim() : null; });
      });
  }
  /* la chiave dati «traduzioni» resta sotto 1,5 MB (il server accetta al massimo 2 MB): si tolgono le più vecchie */
  var MAX_CARATTERI = 1500000, timerSalva = null;
  function memorizza(it, tr) {
    var tutte = L._tutte || (L._tutte = {});
    L.cache[it] = tr; tutte[L.lingua] = L.cache;
    clearTimeout(timerSalva);
    timerSalva = setTimeout(function () {
      var testo = JSON.stringify(tutte);
      while (testo.length > MAX_CARATTERI) {
        var k = Object.keys(L.cache); if (k.length < 2) break;
        k.slice(0, Math.max(1, Math.floor(k.length / 10))).forEach(function (x) { delete L.cache[x]; });
        testo = JSON.stringify(tutte);
      }
      PD.store.save("traduzioni", tutte);
    }, 1500);
  }
  var timerIA = null, inCorsoIA = false;
  function pianificaIA() {
    if (!L.attiva() || !L.iaPronta()) return;
    clearTimeout(timerIA); timerIA = setTimeout(chiediIA, 1500);
  }
  function chiediIA() {
    if (inCorsoIA) return pianificaIA();
    var lista = Object.keys(L.mancanti).filter(function (s) { return cerca(s) == null; });
    lista.sort(function (a, b) { return a.length - b.length; });          // prima i testi brevi (pulsanti, titoli)
    var lotto = [], tot = 0;
    lista.forEach(function (s) { if (lotto.length < 25 && tot + s.length < 6000) { lotto.push(s); tot += s.length; } });
    if (!lotto.length) { if (lista.length) lista.forEach(function (s) { delete L.mancanti[s]; }); return; }
    inCorsoIA = true;
    chiamaIA(lotto).then(function (tr) {
      inCorsoIA = false;
      tr.forEach(function (t, i) { if (t) memorizza(lotto[i], t); delete L.mancanti[lotto[i]]; });
      L.traduciAlbero(document.body);
      if (Object.keys(L.mancanti).length) pianificaIA();
    }, function () { inCorsoIA = false; });
  }
  /* un testo lungo (risposta della guida, lezione letta ad alta voce) tradotto al volo; senza IA resta com'è */
  L.traduciTesto = function (testo) {
    if (!L.attiva() || !testo) return Promise.resolve(testo);
    var core = String(testo).trim(), d = cerca(core.replace(/\s+/g, " "));
    if (d != null) return Promise.resolve(d);
    if (L.cache[core] != null) return Promise.resolve(L.cache[core]);
    if (!L.iaPronta()) return Promise.resolve(testo);
    return chiamaIA([core]).then(function (t) { if (t[0]) { memorizza(core, t[0]); return t[0]; } return testo; }, function () { return testo; });
  };

  /* ------------------------------------------------------------------ avvio e cambio lingua */
  function dizionarioIncluso(lingua) {          // versione portatile e app del telefono: i dizionari sono dentro la pagina
    var el = document.getElementById("pd-i18n-" + lingua);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  L.imposta = function (lingua) {
    if (!L.LINGUE[lingua]) lingua = "it";
    L.lingua = lingua;
    document.documentElement.lang = lingua;
    L.diz = {}; L.cache = {};
    if (lingua === "it") return Promise.resolve();
    var incluso = dizionarioIncluso(lingua);
    var p = incluso ? Promise.resolve(incluso) : fetch("i18n/" + lingua + ".json").then(function (r) { if (!r.ok) throw new Error("dizionario mancante"); return r.json(); });
    return p.then(function (j) {
      Object.keys(j.t || {}).forEach(function (k) { L.diz[chiave(k)] = j.t[k]; });
      return PD.store.load("traduzioni").then(function (c) {
        L._tutte = c && typeof c === "object" ? c : {};
        L.cache = L._tutte[lingua] || {};
      }, function () {});
    }).catch(function (e) { if (window.console) console.warn("i18n", e && e.message); });
  };
  L.osserva = function () {
    if (L.oss || !window.MutationObserver || !L.attiva()) return;
    L.oss = new MutationObserver(function (lista) {
      lista.forEach(function (m) {
        if (m.type === "characterData") nodoTesto(m.target);
        else if (m.type === "attributes") elemento(m.target);
        else for (var i = 0; i < m.addedNodes.length; i++) L.traduciAlbero(m.addedNodes[i]);
      });
      titoloPagina();
      pianificaIA();
    });
    L.oss.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  };
  L.cambia = function (lingua) {
    PD.settings.lingua = lingua;
    PD.saveSettings();
    var fatto = false, ricarica = function () { if (!fatto) { fatto = true; location.reload(); } };
    setTimeout(ricarica, 700);           // il tempo di salvare l'impostazione sul computer
  };

  /* ------------------------------------------------------------------ scelta della lingua: pulsante 🌐 in alto e Impostazioni */
  function bottoniLingue(attuale) {
    return '<div class="pd-lingue">' + Object.keys(L.LINGUE).map(function (k) {
      var x = L.LINGUE[k];
      return '<button type="button" class="pd-lingua' + (k === attuale ? " scelta" : "") + '" data-lingua="' + k + '" lang="' + k + '" data-no-trad aria-pressed="' + (k === attuale) + '">' +
        '<span class="band" aria-hidden="true">' + x.bandiera + "</span><b>" + x.nome + "</b></button>";
    }).join("") + "</div>";
  }
  function legaBottoni(radice) {
    $$("[data-lingua]", radice).forEach(function (b) {
      b.onclick = function () { var l = b.getAttribute("data-lingua"); chiudiMenu(); if (l !== (PD.settings.lingua || "it")) L.cambia(l); };
    });
    var c = $("[data-trad-ia]", radice);
    if (c) c.onchange = function () { PD.settings.traduzioneIA = c.checked; PD.saveSettings(); if (c.checked) pianificaIA(); };
  }
  function opzioneIA() {
    return '<label class="pd-lingua-ia"><input type="checkbox" data-trad-ia' + (PD.settings.traduzioneIA ? " checked" : "") + "> " +
      "🧠 Traduci anche lezioni e risposte lunghe con l'IA locale (sul computer, senza inviare nulla)</label>";
  }
  function chiudiMenu() { var m = document.getElementById("pd-lingua-menu"); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function apriMenu(btn) {
    if (document.getElementById("pd-lingua-menu")) { chiudiMenu(); return; }
    var m = document.createElement("div");
    m.className = "menu-pop pd-lingua-menu"; m.id = "pd-lingua-menu"; m.setAttribute("role", "dialog");
    m.setAttribute("aria-label", "Lingua · Language");
    m.innerHTML = '<p data-no-trad><b>🌐 Lingua · Language · Langue · Idioma · Sprache · Limbă</b></p>' + bottoniLingue(PD.settings.lingua || "it") +
      (PD.server ? opzioneIA() : "") +
      '<p class="small muted">L\'interfaccia è tradotta a mano. Lezioni e risposte lunghe le traduce l\'IA locale, se c\'è; altrimenti restano in italiano. I vademecum sono in italiano.</p>';
    document.body.appendChild(m);
    var r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 6) + "px"; m.style.right = Math.max(8, window.innerWidth - r.right) + "px";
    legaBottoni(m);
    L.traduciAlbero(m);
    setTimeout(function () {
      document.addEventListener("click", function fuori(e) {
        if (!document.getElementById("pd-lingua-menu")) { document.removeEventListener("click", fuori); return; }
        if (!m.contains(e.target) && !btn.contains(e.target)) { chiudiMenu(); document.removeEventListener("click", fuori); }
      });
    }, 0);
    var sc = m.querySelector(".pd-lingua.scelta") || m.querySelector("button"); if (sc) sc.focus();
  }
  L.apriMenu = function () { var b = document.getElementById("btn-lingua"); if (b) apriMenu(b); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") chiudiMenu(); });
  function aggiornaBottone() {
    var b = document.getElementById("btn-lingua");
    if (b) b.querySelector(".cod").textContent = (L.lingua || "it").toUpperCase();
  }
  document.addEventListener("DOMContentLoaded", function () {
    var tools = $(".topbar .tools"); if (!tools || document.getElementById("btn-lingua")) return;
    var b = document.createElement("button");
    b.className = "icon-btn pd-btn-lingua"; b.id = "btn-lingua"; b.type = "button";
    b.title = "Lingua · Language · Langue · Idioma · Sprache · Limbă"; b.setAttribute("aria-label", "Lingua · Language");
    b.setAttribute("aria-haspopup", "dialog"); b.setAttribute("data-no-trad", "");
    b.innerHTML = '<span aria-hidden="true">🌐</span><span class="cod">' + (L.lingua || "it").toUpperCase() + "</span>";
    b.onclick = function () { apriMenu(b); };
    var primo = $("#btn-print", tools);
    tools.insertBefore(b, primo || tools.firstChild);
  });

  PD.hooks.settingsCards.push({
    html: function () {
      return '<div class="card" id="pd-lingua-card"><h2 style="margin-top:0">🌐 Lingua del programma</h2>' +
        '<p class="small muted" data-no-trad>Lingua · Language · Langue · Idioma · Sprache · Limbă</p>' + bottoniLingue(PD.settings.lingua || "it") +
        (PD.server ? opzioneIA() : "") +
        "<p class=\"small muted\">L'interfaccia è tradotta a mano. Lezioni, risposte della guida e quiz li traduce l'IA locale, se è installata: " +
        "sul computer, senza inviare nulla fuori. Senza IA restano in italiano. La voce usa le voci del computer nella lingua scelta.</p></div>";
    },
    bind: function (el) { var c = $("#pd-lingua-card", el); if (c) legaBottoni(c); }
  });

  /* dopo aver letto le impostazioni: si carica il dizionario e si traduce tutto quello che compare */
  PD.hooks.dopoCaricamento.push(function () {
    return L.imposta(PD.settings.lingua || "it").then(function () {
      aggiornaBottone();
      if (!L.attiva()) return;
      L.osserva(); L.traduciAlbero(document.body); titoloPagina();
    });
  });
})();
