/* Professore Digitale - Pacchetti di contenuti (domande e lezioni aggiuntive)
 * Autore: Danilo D'Auria - Licenza MIT
 * Formato: vedi pd_packs.py (stesse regole di validazione, lato browser). */
(function () {
  "use strict";
  var PD = window.PD;
  var FORMATO = "professore-digitale-contenuti";
  var RE_ID = /^[a-z0-9][a-z0-9-]{1,48}$/, RE_VER = /^\d+\.\d+(\.\d+)?$/;
  var PALESTRA = ["", "click", "dblclick", "drag", "typing", "scroll", "rightclick", "copypaste", "select", "keys", "memory", "scam"];
  var LS_KEY = "pd.packs";

  var base = { kb: (window.PD_KB || []).slice(), lessons: (window.PD_LESSONS || []).slice() };

  function vt(v) { var p = String(v || "").match(/\d+/g) || []; return [+(p[0] || 0), +(p[1] || 0), +(p[2] || 0)]; }
  function cmp(a, b) { a = vt(a); b = vt(b); for (var i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1; return 0; }
  PD.cmpVersion = cmp;

  function validate(p) {
    var e = [];
    function add(d, m) { if (e.length < 50) e.push(d + ": " + m); }
    function txt(o, k, d, req, max) {
      var v = o[k];
      if (v == null || v === "") { if (req) add(d + "." + k, "manca"); return; }
      if (typeof v !== "string") add(d + "." + k, "deve essere un testo");
      else if (v.length > max) add(d + "." + k, "troppo lungo (max " + max + " caratteri)");
    }
    if (!p || typeof p !== "object" || Array.isArray(p)) return ["il file non contiene un oggetto JSON"];
    if (p.formato !== FORMATO) add("formato", 'deve essere "' + FORMATO + '"');
    if (p.formato_versione !== 1) add("formato_versione", "deve essere 1");
    if (typeof p.id !== "string" || !RE_ID.test(p.id)) add("id", "solo lettere minuscole, cifre e trattini (2-49 caratteri)");
    txt(p, "titolo", "pacchetto", true, 120);
    txt(p, "licenza", "pacchetto", false, 200);   // dalla 3.5.2, es. "CC BY-NC-SA 4.0" (come pd_packs.py)
    if (typeof p.versione !== "string" || !RE_VER.test(p.versione)) add("versione", "formato atteso tipo 1.0.0");
    if (p.richiede_app) {
      if (!RE_VER.test(p.richiede_app)) add("richiede_app", "formato atteso tipo 2.1.0");
      else if (PD.version && cmp(p.richiede_app, PD.version) > 0) add("richiede_app", "serve il Professore Digitale " + p.richiede_app + " o successivo (installato: " + PD.version + ")");
    }
    var sug = p.suggerimenti || [];
    if (!Array.isArray(sug) || sug.length > 40 || !sug.every(function (s) { return typeof s === "string" && s.length > 0 && s.length <= 120; })) add("suggerimenti", "elenco di testi brevi (max 40)");
    var dom = p.domande || [], lez = p.lezioni || [];
    if (!Array.isArray(dom)) { add("domande", "deve essere un elenco"); dom = []; }
    if (!Array.isArray(lez)) { add("lezioni", "deve essere un elenco"); lez = []; }
    var pr = p.prove || [];
    if (!Array.isArray(pr)) { add("prove", "deve essere un elenco"); pr = []; }
    if (!dom.length && !lez.length && !pr.length) add("pacchetto", "serve almeno una domanda, una lezione o una prova");
    if (pr.length > 20) add("prove", "troppe (max 20)");
    if (dom.length > 2000) add("domande", "troppe (max 2000)");
    if (lez.length > 200) add("lezioni", "troppe (max 200)");
    dom.slice(0, 2000).forEach(function (d, i) {
      var w = "domande[" + i + "]";
      if (!d || typeof d !== "object") return add(w, "deve essere un oggetto");
      txt(d, "domanda", w, true, 300); txt(d, "risposta", w, true, 5000); txt(d, "schema", w, false, 3000); txt(d, "lezione", w, false, 60);
      var k = d.parole_chiave;
      if (!Array.isArray(k) || !k.length || k.length > 40 || !k.every(function (x) { return typeof x === "string" && x.length > 0 && x.length <= 60; }))
        add(w + ".parole_chiave", "elenco di 1-40 parole o brevi frasi");
    });
    var ids = {};
    lez.slice(0, 200).forEach(function (L, i) {
      var w = "lezioni[" + i + "]";
      if (!L || typeof L !== "object") return add(w, "deve essere un oggetto");
      if (typeof L.id !== "string" || !RE_ID.test(L.id)) add(w + ".id", "solo lettere minuscole, cifre e trattini");
      else if (ids[L.id]) add(w + ".id", "ripetuto");
      ids[L.id] = 1;
      txt(L, "titolo", w, true, 120); txt(L, "obiettivo", w, false, 400); txt(L, "livello", w, false, 40); txt(L, "icona", w, false, 16);
      var m = L.minuti == null ? 15 : L.minuti;
      if (typeof m !== "number" || m % 1 !== 0 || m < 1 || m > 240) add(w + ".minuti", "numero intero tra 1 e 240");
      if (PALESTRA.indexOf(L.palestra == null ? "" : L.palestra) < 0) add(w + ".palestra", "uno tra: " + PALESTRA.slice(1).join(", "));
      var ps = L.passi;
      if (!Array.isArray(ps) || ps.length < 1 || ps.length > 30) { add(w + ".passi", "elenco di 1-30 passi"); ps = []; }
      ps.forEach(function (s, j) {
        var ww = w + ".passi[" + j + "]";
        if (!s || typeof s !== "object") return add(ww, "deve essere un oggetto");
        txt(s, "titolo", ww, true, 120); txt(s, "testo", ww, true, 5000); txt(s, "schema", ww, false, 3000); txt(s, "consiglio", ww, false, 400);
      });
      var qz = L.quiz || [];
      if (!Array.isArray(qz) || qz.length > 20) { add(w + ".quiz", "elenco di al massimo 20 domande"); qz = []; }
      qz.forEach(function (q, j) {
        var ww = w + ".quiz[" + j + "]";
        if (!q || typeof q !== "object") return add(ww, "deve essere un oggetto");
        txt(q, "domanda", ww, true, 300); txt(q, "spiegazione", ww, true, 600);
        var op = q.opzioni;
        if (!Array.isArray(op) || op.length < 2 || op.length > 6 || !op.every(function (x) { return typeof x === "string" && x; })) { add(ww + ".opzioni", "elenco di 2-6 risposte"); op = []; }
        if (typeof q.corretta !== "number" || q.corretta % 1 !== 0 || q.corretta < 0 || q.corretta >= Math.max(1, op.length)) add(ww + ".corretta", "numero della risposta giusta, contando da 0");
      });
    });
    var pids = {};
    pr.slice(0, 20).forEach(function (P, i) {
      var w = "prove[" + i + "]";
      if (!P || typeof P !== "object") return add(w, "deve essere un oggetto");
      if (typeof P.id !== "string" || !RE_ID.test(P.id)) add(w + ".id", "solo lettere minuscole, cifre e trattini");
      else if (pids[P.id]) add(w + ".id", "ripetuto");
      pids[P.id] = 1;
      txt(P, "titolo", w, true, 120); txt(P, "icona", w, false, 16); txt(P, "descrizione", w, false, 600); txt(P, "attestato", w, false, 120);
      var n = P.domande_per_prova == null ? 20 : P.domande_per_prova;
      if (typeof n !== "number" || n % 1 !== 0 || n < 5 || n > 100) add(w + ".domande_per_prova", "numero intero tra 5 e 100");
      var sg = P.soglia == null ? 0.7 : P.soglia;
      if (typeof sg !== "number" || sg < 0.5 || sg > 1) add(w + ".soglia", "numero tra 0.5 e 1 (es. 0.7 = 70%)");
      var dd = P.domande;
      if (!Array.isArray(dd) || dd.length < 5 || dd.length > 1000) { add(w + ".domande", "elenco di 5-1000 domande"); dd = []; }
      dd.forEach(function (q, j) {
        var ww = w + ".domande[" + j + "]";
        if (!q || typeof q !== "object") return add(ww, "deve essere un oggetto");
        txt(q, "domanda", ww, true, 300); txt(q, "spiegazione", ww, true, 600); txt(q, "categoria", ww, false, 60);
        var op = q.opzioni;
        if (!Array.isArray(op) || op.length < 2 || op.length > 6 || !op.every(function (x) { return typeof x === "string" && x; })) { add(ww + ".opzioni", "elenco di 2-6 risposte"); op = []; }
        if (typeof q.corretta !== "number" || q.corretta % 1 !== 0 || q.corretta < 0 || q.corretta >= Math.max(1, op.length)) add(ww + ".corretta", "numero della risposta giusta, contando da 0");
      });
    });
    return e;
  }

  function toInternal(p) {
    var kb = (p.domande || []).map(function (d) {
      return { q: d.domanda, k: d.parole_chiave, a: d.risposta, d: d.schema || "", l: d.lezione || "", pack: p.id };
    });
    var lessons = (p.lezioni || []).map(function (L) {
      return {
        id: L.id, icon: L.icona || "📘", title: L.titolo, level: L.livello || "Extra", minutes: L.minuti || 15,
        goal: L.obiettivo || "", practice: L.palestra || "", pack: p.id,
        steps: L.passi.map(function (s) { return { t: s.titolo, x: s.testo, d: s.schema || "", tip: s.consiglio || "" }; }),
        quiz: (L.quiz || []).map(function (q) { return { q: q.domanda, o: q.opzioni, a: q.corretta, e: q.spiegazione }; })
      };
    });
    var prove = (p.prove || []).map(function (P) {
      return { id: P.id, titolo: P.titolo, icona: P.icona || "🏆", descrizione: P.descrizione || "", attestato: P.attestato || P.titolo,
        domande_per_prova: P.domande_per_prova || 20, soglia: P.soglia == null ? 0.7 : P.soglia, pack: p.id, packTitolo: p.titolo, senza_attestato: !!P.senza_attestato,
        domande: P.domande.map(function (q) { return { q: q.domanda, o: q.opzioni, a: q.corretta, e: q.spiegazione, c: q.categoria || "" }; }) };
    });
    return { kb: kb, lessons: lessons, suggestions: p.suggerimenti || [], prove: prove };
  }

  function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function lsSet(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function apply(entries) {
    var kb = base.kb.slice(), lessons = base.lessons.slice(), sugg = [], prove = [];
    entries.forEach(function (en) {
      var c = toInternal(en.pacchetto);
      kb = kb.concat(c.kb);
      c.lessons.forEach(function (L) {
        var i = -1;
        lessons.forEach(function (x, j) { if (x.id === L.id) i = j; });
        if (i >= 0) lessons[i] = L; else lessons.push(L);
      });
      sugg = sugg.concat(c.suggestions);
      c.prove.forEach(function (P) {
        var i = -1;
        prove.forEach(function (x, j) { if (x.id === P.id) i = j; });
        if (i >= 0) prove[i] = P; else prove.push(P);
      });
    });
    window.PD_KB = kb; window.PD_LESSONS = lessons; window.PD_PROVE = prove; PD.extraSuggestions = sugg;
    if (PD.resetIndex) PD.resetIndex();
  }

  PD.packs = {
    list: [], errors: [], validate: validate,
    load: function () {
      var self = this;
      var done = function (entries, errors) { self.list = entries; self.errors = errors || []; apply(entries); return entries; };
      if (PD.server) {
        // il server di Windows fa solo un controllo essenziale: la validazione completa si ripete qui
        return PD.api("/api/packs").then(function (r) {
          var ok = [], errs = (r.errori || []).slice();
          (r.packs || []).forEach(function (en) {
            var er = validate(en.pacchetto);
            if (er.length) errs.push({ file: en.file || en.pacchetto.id, errori: er.slice(0, 10) }); else ok.push(en);
          });
          return done(ok, errs);
        })
          .catch(function () { return done([], []); });
      }
      var byId = {}, order = [], errors = [];
      (window.PD_PACKS_BUILTIN || []).forEach(function (p) {
        var er = validate(p);
        if (er.length) errors.push({ file: p.id || "integrato", errori: er.slice(0, 10) });
        else { if (!byId[p.id]) order.push(p.id); byId[p.id] = { origine: "sistema", pacchetto: p }; }
      });
      var user = lsGet();
      Object.keys(user).forEach(function (id) {
        var p = user[id], er = validate(p);
        if (er.length) errors.push({ file: id, errori: er.slice(0, 10) });
        else if (!byId[id]) { order.push(id); byId[id] = { origine: "utente", pacchetto: p }; }
        else if (cmp(p.versione, byId[id].pacchetto.versione) >= 0) byId[id] = { origine: "utente", pacchetto: p };
      });
      return Promise.resolve(done(order.map(function (id) { return byId[id]; }), errors));
    },
    importText: function (text) {
      var pack;
      try { pack = JSON.parse(text); } catch (e) { return Promise.reject(new Error("il file non è un JSON valido")); }
      var er = validate(pack);
      if (er.length) return Promise.reject(new Error(er.slice(0, 4).join("; ")));
      var self = this;
      if (PD.ospite) return Promise.reject(new Error("su un tablet collegato al PC dell'aula non si installano pacchetti: importateli sul PC del facilitatore"));
      var save = PD.server ? PD.api("/api/packs/import", { pack: pack }) : new Promise(function (res, rej) {
        var all = lsGet(); all[pack.id] = pack;
        if (lsSet(all)) res(); else rej(new Error("spazio del browser non disponibile"));
      });
      return save.then(function () { return self.load(); }).then(function () { return pack; });
    },
    remove: function (id) {
      var self = this;
      if (PD.ospite) return Promise.reject(new Error("i pacchetti si tolgono dal PC del facilitatore"));
      var p = PD.server ? PD.api("/api/packs/remove", { id: id }) : new Promise(function (res) { var all = lsGet(); delete all[id]; lsSet(all); res(); });
      return p.then(function () { return self.load(); });
    },
    download: function (url, sha256) {
      var self = this;
      if (PD.ospite) return Promise.reject(new Error("i contenuti si scaricano dal PC del facilitatore"));
      return PD.api("/api/packs/download", { url: url, sha256: sha256 || "" }).then(function (r) { return self.load().then(function () { return r; }); });
    },
    template: function () {
      return {
        formato: FORMATO, formato_versione: 1, id: "mie-domande", titolo: "Le mie domande aggiuntive", versione: "1.0.0",
        autore: "Nome Cognome", licenza: "CC BY-NC-SA 4.0", descrizione: "Domande e lezioni preparate per il nostro gruppo.", richiede_app: "2.1.0",
        suggerimenti: ["Come stampo un documento?"],
        domande: [{ domanda: "Come stampo un documento?", parole_chiave: ["stampare", "stampa", "stampante", "ctrl p"],
          risposta: "1. Aprite il documento.\n2. Premete **Ctrl + P**.\n3. Scegliete la stampante e premete **Stampa**.",
          schema: "flowchart LR\n  A[\"Apro il documento\"] --> B[\"Ctrl + P\"] --> C[\"Stampa\"]", lezione: "" }],
        lezioni: [{ id: "stampare", icona: "🖨️", titolo: "Stampare un documento", livello: "Extra", minuti: 10, obiettivo: "Stampare una lettera o una foto.", palestra: "",
          passi: [{ titolo: "La stampante", testo: "La **stampante** trasforma il documento in un foglio di carta.", schema: "", consiglio: "Controllate che sia accesa e abbia carta." }],
          quiz: [{ domanda: "Quale scorciatoia apre la finestra di stampa?", opzioni: ["Ctrl + P", "Ctrl + S"], corretta: 0, spiegazione: "P come Print, cioè stampa." }] }]
      };
    }
  };
})();
