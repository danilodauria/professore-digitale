/* ==============================================================================
 *  PROFESSORE DIGITALE - «Il nostro percorso» (dalla 3.5)
 *  - alla prima apertura una maschera in 3 passi: dove si usa il Professore (centro anziani, scuola,
 *    biblioteca, Comune…), chi lo usa, da dove si parte (questionario di autovalutazione);
 *  - #/percorso: le 8 fasi della linea guida con le tappe, la prossima tappa in grande, spunte automatiche
 *    (lezioni, simulatori, quiz, giochi, ripasso…) e manuali, stampa del programma per l'ente;
 *  - riquadro in cima all'Inizio e nelle Impostazioni.
 *  Dati (per profilo): PD.progress.percorso = { contesto, chi, livello, risposte: {domanda: "si"|"poco"|"no"},
 *    spunte: {chiave: true}, iniziato, aggiornato, ultimaTappa, nonChiedere }
 *  Impostazione del computer: PD.settings.percorsoContesto (contesto proposto alle persone nuove).
 *  All'avvio: rispetta sessionStorage pd.salutato / pd.percorsoVisto e ?nosaluto, ?noprofilo, ?nopercorso.
 *  Ordine: scelta del profilo → percorso → saluto.
 *  I contenuti dei percorsi stanno in data-percorsi.js.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var D = window.PD_PERCORSI;
  if (!D) return;

  /* ------------------------------------------------------------------ indici */
  var FASI = {}, CONTESTI = {}, CHI = {};
  D.fasi.forEach(function (f) { FASI[f.id] = f; });
  D.contesti.forEach(function (c) { CONTESTI[c.id] = c; });
  D.chi.forEach(function (c) { CHI[c.id] = c; });
  var PALESTRA = ["click", "dblclick", "drag", "typing", "keys", "scroll", "rightclick", "select", "copypaste", "memory", "scam"];
  var NOMI_PALESTRA = { click: "Il clic", dblclick: "Il doppio clic", drag: "Trascinare", typing: "La tastiera", keys: "I tasti speciali",
    scroll: "Scorrere la pagina", rightclick: "Il clic destro", select: "Selezionare il testo", copypaste: "Copia e incolla", memory: "Memory digitale", scam: "Riconosci la truffa" };
  var SCHEDE_ENTI = { incontri: ["📅", "Incontri pronti"], registro: ["🗒️", "Registro presenze"], resoconto: ["📄", "Resoconto per l'ente"], digcomp: ["🇪🇺", "Competenze DigComp"] };
  var ICONE_CULTURA = { "cultura-storia": "🏛️", "cultura-geografia": "🌍", "cultura-scienze": "🔬", "cultura-arte": "🎨", "cultura-attualita": "📰" };

  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { /* non disponibile */ } return null; }
  function ora() { return new Date().toISOString(); }
  function copia(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function vista(nome) { return !!(PD.views[nome] || document.getElementById("view-" + nome)); }
  function prog() { return PD.progress || {}; }
  function lezione(id) { return (window.PD_LESSONS || []).filter(function (L) { return L.id === id; })[0] || null; }
  function prova(id) { return (PD.prove ? PD.prove() : window.PD_PROVE || []).filter(function (x) { return x.id === id; })[0] || null; }
  function incontro(id) { return (window.PD_INCONTRI || []).filter(function (i) { return i.id === id; })[0] || null; }
  function domandaGuida(q) { return (window.PD_KB || []).some(function (k) { return k.q === q; }); }
  function pacchettoTitolo(id) {
    var e = ((PD.packs && PD.packs.list) || []).filter(function (x) { return x.pacchetto.id === id; })[0];
    return e ? String(e.pacchetto.titolo).replace(/^Cultura generale\s*·\s*/, "") : id;
  }
  function areaFatta(area, pack) {
    var L = PD.lessonsOf ? PD.lessonsOf(area, pack) : [], les = prog().lessons || {};
    return L.some(function (l) { return (les[l.id] || {}).done; });
  }

  /* ------------------------------------------------------------------ rimandi: dal testo «tipo:id» al contenuto vero */
  function norm(a) {
    if (typeof a === "string") a = { r: a };
    return a;
  }
  function chiave(a) {
    a = norm(a);
    if (a.r === "pratica") return "pratica:" + (a.k || "");
    return a.r + (a.p != null ? "/" + a.p : "");
  }
  /* risolvi(attivita) -> { chiave, tipo, ok (esiste), disponibile (si può usare qui), titolo, ico, go, domanda, auto (spunta automatica), fatto() } */
  function risolvi(a) {
    a = norm(a);
    var r = String(a.r || ""), i = r.indexOf(":"), tipo = i < 0 ? r : r.slice(0, i), id = i < 0 ? "" : r.slice(i + 1);
    var x = { chiave: chiave(a), tipo: tipo, id: id, ok: false, disponibile: true, titolo: a.t || "", ico: "▶", go: "", domanda: "", auto: false,
      fatto: function () { return false; }, opz: !!a.opz, conduttore: !!a.conduttore, att: a };
    function imposta(ok, ico, titolo, go) { x.ok = !!ok; x.ico = ico; if (!x.titolo) x.titolo = titolo; x.go = go; }
    var p = prog(), L, P, s, g;
    switch (tipo) {
      case "lezione":
        L = lezione(id);
        if (L && a.p != null && !L.steps[a.p]) L = null;
        imposta(L, L ? L.icon : "📚", L ? (a.p != null ? "«" + L.title + "»: " + L.steps[a.p].t : "Lezione «" + L.title + "»") : id,
          "#/lessons/" + id + (a.p != null ? "/" + a.p : ""));
        x.auto = true;
        x.fatto = function () { var q = (prog().lessons || {})[id]; return !!(q && (q.done || (a.p != null && (q.seen || []).indexOf(a.p) >= 0))); };
        break;
      case "palestra":
        imposta(PALESTRA.indexOf(id) >= 0 && vista("practice"), "🎯", "Palestra: " + (NOMI_PALESTRA[id] || id), "#/practice/" + id);
        x.auto = true; x.fatto = function () { return (prog().practice || {})[id] != null; };
        break;
      case "vita":
        s = PD.vita ? PD.vita.elenco().filter(function (v) { return v.id === id; })[0] : null;
        imposta(s, s ? s.icona : "🏛️", "Vita digitale (prova): " + (s ? s.titolo : id), "#/vita/" + id);
        x.auto = true; x.fatto = function () { var v = (prog().vita || {})[id]; return !!(v && v.fatto); };
        break;
      case "mente":
        if (!id) {
          imposta(PD.mente && vista("mente"), "🧩", "Ginnastica per la mente", "#/mente");
          x.auto = true; x.fatto = function () { var m = prog().mente; return !!(m && m.giorni && Object.keys(m.giorni).length); };
        } else if (id === "diario") {
          imposta(PD.mente && vista("mente"), "📅", "Il diario della mente", "#/mente/diario");
          x.auto = true; x.fatto = function () { var m = prog().mente; return !!(m && m.giorni && Object.keys(m.giorni).length >= 3); };
        } else {
          g = PD.mente ? PD.mente.elenco().filter(function (v) { return v.id === id; })[0] : null;
          imposta(g, g ? g.icona : "🧩", "Gioco: " + (g ? g.titolo : id), "#/mente/" + id);
          x.auto = true; x.fatto = function () { var st = PD.mente && PD.mente.stato(id); return !!(st && st.volte); };
        }
        break;
      case "quiz":
        if (!id) {
          imposta(vista("quiz"), "🎓", "Quiz e attestati", "#/quiz");
          x.auto = true; x.fatto = function () { return (prog().attestati || []).length > 0; };
        } else {
          P = prova(id);
          imposta(P, P ? P.icona || "🎓" : "🎓", "Quiz: " + (P ? P.titolo : id), "#/quiz/" + id);
          x.auto = true; x.fatto = function () { var q = (prog().quiz || {})[id]; return !!(q && q.superata); };
        }
        break;
      case "cultura":
        imposta(PD.lessonsOf && PD.lessonsOf("cultura", id).length > 0, ICONE_CULTURA[id] || "🌍", "Cultura generale: " + pacchettoTitolo(id), "#/cultura/" + id);
        x.auto = true; x.fatto = function () { return areaFatta("cultura", id); };
        break;
      case "libro":
        imposta(vista("libro"), "📖", "Tecnologia Gentile, il libro", "#/libro");
        x.auto = true; x.fatto = function () { return areaFatta("libro"); };
        break;
      case "fenice":
        imposta(vista("fenice"), "🔥", "FeniceOS e il riuso", "#/fenice");
        x.auto = true; x.fatto = function () { return areaFatta("fenice"); };
        break;
      case "truffa":
        imposta(vista("truffa"), "🕵️", "«È una truffa?»", "#/truffa");
        x.auto = true; x.fatto = function () { var t = prog().truffa; return !!(t && t.controlli && t.controlli.length); };
        break;
      case "lettera":
        imposta(vista("lettera"), "✉️", "«Spiegami questa lettera»", "#/lettera");
        x.auto = true; x.fatto = function () { var l = prog().lettera; return !!(l && l.volte); };
        break;
      case "ripasso":
        imposta(vista("ripasso"), "🔁", "Ripasso delle domande", "#/ripasso");
        x.auto = true; x.fatto = function () { var R = prog().ripasso; return !!(R && R.ultimoGiorno); };
        break;
      case "chiedi":
        if (id) {
          imposta(vista("ask") && domandaGuida(id), "💬", "Chiedete al Professore: «" + id + "»", "#/ask");
          x.domanda = id;
          x.auto = true; x.fatto = function () { return (PD.history || []).some(function (m) { return m.role === "user" && m.content === id; }); };
        } else {
          imposta(vista("ask"), "💬", "Chiedi al Professore", "#/ask");
          x.auto = true; x.fatto = function () { return (PD.history || []).some(function (m) { return m.role === "user"; }); };
        }
        break;
      case "competenze": imposta(vista("competenze"), "🧭", "Le mie competenze digitali", "#/competenze"); break;
      case "impostazioni": imposta(vista("settings"), "⚙️", "Impostazioni", "#/settings"); break;
      case "profili": imposta(vista("profili") && PD.profili, "👥", "Persone che usano il computer", "#/profili"); break;
      case "lavagna": imposta(vista("board"), "🖊️", "Lavagna", "#/board"); break;
      case "editor": imposta(vista("editor"), "✏️", "Crea lezioni e quiz", "#/editor"); break;
      case "enti":
        imposta(vista("enti") && SCHEDE_ENTI[id], SCHEDE_ENTI[id] ? SCHEDE_ENTI[id][0] : "📋", SCHEDE_ENTI[id] ? SCHEDE_ENTI[id][1] : id, "#/enti/" + id);
        break;
      case "incontro":
        g = incontro(id);
        imposta(g && vista("enti"), g ? g.icona : "📅", g ? "Incontro " + g.n + ": " + g.titolo : id, "#/enti/incontri/" + id);
        break;
      case "aula":
        imposta(vista("aula"), "🏫", "Quadro dell'aula", "#/aula");
        x.disponibile = !!(PD.server && !PD.ospite);
        break;
      case "tablet":
        imposta(vista("tablet"), "📱", "Tablet dell'aula", "#/tablet");
        x.disponibile = !!(PD.server && !PD.ospite);
        break;
      case "pratica":
        x.ok = !!a.k && !!a.t; x.ico = "✍️"; x.titolo = a.t || "Attività in presenza";
        break;
      default:
        x.ok = false; x.titolo = x.titolo || r;
    }
    return x;
  }

  /* ------------------------------------------------------------------ costruzione del percorso di un contesto */
  function unisci(base, over) {
    var t = copia(base || {});
    if (over) for (var k in over) if (Object.prototype.hasOwnProperty.call(over, k) && k !== "piu" && k !== "base") t[k] = over[k];
    t.att = (t.att || []).slice();
    if (over && over.piu) t.att = t.att.concat(over.piu);
    return t;
  }
  /* costruisci(contesto, chi) -> { contesto, chi, fasi: [{ fase, titolo, consiglio, tappe }], tappe: [...] } */
  function costruisci(idContesto, chi) {
    var C = CONTESTI[idContesto] || CONTESTI.altro;
    chi = CHI[chi] ? chi : C.chi;
    var tutte = [], fasi = [];
    D.fasi.forEach(function (F) {
      var cf = (C.fasi || {})[F.id] || { tappe: [] };
      var tappe = (cf.tappe || []).map(function (rif) {
        var over = typeof rif === "string" ? { id: rif } : rif;
        var base = D.tappe[over.base || over.id] || {};
        var t = unisci(base, over);
        t.id = over.id; t.fase = F.id;
        t.sicurezza = !!(t.sicurezza || F.obbligatoria);
        t.attivita = t.att.map(risolvi).filter(function (x) { return !(x.conduttore && chi === "solo"); });
        t.visibili = t.attivita.filter(function (x) { return x.ok && x.disponibile; });
        return t;
      });
      tappe.forEach(function (t) { t.n = tutte.length + 1; tutte.push(t); });
      fasi.push({ fase: F, id: F.id, titolo: cf.titolo || F.titolo, consiglio: cf.consiglio || F.consiglio, tappe: tappe,
        incontri: (F.incontri || []).map(incontro).filter(Boolean) });
    });
    return { contesto: C, chi: chi, fasi: fasi, tappe: tutte };
  }

  /* ------------------------------------------------------------------ stato */
  function datiP() { return prog().percorso || null; }
  function haContesto() { var p = datiP(); return !!(p && p.contesto && CONTESTI[p.contesto]); }
  function attFatta(x, P) { return !!((P && P.spunte && P.spunte[x.chiave]) || (x.auto && x.fatto())); }
  function statoTappa(t, P) {
    P = P || datiP() || {};
    var vis = t.visibili, obb = vis.filter(function (x) { return !x.opz; }), fatte = vis.filter(function (x) { return attFatta(x, P); });
    var obbFatte = obb.filter(function (x) { return attFatta(x, P); }).length;
    var manuale = !!(P.spunte && P.spunte["tappa:" + t.id]);
    var completa = manuale || (obb.length ? obbFatte === obb.length : fatte.length > 0);
    var risp = (P.risposte || {})[t.salta];
    var giaNota = !completa && !t.sicurezza && !!t.salta && risp === "si";
    return { completa: completa, giaNota: giaNota, ripasso: !t.sicurezza && !!t.salta && risp === "poco", fatte: fatte.length, totali: vis.length,
      obbligatorie: obb.length, obbFatte: obbFatte, iniziata: fatte.length > 0, manuale: manuale };
  }
  function percorsoUtente() { var P = datiP(); return P && P.contesto ? costruisci(P.contesto, P.chi) : null; }
  function prossima(perc, P) {
    P = P || datiP() || {};
    if (!perc) return null;
    var ok = function (t) { var s = statoTappa(t, P); return !s.completa && !s.giaNota; };
    var u = perc.tappe.filter(function (t) { return t.id === P.ultimaTappa; })[0];
    if (u && ok(u)) return u;
    return perc.tappe.filter(ok)[0] || null;
  }
  function conteggio(perc, P) {
    var n = 0, minuti = 0;
    perc.tappe.forEach(function (t) { var s = statoTappa(t, P); if (s.completa || s.giaNota) n++; minuti += t.durata || 0; });
    return { fatte: n, totali: perc.tappe.length, minuti: minuti };
  }
  function livelloDa(risposte) {
    var punti = 0;
    D.domande.forEach(function (d) { var r = (risposte || {})[d.id]; punti += r === "si" ? 2 : r === "poco" ? 1 : 0; });
    var L = D.livelli[0];
    D.livelli.forEach(function (l) { if (punti >= l.min) L = l; });
    return L;
  }
  function livelloNome(id) { var l = D.livelli.filter(function (x) { return x.id === id; })[0]; return l ? l.t : ""; }
  function ore(min) { var h = Math.round(min / 30) / 2; return (h === Math.floor(h) ? h : String(h).replace(".", ",")) + (h === 1 ? " ora" : " ore"); }
  function digcompChip(c) {
    var x = PD.digcomp && PD.digcomp.competenza(c);
    return '<span class="dc-chip" style="--dc-col:' + esc(x ? x.area.colore : "#1d5c8f") + '" title="' + esc(x ? x.titolo : c) + '">' + esc(c) + "</span>";
  }

  /* ------------------------------------------------------------------ voce */
  var parlato = {};
  function testoTappa(t, perc) {
    var P = datiP() || {}, prima = t.visibili.filter(function (x) { return !attFatta(x, P); })[0];
    return "Tappa " + t.n + " di " + perc.tappe.length + ": " + t.titolo + ". " + (t.perche || "") + (prima ? " Cominciate da: " + prima.titolo + "." : "");
  }
  function leggiTappa(t, perc, forza) { if (PD.speak) PD.speak(testoTappa(t, perc), forza); }

  /* ------------------------------------------------------------------ apertura di un'attività */
  function apri(x, idTappa) {
    var P = datiP();
    if (P && idTappa) { P.ultimaTappa = idTappa; PD.saveProgress(); }
    if (x.domanda) {
      PD.go("#/ask");
      setTimeout(function () { if (PD.ask) PD.ask(x.domanda); }, 120);
      return;
    }
    if (x.go) PD.go(x.go);
  }

  /* ================================================================== PAGINA DEL PERCORSO */
  function attHTML(t, P, perc) {
    if (!t.visibili.length) return '<p class="small muted">Questa tappa si svolge a voce, insieme.</p>';
    return '<ul class="pc-att">' + t.visibili.map(function (x) {
      var auto = x.auto && x.fatto(), fatto = auto || !!(P.spunte && P.spunte[x.chiave]);
      return '<li class="pc-a' + (fatto ? " fatto" : "") + (x.opz ? " opz" : "") + '">' +
        '<label class="pc-spunta" title="' + (auto ? "Fatto: risulta dai vostri progressi" : "Segnate a mano quando l'avete fatto") + '">' +
        '<input type="checkbox" data-pc-spunta="' + esc(x.chiave) + '"' + (fatto ? " checked" : "") + (auto ? " disabled" : "") + ' aria-label="' + esc((fatto ? "Fatto: " : "Da fare: ") + x.titolo) + '"></label>' +
        '<span class="pc-a-ico" aria-hidden="true">' + x.ico + '</span><span class="pc-a-testo">' + esc(x.titolo) +
        (x.opz ? ' <small class="muted">(facoltativa)</small>' : "") + (x.conduttore ? ' <small class="pc-cond">per chi conduce</small>' : "") +
        (auto ? ' <small class="pc-auto">✓ fatto</small>' : "") + "</span>" +
        (x.tipo !== "pratica" ? '<button type="button" class="btn ghost pc-apri" data-pc-apri="' + esc(x.chiave) + '" data-pc-tappa="' + esc(t.id) + '">' + (x.domanda ? "💬 Chiedi" : "▶ Apri") + "</button>" : "") +
        "</li>";
    }).join("") + "</ul>";
  }
  function badgeStato(s, prox) {
    if (s.completa) return '<span class="badge done">✓ Fatta</span>';
    if (s.giaNota) return '<span class="badge">⏭ Già nota</span>';
    if (prox) return '<span class="badge warn">▶ Prossima</span>';
    if (s.iniziata) return '<span class="badge">◐ In corso</span>';
    return "";
  }
  function icoStato(s, prox) { return s.completa ? "✓" : s.giaNota ? "⏭" : prox ? "▶" : s.iniziata ? "◐" : "○"; }
  function metaTappa(t, perc) {
    return '<div class="pc-meta small"><span>⏱️ circa ' + (t.durata || 15) + " min</span>" +
      (t.sicurezza ? '<span class="pc-sic">🛡️ sicurezza: non si salta</span>' : "") +
      '<span class="dc-chips">' + (t.digcomp || []).map(digcompChip).join("") + "</span></div>";
  }
  function bottoniTappa(t, s) {
    return '<div class="row pc-tappa-cmd"><button type="button" class="btn ghost" data-pc-leggi="' + esc(t.id) + '">🔊 Leggi</button>' +
      (s.completa && s.manuale ? '<button type="button" class="btn ghost" data-pc-tappa-fatta="' + esc(t.id) + '" data-v="0">↩ Togli «fatta»</button>'
        : !s.completa ? '<button type="button" class="btn ghost" data-pc-tappa-fatta="' + esc(t.id) + '" data-v="1">✓ Segna la tappa come fatta</button>' : "") + "</div>";
  }

  function pagina(el) {
    var P = datiP(), perc = percorsoUtente();
    if (!perc) { M = nuovaMaschera(false); return maschera(el); }
    var C = perc.contesto, cnt = conteggio(perc, P), nx = prossima(perc, P), conduce = perc.chi !== "solo";
    var faseNx = nx ? perc.fasi.filter(function (f) { return f.id === nx.fase; })[0] : null;
    var sNx = nx ? statoTappa(nx, P) : null;
    el.innerHTML =
      '<div class="lesson-head pc-testa"><span class="big-ico">' + C.icona + '</span><div><div class="small muted">' + esc(C.titolo) + " · " + esc(CHI[perc.chi].t) +
      (P.livello ? " · " + esc(livelloNome(P.livello)) : "") + "</div><h1>🧭 Il nostro percorso</h1></div></div>" +
      '<p class="lead">' + esc(C.obiettivo) + "</p>" +
      (C.nota ? '<p class="notice info small">💡 ' + esc(C.nota) + "</p>" : "") +
      '<div class="pc-sommario card"><div class="pc-numero"><b>' + cnt.fatte + "</b><span>di " + cnt.totali + " tappe</span></div><div>" +
      '<div class="progress big"><span style="width:' + Math.round(100 * cnt.fatte / Math.max(1, cnt.totali)) + '%"></span></div>' +
      '<p class="small muted" style="margin:.4rem 0 0">8 fasi · circa ' + ore(cnt.minuti) + " in tutto · " + esc(C.sessione) + "</p></div></div>" +
      '<div class="row pc-azioni"><button type="button" class="btn ghost" data-go="#/percorso/inizia">🔄 Cambia contesto o rifai il questionario</button>' +
      '<button type="button" class="btn ghost" id="pc-stampa">🖨️ Stampa il programma</button>' +
      (conduce && vista("enti") ? '<button type="button" class="btn ghost" data-go="#/enti/incontri">📋 Registro e incontri</button>' : "") + "</div>" +
      (nx ? '<section class="card pc-prossima" id="pc-prossima" aria-label="Prossima tappa"><div class="pc-ka">▶ Continua da qui</div>' +
        '<div class="small muted">Tappa ' + nx.n + " di " + perc.tappe.length + " · Fase " + faseNx.fase.n + ": " + esc(faseNx.titolo) + "</div>" +
        "<h2>" + esc(nx.titolo) + "</h2>" + (sNx.ripasso ? '<span class="badge">🔁 Ripasso veloce: la conoscete un po\'</span>' : "") +
        '<p class="pc-perche">' + esc(nx.perche || "") + "</p>" + metaTappa(nx, perc) + attHTML(nx, P, perc) + bottoniTappa(nx, sNx) + "</section>"
        : '<section class="card pc-prossima pc-finito"><h2>🎉 Percorso completato!</h2><p>Avete fatto tutte le tappe. Bravissimi! Ora potete ripassare, stampare le vostre competenze o scegliere un nuovo contesto.</p>' +
          '<div class="row"><button type="button" class="btn" data-go="#/competenze">🧭 Le mie competenze</button><button type="button" class="btn ghost" data-go="#/ripasso">🔁 Ripasso</button></div></section>') +
      '<details class="card pc-linea"><summary>🧭 ' + esc(D.linea.titolo) + "</summary><p>" + esc(D.linea.testo) + "</p><ul>" +
      D.linea.principi.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></details>" +
      '<h2 class="pc-mappa-tit">🗺️ La mappa del percorso</h2>' +
      perc.fasi.map(function (f) {
        var fatte = 0; f.tappe.forEach(function (t) { var s = statoTappa(t, P); if (s.completa || s.giaNota) fatte++; });
        return '<section class="card pc-fase' + (f.fase.obbligatoria ? " pc-obbl" : "") + (nx && nx.fase === f.id ? " pc-attuale" : "") + '" id="pc-fase-' + esc(f.id) + '">' +
          '<div class="pc-fase-testa"><span class="big-ico">' + f.fase.icona + '</span><div><h3>' + f.fase.n + ". " + esc(f.titolo) + "</h3>" +
          '<p class="small muted">' + esc(f.fase.scopo) + '</p></div><span class="pc-conta">' + fatte + " di " + f.tappe.length + "</span></div>" +
          '<div class="progress"><span style="width:' + Math.round(100 * fatte / Math.max(1, f.tappe.length)) + '%"></span></div>' +
          (conduce ? '<div class="pc-conduce small">' +
            (f.incontri.length ? "<p>📅 <b>Incontri pronti:</b> " + f.incontri.map(function (i) {
              return '<a href="#/enti/incontri/' + esc(i.id) + '" data-go="#/enti/incontri/' + esc(i.id) + '">' + i.n + ". " + esc(i.titolo) + "</a>";
            }).join(" · ") + "</p>" : "") + "<p>💡 <b>Consiglio per chi conduce:</b> " + esc(f.consiglio) + "</p></div>" : "") +
          '<ol class="pc-tappe">' + f.tappe.map(function (t) {
            var s = statoTappa(t, P), prox = nx && nx.id === t.id;
            return '<li><details class="pc-tappa' + (s.completa ? " fatta" : s.giaNota ? " nota" : prox ? " prox" : "") + '" data-pc-t="' + esc(t.id) + '">' +
              '<summary><span class="pc-st" aria-hidden="true">' + icoStato(s, prox) + '</span><span class="pc-t-tit"><span class="pc-n">' + t.n + ".</span> " + esc(t.titolo) +
              "</span>" + badgeStato(s, prox) + '<span class="pc-durata small muted">' + (t.durata || 15) + " min</span></summary>" +
              '<div class="pc-tappa-corpo"><p class="pc-perche">' + esc(t.perche || "") + "</p>" +
              (s.giaNota ? '<p class="small muted">Dalle vostre risposte questa tappa risulta già nota: potete saltarla o ripassarla.</p>' : "") +
              (s.ripasso ? '<p class="small muted">🔁 La conoscete un po\': basta un ripasso veloce.</p>' : "") +
              metaTappa(t, perc) + attHTML(t, P, perc) + bottoniTappa(t, s) + "</div></details></li>";
          }).join("") + "</ol></section>";
      }).join("") +
      (conduce ? strumentiHTML(perc.chi) : "");
    lega(el, perc);
    if (nx && !parlato[nx.id] && PD.settings.voice) { parlato[nx.id] = 1; setTimeout(function () { if (location.hash.indexOf("#/percorso") === 0 && !/inizia/.test(location.hash)) leggiTappa(nx, perc); }, 400); }
  }
  function strumentiHTML(chi) {
    var L = D.strumenti.filter(function (s) { return s.per.indexOf(chi) >= 0; }).map(function (s) { var x = risolvi(s); x.titolo = s.t; return x; })
      .filter(function (x) { return x.ok && x.disponibile; });
    if (!L.length) return "";
    return '<section class="card pc-strumenti"><h3>🧰 Strumenti per chi conduce</h3><div class="pc-str-griglia">' + L.map(function (x) {
      return '<button type="button" class="btn ghost" data-pc-vai="' + esc(x.go) + '"><span aria-hidden="true">' + x.ico + "</span> " + esc(x.titolo) + "</button>";
    }).join("") + "</div></section>";
  }
  function lega(el, perc) {
    var trova = function (k) { var r = null; perc.tappe.forEach(function (t) { t.visibili.forEach(function (x) { if (!r && x.chiave === k) r = x; }); }); return r; };
    var tappa = function (id) { return perc.tappe.filter(function (t) { return t.id === id; })[0]; };
    el.onclick = function (e) {
      var b = e.target.closest ? e.target.closest("[data-pc-apri],[data-pc-leggi],[data-pc-tappa-fatta],[data-pc-vai]") : null;
      if (!b) return;
      if (b.hasAttribute("data-pc-apri")) { var x = trova(b.getAttribute("data-pc-apri")); if (x) apri(x, b.getAttribute("data-pc-tappa")); return; }
      if (b.hasAttribute("data-pc-vai")) { PD.go(b.getAttribute("data-pc-vai")); return; }
      if (b.hasAttribute("data-pc-leggi")) { var t = tappa(b.getAttribute("data-pc-leggi")); if (t) leggiTappa(t, perc, true); return; }
      if (b.hasAttribute("data-pc-tappa-fatta")) {
        var P = datiP(), id = b.getAttribute("data-pc-tappa-fatta");
        P.spunte = P.spunte || {};
        if (b.getAttribute("data-v") === "1") { P.spunte["tappa:" + id] = true; PD.toast("✓ Tappa segnata come fatta. Bravi!"); } else delete P.spunte["tappa:" + id];
        PD.saveProgress(); ridisegna(el, id);
      }
    };
    el.onchange = function (e) {
      var c = e.target;
      if (!c || !c.hasAttribute || !c.hasAttribute("data-pc-spunta")) return;
      var P = datiP(); P.spunte = P.spunte || {};
      var k = c.getAttribute("data-pc-spunta");
      if (c.checked) P.spunte[k] = true; else delete P.spunte[k];
      var t = c.closest("[data-pc-t]");
      PD.saveProgress(); ridisegna(el, t ? t.getAttribute("data-pc-t") : "");
    };
    var st = $("#pc-stampa", el); if (st) st.onclick = function () { stampa(); };
  }
  function ridisegna(el, aperta) {
    var y = window.pageYOffset;
    pagina(el);
    if (aperta) { var d = $('.pc-tappa[data-pc-t="' + aperta + '"]', el); if (d) d.open = true; }
    window.scrollTo(0, y);
  }

  /* ================================================================== STAMPA: programma del corso per l'ente */
  function oggi() { try { return new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return new Date().toLocaleDateString(); } }
  function programmaHTML(perc, P) {
    P = P || datiP() || {};
    var C = perc.contesto, cnt = conteggio(perc, P), conduce = perc.chi !== "solo", codici = {};
    perc.tappe.forEach(function (t) { (t.digcomp || []).forEach(function (c) { codici[c] = 1; }); });
    var dataInizio = P.iniziato ? new Date(P.iniziato).toLocaleDateString("it-IT") : "______________";
    return '<div class="enti-p pc-p"><header class="p-testa"><div><b>Professore Digitale</b> · Programma del percorso</div><div>' + esc(oggi()) + "</div></header>" +
      "<h1>" + C.icona + " Programma del percorso: " + esc(C.titolo) + "</h1>" +
      '<p class="p-chi">Sede: ______________________ · ' + (conduce ? "Conduce: <b>" + (PD.settings.teacherName ? esc(PD.settings.teacherName) : "______________") + "</b> · " : "") +
      (perc.chi === "solo" || perc.chi === "operatore" ? "Partecipante: <b>" + (PD.settings.studentName ? esc(PD.settings.studentName) : "______________") + "</b> · " : "Gruppo: ______________ · ") +
      "Inizio: " + esc(dataInizio) + "</p>" +
      "<p><b>Obiettivo:</b> " + esc(C.obiettivo) + "<br><b>Organizzazione:</b> " + esc(C.sessione) + " · <b>Chi:</b> " + esc(CHI[perc.chi].t) +
      (P.livello ? " · <b>Livello di partenza:</b> " + esc(livelloNome(P.livello)) : "") + "<br><b>Durata indicativa:</b> " + cnt.totali + " tappe in 8 fasi, circa " + ore(cnt.minuti) + ".</p>" +
      (C.nota ? '<p class="p-nota">' + esc(C.nota) + "</p>" : "") +
      "<h2>" + esc(D.linea.titolo) + "</h2><p>" + esc(D.linea.testo) + "</p>" +
      perc.fasi.map(function (f) {
        return '<h2 class="pc-p-fase">' + f.fase.n + ". " + esc(f.titolo) + '</h2><p class="p-sempl">' + esc(f.fase.scopo) +
          (conduce && f.incontri.length ? "<br>📅 Incontri pronti: " + f.incontri.map(function (i) { return i.n + ". " + esc(i.titolo); }).join(" · ") : "") +
          (conduce ? "<br>💡 " + esc(f.consiglio) : "") + "</p>" +
          '<table class="p-tab"><thead><tr><th>N.</th><th>Tappa e perché</th><th>Attività nel programma</th><th>Min</th><th>DigComp</th><th>Fatto</th></tr></thead><tbody>' +
          f.tappe.map(function (t) {
            var s = statoTappa(t, P);
            return '<tr><td class="p-cod">' + t.n + "</td><td><b>" + esc(t.titolo) + '</b><br><span class="p-sempl">' + esc(t.perche || "") + "</span>" +
              (t.sicurezza ? '<br><span class="p-sempl">🛡️ sicurezza: non si salta</span>' : "") + '</td><td class="p-sempl">' +
              (t.visibili.length ? t.visibili.map(function (x) { return esc(x.titolo) + (x.opz ? " <i>(fac.)</i>" : ""); }).join("<br>") : "attività a voce") +
              "</td><td>" + (t.durata || 15) + '</td><td class="p-sempl">' + esc((t.digcomp || []).join(", ")) + '</td><td class="p-stato">' +
              (s.completa ? "✓" : s.giaNota ? "già nota" : "☐") + "</td></tr>";
          }).join("") + "</tbody></table>";
      }).join("") +
      "<h2>Competenze DigComp 2.2 allenate</h2><ul>" + Object.keys(codici).sort().map(function (c) {
        var x = PD.digcomp && PD.digcomp.competenza(c);
        return "<li><b>" + esc(c) + "</b> " + esc(x ? x.titolo : "") + "</li>";
      }).join("") + "</ul>" +
      '<p class="p-nota">Programma generato dal Professore Digitale secondo la linea guida in 8 fasi. Le competenze seguono il quadro europeo DigComp 2.2: indicazione orientativa, non certificazione.</p>' +
      PD.piedeStampa() + "</div>";
  }
  function stampa(perc) {
    perc = perc || percorsoUtente(); if (!perc) return;
    var html = programmaHTML(perc);
    if (PD.printHTML) PD.printHTML(html, "verticale");
  }

  /* ================================================================== MASCHERA: dove, chi, da dove partiamo */
  var M = null;
  function nuovaMaschera(auto) {
    var P = datiP() || {};
    return { auto: !!auto, passo: 1, q: 0, contesto: P.contesto || PD.settings.percorsoContesto || "", chi: P.chi || "",
      risposte: copia(P.risposte || {}), avevaRisposte: !!(P.risposte && Object.keys(P.risposte).length), cambio: !!P.contesto };
  }
  function domandaTesto(d) { return (M.chi === "gruppo" || M.chi === "classe") ? d.tg : d.t; }
  var TITOLI = ["", "Dove usate il Professore?", "Chi lo usa?", "Da dove partiamo?", "Ecco il vostro percorso"];
  function maschera(el) {
    if (!M) M = nuovaMaschera(false);
    var nome = (PD.settings.studentName || "").split(/\s+/)[0];
    var testa = M.cambio ? "Cambiamo il percorso" : (PD.greeting ? PD.greeting() : "Benvenuti") + (nome ? ", " + esc(nome) : "") + "! Prepariamo il vostro percorso";
    var html = '<div class="pc-maschera"><div class="pc-m-testa">' + (PD.profHTML ? PD.profHTML() : "") + "<div><h1>🧭 " + testa + "</h1>" +
      '<p class="lead">' + (M.cambio ? "I progressi fatti finora restano: cambiano solo le tappe proposte." :
        "Tre domande e vi preparo un percorso passo passo, dalle basi all'autonomia, senza dimenticare niente.") + "</p></div>" +
      '<button type="button" class="btn ghost pc-dopo" id="pc-dopo">' + (M.cambio ? "✕ Annulla" : "⏰ Lo faccio dopo") + "</button></div>" +
      '<ol class="pc-passi" aria-label="Passi">' + [1, 2, 3].map(function (i) {
        return '<li class="' + (M.passo === i ? "ora" : M.passo > i ? "fatto" : "") + '"' + (M.passo === i ? ' aria-current="step"' : "") + "><span>" + (M.passo > i ? "✓" : i) + "</span> " + TITOLI[i] + "</li>";
      }).join("") + "</ol>" + '<div class="pc-m-corpo">' + corpoPasso() + "</div>" +
      '<div class="row pc-m-piede">' + (M.passo > 1 ? '<button type="button" class="btn ghost big" id="pc-indietro">← Indietro</button>' : "") +
      (M.auto && !M.cambio && M.passo < 4 ? '<label class="switch small pc-nonchiedere"><input type="checkbox" id="pc-nonchiedere"> Non proporlo più all\'avvio</label>' : "") + "</div></div>";
    el.innerHTML = html;
    legaMaschera(el);
    var corpo = $(".pc-m-corpo", el);
    if (corpo && corpo.getBoundingClientRect().top < 0 && corpo.scrollIntoView) corpo.scrollIntoView();   // sul telefono: la domanda nuova si vede subito
  }
  function corpoPasso() {
    if (M.passo === 1) {
      return "<h2>1. " + TITOLI[1] + '</h2><p class="small muted">Toccate il riquadro che vi somiglia di più.</p><div class="pc-scelte pc-contesti">' +
        D.contesti.map(function (c) {
          return '<button type="button" class="pc-scelta' + (M.contesto === c.id ? " scelta" : "") + '" data-pc-contesto="' + esc(c.id) + '" aria-pressed="' + (M.contesto === c.id) + '">' +
            '<span class="pc-s-ico" aria-hidden="true">' + c.icona + '</span><span class="pc-s-tit">' + esc(c.titolo) + '</span><span class="pc-s-sotto">' + esc(c.sotto) + "</span></button>";
        }).join("") + "</div>";
    }
    if (M.passo === 2) {
      var C = CONTESTI[M.contesto], cons = C ? C.chi : "solo";
      return "<h2>2. " + TITOLI[2] + '</h2><p class="small muted">' + (C ? C.icona + " " + esc(C.titolo) : "") + '</p><div class="pc-scelte pc-chi">' +
        D.chi.map(function (c) {
          var sel = (M.chi || cons) === c.id;
          return '<button type="button" class="pc-scelta' + (sel ? " scelta" : "") + '" data-pc-chi="' + esc(c.id) + '" aria-pressed="' + sel + '">' +
            '<span class="pc-s-ico" aria-hidden="true">' + c.icona + '</span><span class="pc-s-tit">' + esc(c.t) + '</span><span class="pc-s-sotto">' + esc(c.d) + "</span>" +
            (c.id === cons ? '<span class="badge">consigliato</span>' : "") + "</button>";
        }).join("") + "</div>";
    }
    if (M.passo === 3) {
      var d = D.domande[M.q], r = M.risposte[d.id];
      return "<h2>3. " + TITOLI[3] + '</h2><p class="small muted">Rispondete con sincerità: le cose che sapete già si potranno saltare. <b>La sicurezza no: quella si fa sempre.</b></p>' +
        '<div class="card pc-domanda"><div class="small muted">Domanda ' + (M.q + 1) + " di " + D.domande.length + '</div><div class="pc-puntini" aria-hidden="true">' +
        D.domande.map(function (x, i) { return '<span class="' + (i < M.q ? "fatto" : i === M.q ? "ora" : "") + '"></span>'; }).join("") + "</div>" +
        '<div class="pc-d-ico" aria-hidden="true">' + d.icona + '</div><p class="pc-d-testo" id="pc-d-testo">' + esc(domandaTesto(d)) + "</p>" +
        '<div class="pc-risposte" role="group" aria-labelledby="pc-d-testo">' +
        [["si", "👍", "Sì"], ["poco", "🤏", "Un po'"], ["no", "✋", "No"]].map(function (o) {
          return '<button type="button" class="pc-risp pc-r-' + o[0] + (r === o[0] ? " scelta" : "") + '" data-pc-risp="' + o[0] + '"><span aria-hidden="true">' + o[1] + "</span> " + o[2] + "</button>";
        }).join("") + "</div></div>" +
        '<div class="row pc-q-cmd"><button type="button" class="btn ghost" id="pc-q-salta">Non lo so: partiamo dall\'inizio</button>' +
        (M.avevaRisposte ? '<button type="button" class="btn ghost" id="pc-q-tieni">✓ Tengo le risposte di prima</button>' : "") +
        '<button type="button" class="btn ghost" id="pc-q-voce">🔊 Rileggi</button></div>';
    }
    /* 4: riepilogo */
    var perc = costruisci(M.contesto, M.chi), P = datiP() || {}, L = livelloDa(M.risposte), cnt = conteggio(perc, P), nx = prossima(perc, P);
    var note = 0; perc.tappe.forEach(function (t) { if (statoTappa(t, P).giaNota) note++; });
    return '<div class="card pc-riepilogo"><h2>🎉 ' + TITOLI[4] + "</h2>" +
      '<ul class="pc-ri">' + riga(perc.contesto.icona, "<b>" + esc(perc.contesto.titolo) + "</b>") + riga(CHI[perc.chi].icona, esc(CHI[perc.chi].t)) +
      riga("📈", "Livello di partenza: <b>" + esc(L.t) + "</b> — " + esc(L.d)) +
      riga("🗺️", "<b>" + cnt.totali + " tappe</b> in 8 fasi, circa " + ore(cnt.minuti) + (note ? " · " + note + (note === 1 ? " già nota" : " già note") : "")) +
      (nx ? riga("▶", "Si parte da: <b>tappa " + nx.n + " – " + esc(nx.titolo) + "</b>") : "") + "</ul>" +
      '<p class="small muted">' + esc(perc.contesto.sessione) + (M.cambio ? " · I progressi fatti finora restano." : "") + "</p>" +
      '<div class="row"><button type="button" class="btn big" id="pc-via">▶ Cominciamo</button><button type="button" class="btn ghost big" id="pc-m-stampa">🖨️ Stampa il programma</button></div></div>';
  }
  function riga(ico, html) { return '<li><span aria-hidden="true">' + ico + "</span><span>" + html + "</span></li>"; }
  function parlaPasso() {
    if (!PD.speak || !PD.settings.voice) return;
    var t = M.passo === 3 ? domandaTesto(D.domande[M.q]) : M.passo === 4 ? "" : TITOLI[M.passo] + " Toccate il riquadro giusto.";
    if (M.passo === 4) {
      var perc = costruisci(M.contesto, M.chi), nx = prossima(perc);
      t = "Ecco il vostro percorso: " + perc.tappe.length + " tappe." + (nx ? " Si parte dalla tappa " + nx.n + ": " + nx.titolo + "." : "");
    }
    PD.speak(t);
  }
  function vai(el, passo) { M.passo = passo; if (passo === 4) salva(); maschera(el); parlaPasso(); }
  function legaMaschera(el) {
    var on = function (sel, fn) { var n = $(sel, el); if (n) n.onclick = fn; };
    on("#pc-dopo", function () { dopo(); });
    on("#pc-indietro", function () {
      if (M.passo === 3 && M.q > 0) { M.q--; maschera(el); parlaPasso(); return; }
      vai(el, Math.max(1, M.passo - 1));
    });
    var nc = $("#pc-nonchiedere", el);
    if (nc) nc.onchange = function () {
      var P = PD.progress.percorso || (PD.progress.percorso = {});
      if (nc.checked) P.nonChiedere = true; else delete P.nonChiedere;
      PD.saveProgress();
      PD.toast(nc.checked ? "Va bene: non lo proporrò più all'avvio. Lo trovate sempre nell'Inizio." : "All'avvio ve lo riproporrò.");
    };
    $$("[data-pc-contesto]", el).forEach(function (b) {
      b.onclick = function () {
        var nuovo = b.getAttribute("data-pc-contesto");
        if (nuovo !== M.contesto) M.chi = "";
        M.contesto = nuovo;
        $$("[data-pc-contesto]", el).forEach(function (x) { x.classList.toggle("scelta", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        setTimeout(function () { vai(el, 2); }, 250);
      };
    });
    $$("[data-pc-chi]", el).forEach(function (b) {
      b.onclick = function () {
        M.chi = b.getAttribute("data-pc-chi"); M.q = 0;
        $$("[data-pc-chi]", el).forEach(function (x) { x.classList.toggle("scelta", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        setTimeout(function () { vai(el, 3); }, 250);
      };
    });
    $$("[data-pc-risp]", el).forEach(function (b) {
      b.onclick = function () {
        M.risposte[D.domande[M.q].id] = b.getAttribute("data-pc-risp");
        $$("[data-pc-risp]", el).forEach(function (x) { x.classList.toggle("scelta", x === b); });
        setTimeout(function () {
          if (M.q < D.domande.length - 1) { M.q++; maschera(el); parlaPasso(); } else vai(el, 4);
        }, 200);
      };
    });
    on("#pc-q-salta", function () { D.domande.forEach(function (d) { M.risposte[d.id] = "no"; }); vai(el, 4); });
    on("#pc-q-tieni", function () { vai(el, 4); });
    on("#pc-q-voce", function () { if (PD.speak) PD.speak(domandaTesto(D.domande[M.q]), true); });
    on("#pc-via", function () { fine(); });
    on("#pc-m-stampa", function () { stampa(); });
  }
  function salva() {
    var P = PD.progress.percorso || {}, t = ora();
    P.contesto = M.contesto; P.chi = M.chi || CONTESTI[M.contesto].chi; P.risposte = copia(M.risposte);
    P.livello = livelloDa(P.risposte).id;
    P.spunte = P.spunte || {};
    if (!P.iniziato) P.iniziato = t;
    P.aggiornato = t;
    delete P.nonChiedere;
    PD.progress.percorso = P;
    var nx = prossima(costruisci(P.contesto, P.chi), P);
    P.ultimaTappa = nx ? nx.id : "";
    PD.saveProgress();
    if (PD.settings.percorsoContesto !== P.contesto) { PD.settings.percorsoContesto = P.contesto; PD.saveSettings(); }
  }
  function fine() {
    var eraAuto = M && M.auto;
    M = null;
    var perc = percorsoUtente(), nx = prossima(perc);
    if (nx) parlato[nx.id] = 1;     // lo dice già il saluto qui sotto
    PD.go("#/percorso");
    var nome = (PD.settings.studentName || "").split(/\s+/)[0];
    var t = (eraAuto && salutoSospeso ? (PD.greeting ? PD.greeting() : "Buongiorno") + (nome ? ", " + nome : "") + "! " : "") +
      "Ecco il vostro percorso" + (nx ? ": cominciamo dalla tappa " + nx.n + ", «" + nx.titolo + "»." : ".");
    salutoSospeso = false;
    if (PD.bubble) PD.bubble(t, null, 9000);
    if (PD.speak) PD.speak(t);
  }
  function dopo() {
    var eraAuto = M && M.auto, cambio = M && M.cambio;
    M = null;
    if (PD.stopSpeech) PD.stopSpeech();
    PD.go(cambio ? "#/percorso" : "#/home");
    if (eraAuto && salutoSospeso) { salutoSospeso = false; setTimeout(saluta, 300); }
    else if (!cambio) PD.toast("🧭 Va bene! Il percorso vi aspetta in cima all'Inizio.", 4000);
  }
  /* il saluto all'avvio, rimandato a dopo la maschera (presenza.js) */
  function saluta() {
    if (typeof PD.saluta === "function") { PD.saluta(); return; }
    var t = PD.testoSaluto ? PD.testoSaluto() : (PD.greeting ? PD.greeting() : "Buongiorno") + "!";
    var nx = PD.nextLesson ? PD.nextLesson() : null;
    if (PD.bubble) PD.bubble(t, nx && !(PD.isLate && PD.isLate()) ? [{ t: "▶ Continua la lezione", go: "#/lessons/" + nx.id }, { t: "Più tardi", fn: function () {} }] : null, 14000);
    if (PD.speak) PD.speak(t);
  }

  PD.views.percorso = function (el, args) {
    if (args && args[0] === "inizia") {
      if (!M) M = nuovaMaschera(false);
      maschera(el);
      if (M.passo === 1 && !M.parlato) { M.parlato = true; setTimeout(function () { if (M && /inizia/.test(location.hash)) parlaPasso(); }, M.auto ? 700 : 100); }
      return;
    }
    M = null;
    pagina(el);
  };

  /* ================================================================== INIZIO e IMPOSTAZIONI */
  PD.hooks.homeCards.push({
    html: function () {
      var perc = percorsoUtente();
      if (!perc) {
        return '<div class="card pc-home pc-home-nuovo" id="pc-home"><span class="big-ico" aria-hidden="true">🧭</span><div><h2>Il nostro percorso</h2>' +
          "<p>Ditemi dove usate il Professore e da dove partite: vi guiderò passo passo, dalle basi all'autonomia, senza dimenticare niente.</p></div>" +
          '<button type="button" class="btn big" data-go="#/percorso/inizia">🧭 Scegliamo il percorso</button></div>';
      }
      var P = datiP(), cnt = conteggio(perc, P), nx = prossima(perc, P);
      return '<div class="card pc-home" id="pc-home"><span class="big-ico" aria-hidden="true">' + perc.contesto.icona + '</span><div class="pc-home-testo">' +
        '<div class="small muted">🧭 Il vostro percorso · ' + esc(perc.contesto.titolo) + "</div>" +
        "<h2>" + (nx ? "Tappa " + nx.n + " di " + cnt.totali + " – " + esc(nx.titolo) : "🎉 Percorso completato!") + "</h2>" +
        '<div class="progress"><span style="width:' + Math.round(100 * cnt.fatte / Math.max(1, cnt.totali)) + '%"></span></div>' +
        '<div class="small muted">' + cnt.fatte + " di " + cnt.totali + " tappe fatte</div></div>" +
        '<button type="button" class="btn big" data-go="#/percorso">' + (nx ? "▶ Continua" : "🗺️ Vedi") + "</button></div>";
    },
    bind: function (el) {
      var c = $("#pc-home", el), hero = $(".hero", el);
      if (c && hero && hero.parentNode) hero.parentNode.insertBefore(c, hero.nextSibling);   // in alto, subito sotto il saluto
    }
  });
  PD.hooks.settingsCards.push({
    html: function () {
      var P = datiP() || {}, C = CONTESTI[P.contesto];
      return '<div class="card pc-impostazioni" id="pc-impostazioni"><h2 style="margin-top:0">🧭 Il nostro percorso</h2>' +
        '<p class="small muted">' + (C ? "Contesto scelto: <b>" + C.icona + " " + esc(C.titolo) + "</b>" + (P.chi && CHI[P.chi] ? " · " + esc(CHI[P.chi].t) : "") + "." :
          "Non avete ancora scelto il percorso: bastano tre domande.") + " Ogni persona ha il suo percorso e i suoi progressi.</p>" +
        '<label class="switch"><input type="checkbox" id="pc-s-avvio"' + (P.nonChiedere ? "" : " checked") + "> Proponi la scelta del percorso all'avvio, finché non è stata fatta</label>" +
        '<div class="row">' + (C ? '<button type="button" class="btn ghost" data-go="#/percorso">🗺️ Apri il percorso</button>' : "") +
        '<button type="button" class="btn ghost" data-go="#/percorso/inizia">🧭 ' + (C ? "Cambia contesto o rifai il questionario" : "Il nostro percorso") + "</button></div></div>";
    },
    bind: function (el) {
      var c = $("#pc-s-avvio", el);
      if (c) c.onchange = function () {
        var P = PD.progress.percorso || (PD.progress.percorso = {});
        if (c.checked) delete P.nonChiedere; else P.nonChiedere = true;
        PD.saveProgress();
      };
    }
  });

  /* ================================================================== AVVIO: profilo → percorso → saluto */
  var avvioAuto = !(ss("pd.salutato") === "1" || ss("pd.percorsoVisto") === "1" || /[?&](nopercorso|nosaluto|noprofilo)\b/.test(location.search || ""));
  var chiesti = {}, salutoSospeso = false;
  function profiloId() { return (PD.progress && PD.progress.profilo) || "_"; }
  function serveMaschera() { var p = datiP(); return !(p && ((p.contesto && CONTESTI[p.contesto]) || p.nonChiedere)); }
  function sulleHome(h) { return /^(#\/?(home)?)?$/.test(h || ""); }
  function apriAllAvvio(sostituisci) {
    M = nuovaMaschera(true);
    ss("pd.percorsoVisto", "1");
    var h = "#/percorso/inizia";
    if (sostituisci) {
      try { history.replaceState(null, "", location.pathname + location.search + h); } catch (e) { location.hash = h; }
    } else {
      try { location.replace(h); } catch (e) { location.hash = h; }
    }
  }
  PD.hooks.dopoCaricamento.push(function () {
    if (!avvioAuto) return;
    var h = location.hash;
    if (/^#\/profili\/scegli/.test(h)) return;          // prima si sceglie la persona (profili.js)
    if (!sulleHome(h)) { avvioAuto = false; return; }   // aperto su una pagina precisa: non disturbiamo
    chiesti[profiloId()] = 1;
    if (!serveMaschera()) return;
    salutoSospeso = true;
    ss("pd.salutato", "1");                              // il saluto (presenza.js) arriva dopo la maschera
    apriAllAvvio(true);
  });
  window.addEventListener("hashchange", function () {
    if (!avvioAuto || !sulleHome(location.hash)) return;
    var id = profiloId();
    if (chiesti[id]) return;
    chiesti[id] = 1;
    if (!serveMaschera()) return;
    if (PD.stopSpeech) PD.stopSpeech();
    apriAllAvvio(false);
  });

  /* ================================================================== API (anche per le prove) */
  function riferimenti() {
    var out = {};
    function aggiungi(a, dove) { var x = norm(a), k = x.r; if (!out[k]) out[k] = []; out[k].push(dove); }
    D.contesti.forEach(function (C) {
      D.fasi.forEach(function (F) {
        var cf = (C.fasi || {})[F.id]; if (!cf) return;
        (cf.tappe || []).forEach(function (rif) {
          var over = typeof rif === "string" ? { id: rif } : rif, t = unisci(D.tappe[over.base || over.id] || {}, over);
          t.att.forEach(function (a) { aggiungi(a, C.id + "/" + over.id); });
        });
      });
    });
    D.strumenti.forEach(function (s) { aggiungi(s, "strumenti"); });
    D.fasi.forEach(function (F) { (F.incontri || []).forEach(function (i) { aggiungi("incontro:" + i, "fase " + F.id); }); });
    return out;
  }
  /* rimandi che non portano a niente (in tutti i contesti); con «tutti» anche quelli solo-server fuori dal server */
  function verifica() {
    var rotti = [];
    D.contesti.forEach(function (C) {
      D.fasi.forEach(function (F) {
        var cf = (C.fasi || {})[F.id];
        if (!cf || !cf.tappe || !cf.tappe.length) { rotti.push({ contesto: C.id, fase: F.id, motivo: "fase vuota" }); return; }
        cf.tappe.forEach(function (rif) {
          var over = typeof rif === "string" ? { id: rif } : rif, b = D.tappe[over.base || over.id];
          if (!b && !(over.titolo && over.att)) rotti.push({ contesto: C.id, tappa: over.id, motivo: "tappa inesistente" });
        });
      });
      ["solo", "gruppo"].forEach(function (chi) {
        var perc = costruisci(C.id, chi), visti = {};
        perc.tappe.forEach(function (t) {
          if (visti[t.id]) rotti.push({ contesto: C.id, tappa: t.id, motivo: "tappa doppia" });
          visti[t.id] = 1;
          if (!t.titolo || !t.perche || !t.durata || !(t.digcomp || []).length) rotti.push({ contesto: C.id, tappa: t.id, motivo: "dati incompleti" });
          (t.digcomp || []).forEach(function (c) { if (PD.digcomp && !PD.digcomp.competenza(c)) rotti.push({ contesto: C.id, tappa: t.id, motivo: "DigComp sconosciuta " + c }); });
          t.attivita.forEach(function (x) { if (!x.ok) rotti.push({ contesto: C.id, tappa: t.id, r: x.att.r, motivo: "rimando rotto" }); });
        });
      });
    });
    D.strumenti.forEach(function (s) { if (!risolvi(s).ok) rotti.push({ contesto: "strumenti", r: s.r, motivo: "rimando rotto" }); });
    D.fasi.forEach(function (F) { (F.incontri || []).forEach(function (i) { if (!incontro(i)) rotti.push({ contesto: "fasi", r: i, motivo: "incontro inesistente" }); }); });
    return rotti;
  }
  PD.percorsi = {
    dati: D, contesti: function () { return D.contesti.slice(); },
    costruisci: costruisci, risolvi: risolvi, statoTappa: statoTappa, prossima: prossima, conteggio: conteggio, livello: livelloDa,
    attuale: percorsoUtente, programmaHTML: programmaHTML, stampa: stampa, riferimenti: riferimenti, verifica: verifica,
    chiave: chiave
  };
})();
