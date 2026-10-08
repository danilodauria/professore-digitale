/* ==============================================================================
 *  PROFESSORE DIGITALE - Grandi quiz e attestati
 *  Le "prove" arrivano dai pacchetti di contenuti (chiave "prove"): per ogni tentativo si pescano
 *  a caso N domande bilanciate per categoria. Chi supera la soglia ottiene un attestato con il
 *  proprio nome, da stampare o da salvare in PDF (generato qui, senza Internet e senza librerie).
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

  PD.prove = function () { return (window.PD_PROVE || []).slice(); };
  function prova(id) { return PD.prove().filter(function (p) { return p.id === id; })[0]; }
  function res() { return PD.progress.quiz || (PD.progress.quiz = {}); }
  function attestati() { return PD.progress.attestati || (PD.progress.attestati = []); }
  function giudizio(perc) { return perc >= 95 ? "Eccellente" : perc >= 85 ? "Ottimo" : perc >= 75 ? "Buono" : "Sufficiente"; }
  function dataLunga(iso) { var d = new Date(iso); return d.getDate() + " " + MESI[d.getMonth()] + " " + d.getFullYear(); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function ordineProve(list) {
    return list.sort(function (a, b) { return (a.id === "informatica" ? -1 : 0) - (b.id === "informatica" ? -1 : 0); });
  }

  /* riepilogo per il quadro dell'aula */
  PD.quizSummary = function () {
    var r = res();
    return PD.prove().filter(function (p) { return r[p.id]; }).map(function (p) {
      return { titolo: p.titolo, migliore: r[p.id].perc, superata: !!r[p.id].superata };
    });
  };

  /* estrazione bilanciata: a turno una domanda per categoria, finche' non si arriva a N */
  function estrai(P) {
    var cats = {}, ordine = [];
    shuffle(P.domande.slice()).forEach(function (q) {
      var c = q.c || "-"; if (!cats[c]) { cats[c] = []; ordine.push(c); } cats[c].push(q);
    });
    var out = [], n = Math.min(P.domande_per_prova, P.domande.length);
    while (out.length < n) {
      var presi = 0;
      for (var i = 0; i < ordine.length && out.length < n; i++) { var q = cats[ordine[i]].pop(); if (q) { out.push(q); presi++; } }
      if (!presi) break;
    }
    return shuffle(out).map(function (q) {
      var idx = shuffle(q.o.map(function (x, i) { return i; }));
      return { q: q.q, o: idx.map(function (i) { return q.o[i]; }), a: idx.indexOf(q.a), e: q.e, c: q.c };
    });
  }

  /* ------------------------------------------------------------------ elenco */
  PD.views.quiz = function (el, args) {
    if (args[0]) return avvia(el, args[0]);
    var r = res(), list = ordineProve(PD.prove()), att = attestati();
    var html = '<h1>🎓 Quiz e attestati</h1><p class="lead">Mettetevi alla prova con calma: nessuna fretta, nessun voto a scuola. ' +
      "Chi risponde bene ad almeno il 70% delle domande riceve un <b>attestato</b> con il proprio nome, da stampare o salvare.</p>";
    if (!list.length) html += '<p class="notice">Nessun quiz disponibile: controllate i contenuti aggiuntivi in Impostazioni.</p>';
    html += '<div class="grid">' + list.map(function (P) {
      var x = r[P.id];
      return '<button class="card tile' + (P.id === "informatica" ? " spicca" : "") + '" data-go="#/quiz/' + esc(P.id) + '"><span class="big-ico">' + esc(P.icona) + "</span><h3>" +
        esc(P.titolo) + "</h3><p>" + P.domande_per_prova + " domande scelte a caso tra " + P.domande.length + ". Soglia: " + Math.round(P.soglia * 100) + "%.</p>" +
        (x ? '<span class="badge' + (x.superata ? " done" : "") + '">' + (x.superata ? "✓ Superato · " : "Miglior risultato: ") + x.perc + "%</span>" : '<span class="badge">Da provare</span>') + "</button>";
    }).join("") + "</div>";
    html += '<h2 style="font-size:1.25rem;margin:1.6rem 0 .6rem">🏅 I vostri attestati</h2>';
    html += att.length ? '<div class="attestati">' + att.slice().reverse().map(function (a) {
      return '<div class="card att-row"><span class="big-ico">🎓</span><div><b>' + esc(a.titolo) + "</b><br><span class=\"small muted\">" + esc(a.nome) + " · " +
        dataLunga(a.data) + " · " + a.punteggio + "/" + a.totale + " (" + a.perc + "%) · " + esc(a.giudizio) + '</span></div><button class="btn ghost" data-go="#/attestato/' +
        esc(a.codice) + '">Apri e stampa</button></div>';
    }).join("") + "</div>" : '<p class="muted">Ancora nessun attestato: superate un quiz per ottenere il primo!</p>';
    el.innerHTML = html;
  };

  /* ------------------------------------------------------------------ svolgimento */
  function avvia(el, id) {
    var P = prova(id);
    if (!P) { PD.go("#/quiz"); return; }
    var r = res()[P.id];
    el.innerHTML = '<div class="lesson-head"><span class="big-ico">' + esc(P.icona) + '</span><div><div class="small muted">Grande quiz · ' + P.domande_per_prova +
      " domande</div><h1>" + esc(P.titolo) + '</h1></div><button class="btn ghost" data-go="#/quiz" style="margin-left:auto">← Quiz e attestati</button></div>' +
      '<div class="card quiz-intro">' + PD.profHTML() + "<div>" + (P.descrizione ? "<p>" + esc(P.descrizione) + "</p>" : "") +
      "<ul><li>Riceverete <b>" + P.domande_per_prova + " domande</b>, una alla volta, scelte a caso: ogni tentativo è diverso.</li>" +
      "<li>Dopo ogni risposta vedrete se è giusta e una breve spiegazione.</li>" +
      "<li>Con almeno <b>" + Math.ceil(P.domande_per_prova * P.soglia) + " risposte giuste</b> su " + P.domande_per_prova + " (" + Math.round(P.soglia * 100) + "%) " + (P.senza_attestato ? "il quiz è superato." : "ottenete l'<b>attestato</b>.") + "</li></ul>" +
      (r ? '<p class="small muted">Tentativi fatti: ' + r.tentativi + " · miglior risultato: " + r.perc + "%" + (r.superata ? " · ✓ superato" : "") + "</p>" : "") +
      '<div class="field"><label for="q-nome">Il vostro nome e cognome (comparirà sull\'attestato)</label><input type="text" id="q-nome" maxlength="60" value="' +
      esc(PD.settings.studentName) + '" placeholder="es. Maria Rossi"></div>' +
      '<button class="btn big" id="q-via">▶ Inizia il quiz</button></div></div>';
    $("#q-via", el).onclick = function () {
      var nome = $("#q-nome", el).value.trim();
      if (nome !== PD.settings.studentName) { PD.settings.studentName = nome; PD.saveSettings(); }
      gioca(el, P, nome);
    };
  }

  function gioca(el, P, nome) {
    var D = estrai(P), i = 0, giuste = 0, sbagliate = [];
    function mostra() {
      var q = D[i];
      el.innerHTML = '<div class="lesson-head"><span class="big-ico">' + esc(P.icona) + '</span><div><div class="small muted">Domanda ' + (i + 1) + " di " + D.length +
        (q.c ? " · " + esc(q.c) : "") + "</div><h1>" + esc(P.titolo) + '</h1></div><button class="btn ghost" id="q-esci" style="margin-left:auto">✕ Interrompi</button></div>' +
        '<div class="progress big"><span style="width:' + Math.round(100 * i / D.length) + '%"></span></div>' +
        '<div class="card quiz-run"><div class="quiz-q"><h3>' + esc(q.q) + "</h3>" +
        q.o.map(function (o, oi) { return '<button class="quiz-opt" data-o="' + oi + '"><span class="lett">' + "ABCDEF".charAt(oi) + "</span> " + esc(o) + "</button>"; }).join("") +
        '<div class="explain" aria-live="polite"></div></div><div class="row"><button class="btn ghost" id="q-leggi">🔊 Leggi la domanda</button>' +
        '<span class="small muted">Giuste finora: ' + giuste + "</span></div></div>";
      $("#q-leggi", el).onclick = function () {
        PD.speak(q.q + ". " + q.o.map(function (o, oi) { return "Risposta " + "ABCDEF".charAt(oi) + ": " + o; }).join(". "), true);
      };
      $("#q-esci", el).onclick = function () { PD.stopSpeech(); PD.go("#/quiz"); };
      $$(".quiz-opt", el).forEach(function (b) {
        b.onclick = function () {
          var oi = +b.getAttribute("data-o"), ok = oi === q.a;
          $$(".quiz-opt", el).forEach(function (x) { x.disabled = true; if (+x.getAttribute("data-o") === q.a) x.classList.add("right"); });
          if (!ok) { b.classList.add("wrong"); sbagliate.push(q); } else giuste++;
          if (PD.registraRisposta) PD.registraRisposta({ q: q.q, o: q.o, a: q.a, e: q.e, fonte: P.titolo, prova: P.id }, ok);
          $(".explain", el).innerHTML = (ok ? "✅ <b>Esatto!</b> " : "❌ <b>Non proprio.</b> ") + esc(q.e) +
            '<div class="row" style="margin-top:.8rem"><button class="btn big" id="q-avanti">' + (i + 1 < D.length ? "Avanti →" : "Vedi il risultato 🏁") + "</button></div>";
          if (PD.settings.autoReadAnswers) PD.speak((ok ? "Esatto! " : "Non proprio. ") + q.e);
          var av = $("#q-avanti", el); av.focus();
          av.onclick = function () { PD.stopSpeech(); i++; if (i < D.length) mostra(); else fine(); };
        };
      });
    }
    function fine() {
      var tot = D.length, perc = Math.round(100 * giuste / tot), ok = giuste >= Math.ceil(tot * P.soglia - 1e-9);
      var r = res(), prec = r[P.id] || { tentativi: 0, perc: 0, best: 0 };
      r[P.id] = { best: Math.max(prec.best || 0, giuste), totale: tot, perc: Math.max(prec.perc || 0, perc), superata: !!(prec.superata || ok),
        tentativi: (prec.tentativi || 0) + 1, ultima: new Date().toISOString(), ultimo_perc: perc };
      var att = null;
      if (ok && !P.senza_attestato) {
        att = { codice: codice(P.id), prova: P.id, titolo: P.titolo, attestato: P.attestato, nome: nome || "Allievo", punteggio: giuste, totale: tot, perc: perc,
          giudizio: giudizio(perc), data: new Date().toISOString(), facilitatore: PD.settings.teacherName || "" };
        attestati().push(att);
      }
      PD.saveProgress();
      el.innerHTML = '<div class="card" style="text-align:center;padding:2rem">' + PD.profHTML().replace("<div>", '<div style="display:inline-block">') +
        '<div style="font-size:3rem">' + (ok ? "🎓" : "💪") + "</div><h2>" + (ok ? "Complimenti" + (nome ? ", " + esc(nome) : "") + "! Quiz superato." : "Ci siete quasi!") + "</h2>" +
        '<p style="font-size:1.25rem">Risposte giuste: <b>' + giuste + " su " + tot + "</b> (" + perc + "%)" + (ok ? " · giudizio: <b>" + giudizio(perc) + "</b>" : "") + "</p>" +
        (ok ? "" : "<p>Servono almeno " + Math.ceil(tot * P.soglia) + " risposte giuste. Ripassate le spiegazioni qui sotto e riprovate: le domande cambiano ogni volta.</p>") +
        '<div class="row" style="justify-content:center">' + (att ? '<button class="btn big" data-go="#/attestato/' + att.codice + '">🎓 Il vostro attestato</button>' : "") +
        '<button class="btn big ' + (att ? "ghost" : "") + '" id="q-ancora">↻ Riprova</button><button class="btn big ghost" data-go="#/quiz">Altri quiz</button></div></div>' +
        (sbagliate.length ? '<div class="card" style="margin-top:1rem"><h3 style="margin-top:0">📝 Da ripassare</h3>' + sbagliate.map(function (q) {
          return '<div class="ripasso"><b>' + esc(q.q) + "</b><br>✔ " + esc(q.o[q.a]) + '<br><span class="small muted">' + esc(q.e) + "</span></div>";
        }).join("") + "</div>" : "");
      $("#q-ancora", el).onclick = function () { gioca(el, P, nome); };
      PD.speak(ok ? "Complimenti! Avete superato il quiz con " + giuste + " risposte giuste su " + tot + "." + (att ? " Ecco il vostro attestato." : "") :
        "Avete dato " + giuste + " risposte giuste su " + tot + ". Ci siete quasi: ripassate e riprovate!");
      if (PD.aulaPresenza) PD.aulaPresenza();
    }
    mostra();
  }

  function codice(id) {
    var d = new Date(), s = id + "|" + d.getTime() + "|" + Math.random();
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "PD-" + d.getFullYear() + "-" + id.slice(0, 3).toUpperCase() + "-" + ("000000" + h.toString(36).toUpperCase()).slice(-6);
  }

  /* ------------------------------------------------------------------ attestato */
  function profSVG() {
    // copia del disegno del Professore, senza le parti animate (palpebre, nuvolette, onde)
    var sym = document.getElementById("prof-svg"); if (!sym) return null;
    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    for (var i = 0; i < sym.childNodes.length; i++) g.appendChild(sym.childNodes[i].cloneNode(true));
    $$(".lid, .bubbles, .ear-wave", g).forEach(function (n) { n.parentNode.removeChild(n); });
    $$("[clip-path]", g).forEach(function (n) { n.setAttribute("clip-path", n.getAttribute("clip-path").replace("pd-eye-clip", "att-eye-clip")); });
    var clips = ["l", "r"].map(function (k) {
      var c = document.getElementById("pd-eye-clip-" + k); return c ? c.outerHTML.replace("pd-eye-clip", "att-eye-clip") : "";
    }).join("");
    return { defs: clips, body: g.innerHTML };
  }
  function xml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  PD.attestatoSVG = function (a) {
    var W = 2970, H = 2100, prof = profSVG();
    var serif = "'Noto Serif Display','Noto Serif','DejaVu Serif',Georgia,'Times New Roman',serif";
    var sans = "'Noto Sans','DejaVu Sans','Segoe UI',Arial,sans-serif";
    var nome = a.nome || "", nfs = nome.length > 28 ? 120 : nome.length > 20 ? 150 : 180;
    var tit = a.attestato || a.titolo, tfs = tit.length > 46 ? 74 : tit.length > 34 ? 88 : 100;
    var fac = a.facilitatore || PD.settings.teacherName || "";
    var rosetta = "";
    for (var k = 0; k < 24; k++) {
      var ang = k * 15 * Math.PI / 180, x1 = Math.cos(ang) * 150, y1 = Math.sin(ang) * 150;
      rosetta += '<path d="M0 0 L' + (Math.cos(ang - 0.13) * 150).toFixed(1) + " " + (Math.sin(ang - 0.13) * 150).toFixed(1) + " L" + x1.toFixed(1) + " " + (y1 * 1.0 + 0).toFixed(1) +
        " L" + (Math.cos(ang + 0.13) * 150).toFixed(1) + " " + (Math.sin(ang + 0.13) * 150).toFixed(1) + 'Z" fill="' + (k % 2 ? "#c99a2e" : "#e2b84a") + '"/>';
    }
    var greca = "";
    for (var gx = 190; gx < W - 190; gx += 60) greca += '<path d="M' + gx + " 172 h30 v-22 h-18 v10" + '" fill="none" stroke="#c99a2e" stroke-width="5"/>' +
      '<path d="M' + gx + " " + (H - 172) + " h30 v22 h-18 v-10" + '" fill="none" stroke="#c99a2e" stroke-width="5"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Attestato">' +
      "<defs>" + (prof ? prof.defs : "") +
      '<radialGradient id="att-bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#f3ead6"/></radialGradient>' +
      '<linearGradient id="att-oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1d27a"/><stop offset=".5" stop-color="#c99a2e"/><stop offset="1" stop-color="#9c7419"/></linearGradient>' +
      '<pattern id="att-trama" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 22 Q11 0 22 22 T44 22" fill="none" stroke="#1d5c8f" stroke-opacity=".05" stroke-width="2"/></pattern>' +
      "</defs>" +
      '<rect width="' + W + '" height="' + H + '" fill="url(#att-bg)"/><rect width="' + W + '" height="' + H + '" fill="url(#att-trama)"/>' +
      '<rect x="60" y="60" width="' + (W - 120) + '" height="' + (H - 120) + '" fill="none" stroke="#1d5c8f" stroke-width="18"/>' +
      '<rect x="100" y="100" width="' + (W - 200) + '" height="' + (H - 200) + '" fill="none" stroke="url(#att-oro)" stroke-width="7"/>' +
      '<rect x="128" y="128" width="' + (W - 256) + '" height="' + (H - 256) + '" fill="none" stroke="#1d5c8f" stroke-opacity=".5" stroke-width="2.5"/>' + greca +
      [[128, 128, 1, 1], [W - 128, 128, -1, 1], [128, H - 128, 1, -1], [W - 128, H - 128, -1, -1]].map(function (c) {
        return '<g transform="translate(' + c[0] + " " + c[1] + ") scale(" + c[2] + " " + c[3] + ')"><path d="M0 0 h150 M0 0 v150" stroke="#c99a2e" stroke-width="10"/>' +
          '<circle cx="42" cy="42" r="20" fill="#1d5c8f"/><circle cx="42" cy="42" r="9" fill="#e2b84a"/></g>';
      }).join("") +
      '<text x="' + W / 2 + '" y="300" text-anchor="middle" font-family="' + sans + '" font-size="46" letter-spacing="14" fill="#1d5c8f" font-weight="700">PROFESSORE DIGITALE · CATTEDRA DIGITALE PORTATILE</text>' +
      '<text x="' + W / 2 + '" y="500" text-anchor="middle" font-family="' + serif + '" font-size="210" font-weight="700" fill="#1d5c8f" letter-spacing="18">ATTESTATO</text>' +
      '<text x="' + W / 2 + '" y="600" text-anchor="middle" font-family="' + serif + '" font-style="italic" font-size="70" fill="#9c7419">di superamento della prova</text>' +
      '<text x="' + W / 2 + '" y="770" text-anchor="middle" font-family="' + serif + '" font-size="62" fill="#374151">Si attesta che</text>' +
      '<text x="' + W / 2 + '" y="' + (950 - (180 - nfs) / 3) + '" text-anchor="middle" font-family="' + serif + '" font-style="italic" font-weight="700" font-size="' + nfs + '" fill="#1f2a37">' + xml(nome) + "</text>" +
      '<path d="M' + (W / 2 - 820) + ' 1000 H' + (W / 2 + 820) + '" stroke="url(#att-oro)" stroke-width="6"/>' +
      '<text x="' + W / 2 + '" y="1110" text-anchor="middle" font-family="' + serif + '" font-size="62" fill="#374151">ha superato con successo</text>' +
      '<text x="' + W / 2 + '" y="1240" text-anchor="middle" font-family="' + serif + '" font-weight="700" font-size="' + tfs + '" fill="#c2410c">«' + xml(a.titolo) + "»</text>" +
      (a.attestato && a.attestato !== a.titolo ? '<text x="' + W / 2 + '" y="1335" text-anchor="middle" font-family="' + serif + '" font-size="56" fill="#374151">Ambito: ' + xml(a.attestato) + "</text>" : "") +
      '<text x="' + W / 2 + '" y="1440" text-anchor="middle" font-family="' + sans + '" font-size="54" fill="#1f2a37">con ' + a.punteggio + " risposte esatte su " + a.totale +
      " (" + a.perc + "%) · giudizio: <tspan font-weight=\"700\">" + xml(a.giudizio) + "</tspan></text>" +
      // sigillo
      '<g transform="translate(2560 470)">' + rosetta + '<circle r="118" fill="url(#att-oro)" stroke="#9c7419" stroke-width="6"/>' +
      '<circle r="92" fill="none" stroke="#fff8e0" stroke-width="4" stroke-dasharray="10 8"/>' +
      '<path d="M-70 110 L-110 290 L-62 255 L-38 305 L-10 130Z" fill="#1d5c8f"/><path d="M70 110 L110 290 L62 255 L38 305 L10 130Z" fill="#174a73"/>' +
      '<text y="-12" text-anchor="middle" font-family="' + serif + '" font-weight="700" font-size="70" fill="#5b430d">PD</text>' +
      '<text y="48" text-anchor="middle" font-family="' + sans + '" font-weight="700" font-size="26" letter-spacing="4" fill="#5b430d">' + new Date(a.data).getFullYear() + "</text></g>" +
      // data e codice
      '<text x="330" y="1640" font-family="' + sans + '" font-size="44" fill="#4b5563">Data</text>' +
      '<text x="330" y="1710" font-family="' + serif + '" font-size="58" fill="#1f2a37">' + xml(dataLunga(a.data)) + "</text>" +
      '<text x="330" y="1800" font-family="' + sans + '" font-size="36" fill="#6b7280">Codice: ' + xml(a.codice) + "</text>" +
      '<text x="330" y="1855" font-family="' + sans + '" font-size="32" fill="#6b7280">Professore Digitale · Licenza MIT · ideato da Danilo D\'Auria</text>' +
      // firme
      '<path d="M' + (W - 1050) + ' 1700 H' + (W - 330) + '" stroke="#1f2a37" stroke-width="3"/>' +
      '<text x="' + (W - 690) + '" y="1680" text-anchor="middle" font-family="' + serif + '" font-style="italic" font-size="60" fill="#1d5c8f">' + xml(fac) + "</text>" +
      '<text x="' + (W - 690) + '" y="1760" text-anchor="middle" font-family="' + sans + '" font-size="40" fill="#4b5563">' + (fac ? "Il facilitatore" : "Firma del facilitatore") + "</text>" +
      (prof ? '<g transform="translate(250 340) scale(1.5)">' + prof.body + "</g>" : "") +
      '<text x="' + W / 2 + '" y="1790" text-anchor="middle" font-family="' + serif + '" font-style="italic" font-size="50" fill="#9c7419">Tecnologia gentile, per tutti.</text>' +
      "</svg>";
  };

  PD.views.attestato = function (el, args) {
    var a = attestati().filter(function (x) { return x.codice === args[0]; })[0];
    if (!a) { PD.go("#/quiz"); return; }
    el.innerHTML = '<div class="lesson-head"><span class="big-ico">🎓</span><div><div class="small muted">' + esc(a.titolo) + "</div><h1>Il vostro attestato</h1></div>" +
      '<button class="btn ghost" data-go="#/quiz" style="margin-left:auto">← Quiz e attestati</button></div>' +
      '<div class="row" style="margin-bottom:1rem"><button class="btn big" id="att-stampa">🖨️ Stampa</button><button class="btn big ghost" id="att-pdf">📄 Salva in PDF</button>' +
      '<label class="field" style="margin:0;min-width:16rem"><span class="small"><b>Nome sull\'attestato</b></span><input type="text" id="att-nome" maxlength="60" value="' + esc(a.nome) + '"></label></div>' +
      '<div class="attestato-box" id="att-box"></div><p class="small muted">Consiglio: stampate su carta A4 in orizzontale. Per salvare il file sul computer premete «Salva in PDF»: lo trovate nella cartella Download.</p>';
    var box = $("#att-box", el);
    function disegna() { box.innerHTML = PD.attestatoSVG(a); }
    disegna();
    $("#att-nome", el).onchange = function () { a.nome = this.value.trim() || a.nome; PD.saveProgress(); disegna(); };
    $("#att-stampa", el).onclick = function () { PD.printHTML(PD.attestatoSVG(a), "orizzontale"); };
    $("#att-pdf", el).onclick = function () {
      var b = this; b.disabled = true; b.textContent = "Preparo il PDF…";
      PD.svgToPdf(PD.attestatoSVG(a), "Attestato " + a.titolo).then(function (blob) {
        scarica(blob, "Attestato - " + (a.nome || "allievo").replace(/[\\/:*?"<>|]+/g, "") + " - " + a.titolo.replace(/[\\/:*?"<>|«»]+/g, "") + ".pdf");
        PD.toast("📄 PDF salvato nella cartella Download.", 4000);
      }).catch(function (e) {
        PD.toast("PDF non riuscito (" + e.message + "): usate «Stampa» e scegliete «Salva come PDF».", 6000);
      }).then(function () { b.disabled = false; b.textContent = "📄 Salva in PDF"; });
    };
  };

  function scarica(blob, nome) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  PD.download = scarica;

  /* ------------------------------------------------------------------ SVG -> immagine -> PDF (A4 orizzontale) */
  PD.svgToPdf = function (svg, titolo) {
    return new Promise(function (ok, ko) {
      var img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      img.onload = function () {
        try {
          var W = 3508, H = 2480, c = document.createElement("canvas"); c.width = W; c.height = H;
          var g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(url);
          var data = c.toDataURL("image/jpeg", 0.92), bin = atob(data.split(",")[1]), jpg = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
          ok(jpegPdf(jpg, W, H, titolo));
        } catch (e) { ko(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("immagine non disponibile")); };
      img.src = url;
    });
  };
  function jpegPdf(jpg, w, h, titolo) {
    var parti = [], pos = 0, offs = [];
    function add(x) { parti.push(x); pos += typeof x === "string" ? x.length : x.length; }
    function obj(n, body) { offs[n] = pos; add(n + " 0 obj\n" + body + "\nendobj\n"); }
    var t = String(titolo || "Attestato").normalize ? String(titolo || "Attestato").normalize("NFD").replace(/[^\x20-\x7e]/g, "") : "Attestato";
    t = t.replace(/[()\\]/g, "");
    add("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    offs[4] = pos;
    add("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + w + " /Height " + h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n");
    add(jpg); add("\nendstream\nendobj\n");
    var cs = "q 842 0 0 595 0 0 cm /Im0 Do Q";
    obj(5, "<< /Length " + cs.length + " >>\nstream\n" + cs + "\nendstream");
    obj(6, "<< /Title (" + t + ") /Producer (Professore Digitale) /Creator (Professore Digitale) >>");
    var xref = pos, x = "xref\n0 7\n0000000000 65535 f \n";
    for (var n = 1; n <= 6; n++) x += ("0000000000" + offs[n]).slice(-10) + " 00000 n \n";
    add(x + "trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    var out = new Uint8Array(pos), o = 0;
    parti.forEach(function (p) {
      if (typeof p === "string") { for (var i = 0; i < p.length; i++) out[o++] = p.charCodeAt(i) & 255; }
      else { out.set(p, o); o += p.length; }
    });
    return new Blob([out], { type: "application/pdf" });
  }
})();
