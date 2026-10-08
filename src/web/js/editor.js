/* ==============================================================================
 *  PROFESSORE DIGITALE - «Crea lezioni e quiz» (editor dei pacchetti di contenuti)
 *  Per facilitatori NON tecnici: lezioni, domande per «Chiedi al Professore» e grande quiz
 *  sui servizi del proprio Comune, della propria associazione… senza toccare file JSON.
 *  - la bozza resta nel browser (localStorage, chiave "pd.editor.bozza");
 *  - «Salva e usa» installa un vero pacchetto con PD.packs.importText (server: /api/packs/import,
 *    portatile: spazio del browser), aumentando da sola la versione (1.0.0 -> 1.0.1 ...);
 *  - il controllo usa il validatore di packs.js più le regole dei contenuti di CLAUDE.md.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;

  var LS = "pd.editor.bozza";
  var MARCA = "Professore Digitale - Crea lezioni e quiz";
  var RISERVATI = /^(cultura-|feniceos$|tecnologia-gentile$|windows-primi-passi$|grande-quiz)/;
  var ICONE = ["📘", "🏛️", "🏥", "💊", "🚌", "🚆", "🗳️", "📄", "🪪", "💳", "🏦", "📮", "📞", "💬", "📧", "🌐", "💻", "📱",
    "🖨️", "📷", "🔒", "🛡️", "🤝", "❤️", "👵", "🎨", "📚", "🌳", "♻️", "⚽", "🍝", "🗓️", "🎓", "🏆"];
  var PALESTRA = [["", "Nessun esercizio"], ["click", "🎯 Il clic"], ["dblclick", "📂 Il doppio clic"], ["drag", "✋ Trascinare"],
    ["typing", "⌨️ La tastiera"], ["scroll", "🖲️ Scorrere la pagina"], ["rightclick", "🖱️ Il clic destro"], ["copypaste", "📋 Copia e incolla"],
    ["select", "🖍️ Selezionare il testo"], ["keys", "⏎ I tasti speciali"], ["memory", "🧠 Memory digitale"], ["scam", "🚩 Riconosci la truffa"]];
  var SCHEDE = [["pacchetto", "📦", "Pacchetto"], ["lezioni", "📚", "Lezioni"], ["domande", "💬", "Domande"], ["quiz", "🏆", "Grande quiz"], ["controlla", "✅", "Controlla e salva"]];
  var STOP = ("il lo la i gli le un uno una di a da in con su per tra fra e ed o ma se che chi cosa come dove quando perche perché " +
    "non mi ti si ci vi del dello della dei degli delle al allo alla ai agli alle dal dalla dai nel nello nella nei sul sulla sui " +
    "questo questa quello quella sono e è ho hai ha posso può puo voglio vorrei devo mio mia nostro nostra vostro vostra loro qual quale " +
    "quali cos cosa serve servono io tu noi voi fare faccio fa essere avere più piu molto anche già ancora solo sempre mai").split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  /* ------------------------------------------------------------------ stato */
  var S = null;           // { pack, meta: { idFisso, versione, sporco, aggiornato }, tab, lez }
  var vistaEl = null, timerCtl = null, esitoSalva = "";

  function nuovoPack() {
    return { formato: "professore-digitale-contenuti", formato_versione: 1, id: "", titolo: "", descrizione: "",
      autore: (PD.settings && PD.settings.teacherName) || "", lezioni: [], domande: [], prove: [] };
  }
  function nuovoStato(pack, meta) {
    return { pack: pack || nuovoPack(), meta: meta || { idFisso: false, versione: "", sporco: false }, tab: "pacchetto", lez: -1 };
  }
  function lsGet() { try { var v = localStorage.getItem(LS); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(v) { try { if (v) localStorage.setItem(LS, JSON.stringify(v)); else localStorage.removeItem(LS); } catch (e) { /* spazio non disponibile */ } }
  function salvaBozza() { lsSet({ pack: S.pack, meta: S.meta }); }
  function carica() {
    if (S) return;
    var b = lsGet();
    S = b && b.pack ? nuovoStato(b.pack, b.meta || {}) : nuovoStato();
    normalizza(S.pack);
  }
  function vuoto() {
    var p = S.pack;
    return !p.titolo && !(p.lezioni || []).length && !(p.domande || []).length && !(p.prove || []).length;
  }
  function sporca() {
    S.meta.sporco = true; esitoSalva = "";
    clearTimeout(timerCtl);
    timerCtl = setTimeout(function () { salvaBozza(); aggiornaControlli(); }, 250);
  }

  /* ------------------------------------------------------------------ utilità */
  function slug(t) {
    var s = String(t || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* browser vecchio */ }
    s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.slice(0, 40).replace(/-+$/, "");
  }
  function parole(t) {
    return String(t || "").replace(/[*_#`>]/g, " ").split(/\s+/).filter(function (w) { return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(w); }).length;
  }
  function trim(s) { return String(s == null ? "" : s).replace(/^\s+|\s+$/g, ""); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function bump(v) { var n = String(v).match(/\d+/g) || []; return (+(n[0] || 1)) + "." + (+(n[1] || 0)) + "." + ((+(n[2] || 0)) + 1); }
  function cmp(a, b) { return PD.cmpVersion ? PD.cmpVersion(a, b) : 0; }
  function installati() { return (PD.packs && PD.packs.list) || []; }
  function installato(id) { return installati().filter(function (e) { return e.pacchetto.id === id; })[0]; }
  function mio(en) { return en && en.origine === "utente" && en.pacchetto.creato_con === MARCA; }
  function contaTesto(n, uno, molti) { return n + " " + (n === 1 ? uno : molti); }

  /* schema a riquadri <-> Mermaid */
  function pulisciEtichetta(t) { return trim(t).replace(/"/g, "'").replace(/[\r\n]+/g, " ").replace(/[<>]/g, "").replace(/;/g, ",").replace(/#/g, "n.").slice(0, 60); }
  function mermaid(boxes) {
    var b = (boxes || []).map(trim).filter(function (x) { return x; });
    if (b.length < 2) return "";
    return "flowchart LR\n  " + b.slice(0, 6).map(function (t, i) { return "ABCDEF".charAt(i) + '["' + pulisciEtichetta(t) + '"]'; }).join(" --> ");
  }
  function riquadriDa(code) {
    var c = trim(code); if (!c) return [];
    var m = c.match(/^(flowchart|graph)\s+(LR|TD|TB)\s*\n([\s\S]*)$/); if (!m) return null;
    var corpo = m[3].replace(/\s*\n\s*/g, " "), parti = corpo.split(/\s*-->\s*/), out = [];
    for (var i = 0; i < parti.length; i++) {
      var x = parti[i].match(/^\s*[A-Za-z0-9_]+\["([^"]*)"\]\s*$/);
      if (!x) return null;
      out.push(x[1]);
    }
    return out.length >= 2 && out.length <= 6 ? out : null;
  }
  /* risposta <-> testo + passi numerati finali */
  function separaRisposta(r) {
    var righe = String(r || "").replace(/\r/g, "").replace(/\s+$/, "").split("\n"), passi = [], i = righe.length - 1;
    while (i >= 0) { var m = righe[i].match(/^\s*\d+[.)]\s+(.*)$/); if (!m) break; passi.unshift(m[1]); i--; }
    if (passi.length < 2) return { testo: String(r || ""), passi: [] };
    return { testo: trim(righe.slice(0, i + 1).join("\n")), passi: passi };
  }
  function unisciRisposta(d) {
    var passi = (d._passi || []).map(trim).filter(function (x) { return x; });
    var t = trim(d._testo);
    return t + (passi.length ? (t ? "\n\n" : "") + passi.map(function (p, i) { return (i + 1) + ". " + p; }).join("\n") : "");
  }

  /* porta un pacchetto (formato del file) nella forma dell'editor: campi di lavoro con "_" */
  function normalizza(p) {
    ["lezioni", "domande", "prove"].forEach(function (k) { if (!Array.isArray(p[k])) p[k] = []; });
    p.lezioni.forEach(function (L) {
      if (!Array.isArray(L.passi)) L.passi = [];
      if (!Array.isArray(L.quiz)) L.quiz = [];
      L.passi.forEach(function (s) {
        if (s._riquadri === undefined) { var r = riquadriDa(s.schema); if (r) { s._riquadri = r; s.schema = ""; } else s._riquadri = []; }
      });
      L.quiz.forEach(normDomandaQuiz);
    });
    p.domande.forEach(function (d) {
      if (d._testo === undefined) { var sp = separaRisposta(d.risposta); d._testo = sp.testo; d._passi = sp.passi; }
      if (!Array.isArray(d.parole_chiave)) d.parole_chiave = [];
    });
    p.prove.forEach(function (P) {
      if (P._attestato === undefined) P._attestato = !P.senza_attestato;
      if (!Array.isArray(P.domande)) P.domande = [];
      P.domande.forEach(normDomandaQuiz);
    });
    return p;
  }
  function normDomandaQuiz(q) {
    if (!Array.isArray(q.opzioni)) q.opzioni = [];
    while (q.opzioni.length < 2) q.opzioni.push("");
    if (typeof q.corretta !== "number") q.corretta = 0;
  }
  function nuovaLezione() {
    return { id: "", icona: "📘", titolo: "", obiettivo: "", minuti: 15, palestra: "",
      passi: [{ titolo: "", testo: "", consiglio: "", schema: "", _riquadri: [] }], quiz: [] };
  }
  function nuovaDomandaQuiz() { return { domanda: "", opzioni: ["", "", ""], corretta: 0, spiegazione: "" }; }
  function nuovaProva() {
    return { id: "", titolo: "", icona: "🏆", descrizione: "", _attestato: true, attestato: "", domande_per_prova: 10, soglia: 0.7, domande: [] };
  }

  /* ------------------------------------------------------------------ id */
  function idPacchetto() {
    if (S.meta.idFisso && S.pack.id) return S.pack.id;
    var s = slug(S.pack.titolo);
    if (s.length < 2) s = "mie-lezioni";
    if (!/^[a-z0-9]/.test(s)) s = "p-" + s;
    if (RISERVATI.test(s)) s = "nostro-" + s;
    var base = s, n = 2;
    while (true) {
      var en = installato(s);
      if (!en || mio(en)) break;   // un pacchetto creato con l'editor con lo stesso nome viene aggiornato
      s = (base.slice(0, 44) + "-" + n++).replace(/--+/g, "-");
    }
    return s;
  }
  function idLezioni(pid, lezioni) {
    var usati = {}, altre = {};
    (window.PD_LESSONS || []).forEach(function (L) { if (L.pack !== pid) altre[L.id] = 1; });
    return lezioni.map(function (L) {
      var id = L.id;
      if (!id || usati[id] || altre[id]) {
        var base = (pid + "-" + (slug(L.titolo) || "lezione")).slice(0, 46).replace(/-+$/, ""), n = 2;
        id = base;
        while (usati[id] || altre[id]) id = base + "-" + n++;
      }
      usati[id] = 1;
      return id;
    });
  }

  /* ------------------------------------------------------------------ dalla bozza al file del pacchetto */
  function costruisci(versione) {
    var b = S.pack, pid = idPacchetto(), lids = idLezioni(pid, b.lezioni);
    var p = { formato: "professore-digitale-contenuti", formato_versione: 1, id: pid, titolo: trim(b.titolo), versione: versione || S.meta.versione || "1.0.0" };
    if (trim(b.autore)) p.autore = trim(b.autore);
    if (trim(b.descrizione)) p.descrizione = trim(b.descrizione);
    if (PD.version && /^\d+\.\d+(\.\d+)?$/.test(PD.version)) p.richiede_app = PD.version;
    p.creato_con = MARCA;
    // eventuali chiavi in più del file originale restano
    Object.keys(b).forEach(function (k) { if (p[k] === undefined && k.charAt(0) !== "_" && ["lezioni", "domande", "prove", "suggerimenti"].indexOf(k) < 0) p[k] = b[k]; });
    var sug = (Array.isArray(b.suggerimenti) && b.suggerimenti.length ? b.suggerimenti
      : b.domande.map(function (d) { return trim(d.domanda); })).filter(function (s) { return s && s.length <= 120; }).slice(0, 8);
    if (sug.length) p.suggerimenti = sug;
    if (b.domande.length) p.domande = b.domande.map(function (d) {
      var o = pulito(d);
      o.domanda = trim(d.domanda); o.risposta = unisciRisposta(d);
      o.parole_chiave = (d.parole_chiave || []).map(trim).filter(function (k) { return k; });
      if (!o.schema) delete o.schema;
      if (!o.lezione) delete o.lezione;
      return o;
    });
    if (b.lezioni.length) p.lezioni = b.lezioni.map(function (L, i) {
      var o = pulito(L);
      o.id = lids[i]; o.titolo = trim(L.titolo); o.icona = L.icona || "📘";
      o.livello = trim(L.livello) || trim(b.titolo).slice(0, 40) || "Extra";
      o.minuti = Math.max(1, Math.min(240, parseInt(L.minuti, 10) || 15));
      if (trim(L.obiettivo)) o.obiettivo = trim(L.obiettivo); else delete o.obiettivo;
      o.palestra = L.palestra || "";
      o.passi = L.passi.map(function (s) {
        var x = pulito(s);
        x.titolo = trim(s.titolo); x.testo = trim(s.testo);
        var sc = (s._riquadri || []).length ? mermaid(s._riquadri) : trim(s.schema);
        if (sc) x.schema = sc; else delete x.schema;
        if (trim(s.consiglio)) x.consiglio = trim(s.consiglio); else delete x.consiglio;
        return x;
      });
      o.quiz = L.quiz.map(quizFile);
      return o;
    });
    if (b.prove.length) p.prove = b.prove.map(function (P, i) {
      var o = pulito(P);
      o.id = P.id || (pid.slice(0, 40) + "-quiz" + (i ? "-" + (i + 1) : ""));
      o.titolo = trim(P.titolo); o.icona = P.icona || "🏆";
      if (trim(P.descrizione)) o.descrizione = trim(P.descrizione); else delete o.descrizione;
      if (P._attestato) { delete o.senza_attestato; if (trim(P.attestato)) o.attestato = trim(P.attestato); else delete o.attestato; }
      else { o.senza_attestato = true; delete o.attestato; }
      o.domande_per_prova = parseInt(P.domande_per_prova, 10) || 0;
      o.soglia = Math.round((+P.soglia || 0) * 100) / 100;
      o.domande = P.domande.map(function (q) { var x = quizFile(q); if (trim(q.categoria)) x.categoria = trim(q.categoria); else delete x.categoria; return x; });
      return o;
    });
    return p;
  }
  function pulito(o) {
    var x = {};
    Object.keys(o).forEach(function (k) { if (k.charAt(0) !== "_") x[k] = copia(o[k]); });
    return x;
  }
  /* le risposte vuote si tolgono e il numero di quella giusta si sposta di conseguenza */
  function quizFile(q) {
    var x = pulito(q), op = [], giusta = -1;
    (q.opzioni || []).forEach(function (o, i) { if (trim(o)) { if (i === q.corretta) giusta = op.length; op.push(trim(o)); } });
    x.domanda = trim(q.domanda); x.opzioni = op; x.corretta = giusta < 0 ? 0 : giusta; x.spiegazione = trim(q.spiegazione);
    return x;
  }

  /* ------------------------------------------------------------------ controllo */
  function controlla() {
    var b = S.pack, err = [], cons = [];
    function E(f, tab, m) { err.push({ f: f, tab: tab, m: m }); }
    function C(f, tab, m) { cons.push({ f: f, tab: tab, m: m }); }
    function lun(f, tab, v, max, nome) { if (trim(v).length > max) E(f, tab, nome + " è troppo lungo: al massimo " + max + " caratteri (ora " + trim(v).length + ")."); }
    if (!trim(b.titolo)) E("titolo", "pacchetto", "Scrivete il titolo del pacchetto (per esempio «Servizi del Comune di …»).");
    lun("titolo", "pacchetto", b.titolo, 120, "Il titolo");
    lun("descrizione", "pacchetto", b.descrizione, 600, "La descrizione");
    lun("autore", "pacchetto", b.autore, 600, "Il nome dell'autore");
    if (!trim(b.descrizione)) C("descrizione", "pacchetto", "Una descrizione di una riga aiuta i colleghi a capire a cosa serve il pacchetto.");
    if (!b.lezioni.length && !b.domande.length && !b.prove.length) E("pacchetto", "pacchetto", "Il pacchetto è vuoto: aggiungete almeno una lezione, una domanda o un grande quiz.");
    var parentesi = false;

    b.lezioni.forEach(function (L, i) {
      var w = "lezioni." + i, nome = "Lezione " + (i + 1);
      if (!trim(L.titolo)) E(w + ".titolo", "lezioni", "Scrivete il titolo della lezione.");
      lun(w + ".titolo", "lezioni", L.titolo, 120, "Il titolo");
      lun(w + ".obiettivo", "lezioni", L.obiettivo, 400, "La descrizione breve");
      if (!trim(L.obiettivo)) C(w + ".obiettivo", "lezioni", nome + ": una descrizione breve («Cosa imparerete») compare nell'elenco delle lezioni.");
      if (!L.passi.length) E(w + ".passi", "lezioni", nome + ": serve almeno un passo.");
      if (L.passi.length > 30) E(w + ".passi", "lezioni", nome + ": al massimo 30 passi (ora " + L.passi.length + ").");
      L.passi.forEach(function (s, j) {
        var ww = w + ".passi." + j;
        if (!trim(s.titolo)) E(ww + ".titolo", "lezioni", "Scrivete il titolo del passo " + (j + 1) + ".");
        lun(ww + ".titolo", "lezioni", s.titolo, 120, "Il titolo");
        if (!trim(s.testo)) E(ww + ".testo", "lezioni", "Scrivete il testo del passo " + (j + 1) + ": cosa deve fare o sapere l'allievo.");
        lun(ww + ".testo", "lezioni", s.testo, 5000, "Il testo");
        lun(ww + ".consiglio", "lezioni", s.consiglio, 400, "Il consiglio");
        var pieni = (s._riquadri || []).filter(function (x) { return trim(x); }).length;
        if ((s._riquadri || []).length && pieni < 2) E(ww + ".schema", "lezioni", "Lo schema ha bisogno di almeno 2 riquadri scritti (ora " + pieni + "), oppure toglietelo.");
        if (trim(s.testo) && parole(s.testo) > 160) C(ww + ".testo", "lezioni", "Il passo " + (j + 1) + " è lungo (" + parole(s.testo) + " parole): forse conviene dividerlo in due passi.");
        if (/\[[^\]\n]{2,}\]/.test(s.titolo + s.testo + (s.consiglio || ""))) parentesi = true;
      });
      if (!L.quiz.length) C(w + ".quiz", "lezioni", nome + ": aggiungete 2 o 3 domande di quiz, aiutano a ripassare.");
      if (L.quiz.length > 20) E(w + ".quiz", "lezioni", nome + ": al massimo 20 domande nel quiz.");
      L.quiz.forEach(function (q, j) { controllaQuiz(q, w + ".quiz." + j, "lezioni", E); });
    });

    b.domande.forEach(function (d, i) {
      var w = "domande." + i, n = parole(unisciRisposta(d)), k = (d.parole_chiave || []).filter(function (x) { return trim(x); });
      if (!trim(d.domanda)) E(w + ".domanda", "domande", "Scrivete la domanda, come la farebbe un allievo.");
      lun(w + ".domanda", "domande", d.domanda, 300, "La domanda");
      if (!trim(unisciRisposta(d))) E(w + "._testo", "domande", "Scrivete la risposta.");
      else if (n < 40) E(w + "._testo", "domande", "La risposta deve avere almeno 40 parole: ora ne ha " + n + ". Aggiungete un esempio o un consiglio.");
      else if (n > 120) C(w + "._testo", "domande", "La risposta è lunga (" + n + " parole): meglio restare sotto le 120, frasi brevi.");
      if (unisciRisposta(d).length > 5000) E(w + "._testo", "domande", "La risposta è troppo lunga (massimo 5000 caratteri).");
      if (k.length < 3) E(w + ".parole_chiave", "domande", "Servono almeno 3 parole chiave: ora " + (k.length === 1 ? "ce n'è 1" : "ce ne sono " + k.length) + ". Premete «✨ Suggerisci».");
      else if (k.length > 8) C(w + ".parole_chiave", "domande", "Ci sono " + k.length + " parole chiave: ne bastano 3-8, quelle che userebbero davvero gli allievi.");
      if (k.length > 40) E(w + ".parole_chiave", "domande", "Al massimo 40 parole chiave.");
      k.forEach(function (x) { if (x.length > 60) E(w + ".parole_chiave", "domande", "La parola chiave «" + x.slice(0, 20) + "…» è troppo lunga (max 60 caratteri)."); });
      if (/\[[^\]\n]{2,}\]/.test(d.domanda + unisciRisposta(d))) parentesi = true;
    });

    b.prove.forEach(function (P, i) {
      var w = "prove." + i, nq = P.domande.length, npp = parseInt(P.domande_per_prova, 10);
      if (!trim(P.titolo)) E(w + ".titolo", "quiz", "Scrivete il titolo del grande quiz.");
      lun(w + ".titolo", "quiz", P.titolo, 120, "Il titolo");
      lun(w + ".descrizione", "quiz", P.descrizione, 600, "La descrizione");
      lun(w + ".attestato", "quiz", P.attestato, 120, "La scritta dell'attestato");
      if (!(npp >= 5 && npp <= 100)) E(w + ".domande_per_prova", "quiz", "Le domande per ogni prova devono essere tra 5 e 100.");
      else if (nq >= 5 && npp > nq) C(w + ".domande_per_prova", "quiz", "Avete chiesto " + npp + " domande per prova ma ne avete scritte " + nq + ": ne verranno usate " + nq + ".");
      if (!(P.soglia >= 0.5 && P.soglia <= 1)) E(w + ".soglia", "quiz", "La soglia deve essere tra il 50% e il 100%.");
      if (nq < 5) E(w + ".domande", "quiz", "Servono almeno 5 domande: ora " + (nq === 1 ? "ce n'è 1" : "ce ne sono " + nq) + ".");
      if (nq > 1000) E(w + ".domande", "quiz", "Al massimo 1000 domande.");
      P.domande.forEach(function (q, j) { controllaQuiz(q, w + ".domande." + j, "quiz", E); lun(w + ".domande." + j + ".categoria", "quiz", q.categoria, 60, "La categoria"); });
    });
    if (parentesi) C("pacchetto", "controlla", "Ci sono ancora spazi da completare tra [parentesi quadre]: sostituiteli con i vostri dati (indirizzi, orari…).");

    // ultima rete di sicurezza: il validatore del programma (stesse regole del server)
    var fatti = {}; err.forEach(function (x) { fatti[x.f] = 1; });
    var pack = costruisci(), v = PD.packs ? PD.packs.validate(pack) : [];
    v.forEach(function (riga) {
      var m = riga.match(/^([^:]+):\s*(.*)$/), dove = m ? m[1] : "", msg = m ? m[2] : riga;
      var f = dove.replace(/\[(\d+)\]/g, ".$1").replace(/^pacchetto\./, "");
      f = f.replace(/^(domande\.\d+)\.risposta$/, "$1._testo").replace(/\.(opzioni|corretta)$/, ".$1");
      if (fatti[f] || fatti[f.replace(/\.(opzioni|corretta)$/, "")]) return;
      var tab = /^lezioni/.test(f) ? "lezioni" : /^domande/.test(f) ? "domande" : /^prove/.test(f) ? "quiz" : "pacchetto";
      E(f, tab, dovePerLeggere(f) + ": " + msg + ".");
    });
    return { errori: err, consigli: cons, pack: pack };
  }
  function controllaQuiz(q, w, tab, E) {
    var piene = (q.opzioni || []).filter(function (o) { return trim(o); }).length;
    if (!trim(q.domanda)) E(w + ".domanda", tab, "Scrivete la domanda del quiz.");
    if ((q.domanda || "").length > 300) E(w + ".domanda", tab, "La domanda è troppo lunga (massimo 300 caratteri).");
    if (piene < 2) E(w + ".opzioni", tab, "Servono almeno 2 risposte da scegliere: ora " + (piene === 1 ? "ce n'è 1" : "ce ne sono " + piene) + ".");
    else if (!trim((q.opzioni || [])[q.corretta])) E(w + ".opzioni", tab, "Indicate quale risposta è quella giusta (il pallino ✓ accanto).");
    if (!trim(q.spiegazione)) E(w + ".spiegazione", tab, "Scrivete una breve spiegazione: l'allievo la legge dopo aver risposto.");
    if ((q.spiegazione || "").length > 600) E(w + ".spiegazione", tab, "La spiegazione è troppo lunga (massimo 600 caratteri).");
  }
  function dovePerLeggere(f) {
    var p = f.split("."), nomi = { lezioni: "Lezione", domande: "Domanda", prove: "Grande quiz", passi: "passo", quiz: "domanda del quiz" }, out = [];
    for (var i = 0; i < p.length; i++) {
      if (nomi[p[i]] && /^\d+$/.test(p[i + 1] || "")) { out.push(nomi[p[i]] + " " + (+p[i + 1] + 1)); i++; }
      else out.push(p[i].replace(/^_/, ""));
    }
    return out.join(", ");
  }

  /* ------------------------------------------------------------------ percorsi dei campi (data-f) */
  function prendi(path) {
    var o = S.pack, p = path.split(".");
    for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; }
    return o;
  }
  function metti(path, v) {
    var o = S.pack, p = path.split(".");
    for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = v;
  }

  /* ------------------------------------------------------------------ HTML: pezzi riutilizzabili */
  function campo(f, etichetta, opz) {
    opz = opz || {};
    var v = prendi(f), id = "ed-" + f.replace(/\./g, "-"), max = opz.max ? ' maxlength="' + opz.max + '"' : "";
    var input = opz.area
      ? '<textarea id="' + id + '" data-f="' + f + '" rows="' + (opz.righe || 4) + '"' + max + (opz.ph ? ' placeholder="' + esc(opz.ph) + '"' : "") + ">" + esc(v == null ? "" : v) + "</textarea>"
      : '<input type="' + (opz.num ? "number" : "text") + '" id="' + id + '" data-f="' + f + '"' + (opz.num ? ' data-tipo="num" min="' + opz.min + '" max="' + opz.maxn + '" inputmode="numeric"' : "") + max +
        ' value="' + esc(v == null ? "" : v) + '"' + (opz.ph ? ' placeholder="' + esc(opz.ph) + '"' : "") + ">";
    return '<div class="field ed-field"><label for="' + id + '">' + etichetta + "</label>" + (opz.aiuto ? '<span class="small muted">' + opz.aiuto + "</span>" : "") +
      (opz.barra ? barraTesto(id) : "") + input + (opz.extra || "") + err(f) + "</div>";
  }
  function err(f) { return '<div class="ed-err" data-err="' + f + '" aria-live="polite"></div>'; }
  function barraTesto(id) {
    return '<div class="ed-barra" role="toolbar" aria-label="Formattazione"><button type="button" class="btn ghost" data-fmt="b" data-per="' + id + '"><b>G</b> Grassetto</button>' +
      '<button type="button" class="btn ghost" data-fmt="ol" data-per="' + id + '">1. Elenco numerato</button>' +
      '<button type="button" class="btn ghost" data-fmt="ul" data-per="' + id + '">• Elenco puntato</button></div>';
  }
  function scegliIcona(f) {
    var v = prendi(f);
    return '<div class="field ed-field"><label>Icona</label><div class="ed-icone" role="radiogroup" aria-label="Scegliete un\'icona">' +
      ICONE.map(function (ic) { return '<button type="button" class="ed-ico' + (ic === v ? " on" : "") + '" role="radio" aria-checked="' + (ic === v) + '" data-icona="' + ic + '" data-per="' + f + '">' + ic + "</button>"; }).join("") +
      "</div></div>";
  }
  function bottoniOrdine(lista, i, n, cosa) {
    return '<div class="ed-ordine"><button type="button" class="btn ghost" data-act="su" data-lista="' + lista + '" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Sposta in su">↑</button>' +
      '<button type="button" class="btn ghost" data-act="giu" data-lista="' + lista + '" data-i="' + i + '"' + (i === n - 1 ? " disabled" : "") + ' aria-label="Sposta in giù">↓</button>' +
      '<button type="button" class="btn ghost ed-del" data-act="elimina" data-lista="' + lista + '" data-i="' + i + '">🗑 Elimina ' + cosa + "</button></div>";
  }
  function domandaQuizHTML(w, q, j, n, lista, conCategoria) {
    var nome = "ed-c-" + w.replace(/\./g, "-");
    return '<div class="card ed-sub ed-qz"><div class="ed-sub-head"><b>Domanda ' + (j + 1) + "</b>" + bottoniOrdine(lista, j, n, "domanda") + "</div>" +
      campo(w + ".domanda", "Domanda", { max: 300, ph: "Per esempio: Dove si prenota l'appuntamento?" }) +
      '<div class="field ed-field"><label>Risposte (segnate con ✓ quella giusta)</label>' +
      q.opzioni.map(function (o, k) {
        return '<div class="ed-opz"><label class="ed-giusta" title="Questa è la risposta giusta"><input type="radio" name="' + nome + '" data-f="' + w + '.corretta" data-tipo="num" value="' + k + '"' +
          (q.corretta === k ? " checked" : "") + '><span>✓</span></label><input type="text" data-f="' + w + ".opzioni." + k + '" value="' + esc(o) + '" placeholder="Risposta ' + "ABCD".charAt(k) +
          '" aria-label="Risposta ' + "ABCD".charAt(k) + '">' + (q.opzioni.length > 2 ? '<button type="button" class="btn ghost" data-act="togliopz" data-lista="' + w + '.opzioni" data-i="' + k + '" aria-label="Togli questa risposta">✕</button>' : "") + "</div>";
      }).join("") +
      (q.opzioni.length < 4 ? '<button type="button" class="btn ghost" data-act="opz" data-lista="' + w + '.opzioni">➕ Aggiungi una risposta</button>' : "") + err(w + ".opzioni") + "</div>" +
      campo(w + ".spiegazione", "Spiegazione (si legge dopo aver risposto)", { area: true, righe: 2, max: 600 }) +
      (conCategoria ? campo(w + ".categoria", "Categoria (facoltativa)", { max: 60, ph: "es. Uffici, Sito internet…", aiuto: "Le domande si pescano a turno da ogni categoria." }) : "") + "</div>";
  }

  /* ------------------------------------------------------------------ vista */
  PD.views.editor = function (el, args) {
    vistaEl = el; carica();
    if (args && args[0] && SCHEDE.some(function (s) { return s[0] === args[0]; })) S.tab = args[0];
    disegna();
  };

  function disegna() {
    var el = vistaEl; if (!el) return;
    var stato = S.meta.versione ? "versione " + esc(S.meta.versione) + (S.meta.sporco ? " · <b>modifiche non salvate</b>" : " · ✓ salvato e in uso") :
      (vuoto() ? "nuovo, ancora vuoto" : "<b>non ancora salvato</b>");
    el.innerHTML =
      '<div class="ed">' +
      '<h1>✏️ Crea lezioni e quiz</h1><p class="lead">Preparate lezioni, risposte e quiz sui servizi del vostro Comune, della vostra associazione o del vostro gruppo. ' +
      "Non serve conoscere l'informatica: compilate le schede, controllate e premete «Salva e usa».</p>" +
      '<div class="card ed-top"><div class="ed-top-tit"><span class="big-ico">📦</span><div><b id="ed-top-titolo">' + esc(trim(S.pack.titolo) || "Pacchetto senza titolo") + '</b><br><span class="small muted" id="ed-top-stato">' + stato + "</span></div></div>" +
      '<div class="row">' + (PD.ospite ? "" : '<button class="btn big" data-act="salva">💾 Salva e usa</button>') + '<button class="btn ghost" data-act="scarica">⬇️ Scarica il file del pacchetto</button></div></div>' +
      '<nav class="ed-tabs" role="tablist">' + SCHEDE.map(function (s) {
        return '<button role="tab" class="ed-tab" data-tab="' + s[0] + '" aria-selected="' + (S.tab === s[0]) + '"><span aria-hidden="true">' + s[1] + "</span> " + s[2] + '<span class="ed-conta" data-conta="' + s[0] + '"></span></button>';
      }).join("") + "</nav>" +
      '<div class="ed-pannello" role="tabpanel">' + pannello() + "</div>" +
      '<div id="ed-anteprima"></div></div>';
    if (!el.getAttribute("data-ed")) { el.setAttribute("data-ed", "1"); collega(el); }
    aggiornaControlli();
  }
  function pannello() {
    return ({ pacchetto: tabPacchetto, lezioni: tabLezioni, domande: tabDomande, quiz: tabQuiz, controlla: tabControlla }[S.tab] || tabPacchetto)();
  }

  /* --- scheda Pacchetto --- */
  function tabPacchetto() {
    var miei = installati().filter(mio), altri = installati().filter(function (e) { return !mio(e); });
    var h = "";
    if (vuoto()) h += '<div class="card ed-sez"><h2>🚀 Partite da un modello pronto</h2><p class="small muted">Il modello riempie le schede con un esempio: poi completate gli spazi tra [parentesi] con i vostri dati.</p>' +
      '<div class="grid ed-modelli"><button class="card tile" data-modello="comune"><span class="big-ico">🏛️</span><h3>Servizi del nostro Comune</h3><p>Come prenotare allo sportello e usare il sito del Comune.</p></button>' +
      '<button class="card tile" data-modello="associazione"><span class="big-ico">🤝</span><h3>Presentazione della nostra associazione</h3><p>Chi siete, cosa fate, come partecipare.</p></button>' +
      '<button class="card tile" data-modello="vuoto"><span class="big-ico">📄</span><h3>Pacchetto vuoto</h3><p>Partite da zero, una scheda alla volta.</p></button></div></div>';
    h += '<div class="card ed-sez"><h2>📦 Dati del pacchetto</h2>' +
      campo("titolo", "Titolo del pacchetto", { max: 120, ph: "es. Servizi del Comune di Borgoprova" }) +
      '<p class="small muted ed-id">Nome tecnico (si crea da solo dal titolo): <code id="ed-id">' + esc(idPacchetto()) + "</code>" + (S.meta.idFisso ? " · resta lo stesso dopo il primo salvataggio" : "") + "</p>" +
      campo("descrizione", "Descrizione (una o due frasi)", { area: true, righe: 2, max: 600, ph: "A cosa serve, per chi è pensato." }) +
      campo("autore", "Autore", { max: 120, ph: "Il vostro nome o quello dell'associazione", aiuto: PD.settings.teacherName ? "" : "Suggerimento: il nome del facilitatore si imposta in Impostazioni." }) +
      '<p class="small muted">Versione: <b>' + esc(S.meta.versione || "non ancora salvata") + "</b> · aumenta da sola a ogni «Salva e usa».</p>" + err("pacchetto") + "</div>";
    h += '<div class="card ed-sez"><h2>🗂️ I miei pacchetti</h2>' +
      (miei.length ? '<div class="ed-miei">' + miei.map(function (en) {
        var p = en.pacchetto;
        return '<div class="ed-mio"><div><b>' + esc(p.titolo) + '</b><br><span class="small muted">versione ' + esc(p.versione) + " · " + contaTesto((p.lezioni || []).length, "lezione", "lezioni") + ", " +
          contaTesto((p.domande || []).length, "domanda", "domande") + ((p.prove || []).length ? ", grande quiz" : "") + '</span></div><div class="row">' +
          '<button class="btn" data-apri="' + esc(p.id) + '">✏️ Modifica</button><button class="btn ghost" data-scarica-pack="' + esc(p.id) + '">⬇️ Scarica</button>' +
          '<button class="btn ghost ed-del" data-rimuovi="' + esc(p.id) + '">🗑 Rimuovi</button></div></div>';
      }).join("") + "</div>" : '<p class="muted">Non avete ancora salvato pacchetti con questo strumento.</p>') +
      '<h3>Aprire un pacchetto da modificare</h3><div class="row ed-apri">' +
      '<label class="btn ghost ed-file">⬆️ Apri un file del pacchetto (.json)<input type="file" accept=".json,application/json" id="ed-file"></label>' +
      (altri.length ? '<select id="ed-altri" aria-label="Pacchetti installati"><option value="">… oppure partite da un pacchetto installato</option>' +
        altri.map(function (e) { return '<option value="' + esc(e.pacchetto.id) + '">' + esc(e.pacchetto.titolo) + "</option>"; }).join("") + '</select><button class="btn ghost" data-act="apri-altro">Apri una copia</button>' : "") +
      '</div><p class="small muted">I pacchetti inclusi nel programma si aprono come <b>copia</b>: l\'originale non cambia.</p>' +
      '<div id="ed-apri-esito" aria-live="polite"></div>' +
      '<div class="row" style="margin-top:1rem"><button class="btn ghost" data-act="nuovo">➕ Nuovo pacchetto vuoto</button></div></div>';
    return h;
  }

  /* --- scheda Lezioni --- */
  function tabLezioni() {
    var L = S.pack.lezioni;
    if (S.lez >= 0 && L[S.lez]) return formLezione(S.lez);
    S.lez = -1;
    var h = '<div class="card ed-sez"><h2>📚 Le lezioni del pacchetto</h2>' + err("lezioni") +
      (L.length ? '<div class="ed-elenco">' + L.map(function (x, i) {
        return '<div class="ed-riga"><span class="big-ico">' + esc(x.icona || "📘") + '</span><div class="ed-riga-t"><b>' + (i + 1) + ". " + esc(trim(x.titolo) || "Lezione senza titolo") +
          '</b><br><span class="small muted">' + contaTesto(x.passi.length, "passo", "passi") + " · " + contaTesto(x.quiz.length, "domanda", "domande") + " di quiz</span>" +
          '<div class="ed-err" data-err-pref="lezioni.' + i + '."></div></div><div class="row"><button class="btn" data-lez="' + i + '">✏️ Modifica</button>' + bottoniOrdine("lezioni", i, L.length, "") + "</div></div>";
      }).join("") + "</div>" : '<p class="muted">Ancora nessuna lezione.</p>') +
      '<div class="row" style="margin-top:1rem"><button class="btn big" data-act="nuova-lezione">➕ Nuova lezione</button></div></div>' +
      '<div class="card ed-sez"><h2>📋 Copia una lezione esistente</h2><p class="small muted">Prendete una lezione del corso come punto di partenza e adattatela: l\'originale non cambia.</p>' +
      '<div class="row"><select id="ed-copia-lez" aria-label="Lezione da copiare">' + (window.PD_LESSONS || []).map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc(x.icon || "") + " " + esc(x.title) + "</option>";
      }).join("") + '</select><button class="btn ghost" data-act="copia-lezione">📋 Copia questa lezione</button></div></div>';
    return h;
  }
  function formLezione(i) {
    var L = S.pack.lezioni[i], w = "lezioni." + i;
    var h = '<div class="ed-sez-head"><button class="btn ghost" data-act="elenco-lezioni">← Tutte le lezioni</button><button class="btn" data-act="anteprima-lezione" data-i="' + i + '">👁 Anteprima per l\'allievo</button></div>' +
      '<div class="card ed-sez"><h2>' + esc(L.icona || "📘") + " Lezione " + (i + 1) + "</h2>" +
      campo(w + ".titolo", "Titolo della lezione", { max: 120, ph: "es. Prenotare allo sportello del Comune" }) + scegliIcona(w + ".icona") +
      campo(w + ".obiettivo", "Descrizione breve: cosa imparerà l'allievo", { area: true, righe: 2, max: 400 }) +
      '<div class="ed-2col">' + campo(w + ".minuti", "Durata (minuti)", { num: true, min: 1, maxn: 240 }) +
      '<div class="field ed-field"><label for="ed-pal-' + i + '">Esercizio in Palestra (facoltativo)</label><select id="ed-pal-' + i + '" data-f="' + w + '.palestra">' +
      PALESTRA.map(function (p) { return '<option value="' + p[0] + '"' + ((L.palestra || "") === p[0] ? " selected" : "") + ">" + esc(p[1]) + "</option>"; }).join("") + "</select></div></div></div>";
    h += '<div class="card ed-sez"><h2>👣 Passi</h2><p class="small muted">Ogni passo è una pagina della lezione: un titolo, un testo breve e, se aiuta, uno schema alla lavagna.</p>' + err(w + ".passi") +
      L.passi.map(function (s, j) { return passoHTML(w + ".passi." + j, s, j, L.passi.length); }).join("") +
      (L.passi.length < 30 ? '<button class="btn" data-act="passo" data-lista="' + w + '.passi">➕ Aggiungi un passo</button>' : "") + "</div>";
    h += '<div class="card ed-sez"><h2>✓ Quiz della lezione</h2><p class="small muted">2 o 3 domande bastano. Ogni domanda ha da 2 a 4 risposte, una sola giusta.</p>' + err(w + ".quiz") +
      L.quiz.map(function (q, j) { return domandaQuizHTML(w + ".quiz." + j, q, j, L.quiz.length, w + ".quiz", false); }).join("") +
      (L.quiz.length < 20 ? '<button class="btn" data-act="domanda-quiz" data-lista="' + w + '.quiz">➕ Aggiungi una domanda al quiz</button>' : "") + "</div>" +
      '<div class="row"><button class="btn ghost" data-act="elenco-lezioni">← Tutte le lezioni</button><button class="btn" data-act="anteprima-lezione" data-i="' + i + '">👁 Anteprima per l\'allievo</button></div>';
    return h;
  }
  function passoHTML(w, s, j, n) {
    var boxes = s._riquadri || [], man = !boxes.length && trim(s.schema);
    var sc = '<div class="ed-schema" data-schema-per="' + w + '"><b>🧩 Schema alla lavagna (facoltativo)</b>';
    if (boxes.length) {
      sc += '<p class="small muted">Scrivete un riquadro per ogni azione, in ordine (al massimo 6).</p><div class="ed-boxes">' + boxes.map(function (b, k) {
        return (k ? '<span class="ed-freccia" aria-hidden="true">→</span>' : "") + '<span class="ed-box"><input type="text" maxlength="60" data-f="' + w + "._riquadri." + k + '" value="' + esc(b) + '" placeholder="Passo ' + (k + 1) +
          '" aria-label="Riquadro ' + (k + 1) + '"><button type="button" class="btn ghost" data-act="togli-box" data-lista="' + w + '._riquadri" data-i="' + k + '" aria-label="Togli il riquadro ' + (k + 1) + '">✕</button></span>';
      }).join("") + "</div>" + '<div class="row">' + (boxes.length < 6 ? '<button type="button" class="btn ghost" data-act="box" data-lista="' + w + '._riquadri">➕ Riquadro</button>' : "") +
        '<button type="button" class="btn ghost" data-act="vedi-schema" data-per="' + w + '">👁 Vedi lo schema</button><button type="button" class="btn ghost" data-act="togli-schema" data-per="' + w + '">🗑 Togli lo schema</button></div>';
    } else if (man) {
      sc += '<p class="small muted">Questo passo ha uno schema scritto a mano (codice Mermaid, per esperti).</p><textarea rows="3" data-f="' + w + '.schema" aria-label="Codice dello schema">' + esc(s.schema) + "</textarea>" +
        '<div class="row"><button type="button" class="btn ghost" data-act="vedi-schema" data-per="' + w + '">👁 Vedi lo schema</button><button type="button" class="btn ghost" data-act="togli-schema" data-per="' + w + '">🗑 Togli lo schema</button></div>';
    } else sc += ' <button type="button" class="btn ghost" data-act="aggiungi-schema" data-per="' + w + '">➕ Aggiungi uno schema a riquadri</button>';
    sc += err(w + ".schema") + '<div class="chalkboard ed-lavagna" data-lavagna="' + w + '" hidden></div></div>';
    return '<div class="card ed-sub"><div class="ed-sub-head"><b>Passo ' + (j + 1) + "</b>" + bottoniOrdine(w.replace(/\.\d+$/, ""), j, n, "passo") + "</div>" +
      campo(w + ".titolo", "Titolo del passo", { max: 120 }) +
      campo(w + ".testo", "Testo", { area: true, righe: 5, barra: true, max: 5000, ph: "Frasi brevi. Per una procedura usate l'elenco numerato: 1. … 2. …",
        extra: '<details class="ed-md-box"><summary>👁 Come lo vedrà l\'allievo</summary><div class="step-text ed-md" data-md="' + w + '.testo">' + PD.md(s.testo) + "</div></details>" }) +
      campo(w + ".consiglio", "💡 Consiglio (facoltativo)", { max: 400, ph: "es. Portate sempre un documento d'identità." }) + sc + "</div>";
  }

  /* --- scheda Domande --- */
  function tabDomande() {
    var D = S.pack.domande;
    return '<div class="card ed-sez"><h2>💬 Domande e risposte per «Chiedi al Professore»</h2>' +
      '<p class="small muted">Quando un allievo fa una domanda simile, il Professore risponde con il vostro testo, anche senza Internet. ' +
      "Regole d'oro: risposta tra 40 e 120 parole, frasi brevi; 3-8 parole chiave come le direbbero gli allievi.</p>" +
      D.map(function (d, i) { return domandaHTML(d, i, D.length); }).join("") +
      '<button class="btn big" data-act="nuova-domanda">➕ Nuova domanda</button></div>';
  }
  function domandaHTML(d, i, n) {
    var w = "domande." + i, passi = d._passi || [];
    return '<details class="card ed-sub ed-dom"' + (i === n - 1 || S.apriDom === i ? " open" : "") + '><summary><b>' + (i + 1) + ". </b><span data-sommario=\"" + w + '">' + esc(trim(d.domanda) || "Nuova domanda") + "</span></summary>" +
      '<div class="ed-sub-head">' + bottoniOrdine("domande", i, n, "domanda") + "</div>" +
      campo(w + ".domanda", "Domanda (come la farebbe un allievo)", { max: 300, ph: "es. Come prenoto un appuntamento in Comune?" }) +
      campo(w + "._testo", "Risposta", { area: true, righe: 5, barra: true, ph: "Spiegate con parole semplici. Aggiungete un consiglio di prudenza se si parla di soldi o dati personali.",
        extra: '<span class="small ed-contaparole" data-parole="' + w + '"></span>' }) +
      '<div class="field ed-field"><label>Passi numerati (facoltativi: per le procedure)</label>' +
      passi.map(function (p, k) {
        return '<div class="ed-opz"><span class="ed-num">' + (k + 1) + '.</span><input type="text" data-f="' + w + "._passi." + k + '" value="' + esc(p) + '" aria-label="Passo ' + (k + 1) + '">' +
          '<button type="button" class="btn ghost" data-act="togliopz" data-lista="' + w + '._passi" data-i="' + k + '" aria-label="Togli il passo ' + (k + 1) + '">✕</button></div>';
      }).join("") + '<button type="button" class="btn ghost" data-act="opz" data-lista="' + w + '._passi">➕ Aggiungi un passo</button></div>' +
      '<div class="field ed-field"><label for="ed-k-' + i + '">Parole chiave (separate da virgole)</label><span class="small muted">Le parole che un allievo potrebbe usare: «prenotare, appuntamento, sportello…»</span>' +
      '<div class="ed-opz"><input type="text" id="ed-k-' + i + '" data-f="' + w + '.parole_chiave" data-tipo="lista" value="' + esc((d.parole_chiave || []).join(", ")) + '">' +
      '<button type="button" class="btn ghost" data-act="suggerisci" data-i="' + i + '">✨ Suggerisci</button></div><span class="small ed-chiavi" data-chiavi="' + w + '"></span>' + err(w + ".parole_chiave") + "</div>" +
      '<details class="ed-md-box"><summary>👁 Così risponderà il Professore</summary><div class="ed-risposta"><div class="ed-md" data-md="' + w + '.risposta">' + PD.md(unisciRisposta(d)) + "</div></div></details></details>";
  }

  /* --- scheda Grande quiz --- */
  function tabQuiz() {
    var P = S.pack.prove[0];
    if (!P) return '<div class="card ed-sez"><h2>🏆 Grande quiz con attestato (facoltativo)</h2><p>Un grande quiz pesca a caso le domande a ogni tentativo. ' +
      "Chi supera la soglia può ricevere un <b>attestato</b> con il proprio nome, da stampare.</p><p class=\"small muted\">Servono almeno 5 domande; meglio 15-30, così ogni tentativo è diverso.</p>" +
      '<button class="btn big" data-act="crea-prova">➕ Crea il grande quiz</button></div>';
    var w = "prove.0", nq = P.domande.length, npp = parseInt(P.domande_per_prova, 10) || 0;
    return '<div class="card ed-sez"><div class="ed-sub-head"><h2>' + esc(P.icona || "🏆") + ' Grande quiz</h2><div class="row"><button class="btn" data-act="anteprima-quiz">👁 Anteprima</button>' +
      '<button class="btn ghost ed-del" data-act="togli-prova">🗑 Elimina il grande quiz</button></div></div>' +
      campo(w + ".titolo", "Titolo", { max: 120, ph: "es. Quiz sui servizi del Comune" }) + scegliIcona(w + ".icona") +
      campo(w + ".descrizione", "Descrizione (facoltativa)", { area: true, righe: 2, max: 600 }) +
      '<div class="field ed-field"><label class="switch"><input type="checkbox" data-f="' + w + '._attestato" data-tipo="bool"' + (P._attestato ? " checked" : "") + "> Chi supera il quiz riceve l'attestato</label></div>" +
      (P._attestato ? campo(w + ".attestato", "Scritta sull'attestato (facoltativa)", { max: 120, ph: "es. Servizi digitali del Comune" }) : "") +
      '<div class="ed-2col">' + campo(w + ".domande_per_prova", "Domande per ogni tentativo (da 5 a 100)", { num: true, min: 5, maxn: 100, extra: '<span class="small muted" id="ed-npp">Avete scritto ' + contaTesto(nq, "domanda", "domande") + (nq && npp > nq ? ": ne verranno usate " + nq : "") + ".</span>" }) +
      '<div class="field ed-field"><label for="ed-soglia">Per superarlo servono almeno: <b id="ed-soglia-v">' + Math.round(P.soglia * 100) + "%</b> di risposte giuste</label>" +
      '<input type="range" id="ed-soglia" min="50" max="100" step="5" data-f="' + w + '.soglia" data-tipo="perc" value="' + Math.round(P.soglia * 100) + '">' + err(w + ".soglia") + "</div></div></div>" +
      '<div class="card ed-sez"><h2>❓ Domande del grande quiz <span class="badge" id="ed-nq">' + nq + "</span></h2>" + err(w + ".domande") +
      P.domande.map(function (q, j) { return domandaQuizHTML(w + ".domande." + j, q, j, nq, w + ".domande", true); }).join("") +
      (nq < 1000 ? '<button class="btn big" data-act="domanda-quiz" data-lista="' + w + '.domande">➕ Aggiungi una domanda</button>' : "") + "</div>";
  }

  /* --- scheda Controlla e salva --- */
  function tabControlla() {
    var r = controlla(), b = S.pack;
    var h = '<div class="card ed-sez"><h2>✅ Controlla e salva</h2><p>Il pacchetto contiene <b>' + contaTesto(b.lezioni.length, "lezione", "lezioni") + "</b>, <b>" +
      contaTesto(b.domande.length, "domanda", "domande") + "</b> per «Chiedi al Professore»" + (b.prove.length ? " e <b>un grande quiz</b> da " + contaTesto(b.prove[0].domande.length, "domanda", "domande") : "") + ".</p>";
    if (r.errori.length) h += '<div class="notice"><b>✏️ Da correggere prima di salvare (' + r.errori.length + ")</b><ul class=\"ed-lista-err\">" + r.errori.slice(0, 40).map(function (x) {
      return '<li><button type="button" class="ed-link" data-vai="' + esc(x.f) + '" data-vai-tab="' + x.tab + '">' + esc(dovePerLeggere(x.f).replace(/^titolo$|^descrizione$|^autore$|^pacchetto$/, "Pacchetto")) + "</button>: " + esc(x.m) + "</li>";
    }).join("") + "</ul></div>";
    else h += '<div class="notice ok" id="ed-pronto"><b>👍 Il pacchetto è pronto.</b> Il controllo del programma non ha trovato errori.</div>';
    if (r.consigli.length) h += '<div class="notice info"><b>💡 Consigli per migliorarlo</b> (non obbligatori)<ul>' + r.consigli.map(function (x) { return "<li>" + esc(x.m) + "</li>"; }).join("") + "</ul></div>";
    h += '<div class="row">' + (PD.ospite ? "" : '<button class="btn big" data-act="salva"' + (r.errori.length ? " disabled" : "") + '>💾 Salva e usa</button>') + '<button class="btn ghost big" data-act="scarica">⬇️ Scarica il file del pacchetto</button></div>' +
      '<p class="small muted">' + (PD.ospite ? "📱 Su un tablet collegato al PC dell'aula il pacchetto non si installa: scaricate il file e importatelo sul PC del facilitatore (Impostazioni → Contenuti aggiuntivi → Importa)." : PD.server ? "«Salva e usa» installa il pacchetto su questo computer: le lezioni compaiono subito." :
        "Versione portatile: il pacchetto si salva in questo browser. Scaricate anche il file, per portarlo su altri computer (Impostazioni → Contenuti aggiuntivi → Importa).") + "</p>" +
      '<div id="ed-esito" aria-live="polite">' + esitoSalva + "</div></div>";
    return h;
  }

  /* ------------------------------------------------------------------ aggiornamento leggero (senza ridisegnare) */
  function aggiornaControlli() {
    if (!vistaEl || !S) return;
    var r = controlla(), perTab = {}, perCampo = {};
    r.errori.forEach(function (x) { perTab[x.tab] = (perTab[x.tab] || 0) + 1; (perCampo[x.f] = perCampo[x.f] || []).push(x.m); });
    $$("[data-err]", vistaEl).forEach(function (d) {
      var m = perCampo[d.getAttribute("data-err")] || [];
      d.innerHTML = m.map(function (t) { return "<span>✏️ " + esc(t) + "</span>"; }).join("");
      var f = d.parentNode && d.parentNode.querySelector("[data-f]"); if (f) { if (m.length) f.setAttribute("aria-invalid", "true"); else f.removeAttribute("aria-invalid"); }
    });
    $$("[data-err-pref]", vistaEl).forEach(function (d) {
      var pref = d.getAttribute("data-err-pref"), n = 0;
      r.errori.forEach(function (x) { if (x.f.indexOf(pref) === 0) n++; });
      d.textContent = n ? "✏️ " + (n === 1 ? "1 cosa da completare" : n + " cose da completare") : "";
    });
    $$("[data-conta]", vistaEl).forEach(function (s) { var n = perTab[s.getAttribute("data-conta")] || 0; s.textContent = n ? " " + n : ""; s.className = "ed-conta" + (n ? " on" : ""); });
    $$("[data-parole]", vistaEl).forEach(function (s) {
      var d = prendi(s.getAttribute("data-parole")), n = parole(unisciRisposta(d));
      s.textContent = n + " parole " + (n < 40 ? "(ne servono almeno 40)" : n > 120 ? "(meglio sotto le 120)" : "✓");
      s.className = "small ed-contaparole " + (n < 40 || n > 120 ? "ko" : "ok");
    });
    $$("[data-chiavi]", vistaEl).forEach(function (s) {
      var d = prendi(s.getAttribute("data-chiavi")), k = (d.parole_chiave || []).filter(function (x) { return trim(x); });
      s.innerHTML = k.map(function (x) { return '<span class="chip">' + esc(x) + "</span>"; }).join(" ") + ' <span class="' + (k.length >= 3 && k.length <= 8 ? "ok" : "ko") + '">' + k.length + " (3-8)</span>";
    });
    var t = $("#ed-top-titolo", vistaEl); if (t) t.textContent = trim(S.pack.titolo) || "Pacchetto senza titolo";
    var st = $("#ed-top-stato", vistaEl);
    if (st) st.innerHTML = S.meta.versione ? "versione " + esc(S.meta.versione) + (S.meta.sporco ? " · <b>modifiche non salvate</b>" : " · ✓ salvato e in uso") : (vuoto() ? "nuovo, ancora vuoto" : "<b>non ancora salvato</b>");
    var idc = $("#ed-id", vistaEl); if (idc) idc.textContent = idPacchetto();
    if (S.tab === "controlla") {
      // la scheda di controllo si ridisegna intera, ma solo se non si sta scrivendo dentro
      var p = $(".ed-pannello", vistaEl); if (p && !p.contains(document.activeElement)) p.innerHTML = tabControlla();
    }
    return r;
  }

  /* ------------------------------------------------------------------ eventi */
  function collega(el) {
    el.addEventListener("input", function (ev) {
      var t = ev.target, f = t.getAttribute && t.getAttribute("data-f"); if (!f || !S) return;
      var tipo = t.getAttribute("data-tipo"), v = t.value;
      if (tipo === "num") v = t.type === "radio" ? +v : (v === "" ? "" : parseInt(v, 10));
      else if (tipo === "lista") v = v.split(",").map(trim).filter(function (x) { return x; });
      else if (tipo === "perc") { v = (+v) / 100; var sv = $("#ed-soglia-v", el); if (sv) sv.textContent = Math.round(v * 100) + "%"; }
      else if (tipo === "bool") v = !!t.checked;
      metti(f, v);
      // anteprime che seguono la scrittura
      var md = $('[data-md="' + f + '"]', el); if (md) md.innerHTML = PD.md(v);
      var dm = f.match(/^(domande\.\d+)\./);
      if (dm) {
        var r = $('[data-md="' + dm[1] + '.risposta"]', el); if (r) r.innerHTML = PD.md(unisciRisposta(prendi(dm[1])));
        var som = $('[data-sommario="' + dm[1] + '"]', el); if (som && /\.domanda$/.test(f)) som.textContent = trim(v) || "Nuova domanda";
      }
      if (/^prove\.0\.domande_per_prova$/.test(f)) { var np = $("#ed-npp", el), nq = S.pack.prove[0].domande.length; if (np) np.textContent = "Avete scritto " + contaTesto(nq, "domanda", "domande") + (nq && v > nq ? ": ne verranno usate " + nq : "") + "."; }
      if (/\._riquadri\.\d+$/.test(f)) { var lv = $('[data-lavagna="' + f.replace(/\._riquadri\.\d+$/, "") + '"]', el); if (lv && !lv.hidden) mostraSchema(f.replace(/\._riquadri\.\d+$/, "")); }
      sporca();
    });
    el.addEventListener("change", function (ev) {
      var t = ev.target;
      if (t.id === "ed-file") return apriFile(t);
      var f = t.getAttribute && t.getAttribute("data-f");
      if (f && t.getAttribute("data-tipo") === "bool") { metti(f, !!t.checked); sporca(); disegna(); return; }
      if (f && t.tagName === "SELECT") { metti(f, t.value); sporca(); return; }
      if (f && t.type === "radio") { metti(f, +t.value); sporca(); return; }
      // domanda scritta e parole chiave ancora vuote: le proponiamo noi
      var m = f && f.match(/^domande\.(\d+)\.domanda$/);
      if (m) { var d = S.pack.domande[+m[1]]; if (!(d.parole_chiave || []).length) { suggerisci(+m[1]); } }
    });
    el.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("button, [data-tab]") : null; if (!b || !S) return;
      var a = b.getAttribute("data-act"), lista = b.getAttribute("data-lista"), i = +b.getAttribute("data-i");
      if (b.getAttribute("data-tab")) { S.tab = b.getAttribute("data-tab"); if (S.tab !== "lezioni") S.lez = -1; chiudiAnteprima(); disegna(); return; }
      if (b.getAttribute("data-modello")) return usaModello(b.getAttribute("data-modello"));
      if (b.getAttribute("data-icona")) {
        metti(b.getAttribute("data-per"), b.getAttribute("data-icona"));
        $$(".ed-ico", b.parentNode).forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
        sporca(); return;
      }
      if (b.getAttribute("data-fmt")) return formatta(b);
      if (b.getAttribute("data-lez")) { S.lez = +b.getAttribute("data-lez"); disegna(); window.scrollTo(0, 0); return; }
      if (b.getAttribute("data-apri")) return conferma(b, function () { apriInstallato(b.getAttribute("data-apri")); });
      if (b.getAttribute("data-rimuovi")) return conferma(b, function () { rimuovi(b.getAttribute("data-rimuovi")); });
      if (b.getAttribute("data-scarica-pack")) { var en = installato(b.getAttribute("data-scarica-pack")); if (en) scaricaJSON(en.pacchetto); return; }
      if (b.getAttribute("data-vai")) return vaiA(b.getAttribute("data-vai"), b.getAttribute("data-vai-tab"));
      if (b.getAttribute("data-ap-step") != null || b.getAttribute("data-ap-o") != null || b.id === "ed-ap-chiudi" || b.getAttribute("data-ap-next") != null) return;
      if (!a) return;
      var arr = lista ? prendi(lista) : null;
      switch (a) {
        case "salva": return salvaEUsa();
        case "scarica": return scaricaBozza();
        case "nuovo": return conferma(b, function () { S = nuovoStato(); esitoSalva = ""; salvaBozza(); disegna(); }, vuoto() || !S.meta.sporco);
        case "apri-altro": var sel = $("#ed-altri", el); if (sel && sel.value) conferma(b, function () { apriInstallato(sel.value); }); return;
        case "su": case "giu":
          var j = a === "su" ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return;
          var x = arr[i]; arr[i] = arr[j]; arr[j] = x;
          sporca(); disegna(); return;
        case "elimina": return conferma(b, function () { arr.splice(i, 1); if (lista === "lezioni") S.lez = -1; sporca(); disegna(); });
        case "nuova-lezione": S.pack.lezioni.push(nuovaLezione()); S.lez = S.pack.lezioni.length - 1; sporca(); disegna(); window.scrollTo(0, 0); return;
        case "elenco-lezioni": S.lez = -1; chiudiAnteprima(); disegna(); return;
        case "copia-lezione": return copiaLezione($("#ed-copia-lez", el).value);
        case "passo": arr.push({ titolo: "", testo: "", consiglio: "", schema: "", _riquadri: [] }); sporca(); disegna(); fuoco(lista + "." + (arr.length - 1) + ".titolo"); return;
        case "domanda-quiz": arr.push(nuovaDomandaQuiz()); sporca(); disegna(); fuoco(lista + "." + (arr.length - 1) + ".domanda"); return;
        case "opz": if (arr.length < (/_passi$/.test(lista) ? 20 : 4)) { arr.push(""); sporca(); disegna(); fuoco(lista + "." + (arr.length - 1)); } return;
        case "togliopz":
          arr.splice(i, 1);
          var q = prendi(lista.replace(/\.opzioni$/, ""));
          if (/\.opzioni$/.test(lista) && q) { if (q.corretta === i) q.corretta = 0; else if (q.corretta > i) q.corretta--; }
          sporca(); disegna(); return;
        case "aggiungi-schema": prendi(b.getAttribute("data-per"))._riquadri = ["", "", ""]; sporca(); disegna(); fuoco(b.getAttribute("data-per") + "._riquadri.0"); return;
        case "box": if (arr.length < 6) { arr.push(""); sporca(); disegna(); fuoco(lista + "." + (arr.length - 1)); } return;
        case "togli-box": arr.splice(i, 1); sporca(); disegna(); return;
        case "togli-schema": var s = prendi(b.getAttribute("data-per")); s._riquadri = []; s.schema = ""; sporca(); disegna(); return;
        case "vedi-schema": return mostraSchema(b.getAttribute("data-per"));
        case "nuova-domanda":
          S.pack.domande.push({ domanda: "", parole_chiave: [], _testo: "", _passi: [] }); S.apriDom = S.pack.domande.length - 1; sporca(); disegna(); fuoco("domande." + (S.pack.domande.length - 1) + ".domanda"); return;
        case "suggerisci": suggerisci(i, true); return;
        case "crea-prova": S.pack.prove.push(nuovaProva()); sporca(); disegna(); return;
        case "togli-prova": return conferma(b, function () { S.pack.prove = []; sporca(); disegna(); });
        case "anteprima-lezione": return anteprimaLezione(i, 0);
        case "anteprima-quiz": return anteprimaQuiz(0);
      }
    });
  }
  /* pulsanti delicati: il primo clic chiede conferma, il secondo esegue (niente finestre di dialogo) */
  function conferma(b, fn, subito) {
    if (subito || b.getAttribute("data-sicuro")) { b.removeAttribute("data-sicuro"); fn(); return; }
    var prima = b.innerHTML; b.setAttribute("data-sicuro", "1"); b.innerHTML = "Sicuri? Premete di nuovo";
    setTimeout(function () { if (b.getAttribute("data-sicuro")) { b.removeAttribute("data-sicuro"); b.innerHTML = prima; } }, 4000);
  }
  /* porta il cursore nel campo nuovo, ma solo se nel frattempo non si è già cliccato altrove */
  function fuoco(f) {
    var prima = document.activeElement;
    setTimeout(function () {
      var x = vistaEl && $('[data-f="' + f + '"]', vistaEl), ora = document.activeElement;
      if (x && (ora === prima || ora === document.body || !vistaEl.contains(ora))) x.focus();
    }, 30);
  }
  function vaiA(f, tab) {
    S.tab = tab || "pacchetto";
    var m = f.match(/^lezioni\.(\d+)/); S.lez = m && tab === "lezioni" ? +m[1] : -1;
    var d = f.match(/^domande\.(\d+)/); if (d) S.apriDom = +d[1];
    disegna();
    setTimeout(function () {
      var x = $('[data-f="' + f + '"]', vistaEl) || $('[data-err="' + f + '"]', vistaEl) || $('[data-f^="' + f + '"]', vistaEl);
      if (x) { var det = x.closest("details"); if (det) det.open = true; if (x.scrollIntoView) x.scrollIntoView({ block: "center" }); if (x.focus) x.focus(); }
    }, 30);
  }

  /* aiuti di formattazione: grassetto, elenco numerato, elenco puntato */
  function formatta(b) {
    var ta = document.getElementById(b.getAttribute("data-per")); if (!ta) return;
    var tipo = b.getAttribute("data-fmt"), v = ta.value, a = ta.selectionStart || 0, z = ta.selectionEnd || 0;
    if (tipo === "b") {
      var sel = v.slice(a, z) || "testo importante";
      ta.value = v.slice(0, a) + "**" + sel + "**" + v.slice(z);
      ta.setSelectionRange(a + 2, a + 2 + sel.length);
    } else {
      var ini = v.lastIndexOf("\n", a - 1) + 1, fine = v.indexOf("\n", z); if (fine < 0) fine = v.length;
      var righe = v.slice(ini, fine).split("\n"), n = 0;
      var nuove = righe.map(function (r) {
        var pulita = r.replace(/^\s*(\d+[.)]|[-*•])\s+/, "");
        if (!trim(pulita) && righe.length > 1) return r;
        n++; return (tipo === "ol" ? n + ". " : "- ") + pulita;
      }).join("\n");
      ta.value = v.slice(0, ini) + nuove + v.slice(fine);
      ta.setSelectionRange(ini + nuove.length, ini + nuove.length);
    }
    ta.focus();
    var e; try { e = new Event("input", { bubbles: true }); } catch (x) { e = document.createEvent("Event"); e.initEvent("input", true, true); }
    ta.dispatchEvent(e);
  }

  /* parole chiave suggerite dalle parole della domanda */
  function chiaviDa(testo) {
    var w = String(testo || "").toLowerCase().replace(/[^a-zà-ÿ0-9' ]+/g, " ").replace(/'/g, " ").split(/\s+/)
      .filter(function (x) { return x.length > 2 && !STOPSET[x]; });
    var out = [];
    w.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    if (w.length >= 2) out.push(w[0] + " " + w[1]);
    return out.slice(0, 8);
  }
  function suggerisci(i, avvisa) {
    var d = S.pack.domande[i]; if (!d) return;
    var vecchie = (d.parole_chiave || []).slice(), nuove = chiaviDa(d.domanda);
    nuove.forEach(function (k) { if (vecchie.indexOf(k) < 0 && vecchie.length < 8) vecchie.push(k); });
    d.parole_chiave = vecchie;
    var inp = $('[data-f="domande.' + i + '.parole_chiave"]', vistaEl); if (inp) inp.value = vecchie.join(", ");
    sporca();
    if (avvisa) PD.toast(nuove.length ? "✨ Parole chiave suggerite: controllatele e aggiungete quelle che usano i vostri allievi." : "Scrivete prima la domanda: le parole chiave si prendono da lì.");
    aggiornaControlli();
  }

  /* ------------------------------------------------------------------ anteprima (come la vedrà l'allievo) */
  function chiudiAnteprima() { var a = vistaEl && $("#ed-anteprima", vistaEl); if (a) a.innerHTML = ""; }
  function apriAnteprima(html) {
    var a = $("#ed-anteprima", vistaEl);
    a.innerHTML = '<div class="ed-ap" role="region" aria-label="Anteprima"><div class="ed-ap-barra"><b>👁 Anteprima: così la vedrà l\'allievo</b><button class="btn" id="ed-ap-chiudi">✕ Chiudi l\'anteprima</button></div>' +
      '<div class="ed-ap-corpo">' + html + "</div></div>";
    $("#ed-ap-chiudi", a).onclick = chiudiAnteprima;
    if (a.scrollIntoView) a.scrollIntoView({ block: "start" });
    return a;
  }
  function anteprimaLezione(i, idx) {
    var pack = costruisci(), L = (pack.lezioni || [])[i]; if (!L) return;
    var n = L.passi.length, quiz = idx === "quiz";
    var head = '<div class="lesson-head"><span class="big-ico">' + esc(L.icona) + '</span><div><div class="small muted">' + esc(L.livello) + " · circa " + L.minuti + " minuti</div><h1>" + esc(L.titolo || "Lezione senza titolo") + "</h1></div></div>" +
      '<div class="stepper">' + L.passi.map(function (s, k) { return '<button data-ap-step="' + k + '"' + (k === idx ? ' aria-current="step"' : "") + ">" + (k + 1) + "</button>"; }).join("") +
      '<button data-ap-step="quiz"' + (quiz ? ' aria-current="step"' : "") + ' title="Quiz finale">?</button></div>';
    var body;
    if (quiz) {
      body = '<div class="card"><h2 style="margin-top:0">✓ Quiz finale</h2>' + (L.quiz.length ? L.quiz.map(function (q, qi) {
        return '<div class="quiz-q" data-ap-q="' + qi + '"><h3>' + (qi + 1) + ". " + esc(q.domanda) + "</h3>" + q.opzioni.map(function (o, oi) { return '<button class="quiz-opt" data-ap-o="' + oi + '">' + esc(o) + "</button>"; }).join("") + '<div class="explain"></div></div>';
      }).join("") : '<p class="muted">Questa lezione non ha ancora domande di quiz.</p>') + "</div>";
    } else {
      var st = L.passi[idx] || { titolo: "", testo: "" };
      body = '<div class="lesson-body' + (st.schema ? "" : " nodiag") + '"><article class="card step-text"><h2>' + (idx + 1) + ". " + esc(st.titolo) + "</h2>" + PD.md(st.testo) +
        (st.consiglio ? '<div class="tip">💡 ' + esc(st.consiglio) + "</div>" : "") + "</article>" + (st.schema ? '<div class="chalkboard" id="ed-ap-board"></div>' : "") + "</div>" +
        '<div class="lesson-nav">' + (idx > 0 ? '<button class="btn ghost big" data-ap-step="' + (idx - 1) + '">← Indietro</button>' : "<span></span>") +
        (idx < n - 1 ? '<button class="btn big" data-ap-step="' + (idx + 1) + '">Avanti →</button>' : '<button class="btn big" data-ap-step="quiz">Al quiz finale ✓</button>') + "</div>";
    }
    var a = apriAnteprima(head + body);
    if (!quiz && L.passi[idx] && L.passi[idx].schema) PD.renderDiagram($("#ed-ap-board", a), L.passi[idx].schema, L.passi[idx].titolo);
    $(".ed-ap-corpo", a).onclick = function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.getAttribute("data-ap-step") != null) { var v = b.getAttribute("data-ap-step"); anteprimaLezione(i, v === "quiz" ? "quiz" : +v); return; }
      if (b.getAttribute("data-ap-o") != null && !b.disabled) {
        var qd = b.closest(".quiz-q"), q = L.quiz[+qd.getAttribute("data-ap-q")], oi = +b.getAttribute("data-ap-o");
        $$(".quiz-opt", qd).forEach(function (x) { x.disabled = true; if (+x.getAttribute("data-ap-o") === q.corretta) x.classList.add("right"); });
        if (oi !== q.corretta) b.classList.add("wrong");
        $(".explain", qd).innerHTML = (oi === q.corretta ? "✅ <b>Esatto!</b> " : "❌ <b>Non proprio.</b> ") + esc(q.spiegazione);
      }
    };
  }
  function anteprimaQuiz(k) {
    var pack = costruisci(), P = (pack.prove || [])[0]; if (!P) return;
    var q = P.domande[k];
    var html = '<div class="lesson-head"><span class="big-ico">' + esc(P.icona) + '</span><div><div class="small muted">Grande quiz · ' + P.domande_per_prova + " domande a tentativo · soglia " + Math.round(P.soglia * 100) + "%" +
      (P.senza_attestato ? " · senza attestato" : " · con attestato") + "</div><h1>" + esc(P.titolo || "Grande quiz") + "</h1></div></div>" +
      (P.descrizione ? "<p>" + esc(P.descrizione) + "</p>" : "") +
      (q ? '<div class="card quiz-run"><div class="small muted">Domanda ' + (k + 1) + " di " + P.domande.length + (q.categoria ? " · " + esc(q.categoria) : "") + '</div><div class="quiz-q"><h3>' + esc(q.domanda) + "</h3>" +
        q.opzioni.map(function (o, oi) { return '<button class="quiz-opt" data-ap-o="' + oi + '"><span class="lett">' + "ABCDEF".charAt(oi) + "</span> " + esc(o) + "</button>"; }).join("") +
        '<div class="explain"></div></div>' + (k + 1 < P.domande.length ? '<button class="btn" data-ap-next="' + (k + 1) + '">Domanda successiva →</button>' : '<p class="small muted">Fine delle domande.</p>') + "</div>"
        : '<p class="muted">Aggiungete le domande per vedere l\'anteprima.</p>');
    var a = apriAnteprima(html);
    $(".ed-ap-corpo", a).onclick = function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      if (b.getAttribute("data-ap-next") != null) return anteprimaQuiz(+b.getAttribute("data-ap-next"));
      if (b.getAttribute("data-ap-o") != null && !b.disabled) {
        var oi = +b.getAttribute("data-ap-o");
        $$(".quiz-opt", a).forEach(function (x) { x.disabled = true; if (+x.getAttribute("data-ap-o") === q.corretta) x.classList.add("right"); });
        if (oi !== q.corretta) b.classList.add("wrong");
        $(".explain", a).innerHTML = (oi === q.corretta ? "✅ <b>Esatto!</b> " : "❌ <b>Non proprio.</b> ") + esc(q.spiegazione);
      }
    };
  }
  function mostraSchema(w) {
    var lv = $('[data-lavagna="' + w + '"]', vistaEl), s = prendi(w); if (!lv || !s) return;
    var code = (s._riquadri || []).length ? mermaid(s._riquadri) : trim(s.schema);
    lv.hidden = false;
    if (!code) { lv.innerHTML = '<div class="empty">Scrivete almeno 2 riquadri per vedere lo schema.</div>'; return; }
    PD.renderDiagram(lv, code, trim(s.titolo) || "Schema");
  }

  /* ------------------------------------------------------------------ aprire, salvare, scaricare */
  function caricaPacchetto(p, comeCopia) {
    p = copia(p);
    var meta = { idFisso: true, versione: p.versione || "", sporco: false };
    if (p.creato_con === MARCA) delete p.suggerimenti;   // si ricalcolano dalle domande
    if (comeCopia) {
      meta = { idFisso: false, versione: "", sporco: true };
      p.titolo = (p.titolo || "") + " (copia)"; p.id = "";
      (p.lezioni || []).forEach(function (L) { L.id = ""; });
      (p.prove || []).forEach(function (P) { P.id = ""; });
      p.autore = (PD.settings && PD.settings.teacherName) || p.autore || "";
    }
    delete p.versione; delete p.richiede_app;
    S = nuovoStato(normalizza(p), meta);
    esitoSalva = ""; salvaBozza(); disegna();
  }
  function apriInstallato(id) {
    var en = installato(id); if (!en) return;
    caricaPacchetto(en.pacchetto, !mio(en) && en.origine !== "utente");
    PD.toast(mio(en) || en.origine === "utente" ? "✏️ Pacchetto aperto: modificate e poi premete «Salva e usa»." : "📋 Ho aperto una copia: l'originale non cambia.");
  }
  function apriFile(input) {
    var f = input.files && input.files[0], out = $("#ed-apri-esito", vistaEl); if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      input.value = "";
      var p;
      try { p = JSON.parse(String(r.result || "")); } catch (e) { out.innerHTML = '<div class="notice">Questo file non è un pacchetto del Professore Digitale (non si riesce a leggere).</div>'; return; }
      var er = PD.packs.validate(p).filter(function (x) { return !/^richiede_app/.test(x); });
      if (!p || p.formato !== "professore-digitale-contenuti") { out.innerHTML = '<div class="notice">Questo file non è un pacchetto del Professore Digitale.</div>'; return; }
      var en = installato(p.id), sistema = en && en.origine !== "utente";
      caricaPacchetto(p, sistema);
      PD.toast(sistema ? "📋 Questo pacchetto è incluso nel programma: ne ho aperto una copia." : "✏️ File aperto: modificate e poi premete «Salva e usa».", 5000);
      if (er.length) { S.tab = "controlla"; disegna(); }
    };
    r.onerror = function () { out.innerHTML = '<div class="notice">Non sono riuscito a leggere il file.</div>'; };
    r.readAsText(f);
  }
  function copiaLezione(id) {
    var L = (window.PD_LESSONS || []).filter(function (x) { return x.id === id; })[0]; if (!L) return;
    var nuova = normalizzaLezione({
      id: "", icona: L.icon || "📘", titolo: L.title, obiettivo: L.goal || "", minuti: L.minutes || 15, palestra: L.practice || "",
      passi: L.steps.map(function (s) { return { titolo: s.t, testo: s.x, schema: s.d || "", consiglio: s.tip || "" }; }),
      quiz: (L.quiz || []).map(function (q) { return { domanda: q.q, opzioni: q.o.slice(), corretta: q.a, spiegazione: q.e }; })
    });
    S.pack.lezioni.push(nuova); S.lez = S.pack.lezioni.length - 1; sporca(); disegna();
    PD.toast("📋 Lezione copiata: adattatela ai vostri allievi. L'originale non cambia.");
  }
  function normalizzaLezione(L) { var p = { lezioni: [L], domande: [], prove: [] }; normalizza(p); return p.lezioni[0]; }

  function salvaEUsa() {
    var r = controlla();
    if (r.errori.length) { S.tab = "controlla"; S.lez = -1; disegna(); PD.toast("Prima di salvare ci sono " + r.errori.length + " cose da sistemare: le trovate qui sotto."); return; }
    var pid = idPacchetto(), en = installato(pid), base = S.meta.versione || "";
    if (en && mio(en) && (!base || cmp(en.pacchetto.versione, base) > 0)) base = en.pacchetto.versione;
    var ver = base ? bump(base) : "1.0.0", pack = costruisci(ver);
    $$('[data-act="salva"]', vistaEl).forEach(function (b) { b.disabled = true; b.textContent = "Salvataggio…"; });
    PD.packs.importText(JSON.stringify(pack)).then(function () {
      // da ora il nome tecnico e gli id delle lezioni restano fissi (i progressi degli allievi dipendono da essi)
      S.pack.id = pack.id; S.meta.idFisso = true; S.meta.versione = ver; S.meta.sporco = false;
      (pack.lezioni || []).forEach(function (L, i) { S.pack.lezioni[i].id = L.id; });
      (pack.prove || []).forEach(function (P, i) { S.pack.prove[i].id = P.id; });
      salvaBozza();
      var lez = pack.lezioni || [];
      esitoSalva = '<div class="notice ok" id="ed-salvato"><b>🎉 Salvato e già in uso!</b> «' + esc(pack.titolo) + "», versione " + esc(ver) + "." +
        (lez.length ? '<div class="row" style="margin-top:.6rem">' + lez.slice(0, 6).map(function (L) { return '<button class="btn" data-go="#/lessons/' + esc(L.id) + '">' + esc(L.icona) + " Apri «" + esc(L.titolo) + "»</button>"; }).join("") + "</div>" : "") +
        '<div class="row" style="margin-top:.6rem">' + ((pack.domande || []).length ? '<button class="btn ghost" data-go="#/ask">💬 Provate a chiedere al Professore</button>' : "") +
        ((pack.prove || []).length ? '<button class="btn ghost" data-go="#/quiz/' + esc(pack.prove[0].id) + '">🏆 Apri il grande quiz</button>' : "") + "</div>" +
        (PD.server ? "" : '<p class="small">Versione portatile: il pacchetto vale solo in questo browser. Scaricate il file per usarlo su altri computer.</p>') + "</div>";
      S.tab = "controlla"; S.lez = -1; disegna();
      PD.toast("💾 Salvato: le nuove lezioni sono già nell'elenco.");
    }).catch(function (e) {
      esitoSalva = '<div class="notice"><b>Non sono riuscito a salvare.</b> ' + esc(e.message || e) + "</div>";
      S.tab = "controlla"; disegna();
    });
  }
  function nomeFile(p) { return (p.id || "pacchetto") + "-" + (p.versione || "1.0.0") + ".json"; }
  function scaricaJSON(p) {
    var testo = JSON.stringify(p, null, 1), blob = new Blob([testo], { type: "application/json" });
    if (PD.download) PD.download(blob, nomeFile(p));
    else { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nomeFile(p); document.body.appendChild(a); a.click(); a.parentNode.removeChild(a); }
    PD.toast("⬇️ File «" + nomeFile(p) + "» nella cartella Download. Si importa da Impostazioni → Contenuti aggiuntivi.", 5000);
  }
  function scaricaBozza() {
    var r = controlla();
    scaricaJSON(costruisci(S.meta.versione || "1.0.0"));
    if (r.errori.length) PD.toast("⬇️ File scaricato, ma il pacchetto ha ancora " + r.errori.length + " cose da sistemare: senza correzioni non si può importare.", 6000);
  }
  function rimuovi(id) {
    PD.packs.remove(id).then(function () {
      if (S.pack.id === id) { S.meta.versione = ""; S.meta.sporco = true; S.meta.idFisso = false; salvaBozza(); }
      PD.toast("🗑 Pacchetto rimosso. Le sue lezioni non compaiono più."); disegna();
    }).catch(function (e) { PD.toast("Non sono riuscito a rimuoverlo: " + e.message); });
  }

  /* ------------------------------------------------------------------ modelli pronti */
  function usaModello(nome) {
    if (nome === "vuoto") { S.pack.titolo = S.pack.titolo || ""; S.tab = "pacchetto"; disegna(); fuoco("titolo"); return; }
    var p = nome === "comune" ? modelloComune() : modelloAssociazione();
    S = nuovoStato(normalizza(p), { idFisso: false, versione: "", sporco: true });
    esitoSalva = ""; salvaBozza(); S.tab = "lezioni"; disegna();
    PD.toast("🚀 Modello pronto: sostituite le parti tra [parentesi] con i vostri dati.", 5000);
  }
  function qz(d, o, c, e) { return { domanda: d, opzioni: o, corretta: c, spiegazione: e }; }
  function modelloComune() {
    return {
      formato: "professore-digitale-contenuti", formato_versione: 1, id: "", titolo: "Servizi del nostro Comune",
      descrizione: "Come prenotare allo sportello e usare il sito del Comune di [nome del Comune].", autore: PD.settings.teacherName || "",
      lezioni: [{ id: "", icona: "🏛️", titolo: "Prenotare allo sportello del Comune", minuti: 20, palestra: "click",
        obiettivo: "Sapere dove andare, prenotare un appuntamento e usare il sito del Comune senza paura.",
        passi: [
          { titolo: "Dove si trova lo sportello", testo: "L'ufficio si trova in **[indirizzo dell'ufficio]**.\nÈ aperto **[giorni e orari di apertura]**.\n\nPortate con voi:\n- un documento d'identità;\n- la tessera sanitaria;\n- [altri documenti utili].",
            consiglio: "Prima di andare, controllate gli orari sul sito ufficiale del Comune: possono cambiare.", schema: "" },
          { titolo: "Prenotare un appuntamento dal sito", testo: "1. Aprite il sito del Comune: **[indirizzo del sito]**.\n2. Cercate la voce **[nome della voce, es. Prenota un appuntamento]**.\n3. Scegliete il servizio, il giorno e l'ora.\n4. Scrivete nome, cognome e un recapito.\n5. Confermate e annotate il **codice della prenotazione**.",
            consiglio: "Se qualcosa non è chiaro, chiedete a una persona di fiducia o al facilitatore.", schema: "",
            _riquadri: ["Apro il sito del Comune", "Prenota un appuntamento", "Scelgo giorno e ora", "Confermo e annoto il codice"] },
          { titolo: "Usare il sito del Comune con prudenza", testo: "Sul sito trovate orari, moduli da scaricare e notizie.\nPer alcuni servizi serve l'**identità digitale** (per esempio lo SPID o la carta d'identità elettronica).\n\n**Attenzione**: l'indirizzo vero del sito è **[indirizzo esatto del sito]**. Diffidate dei siti simili e dei messaggi che chiedono soldi o password.",
            consiglio: "Il Comune non vi chiederà mai password o codici per telefono o per messaggio.", schema: "" }
        ],
        quiz: [
          qz("Cosa conviene portare allo sportello?", ["Un documento d'identità e la tessera sanitaria", "Niente, basta il nome", "La password della posta"], 0, "Allo sportello serve sempre un documento d'identità; la password non si dà mai a nessuno."),
          qz("Dopo aver prenotato sul sito, cosa è utile fare?", ["Annotare il codice della prenotazione", "Spegnere subito il computer", "Prenotare altre tre volte"], 0, "Il codice della prenotazione serve se dovete spostare o annullare l'appuntamento.")
        ] }],
      domande: [{ domanda: "Come prenoto un appuntamento in Comune?", parole_chiave: ["prenotare", "appuntamento", "comune", "sportello", "prenotazione"],
        risposta: "Potete prenotare dal sito del Comune di [nome del Comune] oppure andando allo sportello in [indirizzo dell'ufficio]. Sul sito cercate la voce [nome della voce], scegliete il servizio, il giorno e l'ora, poi confermate. Annotate il codice della prenotazione: serve per spostare o annullare l'appuntamento. Se avete dubbi, chiedete al facilitatore.\n\n1. Aprite il sito del Comune.\n2. Scegliete il servizio, il giorno e l'ora.\n3. Confermate e annotate il codice." }],
      prove: []
    };
  }
  function modelloAssociazione() {
    return {
      formato: "professore-digitale-contenuti", formato_versione: 1, id: "", titolo: "La nostra associazione",
      descrizione: "Chi siamo, cosa facciamo e come partecipare alle attività di [nome dell'associazione].", autore: PD.settings.teacherName || "",
      lezioni: [{ id: "", icona: "🤝", titolo: "Chi siamo e cosa facciamo", minuti: 15, palestra: "",
        obiettivo: "Conoscere l'associazione, le sue attività e come partecipare.",
        passi: [
          { titolo: "Chi siamo", testo: "**[Nome dell'associazione]** è nata nel [anno] a [città].\nCi occupiamo di [di cosa si occupa l'associazione].\nLa sede è in **[indirizzo della sede]**.", consiglio: "", schema: "" },
          { titolo: "Le nostre attività", testo: "- [Prima attività, es. corso di computer per principianti]\n- [Seconda attività, es. sportello di aiuto digitale]\n- [Terza attività]\n\nLe attività si svolgono [giorni e orari].", consiglio: "Il calendario aggiornato è affisso in sede.", schema: "" },
          { titolo: "Come partecipare", testo: "1. Venite in sede negli orari di apertura.\n2. Chiedete il modulo di iscrizione.\n3. Scegliete le attività che vi interessano.\n\nPer informazioni scrivete a **[indirizzo email dell'associazione]**.", consiglio: "",
            schema: "", _riquadri: ["Vengo in sede", "Compilo il modulo", "Scelgo le attività", "Partecipo"] }
        ],
        quiz: [
          qz("Dove si trova la sede dell'associazione?", ["In [indirizzo della sede]", "Su un sito sconosciuto", "Non si sa"], 0, "La sede è in [indirizzo della sede]: lì trovate anche il calendario delle attività."),
          qz("Qual è il primo passo per partecipare?", ["Venire in sede negli orari di apertura", "Pagare con un messaggio", "Aspettare una telefonata"], 0, "Si comincia venendo in sede: lì vi danno il modulo e tutte le informazioni.")
        ] }],
      domande: [{ domanda: "Come mi iscrivo all'associazione?", parole_chiave: ["iscrivermi", "iscrizione", "associazione", "partecipare", "modulo"],
        risposta: "Per iscrivervi a [nome dell'associazione] venite in sede, in [indirizzo della sede], negli orari di apertura. Vi daranno un modulo da compilare con i vostri dati e potrete scegliere le attività che vi interessano. Se avete dubbi chiedete pure ai volontari: sono lì per aiutarvi, con calma.\n\n1. Venite in sede.\n2. Compilate il modulo.\n3. Scegliete le attività." }],
      prove: []
    };
  }

  /* ------------------------------------------------------------------ uscita con modifiche non salvate */
  window.addEventListener("beforeunload", function (e) {
    if (S && S.meta.sporco && !vuoto()) { e.preventDefault(); e.returnValue = "La bozza resta salvata nel browser, ma non è ancora in uso."; return e.returnValue; }
  });
  var eraEditor = false;
  window.addEventListener("hashchange", function () {
    var ora = /^#\/editor/.test(location.hash);
    if (eraEditor && !ora && S && S.meta.sporco && !vuoto()) PD.toast("📝 Modifiche non ancora salvate: la bozza vi aspetta in «Crea lezioni e quiz». Ricordatevi di premere «Salva e usa».", 6000);
    if (!ora) chiudiAnteprima();
    eraEditor = ora;
  });
  var prev = PD.onReady;
  PD.onReady = function () { if (prev) prev(); eraEditor = /^#\/editor/.test(location.hash); };

  /* per i test e per chi integra */
  PD.editor = {
    stato: function () { carica(); return S; },
    costruisci: function () { carica(); return costruisci(); },
    controlla: function () { carica(); return controlla(); },
    azzera: function () { S = nuovoStato(); esitoSalva = ""; lsSet(null); if (vistaEl && /^#\/editor/.test(location.hash)) disegna(); },
    mermaid: mermaid, chiaviDa: chiaviDa
  };
})();
