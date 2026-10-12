/* ==============================================================================
 *  PROFESSORE DIGITALE - Registro presenze e resoconto per l'ente
 *  Il facilitatore crea un corso, scrive gli iscritti, segna gli incontri e chi era presente.
 *  Il resoconto conta incontri, ore, presenze, ore-persona e frequenza; si stampa (A4) o si
 *  esporta per il foglio di calcolo (CSV con «;» e BOM, adatto a Excel e LibreOffice in italiano).
 *  Dati nella chiave "registro" (separata dai progressi), solo su questo computer.
 *  Lo mostra la pagina «Registro e incontri» (enti.js) con PD.registro.render(box, "registro"|"resoconto").
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var R = vuoto(), caricato = false, nBox = 0;
  var GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

  /* ------------------------------------------------------------------ dati */
  function vuoto() { return { versione: 1, corsi: [], attivo: "" }; }
  function nuovoId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function str(v, max) { return String(v == null ? "" : v).slice(0, max || 200); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function oggi() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function isoOk(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || ""); }
  function oraOk(h) { return /^\d{1,2}:\d{2}$/.test(h || ""); }
  function copia(o) { var r = {}, k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function nomeChiave(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/^\s|\s$/g, ""); }

  function normIscritto(x) {
    if (!x || typeof x !== "object") return null;
    var i = copia(x);
    i.id = str(x.id, 60) || nuovoId("i"); i.nome = str(x.nome, 80);
    if (x.profilo != null) i.profilo = str(x.profilo, 60);
    if (x.telefono != null) i.telefono = str(x.telefono, 40);
    if (x.note != null) i.note = str(x.note, 500);
    return i;
  }
  function normIncontro(x) {
    if (!x || typeof x !== "object") return null;
    var m = copia(x);
    m.id = str(x.id, 60) || nuovoId("m");
    m.data = isoOk(x.data) ? x.data : oggi();
    m.inizio = oraOk(x.inizio) ? x.inizio : "15:00"; m.fine = oraOk(x.fine) ? x.fine : "17:00";
    m.argomento = str(x.argomento, 200); m.note = str(x.note, 1000);
    if (x.incontroPronto != null && x.incontroPronto !== "") m.incontroPronto = x.incontroPronto; else delete m.incontroPronto;
    var visti = {};
    m.presenti = (Array.isArray(x.presenti) ? x.presenti : []).map(function (p) { return str(p, 60); })
      .filter(function (p) { if (!p || visti[p]) return false; visti[p] = 1; return true; });
    return m;
  }
  function normCorso(x) {
    if (!x || typeof x !== "object") return null;
    var c = copia(x);
    c.id = str(x.id, 60) || nuovoId("c");
    ["nome", "ente", "sede", "facilitatore"].forEach(function (k) { c[k] = str(x[k], 120); });
    c.inizio = isoOk(x.inizio) ? x.inizio : ""; c.fine = isoOk(x.fine) ? x.fine : ""; c.note = str(x.note, 1000);
    c.iscritti = (Array.isArray(x.iscritti) ? x.iscritti : []).map(normIscritto).filter(Boolean);
    c.incontri = (Array.isArray(x.incontri) ? x.incontri : []).map(normIncontro).filter(Boolean);
    return c;
  }
  function normalizza(v) {
    if (!v || typeof v !== "object" || !Array.isArray(v.corsi)) return vuoto();
    var r = copia(v);
    r.versione = 1;
    r.corsi = v.corsi.map(normCorso).filter(Boolean);
    r.attivo = str(v.attivo, 60);
    if (!corsoIn(r, r.attivo)) r.attivo = r.corsi.length ? r.corsi[r.corsi.length - 1].id : "";
    return r;
  }
  function corsoIn(r, id) { return r.corsi.filter(function (c) { return c.id === id; })[0] || null; }
  function corso(id) { return corsoIn(R, id || R.attivo); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0] || null; }

  /* salvataggio: copia nel browser subito; con il server anche subito sul disco (non ritardato) */
  var avvisato = false, sporco = false;
  function salva() {
    sporco = false;
    R.aggiornato = new Date().toISOString();
    PD.store.save("registro", R);
    if (PD.server && !PD.ospite && PD.api) {
      PD.api("/api/data/registro", { value: R }).catch(function () {
        if (!avvisato && PD.toast) { avvisato = true; PD.toast("⚠️ Non riesco a salvare il registro sul disco: resta una copia nel browser. Salvate una copia (JSON) per sicurezza.", 6000); }
      });
    }
  }
  /* mentre si scrive: copia nel browser subito, sul disco dopo una breve pausa (PD.store) */
  function salvaPresto() { sporco = true; R.aggiornato = new Date().toISOString(); PD.store.save("registro", R); }
  /* chiudendo la pagina subito dopo aver scritto, l'ultima modifica arriva comunque sul disco */
  window.addEventListener("pagehide", function () {
    if (!sporco || !PD.server || PD.ospite || !window.fetch) return;
    sporco = false;
    try { fetch("/api/data/registro", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: R }) }); } catch (e) { /* resta la copia nel browser */ }
  });

  function carica() {
    return PD.store.load("registro").then(function (v) { R = normalizza(v); caricato = true; }, function () { caricato = true; });
  }
  if (PD.hooks && PD.hooks.dopoCaricamento) PD.hooks.dopoCaricamento.push(carica);

  /* ------------------------------------------------------------------ date e ore */
  function minuti(h) { var p = String(h || "").split(":"); return oraOk(h) ? (+p[0]) * 60 + (+p[1]) : 0; }
  function durataMin(m) { var d = minuti(m.fine) - minuti(m.inizio); return d > 0 ? d : 0; }
  function arrot(n, k) { var f = Math.pow(10, k == null ? 2 : k); return Math.round(n * f) / f; }
  function numIt(n) { return String(arrot(n, 2)).replace(".", ","); }
  function dataIt(iso) { if (!isoOk(iso)) return ""; var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function dataLunga(iso) {
    if (!isoOk(iso)) return "";
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return GIORNI[d.getDay()] + " " + d.getDate() + " " + MESI[d.getMonth()] + " " + d.getFullYear();
  }
  function ordina(list) {
    return list.slice().sort(function (a, b) { var x = a.data + " " + pad5(a.inizio), y = b.data + " " + pad5(b.inizio); return x < y ? -1 : x > y ? 1 : 0; });
  }
  function pad5(h) { return h && h.length === 4 ? "0" + h : h || ""; }
  function inPeriodo(m, dal, al) { return (!dal || m.data >= dal) && (!al || m.data <= al); }

  /* ------------------------------------------------------------------ progressi di una persona */
  function progressoDi(isc) {
    if (!isc.profilo) return null;
    try {
      if (isc.profilo !== "locale" && PD.profili && typeof PD.profili.progressDi === "function") return PD.profili.progressDi(isc.profilo) || null;
    } catch (e) { return null; }
    return isc.profilo === "locale" ? PD.progress : null;
  }
  function titoloProva(id) {
    var P = (PD.prove ? PD.prove() : window.PD_PROVE || []).filter(function (p) { return p.id === id; })[0];
    return P ? P.titolo : id;
  }
  function unico(list) { var v = {}; return list.filter(function (x) { if (!x || v[x]) return false; v[x] = 1; return true; }); }
  function risultati(isc) {
    var pr = progressoDi(isc), a = isc.aula || null, out = { lezioni: 0, quiz: [], attestati: [], competenze: [], fonte: [] };
    if (pr) {
      var L = pr.lessons || {};
      out.lezioni = Object.keys(L).filter(function (k) { return L[k] && L[k].done; }).length;
      var Q = pr.quiz || {};
      out.quiz = Object.keys(Q).filter(function (k) { return Q[k] && Q[k].superata; }).map(titoloProva);
      out.attestati = (pr.attestati || []).map(function (x) { return x.titolo; });
      if (PD.digcomp && typeof PD.digcomp.raggiunte === "function") {
        try { out.competenze = (PD.digcomp.raggiunte(pr) || []).slice(); } catch (e) { out.competenze = []; }
      }
      out.fonte.push("profilo");
    }
    if (a) {
      out.lezioni = Math.max(out.lezioni, +a.lezioni || 0);
      out.quiz = out.quiz.concat((a.quiz || []).filter(function (q) { return q.superata; }).map(function (q) { return q.titolo; }));
      out.attestati = out.attestati.concat((a.attestati || []).map(function (x) { return x.titolo; }));
      out.fonte.push("aula");
    }
    out.quiz = unico(out.quiz); out.attestati = unico(out.attestati); out.competenze = unico(out.competenze).sort();
    out.collegato = out.fonte.length > 0;
    return out;
  }
  function areeDigcomp() {
    var D = window.PD_DIGCOMP, mappa = {}, aree = [];
    if (!D || !Array.isArray(D.aree)) return null;
    D.aree.forEach(function (a, i) {
      var t = a.titolo || a.nome || ("Area " + (i + 1)), voce = { titolo: t, n: 0, persone: 0, competenze: (a.competenze || []).length };
      aree.push(voce);
      (a.competenze || []).forEach(function (k) { mappa[k.c] = voce; });
    });
    return { aree: aree, mappa: mappa };
  }

  /* ------------------------------------------------------------------ calcolo del resoconto */
  function resoconto(idCorso, dal, al) {
    var c = corso(idCorso);
    if (!c) return null;
    var inc = ordina(c.incontri.filter(function (m) { return inPeriodo(m, dal, al); }));
    var ids = {}, persone = c.iscritti.map(function (i) { var p = { id: i.id, nome: i.nome, presenze: 0, minuti: 0 }; ids[i.id] = p; return p; });
    var totMin = 0, presenze = 0, minPers = 0, argomenti = [];
    inc.forEach(function (m) {
      var d = durataMin(m), pres = m.presenti.filter(function (x) { return ids[x]; });
      totMin += d;
      pres.forEach(function (x) { ids[x].presenze++; ids[x].minuti += d; presenze++; minPers += d; });
      argomenti.push({ id: m.id, data: m.data, inizio: m.inizio, fine: m.fine, ore: arrot(d / 60), argomento: m.argomento, incontroPronto: m.incontroPronto || "", presenti: pres.length, note: m.note });
    });
    var dc = areeDigcomp(), perArea = dc ? dc.aree.map(function (a) { return { titolo: a.titolo, competenze: a.competenze, raggiunte: 0, persone: 0 }; }) : [];
    persone.forEach(function (p) {
      var isc = byId(c.iscritti, p.id), r = risultati(isc);
      p.ore = arrot(p.minuti / 60); p.perc = inc.length ? arrot(100 * p.presenze / inc.length, 1) : 0;
      p.lezioni = r.lezioni; p.quiz = r.quiz; p.attestati = r.attestati; p.competenze = r.competenze; p.collegato = r.collegato;
      if (dc) {
        var viste = {};
        r.competenze.forEach(function (k) {
          var v = dc.mappa[k]; if (!v) return;
          var i = dc.aree.indexOf(v); perArea[i].raggiunte++;
          if (!viste[i]) { viste[i] = 1; perArea[i].persone++; }
        });
      }
      delete p.minuti;
    });
    var date = inc.map(function (m) { return m.data; });
    return {
      corso: { id: c.id, nome: c.nome, ente: c.ente, sede: c.sede, facilitatore: c.facilitatore, inizio: c.inizio, fine: c.fine },
      dal: dal || date[0] || c.inizio || "", al: al || date[date.length - 1] || c.fine || "",
      incontri: inc.length, ore: arrot(totMin / 60), iscritti: c.iscritti.length,
      partecipanti: persone.filter(function (p) { return p.presenze > 0; }).length,
      presenze: presenze, orePersona: arrot(minPers / 60),
      frequenza: inc.length && c.iscritti.length ? arrot(100 * presenze / (inc.length * c.iscritti.length), 1) : 0,
      persone: persone, argomenti: argomenti, digcomp: dc ? perArea : null,
      competenzeTotali: persone.reduce(function (a, p) { return a + p.competenze.length; }, 0),
      lezioniTotali: persone.reduce(function (a, p) { return a + p.lezioni; }, 0),
      attestatiTotali: persone.reduce(function (a, p) { return a + p.attestati.length; }, 0)
    };
  }

  /* ------------------------------------------------------------------ CSV (separatore ; e virgola decimale) */
  function cella(v) { var s = String(v == null ? "" : v); return /[";\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function righeCSV(righe) { return righe.map(function (r) { return r.map(cella).join(";"); }).join("\r\n") + "\r\n"; }
  function csvPresenze(idCorso, dal, al) {
    var c = corso(idCorso); if (!c) return "";
    var inc = ordina(c.incontri.filter(function (m) { return inPeriodo(m, dal, al); })), s = resoconto(c.id, dal, al);
    var testa = ["Partecipante"].concat(inc.map(function (m) { return dataIt(m.data) + " " + m.inizio + "-" + m.fine; })).concat(["Presenze", "Ore", "Frequenza %"]);
    var righe = [testa];
    c.iscritti.forEach(function (i, k) {
      var p = s.persone[k];
      righe.push([i.nome].concat(inc.map(function (m) { return m.presenti.indexOf(i.id) >= 0 ? "X" : "assente"; })).concat([p.presenze, numIt(p.ore), numIt(p.perc)]));
    });
    righe.push(["Presenti"].concat(inc.map(function (m) { return m.presenti.filter(function (x) { return byId(c.iscritti, x); }).length; })).concat([s.presenze, numIt(s.orePersona), numIt(s.frequenza)]));
    righe.push(["Durata (ore)"].concat(inc.map(function (m) { return numIt(durataMin(m) / 60); })).concat(["", numIt(s.ore), ""]));
    return righeCSV(righe);
  }
  function csvRiepilogo(idCorso, dal, al) {
    var s = resoconto(idCorso, dal, al); if (!s) return "";
    var C = s.corso, righe = [
      ["Resoconto del corso", C.nome], ["Ente", C.ente], ["Sede", C.sede], ["Facilitatore", C.facilitatore],
      ["Periodo dal", dataIt(s.dal)], ["Periodo al", dataIt(s.al)], [],
      ["Incontri", s.incontri], ["Ore totali di formazione", numIt(s.ore)], ["Iscritti", s.iscritti], ["Partecipanti (almeno una presenza)", s.partecipanti],
      ["Presenze totali", s.presenze], ["Ore-persona", numIt(s.orePersona)], ["Frequenza media %", numIt(s.frequenza)], [],
      ["Partecipante", "Presenze", "Su incontri", "Frequenza %", "Ore", "Lezioni completate", "Quiz superati", "Attestati", "Competenze DigComp"]
    ];
    s.persone.forEach(function (p) {
      righe.push([p.nome, p.presenze, s.incontri, numIt(p.perc), numIt(p.ore), p.collegato ? p.lezioni : "", p.quiz.join(", "), p.attestati.join(", "), p.competenze.join(", ")]);
    });
    if (s.digcomp) {
      righe.push([]); righe.push(["Area DigComp", "Competenze raggiunte (totale)", "Persone"]);
      s.digcomp.forEach(function (a) { righe.push([a.titolo, a.raggiunte, a.persone]); });
    }
    righe.push([]); righe.push(["Data", "Orario", "Ore", "Argomento", "Presenti", "Note"]);
    s.argomenti.forEach(function (a) { righe.push([dataIt(a.data), a.inizio + "-" + a.fine, numIt(a.ore), a.argomento, a.presenti, a.note]); });
    return righeCSV(righe);
  }
  function nomeFile(c, cosa, ext) {
    return ("registro-" + cosa + "-" + (c && c.nome ? c.nome : "corso")).replace(/[\\\/:*?"<>|«»]+/g, "").replace(/\s+/g, "-").slice(0, 70) + "-" + oggi() + "." + ext;
  }
  function scarica(testo, nome, mime) {
    var blob = new Blob([testo], { type: mime });
    if (typeof PD.download === "function") { PD.download(blob, nome); return; }
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ------------------------------------------------------------------ unione sicura di un registro importato (non cancella mai) */
  function unisci(v) {
    var n = normalizza(v), st = { corsi: 0, iscritti: 0, incontri: 0, presenze: 0 };
    function riempi(dest, src) { for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k) && (dest[k] == null || dest[k] === "")) dest[k] = src[k]; }
    n.corsi.forEach(function (c) {
      var mio = corso(c.id);
      if (!mio) { R.corsi.push(c); st.corsi++; st.iscritti += c.iscritti.length; st.incontri += c.incontri.length; return; }
      riempi(mio, c);
      c.iscritti.forEach(function (i) { var m = byId(mio.iscritti, i.id); if (!m) { mio.iscritti.push(i); st.iscritti++; } else riempi(m, i); });
      c.incontri.forEach(function (m) {
        var x = byId(mio.incontri, m.id);
        if (!x) { mio.incontri.push(m); st.incontri++; return; }
        riempi(x, m);
        m.presenti.forEach(function (p) { if (x.presenti.indexOf(p) < 0) { x.presenti.push(p); st.presenze++; } });
      });
    });
    if (!corso(R.attivo) && R.corsi.length) R.attivo = R.corsi[0].id;
    salva();
    return st;
  }

  /* ------------------------------------------------------------------ dati dall'aula (PC del facilitatore) */
  function aulaDisponibile() { return !!(PD.server && !PD.ospite && PD.api && PD.settings && PD.settings.aulaRuolo === "facilitatore"); }
  function importaAula(c) {
    return PD.api("/api/aula").then(function (st) {
      var cl = (st && st.clienti) || [], agg = 0, nuovi = 0, quando = new Date().toISOString();
      cl.forEach(function (x) {
        var nome = String(x.utente || "").trim(); if (!nome) return;
        var i = c.iscritti.filter(function (y) { return nomeChiave(y.nome) === nomeChiave(nome); })[0];
        if (!i) { i = { id: nuovoId("i"), nome: nome.slice(0, 80) }; c.iscritti.push(i); nuovi++; } else agg++;
        var p = x.progressi || {};
        i.aula = { lezioni: +p.lezioni_fatte || 0, lezioniTotali: +p.lezioni_totali || 0, pc: str(x.pc, 60),
          quiz: (p.quiz || []).map(function (q) { return { titolo: str(q.titolo, 80), migliore: +q.migliore || 0, superata: !!q.superata }; }),
          attestati: (p.attestati || []).map(function (a) { return { titolo: str(a.titolo, 80), data: str(a.data, 20) }; }), quando: quando };
      });
      salva();
      return { aggiornati: agg, nuovi: nuovi, totale: cl.length };
    });
  }

  /* ------------------------------------------------------------------ interfaccia: pezzi comuni */
  function campo(id, lab, val, tipo, extra) {
    return '<div class="field"><label for="' + id + '">' + lab + '</label><input type="' + (tipo || "text") + '" id="' + id + '" value="' + esc(val || "") + '" ' + (extra || "") + "></div>";
  }
  function avvisoPrivacy() {
    return '<p class="notice info small rg-privacy">🔒 <b>Riservatezza.</b> I dati degli iscritti restano <b>solo su questo computer</b>. ' +
      "Trattateli secondo le regole dell'ente (consenso delle persone, il minimo indispensabile: <b>basta il nome</b>). " +
      "Non scrivete dati di salute o documenti.</p>";
  }
  function sceltaCorso(st, cur) {
    if (R.corsi.length < 2) return "";
    return '<div class="field rg-scegli"><label for="' + st.p + '-corso">Corso</label><select id="' + st.p + '-corso" data-rg="scegli">' +
      R.corsi.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === cur.id ? " selected" : "") + ">" + esc(c.nome || "(corso senza nome)") + (c.ente ? " · " + esc(c.ente) : "") + "</option>"; }).join("") +
      "</select></div>";
  }
  function bloccoCopie(st) {
    return '<div class="card rg-copie"><h2>💾 Copia di sicurezza</h2>' +
      '<p class="small muted">Salvate ogni tanto una copia del registro su una chiavetta. L\'importazione <b>aggiunge</b> i dati mancanti e non cancella mai nulla.</p>' +
      '<div class="row"><button class="btn ghost" data-rg="json">⬇️ Salva copia del registro (JSON)</button>' +
      '<label class="btn ghost rg-file">⬆️ Importa registro<input type="file" accept=".json,application/json" data-rg="importa" id="' + st.p + '-imp"></label></div></div>';
  }

  /* ------------------------------------------------------------------ sezione «registro» */
  function htmlRegistro(st) {
    var c = corso();
    if (!c || st.nuovoCorso) return htmlNuovoCorso(st, !c);
    var p = st.p, completo = c.nome && c.facilitatore;
    var h = avvisoPrivacy() + sceltaCorso(st, c);
    h += '<div class="card rg-corso"><div class="rg-testa"><h2>📚 ' + esc(c.nome || "Corso senza nome") + "</h2>" +
      '<button class="btn ghost" data-rg="nuovo-corso">➕ Nuovo corso</button></div>' +
      '<p class="muted small">' + [c.ente, c.sede, c.facilitatore ? "Facilitatore: " + c.facilitatore : "", periodo(c.inizio, c.fine)].filter(Boolean).map(esc).join(" · ") + "</p>" +
      "<details" + (completo ? "" : " open") + '><summary>✏️ Dati del corso</summary>' + campiCorso(p, c) +
      (!c.iscritti.length && !c.incontri.length ? '<button class="btn danger" data-rg="elimina-corso">🗑️ Elimina questo corso (è vuoto)</button>' : "") + "</details></div>";
    h += htmlIscritti(st, c) + htmlIncontri(st, c) + bloccoCopie(st);
    return h;
  }
  function periodo(a, b) { return a && b ? "dal " + dataIt(a) + " al " + dataIt(b) : a ? "dal " + dataIt(a) : b ? "fino al " + dataIt(b) : ""; }
  function campiCorso(p, c) {
    return '<div class="rg-campi">' +
      campo(p + "-nome", "Nome del corso", c.nome, "text", 'data-corso="nome" maxlength="120" placeholder="es. Il computer senza paura"') +
      campo(p + "-ente", "Ente o associazione", c.ente, "text", 'data-corso="ente" maxlength="120" placeholder="es. Associazione Borgoprova Insieme"') +
      campo(p + "-sede", "Sede", c.sede, "text", 'data-corso="sede" maxlength="120" placeholder="es. Biblioteca comunale"') +
      campo(p + "-fac", "Facilitatore", c.facilitatore, "text", 'data-corso="facilitatore" maxlength="120"') +
      campo(p + "-ini", "Inizio del corso", c.inizio, "date", 'data-corso="inizio"') +
      campo(p + "-fin", "Fine del corso", c.fine, "date", 'data-corso="fine"') + "</div>" +
      '<div class="field"><label for="' + p + '-cnote">Note</label><textarea id="' + p + '-cnote" data-corso="note" rows="2" maxlength="1000">' + esc(c.note) + "</textarea></div>";
  }
  function htmlNuovoCorso(st, primo) {
    var p = st.p, fac = PD.settings.teacherName || "";
    return avvisoPrivacy() + '<div class="card rg-corso"><h2>' + (primo ? "📚 Il vostro primo corso" : "➕ Nuovo corso") + "</h2>" +
      (primo ? '<p>Scrivete il nome del corso e chi lo tiene. Il resto si può aggiungere dopo.</p>' : "") +
      '<div class="rg-campi">' + campo(p + "-nn", "Nome del corso", "", "text", 'maxlength="120" placeholder="es. Il computer senza paura" data-nuovo="nome"') +
      campo(p + "-ne", "Ente o associazione", "", "text", 'maxlength="120" data-nuovo="ente"') +
      campo(p + "-ns", "Sede", "", "text", 'maxlength="120" data-nuovo="sede"') +
      campo(p + "-nf", "Facilitatore", fac, "text", 'maxlength="120" data-nuovo="facilitatore"') +
      campo(p + "-ni", "Inizio del corso", oggi(), "date", 'data-nuovo="inizio"') + campo(p + "-nfi", "Fine del corso", "", "date", 'data-nuovo="fine"') + "</div>" +
      '<div class="row"><button class="btn big" data-rg="crea-corso">✅ Crea il corso</button>' + (primo ? "" : '<button class="btn ghost" data-rg="annulla">Annulla</button>') + "</div></div>" +
      (primo ? bloccoCopie(st) : "");
  }
  function htmlIscritti(st, c) {
    var p = st.p, prof = personeDelPC(c);
    var h = '<div class="card rg-iscritti"><h2>👥 Iscritti <span class="badge">' + c.iscritti.length + "</span></h2>";
    h += c.iscritti.length ? '<ul class="rg-lista">' + c.iscritti.map(function (i) {
      var conf = st.conferma === "isc:" + i.id, n = c.incontri.filter(function (m) { return m.presenti.indexOf(i.id) >= 0; }).length;
      return '<li><details' + (st.apri === i.id ? " open" : "") + '><summary><b>' + esc(i.nome || "(senza nome)") + "</b>" +
        (i.profilo ? ' <span class="badge done" title="I progressi entrano nel resoconto">🔗 collegato</span>' : "") +
        (i.aula ? ' <span class="badge" title="Dati ricevuti dal quadro dell\'aula">🏫 aula</span>' : "") +
        ' <span class="small muted">' + n + " presenz" + (n === 1 ? "a" : "e") + "</span></summary>" +
        '<div class="rg-campi">' + campo(p + "-in-" + i.id, "Nome", i.nome, "text", 'data-isc="' + esc(i.id) + '" data-k="nome" maxlength="80"') +
        campo(p + "-it-" + i.id, "Telefono (facoltativo)", i.telefono, "tel", 'data-isc="' + esc(i.id) + '" data-k="telefono" maxlength="40"') +
        selProfilo(p, i) + "</div>" +
        '<div class="field"><label for="' + p + "-io-" + esc(i.id) + '">Note (facoltative)</label><input type="text" id="' + p + "-io-" + esc(i.id) + '" value="' + esc(i.note || "") + '" data-isc="' + esc(i.id) + '" data-k="note" maxlength="500"></div>' +
        (conf ? '<div class="notice rg-conferma">Togliere <b>' + esc(i.nome) + "</b> dal corso?" + (n ? " Verranno tolte anche le sue " + n + " presenze." : "") +
          '<div class="row"><button class="btn danger" data-rg="togli-si" data-id="' + esc(i.id) + '">Sì, togli</button><button class="btn ghost" data-rg="no">No</button></div></div>'
          : '<button class="btn ghost" data-rg="togli" data-id="' + esc(i.id) + '">🗑️ Togli dal corso</button>') +
        "</details></li>";
    }).join("") + "</ul>" : '<p class="muted">Ancora nessun iscritto. Scrivete il nome e premete «Aggiungi».</p>';
    h += '<div class="rg-aggiungi"><label for="' + p + '-nuovo" class="sr-only">Nome e cognome</label><input type="text" id="' + p + '-nuovo" maxlength="80" placeholder="Nome e cognome">' +
      '<button class="btn big" data-rg="aggiungi">➕ Aggiungi</button></div>';
    var az = "";
    if (prof.length) az += '<button class="btn ghost" data-rg="dal-pc">💻 Aggiungi le persone di questo computer (' + prof.length + ")</button>";
    if (aulaDisponibile()) az += '<button class="btn ghost" data-rg="aula">🏫 Importa i dati dall\'aula</button>';
    if (az) h += '<div class="row rg-azioni">' + az + "</div>";
    return h + "</div>";
  }
  function elencoProfili() {
    try { if (PD.profili && typeof PD.profili.elenco === "function") return PD.profili.elenco() || []; } catch (e) { /* profili non pronti */ }
    return null;
  }
  function personeDelPC(c) {
    var el = elencoProfili(), gia = {};
    c.iscritti.forEach(function (i) { if (i.profilo) gia[i.profilo] = 1; });
    if (el) return el.filter(function (x) { return x && x.id && !gia[x.id]; }).map(function (x) { return { nome: x.nome, profilo: x.id }; });
    var n = PD.settings.studentName;
    return n && !gia.locale ? [{ nome: n, profilo: "locale" }] : [];
  }
  function selProfilo(p, i) {
    var el = elencoProfili(), ops = [["", "— nessuno —"]];
    if (el) el.forEach(function (x) { ops.push([x.id, (x.icona ? x.icona + " " : "") + x.nome]); });
    else ops.push(["locale", "Chi usa questo computer" + (PD.settings.studentName ? " (" + PD.settings.studentName + ")" : "")]);
    if (i.profilo && !ops.some(function (o) { return o[0] === i.profilo; })) ops.push([i.profilo, "Profilo non più presente"]);
    return '<div class="field"><label for="' + p + "-ip-" + esc(i.id) + '">Progressi di questo computer</label><select id="' + p + "-ip-" + esc(i.id) + '" data-isc="' + esc(i.id) + '" data-k="profilo">' +
      ops.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === (i.profilo || "") ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>";
  }
  function htmlIncontri(st, c) {
    var h = '<div class="card rg-incontri"><div class="rg-testa"><h2>🗓️ Incontri <span class="badge">' + c.incontri.length + "</span></h2>" +
      (st.modifica ? "" : '<button class="btn big" data-rg="nuovo-inc">➕ Nuovo incontro</button>') + "</div>";
    var m = st.modifica && byId(c.incontri, st.modifica);
    if (m) h += htmlAppello(st, c, m);
    var lista = ordina(c.incontri).reverse(), tot = c.iscritti.length;
    h += lista.length ? '<ul class="rg-inc-lista">' + lista.map(function (x) {
      var n = x.presenti.filter(function (k) { return byId(c.iscritti, k); }).length, conf = st.conferma === "inc:" + x.id;
      return '<li class="' + (m && m.id === x.id ? "rg-sel" : "") + '"><div class="rg-inc-info"><b>' + esc(dataLunga(x.data)) + "</b> · " + esc(x.inizio) + "–" + esc(x.fine) +
        ' <span class="small muted">(' + numIt(durataMin(x) / 60) + " ore)</span><br>" + (x.argomento ? esc(x.argomento) : '<span class="muted">Argomento non indicato</span>') + "</div>" +
        '<div class="rg-inc-n" title="presenti">👥 <b>' + n + "</b>/" + tot + "</div>" +
        (conf ? '<div class="notice rg-conferma">Eliminare l\'incontro del ' + esc(dataIt(x.data)) + " con le sue presenze?" +
          '<div class="row"><button class="btn danger" data-rg="elimina-si" data-id="' + esc(x.id) + '">Sì, elimina</button><button class="btn ghost" data-rg="no">No</button></div></div>'
          : '<div class="row rg-inc-az"><button class="btn ghost" data-rg="modifica" data-id="' + esc(x.id) + '">✏️ Modifica</button>' +
            '<button class="btn ghost" data-rg="elimina" data-id="' + esc(x.id) + '">🗑️ Elimina</button></div>') + "</li>";
    }).join("") + "</ul>" : (m ? "" : '<p class="muted">Nessun incontro ancora. Premete «➕ Nuovo incontro» all\'inizio di ogni lezione e segnate chi c\'è.</p>');
    return h + "</div>";
  }
  function htmlAppello(st, c, m) {
    var p = st.p, pronti = Array.isArray(window.PD_INCONTRI) ? window.PD_INCONTRI : [];
    var h = '<div class="rg-appello" data-inc="' + esc(m.id) + '"><h3>' + (st.nuovo ? "➕ Nuovo incontro" : "✏️ Incontro del " + esc(dataIt(m.data))) + "</h3>" +
      '<div class="rg-campi rg-orari">' + campo(p + "-md", "Data", m.data, "date", 'data-m="data"') +
      campo(p + "-mi", "Dalle", m.inizio, "time", 'data-m="inizio" step="300"') + campo(p + "-mf", "Alle", m.fine, "time", 'data-m="fine" step="300"') + "</div>";
    if (pronti.length) {
      h += '<div class="field"><label for="' + p + '-mp">Incontro pronto (facoltativo)</label><select id="' + p + '-mp" data-m="incontroPronto"><option value="">— nessuno —</option>' +
        pronti.map(function (x) { return '<option value="' + esc(x.id) + '"' + (String(x.id) === String(m.incontroPronto || "") ? " selected" : "") + ">" + esc((x.n != null ? x.n + ". " : "") + x.titolo) + "</option>"; }).join("") + "</select></div>";
    }
    h += campo(p + "-ma", "Argomento", m.argomento, "text", 'data-m="argomento" maxlength="200" placeholder="es. Le videochiamate con la famiglia"');
    h += '<h3>✋ Appello <span class="small muted" data-rg-conta>' + contaPresenti(c, m) + "</span></h3>";
    if (c.iscritti.length) {
      h += '<div class="row"><button class="btn ghost" data-rg="tutti">✅ Tutti presenti</button><button class="btn ghost" data-rg="nessuno">⬜ Nessuno</button></div>' +
        '<div class="rg-presenze">' + c.iscritti.map(function (i) {
          var on = m.presenti.indexOf(i.id) >= 0;
          return '<label class="rg-pres' + (on ? " on" : "") + '"><input type="checkbox" data-pres="' + esc(i.id) + '"' + (on ? " checked" : "") + "><span>" + esc(i.nome || "(senza nome)") + "</span></label>";
        }).join("") + "</div>";
    } else h += '<p class="notice">Prima aggiungete gli iscritti qui sopra: poi potrete segnare le presenze.</p>';
    h += '<div class="field"><label for="' + p + '-mn">Note dell\'incontro</label><textarea id="' + p + '-mn" data-m="note" rows="2" maxlength="1000">' + esc(m.note) + "</textarea></div>" +
      '<div class="row"><button class="btn big" data-rg="fatto">💾 Fatto</button><span class="small muted">Tutto viene salvato subito, a ogni modifica.</span></div></div>';
    return h;
  }
  function contaPresenti(c, m) { return m.presenti.filter(function (k) { return byId(c.iscritti, k); }).length + " presenti su " + c.iscritti.length; }

  /* ------------------------------------------------------------------ sezione «resoconto» */
  function htmlResoconto(st) {
    var c = corso();
    if (!c) return '<div class="card"><h2>📊 Resoconto</h2><p>Non c\'è ancora nessun corso. Createlo nella scheda del registro.</p></div>' + bloccoCopie(st);
    var p = st.p, s = resoconto(c.id, st.dal, st.al);
    var h = sceltaCorso(st, c) + '<div class="card rg-periodo"><h2>📊 Resoconto: ' + esc(c.nome || "corso") + "</h2>" +
      '<p class="small muted">' + [c.ente, c.sede, c.facilitatore ? "Facilitatore: " + c.facilitatore : ""].filter(Boolean).map(esc).join(" · ") + "</p>" +
      '<div class="rg-campi rg-orari">' + campo(p + "-dal", "Dal", st.dal || "", "date", 'data-rg-per="dal"') + campo(p + "-al", "Al", st.al || "", "date", 'data-rg-per="al"') +
      '<div class="field"><span class="small muted">' + (st.dal || st.al ? "" : "Tutto il corso. ") + "Periodo considerato: " + esc(periodo(s.dal, s.al) || "—") + "</span>" +
      (st.dal || st.al ? '<button class="btn ghost" data-rg="tutto">Tutto il corso</button>' : "") + "</div></div></div>";
    h += '<div class="numeri rg-numeri">' + numero(s.incontri, "incontri") + numero(numIt(s.ore), "ore di formazione") + numero(s.partecipanti, "partecipanti (su " + s.iscritti + " iscritti)") +
      numero(s.presenze, "presenze totali") + numero(numIt(s.orePersona), "ore-persona") + numero(numIt(s.frequenza) + "%", "frequenza media") + "</div>";
    h += '<div class="card"><h2>🧑‍🎓 Partecipanti</h2>' + tabPersone(s, false) +
      '<p class="small muted">Lezioni, quiz e attestati compaiono per chi è collegato a un profilo di questo computer o ai dati dell\'aula (situazione attuale, non solo del periodo).</p></div>';
    if (s.digcomp) h += '<div class="card"><h2>🧭 Competenze digitali (DigComp)</h2>' + tabDigcomp(s) + "</div>";
    h += '<div class="card"><h2>📝 Argomenti trattati</h2>' + tabArgomenti(s) + "</div>";
    h += '<div class="card rg-esporta"><h2>📤 Per l\'ente o il bando</h2><div class="row">' +
      '<button class="btn big" data-rg="stampa">🖨️ Stampa il resoconto</button></div>' +
      '<h3>⬇️ Esporta per foglio di calcolo (CSV)</h3><p class="small muted">Si aprono con Excel o LibreOffice Calc.</p><div class="row">' +
      '<button class="btn ghost" data-rg="csv-presenze">⬇️ Presenze (CSV)</button><button class="btn ghost" data-rg="csv-riepilogo">⬇️ Riepilogo (CSV)</button></div></div>';
    return h + bloccoCopie(st);
  }
  function numero(v, t) { return '<div class="card numero"><b>' + esc(v) + "</b><span>" + esc(t) + "</span></div>"; }
  function tabPersone(s, stampa) {
    if (!s.persone.length) return '<p class="muted">Nessun iscritto.</p>';
    var dc = !!s.digcomp;
    return '<div class="rg-tab"><table><thead><tr><th>Partecipante</th><th>Presenze</th><th>%</th><th>Ore</th><th>Lezioni</th><th>Quiz superati</th><th>Attestati</th>' + (dc ? "<th>DigComp</th>" : "") + "</tr></thead><tbody>" +
      s.persone.map(function (p) {
        return "<tr><td><b>" + esc(p.nome) + "</b></td><td>" + p.presenze + "/" + s.incontri + "</td><td>" + numIt(p.perc) + "%</td><td>" + numIt(p.ore) + "</td>" +
          "<td>" + (p.collegato ? p.lezioni : "—") + "</td><td>" + (p.quiz.length ? p.quiz.map(esc).join(", ") : "—") + "</td><td>" + (p.attestati.length ? p.attestati.map(esc).join(", ") : "—") + "</td>" +
          (dc ? "<td>" + (p.competenze.length ? (stampa ? p.competenze.length + ": " : "") + p.competenze.map(esc).join(", ") : "—") + "</td>" : "") + "</tr>";
      }).join("") +
      '</tbody><tfoot><tr><th>Totale</th><th>' + s.presenze + "</th><th>" + numIt(s.frequenza) + "%</th><th>" + numIt(s.orePersona) + "</th><th>" + s.lezioniTotali + "</th><th></th><th>" + s.attestatiTotali + "</th>" + (dc ? "<th>" + s.competenzeTotali + "</th>" : "") + "</tr></tfoot></table></div>";
  }
  function tabDigcomp(s) {
    return '<div class="rg-tab"><table><thead><tr><th>Area</th><th>Competenze raggiunte (totale)</th><th>Persone</th></tr></thead><tbody>' +
      s.digcomp.map(function (a) { return "<tr><td>" + esc(a.titolo) + "</td><td>" + a.raggiunte + "</td><td>" + a.persone + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  function tabArgomenti(s) {
    if (!s.argomenti.length) return '<p class="muted">Nessun incontro nel periodo.</p>';
    return '<div class="rg-tab"><table><thead><tr><th>Data</th><th>Orario</th><th>Ore</th><th>Argomento</th><th>Presenti</th></tr></thead><tbody>' +
      s.argomenti.map(function (a) {
        return "<tr><td>" + esc(dataIt(a.data)) + "</td><td>" + esc(a.inizio + "–" + a.fine) + "</td><td>" + numIt(a.ore) + "</td><td>" + esc(a.argomento || "—") +
          (a.note ? '<br><span class="small muted">' + esc(a.note) + "</span>" : "") + "</td><td>" + a.presenti + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* documento A4 da stampare */
  function htmlStampa(idCorso, dal, al) {
    var c = corso(idCorso), s = resoconto(idCorso, dal, al); if (!s) return "";
    var C = s.corso, inc = ordina(c.incontri.filter(function (m) { return inPeriodo(m, dal, al); }));
    var h = '<div class="rg-doc"><header class="p-testa"><div><b>' + esc(C.ente || "Professore Digitale") + "</b>" + (C.sede ? " · " + esc(C.sede) : "") + "</div><div>Stampato il " + esc(dataIt(oggi())) + "</div></header>" +
      "<h1>Resoconto delle attività</h1>" +
      '<table class="rg-intesta"><tr><th>Corso</th><td>' + esc(C.nome) + "</td></tr><tr><th>Ente</th><td>" + esc(C.ente || "—") + "</td></tr><tr><th>Sede</th><td>" + esc(C.sede || "—") +
      "</td></tr><tr><th>Facilitatore</th><td>" + esc(C.facilitatore || "—") + "</td></tr><tr><th>Periodo</th><td>" + esc(periodo(s.dal, s.al) || "—") + "</td></tr></table>" +
      "<h2>In sintesi</h2>" + '<table class="rg-sintesi"><tr><td><b>' + s.incontri + "</b><br>incontri</td><td><b>" + numIt(s.ore) + "</b><br>ore di formazione</td><td><b>" + s.partecipanti +
      "</b><br>partecipanti (su " + s.iscritti + " iscritti)</td></tr><tr><td><b>" + s.presenze + "</b><br>presenze totali</td><td><b>" + numIt(s.orePersona) + "</b><br>ore-persona</td><td><b>" +
      numIt(s.frequenza) + "%</b><br>frequenza media</td></tr></table>" +
      "<h2>Partecipanti</h2>" + tabPersone(s, true);
    if (s.digcomp) h += "<h2>Competenze digitali (DigComp)</h2>" + tabDigcomp(s);
    h += "<h2>Argomenti trattati</h2>" + tabArgomenti(s);
    if (inc.length && c.iscritti.length) {
      for (var k = 0; k < inc.length; k += 10) {
        var parte = inc.slice(k, k + 10);
        h += '<h2>Registro delle presenze' + (inc.length > 10 ? " (" + (k + 1) + "–" + (k + parte.length) + ")" : "") + '</h2><div class="rg-tab"><table class="rg-griglia"><thead><tr><th>Partecipante</th>' +
          parte.map(function (m) { return "<th>" + esc(dataIt(m.data).slice(0, 5)) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          c.iscritti.map(function (i) { return "<tr><td>" + esc(i.nome) + "</td>" + parte.map(function (m) { return "<td>" + (m.presenti.indexOf(i.id) >= 0 ? "X" : "–") + "</td>"; }).join("") + "</tr>"; }).join("") +
          "</tbody></table></div>";
      }
      h += '<p class="small">X = presente · – = assente</p>';
    }
    h += '<div class="rg-firma"><div>Luogo e data<br><span class="rg-riga"></span></div><div>Il facilitatore' + (C.facilitatore ? " (" + esc(C.facilitatore) + ")" : "") + '<br><span class="rg-riga"></span></div></div>' +
      '<footer class="p-piede">Registro tenuto con il Professore Digitale · ideato da Danilo D\'Auria · i dati restano sul computer dell\'ente · ' + esc(PD.licenzaBreve()) + "</footer></div>";
    return h;
  }

  /* ------------------------------------------------------------------ disegno e azioni */
  function disegna(box) {
    var st = box.__rg;
    if (!st) return;
    if (st.conferma && st.sez !== "registro") st.conferma = "";
    box.innerHTML = '<div class="rg">' + (st.sez === "resoconto" ? htmlResoconto(st) : htmlRegistro(st)) + "</div>";
    collega(box);
  }
  function collega(box) {
    var st = box.__rg, c = corso();
    $$("[data-rg]", box).forEach(function (b) {
      var az = b.getAttribute("data-rg");
      if (az === "scegli") { b.onchange = function () { R.attivo = b.value; st.modifica = ""; st.conferma = ""; salva(); disegna(box); }; return; }
      if (az === "importa") { b.onchange = function () { importaFile(box, b); }; return; }
      b.onclick = function (e) { e.preventDefault(); azione(box, az, b.getAttribute("data-id"), b); };
    });
    $$("[data-corso]", box).forEach(function (f) {
      f.oninput = function () { c[f.getAttribute("data-corso")] = f.value; salvaPresto(); };
      f.onchange = function () { c[f.getAttribute("data-corso")] = f.value; salva(); };
    });
    $$("[data-isc]", box).forEach(function (f) {
      var i = byId(c.iscritti, f.getAttribute("data-isc")), k = f.getAttribute("data-k");
      function metti() { if (k === "profilo" && !f.value) delete i.profilo; else i[k] = f.value; }
      f.oninput = function () { metti(); salvaPresto(); };
      f.onchange = function () { metti(); salva(); if (k === "profilo") { st.apri = i.id; disegna(box); } };
    });
    var app = $(".rg-appello", box);
    if (app) {
      var m = byId(c.incontri, app.getAttribute("data-inc"));
      $$("[data-m]", app).forEach(function (f) {
        var k = f.getAttribute("data-m");
        f.oninput = function () { if (k !== "incontroPronto") { m[k] = f.value; salvaPresto(); } };
        f.onchange = function () {
          if (k === "incontroPronto") {
            var x = (window.PD_INCONTRI || []).filter(function (y) { return String(y.id) === f.value; })[0], vecchio = (window.PD_INCONTRI || []).filter(function (y) { return String(y.id) === String(m.incontroPronto); })[0];
            if (f.value) m.incontroPronto = x ? x.id : f.value; else delete m.incontroPronto;
            if (x && (!m.argomento || (vecchio && m.argomento === vecchio.titolo))) { m.argomento = x.titolo; var a = $("[data-m=argomento]", app); if (a) a.value = x.titolo; }
          } else if ((k === "data" && !isoOk(f.value)) || ((k === "inizio" || k === "fine") && !oraOk(f.value))) { f.value = m[k]; return; }
          else m[k] = f.value;
          salva(); aggiornaLista(box);
        };
      });
      $$("[data-pres]", app).forEach(function (f) {
        f.onchange = function () {
          var id = f.getAttribute("data-pres"), i = m.presenti.indexOf(id);
          if (f.checked && i < 0) m.presenti.push(id); if (!f.checked && i >= 0) m.presenti.splice(i, 1);
          f.parentNode.className = "rg-pres" + (f.checked ? " on" : "");
          salva(); aggiornaConta(box, c, m); aggiornaLista(box);
        };
      });
    }
    $$("[data-rg-per]", box).forEach(function (f) {
      f.onchange = function () { st[f.getAttribute("data-rg-per")] = isoOk(f.value) ? f.value : ""; disegna(box); };
    });
    var nu = $("#" + st.p + "-nuovo", box);
    if (nu) nu.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); azione(box, "aggiungi"); } };
  }
  function aggiornaConta(box, c, m) { var x = $("[data-rg-conta]", box); if (x) x.textContent = contaPresenti(c, m); }
  function aggiornaLista(box) {
    // ridisegna solo l'elenco degli incontri, senza toccare il modulo aperto (resta il cursore dov'e')
    var st = box.__rg, c = corso(), vecchio = $(".rg-inc-lista", box), tmp = document.createElement("div");
    tmp.innerHTML = htmlIncontri(st, c);
    var nuovo = $(".rg-inc-lista", tmp);
    if (vecchio && nuovo) { vecchio.parentNode.replaceChild(nuovo, vecchio); $$("[data-rg]", nuovo).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); azione(box, b.getAttribute("data-rg"), b.getAttribute("data-id"), b); }; }); }
    else if (!vecchio && nuovo) disegna(box);
  }

  function azione(box, az, id, el) {
    var st = box.__rg, c = corso();
    if (az === "nuovo-corso") { st.nuovoCorso = true; disegna(box); return; }
    if (az === "annulla") { st.nuovoCorso = false; disegna(box); return; }
    if (az === "crea-corso") {
      var v = {}; $$("[data-nuovo]", box).forEach(function (f) { v[f.getAttribute("data-nuovo")] = f.value.trim(); });
      if (!v.nome) { PD.toast("Scrivete il nome del corso."); var f0 = $("[data-nuovo=nome]", box); if (f0) f0.focus(); return; }
      var nc = normCorso({ id: nuovoId("c"), nome: v.nome, ente: v.ente, sede: v.sede, facilitatore: v.facilitatore, inizio: v.inizio, fine: v.fine });
      R.corsi.push(nc); R.attivo = nc.id; st.nuovoCorso = false; st.modifica = ""; salva(); disegna(box);
      PD.toast("✅ Corso creato. Ora aggiungete gli iscritti."); return;
    }
    if (!c) return;
    if (az === "elimina-corso") {
      if (c.iscritti.length || c.incontri.length) return;
      R.corsi = R.corsi.filter(function (x) { return x !== c; }); R.attivo = R.corsi.length ? R.corsi[R.corsi.length - 1].id : ""; salva(); disegna(box); return;
    }
    if (az === "aggiungi") {
      var inp = $("#" + st.p + "-nuovo", box), nome = inp ? inp.value.trim() : "";
      if (!nome) { PD.toast("Scrivete il nome della persona."); if (inp) inp.focus(); return; }
      if (c.iscritti.some(function (i) { return nomeChiave(i.nome) === nomeChiave(nome); })) { PD.toast("ℹ️ " + nome + " è già tra gli iscritti."); return; }
      c.iscritti.push({ id: nuovoId("i"), nome: nome.slice(0, 80) }); salva(); disegna(box);
      var n2 = $("#" + st.p + "-nuovo", box); if (n2) n2.focus(); return;
    }
    if (az === "dal-pc") {
      var add = personeDelPC(c);
      add.forEach(function (x) {
        var gia = c.iscritti.filter(function (i) { return !i.profilo && nomeChiave(i.nome) === nomeChiave(x.nome); })[0];
        if (gia) gia.profilo = x.profilo; else c.iscritti.push({ id: nuovoId("i"), nome: str(x.nome, 80), profilo: x.profilo });
      });
      salva(); disegna(box); PD.toast("✅ Aggiunte " + add.length + " persone, con i loro progressi."); return;
    }
    if (az === "aula") {
      el.disabled = true;
      importaAula(c).then(function (r) {
        disegna(box);
        PD.toast(r.totale ? "🏫 Dall'aula: " + r.aggiornati + " aggiornati, " + r.nuovi + " nuovi iscritti." : "🏫 Nessun allievo nel quadro dell'aula.", 5000);
      }).catch(function (e) { el.disabled = false; PD.toast("Dati dell'aula non disponibili: " + e.message); });
      return;
    }
    if (az === "togli") { st.conferma = "isc:" + id; st.apri = id; disegna(box); return; }
    if (az === "togli-si") {
      c.iscritti = c.iscritti.filter(function (i) { return i.id !== id; });
      c.incontri.forEach(function (m) { m.presenti = m.presenti.filter(function (x) { return x !== id; }); });
      st.conferma = ""; salva(); disegna(box); return;
    }
    if (az === "no") { st.conferma = ""; disegna(box); return; }
    if (az === "nuovo-inc") {
      var m = normIncontro({ id: nuovoId("m"), data: oggi(), inizio: ultimoOrario(c, "inizio", "15:00"), fine: ultimoOrario(c, "fine", "17:00"), presenti: [] });
      c.incontri.push(m); st.modifica = m.id; st.nuovo = true; st.conferma = ""; salva(); disegna(box);
      var ap = $(".rg-appello", box); if (ap && ap.scrollIntoView) ap.scrollIntoView({ block: "start" });
      return;
    }
    if (az === "modifica") { st.modifica = id; st.nuovo = false; st.conferma = ""; disegna(box); var ap2 = $(".rg-appello", box); if (ap2 && ap2.scrollIntoView) ap2.scrollIntoView({ block: "start" }); return; }
    if (az === "fatto") {
      var mm = byId(c.incontri, st.modifica); st.modifica = ""; st.nuovo = false; salva(); disegna(box);
      if (mm) PD.toast("💾 Incontro salvato: " + mm.presenti.length + " presenti."); return;
    }
    if (az === "tutti" || az === "nessuno") {
      var mt = byId(c.incontri, st.modifica); if (!mt) return;
      mt.presenti = az === "tutti" ? c.iscritti.map(function (i) { return i.id; }) : [];
      salva(); $$("[data-pres]", box).forEach(function (f) { f.checked = az === "tutti"; f.parentNode.className = "rg-pres" + (f.checked ? " on" : ""); });
      aggiornaConta(box, c, mt); aggiornaLista(box); return;
    }
    if (az === "elimina") { st.conferma = "inc:" + id; disegna(box); return; }
    if (az === "elimina-si") {
      c.incontri = c.incontri.filter(function (m) { return m.id !== id; });
      if (st.modifica === id) st.modifica = "";
      st.conferma = ""; salva(); disegna(box); PD.toast("🗑️ Incontro eliminato."); return;
    }
    if (az === "tutto") { st.dal = ""; st.al = ""; disegna(box); return; }
    if (az === "stampa") {
      var html = htmlStampa(c.id, st.dal, st.al);
      if (PD.printHTML) PD.printHTML(html, "verticale"); else window.print();
      return;
    }
    if (az === "csv-presenze") { scarica("﻿" + csvPresenze(c.id, st.dal, st.al), nomeFile(c, "presenze", "csv"), "text/csv;charset=utf-8"); PD.toast("⬇️ File delle presenze salvato nella cartella Download."); return; }
    if (az === "csv-riepilogo") { scarica("﻿" + csvRiepilogo(c.id, st.dal, st.al), nomeFile(c, "riepilogo", "csv"), "text/csv;charset=utf-8"); PD.toast("⬇️ Riepilogo salvato nella cartella Download."); return; }
    if (az === "json") { scarica(JSON.stringify(R, null, 1), nomeFile(null, "copia", "json").replace("registro-copia-corso", "registro-copia"), "application/json"); PD.toast("⬇️ Copia del registro salvata nella cartella Download."); return; }
  }
  function ultimoOrario(c, k, def) { var l = ordina(c.incontri); return l.length ? l[l.length - 1][k] : def; }
  function importaFile(box, inp) {
    var f = inp.files && inp.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var v = null;
      try { v = JSON.parse(String(rd.result).replace(/^﻿/, "")); } catch (e) { v = null; }
      if (!v || !Array.isArray(v.corsi)) { PD.toast("⚠️ Questo file non è un registro del Professore Digitale."); inp.value = ""; return; }
      var r = unisci(v);
      disegna(box);
      PD.toast("⬆️ Registro unito: " + r.corsi + " corsi, " + r.iscritti + " iscritti, " + r.incontri + " incontri e " + r.presenze + " presenze aggiunti.", 6000);
    };
    rd.onerror = function () { PD.toast("Non riesco a leggere il file."); };
    rd.readAsText(f);
  }

  function render(box, sezione) {
    if (!box) return;
    var vecchio = box.__rg || {};
    box.__rg = { p: vecchio.p || "rg" + (++nBox), sez: sezione === "resoconto" ? "resoconto" : "registro", modifica: vecchio.modifica || "", nuovo: vecchio.nuovo,
      dal: vecchio.dal || "", al: vecchio.al || "", conferma: "", nuovoCorso: false };
    if (box.__rg.modifica && !byId((corso() || { incontri: [] }).incontri, box.__rg.modifica)) box.__rg.modifica = "";
    if (caricato) { disegna(box); return; }
    box.innerHTML = '<p class="muted">Carico il registro…</p>';
    carica().then(function () { disegna(box); });
  }

  PD.registro = {
    render: render,
    dati: function () { return R; },
    resoconto: function (idCorso, dal, al) { return resoconto(idCorso, dal, al); },
    csvPresenze: csvPresenze,
    csvRiepilogo: csvRiepilogo,
    stampaHTML: htmlStampa,
    unisci: unisci,
    /* sostituisce tutto il registro (per i test e per ripristinare una copia): usare con prudenza */
    ripristina: function (v) { R = normalizza(v); caricato = true; salva(); },
    ricarica: carica
  };
})();
