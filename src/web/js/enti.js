/* ==============================================================================
 *  PROFESSORE DIGITALE - Competenze DigComp 2.2 e pagina per facilitatori ed enti
 *  - PD.digcomp: quali competenze europee allena ogni lezione e quali ha raggiunto l'allievo
 *  - #/competenze  «🧭 Le mie competenze digitali» (con stampa) + riquadro nell'Inizio
 *  - #/enti        «📋 Registro e incontri»: Incontri pronti (con guida a tempo e schede da stampare),
 *                  Registro presenze e Resoconto (modulo registro.js), Competenze DigComp
 *  Tutto resta su questo computer: nessun dato viene inviato.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var D = window.PD_DIGCOMP, INC = window.PD_INCONTRI || [];
  if (!D) return;

  /* ------------------------------------------------------------------ indice del quadro */
  var COMP = {}, CODICI = [];
  D.aree.forEach(function (a) {
    a.competenze.forEach(function (c) { COMP[c.c] = { c: c.c, titolo: c.titolo, semplice: c.semplice, area: a }; CODICI.push(c.c); });
  });
  var PALESTRA = ["click", "dblclick", "drag", "typing", "scroll", "rightclick", "copypaste", "select", "keys", "memory", "scam"];
  var NOMI_PALESTRA = D.palestraNomi || {};
  NOMI_PALESTRA.memory = NOMI_PALESTRA.memory || "🧠 Memory digitale";

  function lezioni() { return window.PD_LESSONS || []; }
  function lezione(id) { return lezioni().filter(function (L) { return L.id === id; })[0]; }
  function ordineArea(L) { return { corso: 0, cultura: 1, fenice: 2, libro: 3 }[PD.lessonArea ? PD.lessonArea(L) : "corso"] || 0; }
  function competenzeLezione(x) {
    var id = typeof x === "string" ? x : (x && x.id);
    return (D.lezioni[id] || []).slice();
  }
  function lezioniDi(cod) {
    return lezioni().filter(function (L) { return (D.lezioni[L.id] || []).indexOf(cod) >= 0; })
      .sort(function (a, b) { return ordineArea(a) - ordineArea(b); });
  }
  function chiaviDi(mappa, cod) { return Object.keys(mappa || {}).filter(function (k) { return mappa[k].indexOf(cod) >= 0; }); }
  function incontriDi(cod) { return INC.filter(function (i) { return (i.digcomp || []).indexOf(cod) >= 0; }); }

  function stato(progress) {
    progress = progress || PD.progress || {};
    var les = progress.lessons || {}, vita = progress.vita || {}, pal = progress.practice || {}, out = {};
    CODICI.forEach(function (cod) {
      var L = lezioniDi(cod), fatte = 0, viste = 0, perfetto = false;
      L.forEach(function (l) {
        var p = les[l.id]; if (!p) return;
        if (p.done) fatte++;
        if (p.done || (p.seen || []).length) viste++;
        if (p.done && p.quiz && p.quiz.total && p.quiz.score === p.quiz.total) perfetto = true;
      });
      var V = chiaviDi(D.vita, cod), vf = 0, vi = 0;
      V.forEach(function (v) { var x = vita[v]; if (x && x.fatto) vf++; else if (x) vi++; });
      var pf = chiaviDi(D.palestra, cod).filter(function (id) { return pal[id] != null; }).length;
      var att = fatte + vf, raggiunta = att > 0;
      var livello = raggiunta ? ((att + pf >= 2 || perfetto) ? 3 : 2) : (viste || vi || pf ? 1 : 0);
      out[cod] = { lezioni: L.length, fatte: fatte, viste: viste, vita: vf, simulatori: V.length, palestra: pf, raggiunta: raggiunta, livello: livello };
    });
    return out;
  }
  function raggiunte(progress) {
    var s = stato(progress);
    return CODICI.filter(function (c) { return s[c].raggiunta; });
  }
  function areaDi(cod) { var c = COMP[String(cod)]; return c ? c.area : null; }

  PD.digcomp = {
    quadro: D, codici: CODICI.slice(), competenza: function (cod) { return COMP[cod] || null; },
    competenzeLezione: competenzeLezione, lezioniDi: lezioniDi, stato: stato, raggiunte: raggiunte, areaDi: areaDi
  };

  var LIVELLI = [
    { t: "Da iniziare", cls: "", ico: "○" },
    { t: "In corso", cls: "warn", ico: "◔" },
    { t: "Raggiunta", cls: "done", ico: "✓" },
    { t: "Consolidata", cls: "done", ico: "★" }
  ];
  function pallini(l) {
    var h = '<span class="dc-pallini" aria-label="Livello ' + l + ' di 3">';
    for (var i = 1; i <= 3; i++) h += '<span class="' + (i <= l ? "on" : "") + '"></span>';
    return h + "</span>";
  }
  function oggi() { try { return new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return new Date().toLocaleDateString(); } }
  function testata(titolo, sotto) {
    return '<header class="p-testa"><div><b>Professore Digitale</b> · ' + esc(sotto || "Cattedra Digitale Portatile") + "</div><div>" + esc(oggi()) +
      "</div></header><h1>" + esc(titolo) + "</h1>";
  }
  function piede() {
    return '<footer class="p-piede">Stampato dal Professore Digitale · software libero ideato da Danilo D\'Auria · funziona senza Internet · ' +
      "competenze secondo il quadro europeo DigComp " + esc(D.versione) + "</footer>";
  }
  function righe(n) { var h = '<div class="p-righe">'; for (var i = 0; i < n; i++) h += "<i></i>"; return h + "</div>"; }
  function stampa(html, orient) {
    if (PD.printHTML) PD.printHTML(html, orient || "verticale");
    else { var w = window.open("", "_blank"); if (w) { w.document.write(html); w.print(); } }
  }

  /* ------------------------------------------------------------------ destinazioni dei passi */
  function vaiInfo(vai) {
    if (!vai) return null;
    var p = String(vai).replace(/^#\/?/, "").split("/"), nome = p[0], a = p[1], L, P;
    if (nome === "lessons") {
      L = a ? lezione(a) : null;
      return { ok: !!L || !a, nome: L ? "Lezione «" + L.title + "»" : "Lezioni", ico: L ? L.icon : "📚" };
    }
    if (nome === "practice") return { ok: !a || PALESTRA.indexOf(a) >= 0, nome: "Palestra: " + (NOMI_PALESTRA[a] || "esercizi").replace(/^\S+\s/, ""), ico: "🎯" };
    if (nome === "vita") return { ok: !a || !!D.vita[a], nome: "Vita digitale: " + ((D.vitaNomi || {})[a] || "simulatori").replace(/^\S+\s/, ""), ico: "🏛️" };
    if (nome === "quiz") {
      P = a ? (PD.prove ? PD.prove() : window.PD_PROVE || []).filter(function (x) { return x.id === a; })[0] : null;
      return { ok: !!P || !a, nome: P ? "Quiz: " + P.titolo : "Quiz e attestati", ico: "🎓" };
    }
    var altri = { truffa: ["🕵️", "È una truffa?"], ripasso: ["🔁", "Ripasso delle domande"], ask: ["💬", "Chiedi al Professore"], board: ["🖊️", "Lavagna"],
      competenze: ["🧭", "Le mie competenze"], home: ["🏠", "Inizio"], cultura: ["🌍", "Cultura generale"] };
    var ok = !!(PD.views[nome] || document.getElementById("view-" + nome));
    return { ok: ok, nome: altri[nome] ? altri[nome][1] : nome, ico: altri[nome] ? altri[nome][0] : "▶" };
  }

  /* ================================================================== LE MIE COMPETENZE */
  function attivitaHTML(cod, s) {
    var les = PD.progress.lessons || {}, vita = PD.progress.vita || {}, pal = PD.progress.practice || {};
    var voci = [];
    lezioniDi(cod).forEach(function (L) {
      var p = les[L.id] || {};
      voci.push('<button class="btn ghost dc-att' + (p.done ? " fatta" : "") + '" data-go="#/lessons/' + esc(L.id) + '">' + (p.done ? "✓ " : "") + L.icon + " " + esc(L.title) + "</button>");
    });
    var haVita = !!(PD.views.vita || document.getElementById("view-vita"));
    if (haVita) chiaviDi(D.vita, cod).forEach(function (v) {
      var f = vita[v] && vita[v].fatto;
      voci.push('<button class="btn ghost dc-att' + (f ? " fatta" : "") + '" data-go="#/vita/' + esc(v) + '">' + (f ? "✓ " : "") + esc((D.vitaNomi || {})[v] || v) + "</button>");
    });
    chiaviDi(D.palestra, cod).forEach(function (id) {
      var f = pal[id] != null;
      voci.push('<button class="btn ghost dc-att pal' + (f ? " fatta" : "") + '" data-go="#/practice/' + esc(id) + '">' + (f ? "✓ " : "") + esc(NOMI_PALESTRA[id] || id) + "</button>");
    });
    if (!voci.length) return '<p class="small muted">Questa competenza si allena negli incontri di gruppo e nella vita di tutti i giorni.</p>';
    var primi = voci.slice(0, 4), altri = voci.slice(4);
    return '<div class="dc-atts">' + primi.join("") + "</div>" +
      (altri.length ? '<details class="dc-altre"><summary>Altre attività (' + altri.length + ")</summary><div class=\"dc-atts\">" + altri.join("") + "</div></details>" : "");
  }

  PD.views.competenze = function (el) {
    var s = stato(PD.progress), n = raggiunte(PD.progress).length, tot = CODICI.length;
    var nome = PD.settings.studentName || "";
    el.innerHTML =
      '<div class="lesson-head"><span class="big-ico">🧭</span><div><h1>Le mie competenze digitali</h1>' +
      '<div class="small muted">' + (nome ? esc(nome) + " · " : "") + "secondo il quadro europeo DigComp " + esc(D.versione) + "</div></div></div>" +
      '<div class="card dc-sommario"><div class="dc-numero"><b>' + n + "</b><span>di " + tot + "</span></div><div>" +
      "<p style=\"margin:0 0 .4rem\">" + (n ? "Avete già raggiunto <b>" + n + "</b> delle " + tot + " competenze digitali che l'Europa considera importanti per tutti i cittadini. Bravissimi!"
        : "Qui vedete le " + tot + " competenze digitali che l'Europa considera importanti per tutti i cittadini. Ogni lezione completata vi fa fare un passo avanti.") + "</p>" +
      '<div class="progress big"><span style="width:' + Math.round(100 * n / tot) + '%"></span></div>' +
      '<p class="small muted dc-legenda">' + LIVELLI.map(function (l, i) { return pallini(i) + " " + l.t; }).join(" &nbsp; ") + "</p></div></div>" +
      '<div class="row" style="margin:1rem 0"><button class="btn" id="dc-stampa">🖨️ Stampa le mie competenze</button>' +
      '<button class="btn ghost" data-go="#/enti/digcomp">❓ Che cos\'è DigComp</button></div>' +
      D.aree.map(function (a) {
        var ra = a.competenze.filter(function (c) { return s[c.c].raggiunta; }).length;
        return '<section class="card dc-area" style="--dc-col:' + esc(a.colore) + '"><div class="dc-area-testa"><span class="big-ico">' + a.icona + "</span><div><h2>" +
          a.n + ". " + esc(a.titolo) + '</h2><p class="small muted">' + esc(a.semplice) + '</p></div><span class="dc-conta">' + ra + " di " + a.competenze.length + "</span></div>" +
          '<div class="progress dc-barra"><span style="width:' + Math.round(100 * ra / a.competenze.length) + '%"></span></div>' +
          '<div class="dc-lista">' + a.competenze.map(function (c) {
            var x = s[c.c], L = LIVELLI[x.livello];
            return '<article class="dc-comp dc-l' + x.livello + '" data-c="' + esc(c.c) + '"><div class="dc-comp-testa"><span class="dc-codice">' + esc(c.c) + "</span><h3>" + esc(c.titolo) + "</h3></div>" +
              '<div class="row dc-stato"><span class="badge ' + L.cls + '">' + L.ico + " " + L.t + "</span>" + pallini(x.livello) + "</div>" +
              '<p class="dc-semplice">' + esc(c.semplice) + "</p>" + attivitaHTML(c.c, x) + "</article>";
          }).join("") + "</div></section>";
      }).join("") +
      '<p class="small muted">«Raggiunta»: avete completato almeno una lezione o un simulatore collegato. «Consolidata»: due attività o un quiz di lezione tutto giusto. ' +
      "È un'indicazione per orientarsi, non una certificazione ufficiale.</p>";
    $("#dc-stampa", el).onclick = function () { stampa(stampaCompetenze()); };
  };

  function stampaCompetenze() {
    var s = stato(PD.progress), n = raggiunte(PD.progress).length, nome = PD.settings.studentName || "";
    var les = PD.progress.lessons || {}, vita = PD.progress.vita || {};
    return '<div class="enti-p">' + testata("🧭 Le mie competenze digitali", "Competenze digitali europee DigComp " + D.versione) +
      '<p class="p-chi"><b>' + (nome ? esc(nome) : "Nome: ______________________________") + "</b> · " + esc(oggi()) + "</p>" +
      "<p>Competenze raggiunte: <b>" + n + " di " + CODICI.length + "</b> del quadro europeo DigComp " + esc(D.versione) + ".</p>" +
      D.aree.map(function (a) {
        return "<h2>" + a.n + ". " + esc(a.titolo) + '</h2><table class="p-tab"><tbody>' + a.competenze.map(function (c) {
          var x = s[c.c], L = LIVELLI[x.livello];
          var fatte = lezioniDi(c.c).filter(function (l) { return (les[l.id] || {}).done; }).map(function (l) { return esc(l.title); })
            .concat(chiaviDi(D.vita, c.c).filter(function (v) { return vita[v] && vita[v].fatto; }).map(function (v) { return esc(((D.vitaNomi || {})[v] || v).replace(/^\S+\s/, "")); }));
          return '<tr><td class="p-cod">' + esc(c.c) + "</td><td><b>" + esc(c.titolo) + '</b><br><span class="p-sempl">' + esc(c.semplice) + "</span>" +
            (fatte.length ? '<br><span class="p-sempl">Attività svolte: ' + fatte.join(" · ") + "</span>" : "") + '</td><td class="p-stato">' + L.ico + " " + L.t + "</td></tr>";
        }).join("") + "</tbody></table>";
      }).join("") +
      '<p class="p-nota">Indicazione orientativa basata sulle attività svolte con il Professore Digitale: non è una certificazione ufficiale.</p>' + piede() + "</div>";
  }

  PD.hooks.homeTiles.push(function () {
    var n = raggiunte(PD.progress).length;
    return PD.tileHTML("🧭", "Le mie competenze", n + " di " + CODICI.length + " competenze europee", "#/competenze", "dc-tile");
  });

  /* ================================================================== GUIDA DELL'INCONTRO (a tempo) */
  var G = null, timer = null, audioCtx = null;
  function incontro(id) { return INC.filter(function (i) { return i.id === id; })[0]; }
  function salvaG() { try { if (G) sessionStorage.setItem("pd.enti.guida", JSON.stringify(G)); else sessionStorage.removeItem("pd.enti.guida"); } catch (e) { /* niente */ } }
  function caricaG() { try { var x = JSON.parse(sessionStorage.getItem("pd.enti.guida") || "null"); if (x && incontro(x.id)) G = x; } catch (e) { G = null; } }
  function trascorso() { if (!G) return 0; return G.acc + (G.pausa ? 0 : Date.now() - G.t0); }
  function totaleTrascorso() { if (!G) return 0; return G.tot + (G.pausa ? 0 : Date.now() - G.t0); }
  function mmss(ms) { var s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60); s = s % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function hmm(ms) { var m = Math.max(0, Math.floor(ms / 60000)); return Math.floor(m / 60) + ":" + (m % 60 < 10 ? "0" : "") + (m % 60); }
  function avviaGuida(id) {
    G = { id: id, i: 0, t0: Date.now(), acc: 0, tot: 0, pausa: false, avvisato: false, suono: true };
    salvaG(); tic(); PD.go("#/enti/incontri/" + id + "/guida");
  }
  function cambiaPasso(i) {
    var I = incontro(G.id); if (!I) return;
    i = Math.max(0, Math.min(I.scaletta.length - 1, i));
    var ora = Date.now();
    if (!G.pausa) { G.tot += ora - G.t0; }
    G.i = i; G.acc = 0; G.t0 = ora; G.avvisato = false;
    salvaG(); tic(true);
  }
  function pausa() {
    var ora = Date.now();
    if (G.pausa) { G.pausa = false; G.t0 = ora; }
    else { G.acc += ora - G.t0; G.tot += ora - G.t0; G.pausa = true; }
    salvaG(); tic(true);
  }
  function termina() { G = null; salvaG(); if (timer) { clearInterval(timer); timer = null; } aggiornaBarra(); }
  function suonoGentile() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      audioCtx = audioCtx || new C();
      [660, 880].forEach(function (f, k) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + k * 0.35;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.65);
      });
    } catch (e) { /* senza audio va bene lo stesso */ }
  }
  function tic(ridisegna) {
    if (!G) { if (timer) { clearInterval(timer); timer = null; } aggiornaBarra(); return; }
    if (!timer) timer = setInterval(function () { tic(); }, 1000);
    var I = incontro(G.id), P = I && I.scaletta[G.i]; if (!P) return;
    var t = trascorso(), lim = P.min * 60000, finito = t >= lim;
    if (finito && !G.avvisato) {
      G.avvisato = true; salvaG();
      if (PD.toast) PD.toast("⏳ Il tempo di «" + P.titolo + "» è finito. Quando volete, passate al passo successivo.", 6000);
      if (G.suono) suonoGentile();
    }
    $$("[data-enti-t]").forEach(function (x) { x.textContent = mmss(t); });
    $$("[data-enti-tot]").forEach(function (x) { x.textContent = hmm(totaleTrascorso()); });
    $$("[data-enti-bar]").forEach(function (x) { x.style.width = Math.min(100, Math.round(100 * t / lim)) + "%"; });
    $$(".inc-guida-passo, #enti-guida-bar").forEach(function (x) { x.classList.toggle("scaduto", finito); });
    if (ridisegna) {
      var v = $("#view-enti");
      if (v && !v.hidden && /^#\/enti\/incontri\/[^/]+\/guida/.test(location.hash)) PD.views.enti(v, location.hash.replace(/^#\/?/, "").split("/").slice(1));
    }
    aggiornaBarra();
  }
  /* barra piccola che resta visibile quando il facilitatore apre una lezione o un esercizio */
  function aggiornaBarra() {
    var b = document.getElementById("enti-guida-bar");
    var inGuida = G && location.hash.indexOf("#/enti/incontri/" + G.id + "/guida") === 0;
    if (!G || inGuida) { if (b) b.hidden = true; return; }
    var I = incontro(G.id), P = I.scaletta[G.i];
    if (!b) {
      b = document.createElement("div"); b.id = "enti-guida-bar"; b.setAttribute("role", "region"); b.setAttribute("aria-label", "Guida dell'incontro");
      document.body.appendChild(b);
      b.addEventListener("click", function (e) {
        var x = e.target.closest ? e.target.closest("[data-gb]") : null; if (!x || !G) return;
        var a = x.getAttribute("data-gb");
        if (a === "avanti") cambiaPasso(G.i + 1);
        if (a === "guida") PD.go("#/enti/incontri/" + G.id + "/guida");
      });
    }
    var chiave = G.id + ":" + G.i + ":" + G.pausa;
    if (b.getAttribute("data-k") !== chiave) {
      b.setAttribute("data-k", chiave);
      b.innerHTML = '<span class="gb-ico">⏱️</span><div class="gb-testo"><b>' + esc(P.titolo) + '</b><span class="small"><span data-enti-t>0:00</span> di ' + P.min + ":00" +
        (G.pausa ? " · in pausa" : "") + " · passo " + (G.i + 1) + "/" + I.scaletta.length + "</span></div>" +
        (G.i < I.scaletta.length - 1 ? '<button class="btn" data-gb="avanti">Avanti ▶</button>' : "") +
        '<button class="btn ghost" data-gb="guida">📋 Guida</button>';
    }
    b.hidden = false;
    var t = trascorso(); $$("[data-enti-t]", b).forEach(function (x) { x.textContent = mmss(t); });
    b.classList.toggle("scaduto", t >= P.min * 60000);
  }
  window.addEventListener("hashchange", function () { setTimeout(aggiornaBarra, 0); });

  /* ================================================================== PAGINA ENTI */
  var SCHEDE = [
    { id: "incontri", t: "📅 Incontri pronti" },
    { id: "registro", t: "🗒️ Registro presenze" },
    { id: "resoconto", t: "📄 Resoconto per l'ente" },
    { id: "digcomp", t: "🇪🇺 Competenze DigComp" }
  ];

  PD.views.enti = function (el, args) {
    var tab = SCHEDE.filter(function (s) { return s.id === args[0]; }).length ? args[0] : "incontri";
    var conIntro = tab === "incontri" && !args[1];
    el.innerHTML =
      '<div class="lesson-head"><span class="big-ico">📋</span><div><h1>Registro e incontri</h1><div class="small muted">Per facilitatori digitali, associazioni, biblioteche e Comuni</div></div></div>' +
      (conIntro ? '<div class="card enti-intro"><p style="margin-top:0">Questa pagina aiuta chi <b>tiene un corso</b>: <b>12 incontri pronti</b> da due ore, con scaletta a tempo e schede da stampare; ' +
        "il <b>registro delle presenze</b> e un <b>resoconto</b> da consegnare al Comune, all'associazione o all'ente che finanzia il progetto (per esempio per un bando). " +
        "Le attività sono collegate alle <b>competenze digitali europee DigComp " + esc(D.versione) + "</b>, il linguaggio comune usato nei progetti di facilitazione digitale.</p>" +
        '<p class="notice info small" style="margin-bottom:0">🔒 <b>Privacy</b>: nomi, presenze e resoconti restano <b>solo su questo computer</b>. Nulla viene inviato in Internet. ' +
        "Raccogliete solo i dati che servono davvero e chiedete il consenso ai partecipanti.</p></div>" : "") +
      '<div class="enti-schede" role="tablist" aria-label="Sezioni">' + SCHEDE.map(function (s) {
        return '<button class="enti-scheda" role="tab" aria-selected="' + (s.id === tab) + '" data-go="#/enti/' + s.id + '">' + s.t + "</button>";
      }).join("") + "</div>" +
      '<div class="enti-box" id="enti-box" role="tabpanel"></div>';
    var box = $("#enti-box", el);
    if (tab === "incontri") return schedaIncontri(box, args[1], args[2]);
    if (tab === "digcomp") return schedaDigcomp(box);
    if (PD.registro && PD.registro.render) {
      try { PD.registro.render(box, tab); } catch (e) { if (window.console) console.error(e); box.innerHTML = '<p class="notice">Questa sezione non si è aperta correttamente. Riprovate più tardi.</p>'; }
    } else {
      box.innerHTML = '<div class="card"><h2>' + (tab === "registro" ? "🗒️ Registro presenze" : "📄 Resoconto per l'ente") + '</h2><p class="notice info">🛠️ Questa sezione è <b>in preparazione</b>.</p></div>';
    }
  };

  /* ------------------------------------------------------------------ Incontri pronti */
  function chipComp(cods) {
    return '<span class="dc-chips">' + (cods || []).map(function (c) {
      var x = COMP[c]; return x ? '<span class="dc-chip" style="--dc-col:' + esc(x.area.colore) + '" title="' + esc(x.titolo) + '">' + esc(c) + "</span>" : "";
    }).join("") + "</span>";
  }
  function orari(I) {
    var t = 0; return I.scaletta.map(function (p) { var a = t; t += p.min; return [a, t]; });
  }
  function schedaIncontri(box, id, modo) {
    var I = id ? incontro(id) : null;
    if (I && modo === "guida") return vistaGuida(box, I);
    if (I) return vistaIncontro(box, I);
    var oreTot = INC.reduce(function (s, i) { return s + i.durata; }, 0) / 60;
    box.innerHTML = '<p class="lead" style="margin-top:1rem">Un percorso completo in <b>' + INC.length + " incontri da 2 ore</b> (" + oreTot + " ore in tutto), " +
      "pensato per gruppi di principianti e persone anziane: dal primo contatto con il computer ai servizi pubblici online e alla sicurezza. " +
      "Ogni incontro ha obiettivi, materiali, una scaletta a tempo e le schede da stampare.</p>" +
      '<div class="row" style="margin-bottom:1rem"><button class="btn ghost" id="inc-programma">🖨️ Stampa il programma del corso</button></div>' +
      '<div class="grid inc-grid">' + INC.map(function (i) {
        return '<button class="card tile inc-tile" data-go="#/enti/incontri/' + esc(i.id) + '"><span class="inc-n">Incontro ' + i.n + '</span><span class="big-ico">' + i.icona +
          "</span><h3>" + esc(i.titolo) + "</h3><p>" + esc(i.obiettivi.join(" · ")) + "</p>" + chipComp(i.digcomp) + "</button>";
      }).join("") + "</div>";
    $("#inc-programma", box).onclick = function () { stampa(stampaProgramma()); };
  }

  function vistaIncontro(box, I) {
    var o = orari(I), k = INC.indexOf(I), prec = INC[k - 1], succ = INC[k + 1];
    var attiva = G && G.id === I.id;
    box.innerHTML =
      '<div class="lesson-head inc-testa"><span class="big-ico">' + I.icona + '</span><div><div class="small muted">Incontro ' + I.n + " di " + INC.length + " · " + I.durata + " minuti</div><h2>" +
      esc(I.titolo) + '</h2></div><button class="btn ghost" data-go="#/enti/incontri" style="margin-left:auto">← Tutti gli incontri</button></div>' +
      '<div class="row inc-azioni"><button class="btn big" id="inc-avvia">⏱️ ' + (attiva ? "Torna alla guida" : "Avvia l'incontro") + "</button>" +
      '<button class="btn ghost" id="inc-stampa">🖨️ Stampa la scheda dell\'incontro</button>' +
      '<button class="btn ghost" id="inc-stampa-all">🖨️ Stampa la scheda per gli allievi</button></div>' +
      '<div class="inc-info">' +
      '<div class="card"><h3>🎯 Obiettivi</h3><ul>' + I.obiettivi.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="card"><h3>🇪🇺 Competenze DigComp ' + esc(D.versione) + '</h3><ul class="inc-comp">' + I.digcomp.map(function (c) {
        var x = COMP[c]; return x ? '<li><span class="dc-chip" style="--dc-col:' + esc(x.area.colore) + '">' + esc(c) + "</span> " + esc(x.titolo) + "</li>" : "";
      }).join("") + "</ul></div>" +
      '<div class="card"><h3>🧰 Materiali</h3><ul>' + I.materiali.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></div>" +
      '<div class="card inc-scaletta-card"><h3>🕑 Scaletta</h3><ol class="inc-scaletta">' + I.scaletta.map(function (p, i) {
        var v = vaiInfo(p.vai);
        return '<li class="' + (/^pausa/i.test(p.titolo) ? "pausa" : "") + '"><span class="inc-ora">' + o[i][0] + "′–" + o[i][1] + '′<small>' + p.min + " min</small></span>" +
          '<div class="inc-cosa"><b>' + esc(p.titolo) + "</b>" + (p.cosa ? "<p>" + esc(p.cosa) + "</p>" : "") +
          (v ? '<button class="btn ghost inc-apri" data-go="' + esc(p.vai) + '"' + (v.ok ? "" : " disabled") + ">▶ Apri · " + v.ico + " " + esc(v.nome) + "</button>" : "") + "</div></li>";
      }).join("") + "</ol></div>" +
      '<div class="inc-info"><div class="card"><h3>📝 Compito per casa</h3><p>' + esc(I.compito) + "</p></div>" +
      '<div class="card"><h3>💡 Consigli per il facilitatore</h3><p>' + esc(I.consigli) + "</p></div></div>" +
      '<div class="row inc-nav">' + (prec ? '<button class="btn ghost" data-go="#/enti/incontri/' + esc(prec.id) + '">◀ Incontro ' + prec.n + "</button>" : "") +
      (succ ? '<button class="btn ghost" data-go="#/enti/incontri/' + esc(succ.id) + '" style="margin-left:auto">Incontro ' + succ.n + " ▶</button>" : "") + "</div>";
    $("#inc-avvia", box).onclick = function () { if (attiva) PD.go("#/enti/incontri/" + I.id + "/guida"); else avviaGuida(I.id); };
    $("#inc-stampa", box).onclick = function () { stampa(stampaScheda(I)); };
    $("#inc-stampa-all", box).onclick = function () { stampa(stampaAllievi(I)); };
  }

  function vistaGuida(box, I) {
    if (!G || G.id !== I.id) { G = { id: I.id, i: 0, t0: Date.now(), acc: 0, tot: 0, pausa: false, avvisato: false, suono: true }; salvaG(); }
    var P = I.scaletta[G.i], v = vaiInfo(P.vai), o = orari(I), ultimo = G.i === I.scaletta.length - 1;
    box.innerHTML =
      '<div class="lesson-head inc-testa"><span class="big-ico">⏱️</span><div><div class="small muted">Incontro ' + I.n + " in corso · tempo trascorso <b data-enti-tot>0:00</b> di 2:00</div><h2>" +
      esc(I.titolo) + '</h2></div><button class="btn ghost" data-go="#/enti/incontri/' + esc(I.id) + '" style="margin-left:auto">📄 Scheda dell\'incontro</button></div>' +
      '<div class="card inc-guida-passo"><div class="small muted">Passo ' + (G.i + 1) + " di " + I.scaletta.length + " · dal minuto " + o[G.i][0] + " al " + o[G.i][1] + "</div>" +
      "<h2>" + esc(P.titolo) + "</h2>" + (P.cosa ? '<p class="inc-guida-cosa">' + esc(P.cosa) + "</p>" : "") +
      '<div class="inc-crono" aria-live="off"><span class="inc-crono-t" data-enti-t>0:00</span><span class="inc-crono-di">di ' + P.min + ":00</span>" + (G.pausa ? '<span class="badge warn">⏸ In pausa</span>' : "") + "</div>" +
      '<div class="progress big"><span data-enti-bar style="width:0"></span></div>' +
      '<p class="inc-scaduto-msg small">⏳ Il tempo previsto è finito: nessuna fretta, quando il gruppo è pronto passate al passo successivo.</p>' +
      '<div class="row inc-guida-cmd">' +
      '<button class="btn ghost" id="g-indietro"' + (G.i ? "" : " disabled") + ">◀ Indietro</button>" +
      '<button class="btn ghost" id="g-pausa">' + (G.pausa ? "▶ Riprendi" : "⏸ Pausa") + "</button>" +
      (v ? '<button class="btn ghost" data-go="' + esc(P.vai) + '"' + (v.ok ? "" : " disabled") + ">▶ Apri · " + v.ico + " " + esc(v.nome) + "</button>" : "") +
      (ultimo ? '<button class="btn big" id="g-fine">🏁 Concludi l\'incontro</button>' : '<button class="btn big" id="g-avanti">Avanti ▶</button>') + "</div>" +
      '<label class="small inc-suono"><input type="checkbox" id="g-suono"' + (G.suono ? " checked" : "") + "> 🔔 Segnale gentile quando il tempo del passo è finito</label></div>" +
      '<div class="card"><h3>🕑 La scaletta</h3><ol class="inc-scaletta inc-scaletta-guida">' + I.scaletta.map(function (p, i) {
        return '<li class="' + (i === G.i ? "ora" : i < G.i ? "fatto" : "") + '"><button class="inc-salta" data-i="' + i + '"><span class="inc-ora">' + o[i][0] + "′–" + o[i][1] + "′</span><span>" +
          (i < G.i ? "✓ " : i === G.i ? "▶ " : "") + esc(p.titolo) + "</span></button></li>";
      }).join("") + "</ol></div>";
    var b = function (id, fn) { var x = $("#" + id, box); if (x) x.onclick = fn; };
    b("g-indietro", function () { cambiaPasso(G.i - 1); });
    b("g-avanti", function () { cambiaPasso(G.i + 1); });
    b("g-pausa", pausa);
    b("g-fine", function () {
      var durata = hmm(totaleTrascorso());
      termina();
      if (PD.toast) PD.toast("🏁 Incontro concluso (" + durata + "). Ricordatevi di segnare le presenze nel registro!", 6000);
      PD.go(PD.registro ? "#/enti/registro" : "#/enti/incontri/" + I.id);
    });
    var su = $("#g-suono", box); if (su) su.onchange = function () { G.suono = this.checked; salvaG(); };
    $$(".inc-salta", box).forEach(function (x) { x.onclick = function () { cambiaPasso(+x.getAttribute("data-i")); }; });
    tic();
  }

  /* ------------------------------------------------------------------ stampe degli incontri */
  function stampaScheda(I) {
    var o = orari(I);
    return '<div class="enti-p">' + testata("Incontro " + I.n + " · " + I.titolo, "Scheda per il facilitatore") +
      '<p class="p-chi">Durata: <b>' + I.durata + " minuti</b> (pausa compresa) · Data: ______________ · Sede: ______________________ · Partecipanti: ____</p>" +
      "<h2>🎯 Obiettivi</h2><ul>" + I.obiettivi.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      "<h2>🇪🇺 Competenze DigComp " + esc(D.versione) + "</h2><ul>" + I.digcomp.map(function (c) { return COMP[c] ? "<li><b>" + esc(c) + "</b> " + esc(COMP[c].titolo) + " <i>(" + esc(COMP[c].area.titolo) + ")</i></li>" : ""; }).join("") + "</ul>" +
      "<h2>🧰 Materiali</h2><ul>" + I.materiali.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      '<h2>🕑 Scaletta</h2><table class="p-tab"><thead><tr><th>Minuti</th><th>Attività</th><th>Nel programma</th></tr></thead><tbody>' + I.scaletta.map(function (p, i) {
        var v = vaiInfo(p.vai);
        return '<tr><td class="p-cod">' + o[i][0] + "–" + o[i][1] + "<br><small>" + p.min + " min</small></td><td><b>" + esc(p.titolo) + "</b>" + (p.cosa ? "<br>" + esc(p.cosa) : "") + "</td><td>" + (v ? esc(v.nome) : "—") + "</td></tr>";
      }).join("") + "</tbody></table>" +
      "<h2>📝 Compito per casa</h2><p>" + esc(I.compito) + "</p>" +
      "<h2>💡 Consigli</h2><p>" + esc(I.consigli) + "</p>" +
      '<h2>✏️ Note del facilitatore</h2>' + righe(6) + piede() + "</div>";
  }
  function stampaAllievi(I) {
    var passi = I.scaletta.filter(function (p) { return p.vai && !/^pausa/i.test(p.titolo); });
    return '<div class="enti-p enti-allievi">' + testata(I.icona + " " + I.titolo, "Incontro " + I.n + " · scheda per chi partecipa") +
      '<p class="p-chi">Nome: ______________________________</p>' +
      "<h2>Oggi impariamo a…</h2><ul>" + I.obiettivi.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      "<h2>I passi di oggi</h2><ol>" + passi.map(function (p) { var v = vaiInfo(p.vai); return "<li><b>" + esc(p.titolo) + "</b>" + (v ? ' <span class="p-sempl">(' + esc(v.nome) + ")</span>" : "") + "</li>"; }).join("") + "</ol>" +
      '<div class="p-compito"><h2>📝 Il compito per casa</h2><p>' + esc(I.compito) + "</p></div>" +
      '<p class="p-ricorda">💛 Ricordate: con il computer non si rompe niente facendo un clic. Se avete un dubbio, chiedete: non esistono domande stupide.<br>' +
      "🔒 Nessuno vi chiederà mai password o codici: non dateli a nessuno.</p>" +
      '<h2>✏️ I miei appunti</h2>' + righe(3) + piede() + "</div>";
  }
  function stampaProgramma() {
    return '<div class="enti-p">' + testata("Programma del corso: " + INC.length + " incontri", "Percorso di facilitazione digitale") +
      "<p>Percorso per principianti e persone anziane: " + INC.length + " incontri da 2 ore (" + (INC.length * 2) + " ore). Competenze secondo il quadro europeo DigComp " + esc(D.versione) + ".</p>" +
      '<table class="p-tab"><thead><tr><th>N.</th><th>Incontro e obiettivi</th><th>DigComp</th></tr></thead><tbody>' + INC.map(function (i) {
        return '<tr><td class="p-cod">' + i.n + "</td><td><b>" + esc(i.titolo) + '</b><br><span class="p-sempl">' + esc(i.obiettivi.join(" · ")) + '</span></td><td class="p-stato">' + esc(i.digcomp.join(", ")) + "</td></tr>";
      }).join("") + "</tbody></table>" + piede() + "</div>";
  }

  /* ------------------------------------------------------------------ Competenze DigComp (per enti e bandi) */
  function schedaDigcomp(box) {
    var coperte = CODICI.filter(function (c) { return incontriDi(c).length; });
    var conAttivita = CODICI.filter(function (c) { return lezioniDi(c).length || chiaviDi(D.vita, c).length; });
    box.innerHTML =
      '<div class="card"><h2>🇪🇺 Che cos\'è DigComp ' + esc(D.versione) + "</h2>" +
      "<p><b>DigComp</b> è il quadro europeo delle competenze digitali dei cittadini, pubblicato dalla Commissione europea (Centro comune di ricerca). " +
      "Descrive <b>21 competenze</b> divise in <b>5 aree</b>, con 8 livelli di padronanza: dal livello base (1–2) al livello altamente specializzato (7–8).</p>" +
      "<p>Molti progetti e bandi di <b>facilitazione digitale</b> chiedono di indicare quali competenze DigComp vengono allenate. " +
      "Qui trovate, per ogni competenza, le lezioni, i simulatori e gli incontri pronti del Professore Digitale che la allenano: potete citarli nel progetto e nel resoconto.</p>" +
      '<p class="notice info small">Il percorso del Professore Digitale si rivolge soprattutto ai <b>livelli base</b>. Gli indicatori «da iniziare / in corso / raggiunta / consolidata» ' +
      "che vedono gli allievi servono a orientarsi: <b>non sono una certificazione</b> ufficiale delle competenze.</p>" +
      '<p class="small dc-legenda">' + LIVELLI.map(function (l, i) { return pallini(i) + " " + l.t; }).join(" &nbsp; ") + "</p>" +
      '<p class="small muted">Competenze allenate dagli incontri pronti: <b>' + coperte.length + " di " + CODICI.length + "</b> · con almeno una lezione o un simulatore: <b>" +
      conAttivita.length + " di " + CODICI.length + "</b>.</p>" +
      '<div class="row"><button class="btn ghost" id="dc-tab-stampa">🖨️ Stampa la tabella delle competenze</button><button class="btn ghost" data-go="#/competenze">🧭 Le competenze dell\'allievo attivo</button></div></div>' +
      D.aree.map(function (a) {
        return '<section class="card dc-area" style="--dc-col:' + esc(a.colore) + '"><div class="dc-area-testa"><span class="big-ico">' + a.icona + "</span><div><h2>" + a.n + ". " + esc(a.titolo) +
          '</h2><p class="small muted">' + esc(a.semplice) + '</p></div></div><div class="dc-tabella">' + a.competenze.map(function (c) {
            var L = lezioniDi(c.c), V = chiaviDi(D.vita, c.c), I = incontriDi(c.c);
            return '<div class="dc-riga"><span class="dc-codice">' + esc(c.c) + "</span><div><b>" + esc(c.titolo) + '</b><p class="small muted">' + esc(c.semplice) + '</p></div><div class="small dc-dove">' +
              (L.length ? "📚 " + L.length + (L.length === 1 ? " lezione" : " lezioni") : "") + (V.length ? (L.length ? " · " : "") + "🏛️ " + V.length + (V.length === 1 ? " simulatore" : " simulatori") : "") +
              (I.length ? '<br>📅 Incontri ' + I.map(function (x) { return '<a href="#/enti/incontri/' + esc(x.id) + '">' + x.n + "</a>"; }).join(", ") : (L.length || V.length ? "" : '<span class="muted">da trattare a voce</span>')) +
              "</div></div>";
          }).join("") + "</div></section>";
      }).join("");
    $("#dc-tab-stampa", box).onclick = function () { stampa(stampaTabella()); };
  }
  function stampaTabella() {
    return '<div class="enti-p">' + testata("Competenze DigComp " + D.versione + " allenate", "Per enti, associazioni e bandi") +
      D.aree.map(function (a) {
        return "<h2>" + a.n + ". " + esc(a.titolo) + '</h2><table class="p-tab"><tbody>' + a.competenze.map(function (c) {
          var L = lezioniDi(c.c), V = chiaviDi(D.vita, c.c), I = incontriDi(c.c);
          return '<tr><td class="p-cod">' + esc(c.c) + "</td><td><b>" + esc(c.titolo) + '</b><br><span class="p-sempl">' +
            (L.length ? "Lezioni: " + L.map(function (l) { return esc(l.title); }).join(", ") : "") +
            (V.length ? (L.length ? "<br>" : "") + "Simulatori: " + V.map(function (v) { return esc(((D.vitaNomi || {})[v] || v).replace(/^\S+\s/, "")); }).join(", ") : "") +
            '</span></td><td class="p-stato">' + (I.length ? "Incontri " + I.map(function (x) { return x.n; }).join(", ") : "—") + "</td></tr>";
        }).join("") + "</tbody></table>";
      }).join("") + piede() + "</div>";
  }

  /* per il modulo del registro e per i test */
  PD.incontri = {
    lista: INC, get: incontro, vaiInfo: vaiInfo,
    guida: function () { return G ? { id: G.id, passo: G.i, pausa: G.pausa, ms: trascorso() } : null; },
    termina: termina,
    /* solo per le prove automatiche: fa passare il tempo del passo corrente */
    avanzaTempo: function (ms) { if (G) { if (G.pausa) G.acc += ms; else G.t0 -= ms; salvaG(); tic(); } }
  };

  caricaG();
  if (G) { var prev = PD.onReady; PD.onReady = function () { if (prev) prev(); tic(); }; }
})();
