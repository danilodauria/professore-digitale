/* ==============================================================================
 *  PROFESSORE DIGITALE - «Ripasso intelligente» e «Domanda del giorno»
 *  Le domande sbagliate nei quiz (lezioni e grandi quiz) diventano «schede» da ripassare
 *  con il metodo delle scatole (Leitner): chi sbaglia torna alla scatola 1 e rivede la domanda
 *  domani; chi risponde giusto sale di scatola e la rivede dopo 1, 3, 7, 14, 30 giorni.
 *  Oltre la quinta scatola la domanda e' «imparata». I dati stanno in PD.progress.ripasso
 *  (quindi seguono il profilo attivo e restano su questo computer).
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var INTERVALLI = [1, 3, 7, 14, 30];   // giorni di attesa per le scatole 1..5
  var MAX_SCHEDE = 400, PER_SESSIONE = 10, LETTERE = "ABCDEFGH";

  /* ------------------------------------------------------------------ date (giorno locale) */
  function due(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(d) { return d.getFullYear() + "-" + due(d.getMonth() + 1) + "-" + due(d.getDate()); }
  function oggi() { return (PD.ripasso && PD.ripasso._oggi) || fmt(new Date()); }
  function piuGiorni(data, n) {
    var p = data.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
    d.setDate(d.getDate() + n); return fmt(d);
  }
  function giorniTra(a, b) {   // b - a in giorni
    var pa = a.split("-"), pb = b.split("-");
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }
  function quando(data) {
    var g = giorniTra(oggi(), data);
    return g <= 0 ? "oggi" : g === 1 ? "domani" : "tra " + g + " giorni";
  }

  /* ------------------------------------------------------------------ dati */
  /* hash semplice e stabile (djb2) del testo della domanda, normalizzato */
  function hash(s) {
    var h = 5381; s = String(s || "");
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h;
  }
  function chiave(testo) { return "r" + hash(String(testo || "").toLowerCase().replace(/\s+/g, " ").trim()).toString(36); }
  function dati() {
    var p = PD.progress || (PD.progress = { lessons: {} });
    var R = p.ripasso;
    if (!R || typeof R !== "object") R = p.ripasso = {};
    if (!R.schede || typeof R.schede !== "object") R.schede = {};
    if (!R.giorno || typeof R.giorno !== "object") R.giorno = {};
    if (typeof R.serie !== "number") R.serie = 0;
    if (!R.ultimoGiorno) R.ultimoGiorno = "";
    return R;
  }
  function valido(item) {
    return item && typeof item.q === "string" && item.q && Array.isArray(item.o) && item.o.length > 1 &&
      typeof item.a === "number" && item.a >= 0 && item.a < item.o.length;
  }
  function elenco(filtro) {
    var S = dati().schede, out = [];
    for (var k in S) if (Object.prototype.hasOwnProperty.call(S, k) && (!filtro || filtro(S[k]))) out.push(S[k]);
    return out;
  }
  function inScadenza(s) { return !s.imparata && s.prossima && s.prossima <= oggi(); }
  function perScadenza(a, b) { return a.prossima < b.prossima ? -1 : a.prossima > b.prossima ? 1 : (a.scatola || 1) - (b.scatola || 1); }

  /* serie di giorni di fila con almeno un ripasso */
  function segnaGiorno() {
    var R = dati(), o = oggi();
    if (R.ultimoGiorno === o) return;
    R.serie = R.ultimoGiorno && giorniTra(R.ultimoGiorno, o) === 1 ? (R.serie || 0) + 1 : 1;
    R.ultimoGiorno = o;
  }
  function serieAttuale() {
    var R = dati();
    if (!R.ultimoGiorno) return 0;
    return giorniTra(R.ultimoGiorno, oggi()) <= 1 ? R.serie || 0 : 0;
  }

  /* al massimo MAX_SCHEDE: prima si tolgono le imparate piu' vecchie, poi (caso estremo) le piu' vecchie in assoluto */
  function limita() {
    var R = dati(), tutte = elenco();
    if (tutte.length <= MAX_SCHEDE) return;
    var vecchie = function (a, b) { return (a.ultima || "") < (b.ultima || "") ? -1 : (a.ultima || "") > (b.ultima || "") ? 1 : 0; };
    var togli = tutte.filter(function (s) { return s.imparata; }).sort(vecchie)
      .concat(tutte.filter(function (s) { return !s.imparata; }).sort(vecchie));
    for (var i = 0; i < togli.length && elenco().length > MAX_SCHEDE; i++) {
      if (togli[i].imparata) R.imparateTolte = (R.imparateTolte || 0) + 1;
      delete R.schede[togli[i].chiave];
    }
  }

  /* cuore del metodo. inRipasso = risposta data nel ripasso (o nella domanda del giorno): la scheda avanza sempre */
  function aggiorna(item, giusta, inRipasso) {
    if (!valido(item)) return null;
    var R = dati(), k = chiave(item.q), s = R.schede[k], o = oggi();
    if (giusta && !s) return null;   // giusta al primo colpo: niente scheda, il ripasso non si riempie
    if (!s) s = R.schede[k] = { chiave: k, scatola: 1, sbagli: 0, giuste: 0 };
    s.q = item.q; s.o = item.o.slice(); s.a = item.a; s.e = item.e || ""; s.fonte = item.fonte || s.fonte || "";
    if (item.lezione) s.lezione = item.lezione;
    if (item.prova) s.prova = item.prova;
    s.ultima = new Date().toISOString();
    if (!giusta) {
      s.sbagli = (s.sbagli || 0) + 1; s.scatola = 1; s.imparata = false; s.prossima = piuGiorni(o, INTERVALLI[0]);
    } else {
      s.giuste = (s.giuste || 0) + 1;
      if (!s.imparata && (inRipasso || inScadenza(s))) {
        s.scatola = (s.scatola || 1) + 1;
        if (s.scatola > INTERVALLI.length) { s.imparata = true; s.scatola = INTERVALLI.length; s.prossima = ""; }
        else s.prossima = piuGiorni(o, INTERVALLI[s.scatola - 1]);
      }
    }
    if (inRipasso) segnaGiorno();
    limita();
    return s;
  }

  PD.registraRisposta = function (item, giusta) {
    try { if (aggiorna(item, !!giusta, false)) PD.saveProgress(); } catch (e) { if (window.console) console.error(e); }
  };

  PD.ripasso = {
    _oggi: "",   // solo per le prove: forza la data di oggi ("AAAA-MM-GG")
    daRipassare: function () { return elenco(inScadenza).length; },
    totale: function () { return elenco(function (s) { return !s.imparata; }).length; },
    imparate: function () { return elenco(function (s) { return s.imparata; }).length + (dati().imparateTolte || 0); },
    schedeOggi: function () { return elenco(inScadenza).sort(perScadenza); },
    serie: serieAttuale,
    chiave: chiave,
    oggi: oggi
  };

  /* ------------------------------------------------------------------ utilita' per le domande */
  /* mescola le opzioni tenendo traccia della giusta; con un seme la sequenza e' sempre la stessa */
  function mescola(s, seme) {
    var idx = s.o.map(function (x, i) { return i; }), r = seme ? (hash(seme) % 2147483646) + 1 : 0;
    function caso() { if (!seme) return Math.random(); r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; }
    for (var i = idx.length - 1; i > 0; i--) { var j = Math.floor(caso() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    return { q: s.q, o: idx.map(function (i) { return s.o[i]; }), a: idx.indexOf(s.a), e: s.e, fonte: s.fonte, orig: s };
  }
  function opzioniHTML(d) {
    return d.o.map(function (o, oi) {
      return '<button class="quiz-opt" data-o="' + oi + '"><span class="lett">' + LETTERE.charAt(oi) + "</span> " + esc(o) + "</button>";
    }).join("");
  }
  function testoDaLeggere(d) {
    return d.q + ". " + d.o.map(function (o, oi) { return "Risposta " + LETTERE.charAt(oi) + ": " + o; }).join(". ");
  }
  function plur(n, uno, tanti) { return n + " " + (n === 1 ? uno : tanti); }

  /* ------------------------------------------------------------------ vista #/ripasso */
  PD.views.ripasso = function (el) {
    PD.stopSpeech();
    var n = PD.ripasso.daRipassare(), tot = PD.ripasso.totale(), imp = PD.ripasso.imparate(), serie = serieAttuale();
    var html = '<div class="lesson-head"><span class="big-ico">🔁</span><div><div class="small muted">Metodo delle scatole: si rivede ciò che si dimentica</div>' +
      '<h1>Ripasso</h1></div><button class="btn ghost" data-go="#/home" style="margin-left:auto">🏠 Inizio</button></div>' +
      '<div class="rip-numeri">' +
      numero(n, n === 1 ? "domanda da ripassare oggi" : "domande da ripassare oggi", "oggi") +
      numero(tot, "in ripasso in tutto", "") +
      numero(imp, imp === 1 ? "imparata" : "imparate", "ok") +
      numero(serie, serie === 1 ? "giorno di fila" : "giorni di fila", "serie") + "</div>";
    if (n) {
      html += '<div class="card rip-intro">' + PD.profHTML() + "<div><p class=\"lead\">" +
        (n === 1 ? "Oggi vi aspetta <b>una domanda</b>." : "Oggi vi aspettano <b>" + n + " domande</b>.") +
        " Sono quelle che vi hanno messo in difficoltà: rivederle al momento giusto aiuta a ricordarle per sempre.</p>" +
        '<p class="small muted">Al massimo ' + PER_SESSIONE + " domande per volta, con calma. Nessun voto.</p>" +
        '<div class="row"><button class="btn big" id="rip-via">▶ Inizia il ripasso</button></div></div></div>';
    } else if (tot) {
      var prima = elenco(function (s) { return !s.imparata; }).sort(perScadenza)[0];
      html += '<div class="card rip-intro">' + PD.profHTML() + '<div><p class="lead">😊 <b>Per oggi avete finito.</b> Nessuna domanda da ripassare.</p>' +
        "<p>La prossima tornerà <b>" + quando(prima.prossima) + "</b>. Se avete voglia, potete ripassare lo stesso le domande più vicine.</p>" +
        '<div class="row"><button class="btn big ghost" id="rip-comunque">🔁 Ripassa comunque</button></div></div></div>';
    } else {
      html += '<div class="card rip-intro">' + PD.profHTML() + '<div><p class="lead">🌱 <b>Il ripasso è vuoto</b>, ed è una bella notizia.</p>' +
        "<p>Quando sbagliate una domanda in una lezione o in un quiz, il Professore la mette da parte e ve la ripropone qui, " +
        "il giorno dopo e poi a distanza di qualche giorno, finché non la ricordate bene.</p>" +
        '<div class="row"><button class="btn big" data-go="#/lessons">📚 Fate una lezione</button><button class="btn big ghost" data-go="#/quiz">🎓 Provate un quiz</button></div></div></div>';
    }
    html += '<div class="card rip-come"><h2 style="margin-top:0">📦 Come funziona</h2><ol class="rip-scatole">' +
      INTERVALLI.map(function (g, i) {
        var c = elenco(function (s) { return !s.imparata && (s.scatola || 1) === i + 1; }).length;
        return '<li><b>Scatola ' + (i + 1) + "</b><span class=\"small muted\">si rivede dopo " + plur(g, "giorno", "giorni") + '</span><span class="badge">' + c + "</span></li>";
      }).join("") + '<li class="fine"><b>🏅 Imparate</b><span class="small muted">non tornano più</span><span class="badge done">' + imp + "</span></li></ol>" +
      '<p class="small muted">Risposta giusta: la domanda sale di una scatola e torna più avanti. Risposta sbagliata: torna nella scatola 1 e la rivedete domani.</p></div>';
    el.innerHTML = html;
    var via = $("#rip-via", el), com = $("#rip-comunque", el);
    if (via) via.onclick = function () { sessione(el, PD.ripasso.schedeOggi().slice(0, PER_SESSIONE)); };
    if (com) com.onclick = function () { sessione(el, elenco(function (s) { return !s.imparata; }).sort(perScadenza).slice(0, PER_SESSIONE)); };
  };
  function numero(n, etichetta, cls) {
    return '<div class="card rip-num' + (cls ? " " + cls : "") + '"><b>' + n + '</b><span>' + esc(etichetta) + "</span></div>";
  }

  /* una domanda alla volta, come nei grandi quiz */
  function sessione(el, schede) {
    var D = schede.map(function (s) { return mescola(s); }), i = 0, giuste = 0, sbagliate = [], salite = 0, imparateOra = 0;
    if (!D.length) { PD.views.ripasso(el); return; }
    function mostra() {
      var d = D[i];
      el.innerHTML = '<div class="lesson-head"><span class="big-ico">🔁</span><div><div class="small muted">Domanda ' + (i + 1) + " di " + D.length +
        " · scatola " + (d.orig.scatola || 1) + "</div><h1>Ripasso</h1></div>" +
        '<button class="btn ghost" id="rip-esci" style="margin-left:auto">✕ Interrompi</button></div>' +
        '<div class="progress big"><span style="width:' + Math.round(100 * i / D.length) + '%"></span></div>' +
        '<div class="card quiz-run rip-run"><div class="quiz-q">' + (d.fonte ? '<div class="small muted rip-fonte">Da: ' + esc(d.fonte) + "</div>" : "") +
        "<h3>" + esc(d.q) + "</h3>" + opzioniHTML(d) + '<div class="explain" aria-live="polite"></div></div>' +
        '<div class="row"><button class="btn ghost" id="rip-leggi">🔊 Leggi la domanda</button><span class="small muted">Giuste finora: ' + giuste + "</span></div></div>";
      $("#rip-leggi", el).onclick = function () { PD.speak(testoDaLeggere(d), true); };
      $("#rip-esci", el).onclick = function () { PD.stopSpeech(); PD.views.ripasso(el); };
      $$(".quiz-opt", el).forEach(function (b) {
        b.onclick = function () {
          var oi = +b.getAttribute("data-o"), ok = oi === d.a, prima = d.orig.scatola || 1;
          $$(".quiz-opt", el).forEach(function (x) { x.disabled = true; if (+x.getAttribute("data-o") === d.a) x.classList.add("right"); });
          if (!ok) { b.classList.add("wrong"); sbagliate.push(d); } else giuste++;
          var s = aggiorna(d.orig, ok, true); PD.saveProgress();
          var nota = "";
          if (ok && s) {
            if (s.imparata) { imparateOra++; nota = "🏅 Questa ormai la sapete: è <b>imparata</b>!"; }
            else { if (s.scatola > prima) salite++; nota = "📦 Sale nella scatola " + s.scatola + ": la rivedrete " + quando(s.prossima) + "."; }
          } else if (s) nota = "📦 Torna nella scatola 1: la rivedrete domani, con calma.";
          $(".explain", el).innerHTML = (ok ? "✅ <b>Esatto!</b> " : "❌ <b>Non proprio.</b> La risposta giusta è <b>" + esc(d.o[d.a]) + "</b>. ") + esc(d.e) +
            '<div class="small rip-nota">' + nota + "</div>" +
            '<div class="row" style="margin-top:.8rem"><button class="btn big" id="rip-avanti">' + (i + 1 < D.length ? "Avanti →" : "Fine del ripasso 🏁") + "</button></div>";
          if (PD.settings.autoReadAnswers) PD.speak((ok ? "Esatto! " : "Non proprio. ") + (d.e || ""));
          var av = $("#rip-avanti", el); av.focus();
          av.onclick = function () { PD.stopSpeech(); i++; if (i < D.length) mostra(); else fine(); };
        };
      });
    }
    function fine() {
      var tot = D.length, resto = PD.ripasso.daRipassare();
      var titolo = giuste === tot ? "Perfetto, tutte giuste!" : giuste >= tot / 2 ? "Bel lavoro!" : "Bravi per l'impegno!";
      el.innerHTML = '<div class="card rip-fine">' + PD.profHTML().replace("<div>", '<div style="display:inline-block">') +
        '<div style="font-size:3rem">' + (giuste === tot ? "🌟" : "💪") + "</div><h2>" + titolo + "</h2>" +
        '<p style="font-size:1.2rem">Risposte giuste: <b>' + giuste + " su " + tot + "</b>.</p>" +
        (imparateOra ? "<p>🏅 " + (imparateOra === 1 ? "Una domanda è ormai <b>imparata</b>." : imparateOra + " domande sono ormai <b>imparate</b>.") + "</p>" : "") +
        (salite ? "<p>📦 " + (salite === 1 ? "Una domanda è salita" : salite + " domande sono salite") + " di scatola: la rivedrete più avanti.</p>" : "") +
        (serieAttuale() > 1 ? "<p>🔥 Avete ripassato per <b>" + serieAttuale() + " giorni di fila</b>. Continuate così!</p>" : "") +
        (resto ? '<p class="small muted">Restano ancora ' + plur(resto, "domanda", "domande") + " per oggi.</p>" : "") +
        '<div class="row" style="justify-content:center">' + (resto ? '<button class="btn big" id="rip-ancora">▶ Continua il ripasso</button>' : "") +
        '<button class="btn big ghost" data-go="#/home">🏠 Torna all\'inizio</button></div></div>' +
        (sbagliate.length ? '<div class="card" style="margin-top:1rem"><h3 style="margin-top:0">📅 Domani riproviamo queste</h3>' + sbagliate.map(function (d) {
          return '<div class="rip-riga"><b>' + esc(d.q) + "</b><br>✔ " + esc(d.o[d.a]) + (d.e ? '<br><span class="small muted">' + esc(d.e) + "</span>" : "") + "</div>";
        }).join("") + "</div>" : "");
      var an = $("#rip-ancora", el);
      if (an) an.onclick = function () { sessione(el, PD.ripasso.schedeOggi().slice(0, PER_SESSIONE)); };
      PD.speak(giuste === tot ? "Perfetto! Avete risposto bene a tutte le domande del ripasso." :
        "Avete dato " + giuste + " risposte giuste su " + tot + ". " + (sbagliate.length ? "Le altre le riproviamo domani, con calma." : ""));
    }
    mostra();
  }

  /* ------------------------------------------------------------------ domanda del giorno */
  function raccolta() {
    var pool = [];
    PD.lessonsOf("corso").forEach(function (L) {
      (L.quiz || []).forEach(function (q) { pool.push({ q: q.q, o: q.o, a: q.a, e: q.e, fonte: L.title, lezione: L.id }); });
    });
    (window.PD_PROVE || []).forEach(function (P) {
      (P.domande || []).forEach(function (q) { pool.push({ q: q.q, o: q.o, a: q.a, e: q.e, fonte: P.titolo, prova: P.id }); });
    });
    return pool.filter(valido);
  }
  /* sceglie (una sola volta al giorno) e ricorda la domanda di oggi: ricaricando resta la stessa */
  function domandaDiOggi() {
    var R = dati(), o = oggi(), G = R.giorno;
    if (G.data === o && G.item && valido(G.item)) return G;
    var item = null, scadute = PD.ripasso.schedeOggi(), seme = hash("pd-giorno-" + o);
    if (scadute.length) {
      var s = scadute[seme % Math.min(scadute.length, 5)];
      item = { q: s.q, o: s.o, a: s.a, e: s.e, fonte: s.fonte, lezione: s.lezione, prova: s.prova };
    } else {
      var pool = raccolta();
      if (pool.length) item = pool[seme % pool.length];
    }
    if (!item) return null;
    R.giorno = { data: o, chiave: chiave(item.q), risposto: false, giusta: false, item: item };
    PD.saveProgress();
    return R.giorno;
  }
  function giornoHTML() {
    if (!PD.settings.domandaGiorno) return "";
    var G = domandaDiOggi();
    if (!G || G.chiusa) return "";
    var d = mescola(G.item, "pd-ordine-" + G.data + G.chiave);
    var corpo = '<h3 class="rip-gq">' + esc(d.q) + "</h3>" + opzioniHTML(d);
    if (G.risposto) corpo = '<h3 class="rip-gq">' + esc(d.q) + "</h3>" + esitoGiorno(G, d);
    return '<div class="card rip-giorno" id="rip-giorno"><div class="rip-giorno-testa"><h2>☀️ La domanda del giorno</h2>' +
      '<button class="btn ghost rip-chiudi" id="rip-g-chiudi" title="Chiudi per oggi" aria-label="Chiudi la domanda del giorno per oggi">✕</button></div>' +
      '<div class="quiz-q">' + corpo + '<div class="explain" aria-live="polite"></div></div>' +
      (G.risposto ? "" : '<div class="row"><button class="btn ghost" id="rip-g-leggi">🔊 Leggi la domanda</button>' +
        (G.item.fonte ? '<span class="small muted">Da: ' + esc(G.item.fonte) + "</span>" : "") + "</div>") + "</div>";
  }
  function esitoGiorno(G, d) {
    return '<p class="rip-esito ' + (G.giusta ? "ok" : "no") + '">' + (G.giusta ? "✅ <b>Esatto!</b> " : "❌ <b>Non proprio.</b> La risposta giusta è <b>" + esc(d.o[d.a]) + "</b>. ") +
      esc(d.e || "") + "</p>" + (G.giusta ? "" : '<p class="small muted">📦 L\'ho messa nel <a href="#/ripasso" data-go="#/ripasso">ripasso</a>: la rivedrete domani.</p>') +
      '<p class="rip-domani">🌅 <b>Domani un\'altra!</b></p>';
  }
  function giornoBind(home) {
    var box = $("#rip-giorno", home); if (!box) return;
    var R = dati(), G = R.giorno, d = mescola(G.item, "pd-ordine-" + G.data + G.chiave);
    $("#rip-g-chiudi", box).onclick = function () {
      G.chiusa = true; PD.saveProgress(); PD.stopSpeech();
      box.parentNode.removeChild(box); PD.toast("Va bene: la domanda del giorno torna domani.");
    };
    var lg = $("#rip-g-leggi", box);
    if (lg) lg.onclick = function () { PD.speak(testoDaLeggere(d), true); };
    $$(".quiz-opt", box).forEach(function (b) {
      b.onclick = function () {
        if (G.risposto) return;
        var oi = +b.getAttribute("data-o"), ok = oi === d.a;
        $$(".quiz-opt", box).forEach(function (x) { x.disabled = true; if (+x.getAttribute("data-o") === d.a) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        G.risposto = true; G.giusta = ok;
        var giaScheda = !!dati().schede[G.chiave];
        if (!ok || giaScheda) aggiorna(G.item, ok, true); else segnaGiorno();
        PD.saveProgress();
        $(".explain", box).innerHTML = esitoGiorno(G, d);
        if (lg && lg.parentNode) lg.parentNode.parentNode.removeChild(lg.parentNode);
        aggiornaTile(home);
        if (PD.settings.autoReadAnswers) PD.speak((ok ? "Esatto! " : "Non proprio. ") + (d.e || "") + " Domani un'altra!");
      };
    });
  }

  /* ------------------------------------------------------------------ Inizio e Impostazioni */
  function tileTesto() {
    var n = PD.ripasso.daRipassare(), tot = PD.ripasso.totale();
    if (n) return '<b class="rip-n">' + (n === 1 ? "1 domanda vi aspetta" : n + " domande vi aspettano") + "</b> oggi. Pochi minuti, con calma.";
    if (tot) return "Per oggi niente da ripassare. 👍 " + plur(tot, "domanda", "domande") + " in attesa nei prossimi giorni.";
    return "Le domande sbagliate tornano qui, al momento giusto, per ricordarle meglio.";
  }
  function aggiornaTile(home) {
    var t = $("#rip-tile p", home); if (t) t.innerHTML = tileTesto();
  }
  PD.hooks.homeTiles.push(function () {
    var n = PD.ripasso.daRipassare();
    return PD.tileHTML("🔁", "Ripasso" + (n ? ' <span class="badge warn">' + n + "</span>" : ""), tileTesto(), "#/ripasso", "rip-tile" + (n ? " rip-attesa" : ""))
      .replace('<button class="card tile', '<button id="rip-tile" class="card tile');
  });
  PD.hooks.homeCards.push({ html: giornoHTML, bind: giornoBind });

  PD.hooks.settingsCards.push({
    html: function () {
      return '<div class="card rip-impostazioni" id="rip-impostazioni"><h2 style="margin-top:0">🔁 Ripasso e domanda del giorno</h2>' +
        '<label class="switch"><input type="checkbox" id="s-domgiorno"' + (PD.settings.domandaGiorno ? " checked" : "") +
        ">Mostra nella pagina Inizio una «domanda del giorno» a cui rispondere</label>" +
        '<p class="small muted">Nel ripasso ci sono ora <b>' + PD.ripasso.totale() + "</b> domande (" + PD.ripasso.imparate() + " già imparate). " +
        "Le domande sbagliate nelle lezioni e nei quiz entrano da sole nel ripasso.</p>" +
        '<div class="row"><button class="btn ghost" data-go="#/ripasso">🔁 Apri il ripasso</button>' +
        '<button class="btn danger" id="rip-azzera">Azzera il ripasso</button></div></div>';
    },
    bind: function (el) {
      var c = $("#s-domgiorno", el), b = $("#rip-azzera", el), t = null;
      if (c) c.onchange = function () { PD.settings.domandaGiorno = this.checked; PD.saveSettings(); };
      if (b) b.onclick = function () {
        if (b.getAttribute("data-confirm")) {
          clearTimeout(t); PD.progress.ripasso = { schede: {}, giorno: {}, serie: 0, ultimoGiorno: "" }; PD.saveProgress();
          b.removeAttribute("data-confirm"); b.textContent = "Azzera il ripasso"; PD.toast("Ripasso azzerato.");
          var p = $("#rip-impostazioni p.small", el); if (p) p.innerHTML = "Il ripasso è vuoto.";
          return;
        }
        b.setAttribute("data-confirm", "1"); b.textContent = "Sicuri? Premete di nuovo per confermare";
        t = setTimeout(function () { b.removeAttribute("data-confirm"); b.textContent = "Azzera il ripasso"; }, 5000);
      };
    }
  });
})();
