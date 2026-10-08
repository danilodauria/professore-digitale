/* ==============================================================================
 *  PROFESSORE DIGITALE - Profili allievo sullo stesso computer
 *  Nei centri per anziani e nelle biblioteche lo stesso PC e' usato da piu' persone:
 *  ognuna ha i suoi progressi, la sua conversazione e il suo nome (stampato sugli attestati).
 *  Le impostazioni (tema, voce, IA...) restano uguali per tutti.
 *
 *  Regola d'oro: mai perdere dati. Il profilo ATTIVO usa come sempre PD.progress ("progress")
 *  e PD.history ("history"); gli altri profili stanno nella chiave "profili":
 *    { versione: 1, attivo: "p1", chiedi: true,
 *      elenco: [{ id, nome, icona, colore, creato, ultimo }],
 *      dati: { "p2": { progress, history, studentName } } }   // solo profili non attivi
 *  PD.progress.profilo ricorda a chi appartengono i progressi salvati: se il computer si spegne
 *  a meta' di un cambio di profilo, al riavvio il cambio viene completato senza perdere nulla.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;

  var ICONE = ["🙂", "🌻", "🌹", "🌳", "🐱", "🐶", "🐦", "🦋", "🌞", "🌙", "⭐", "🍎", "☕", "🎵", "⚽", "🚲"];
  var COLORI = ["#1d5c8f", "#c2410c", "#15803d", "#7c3aed", "#b91c1c", "#0e7490", "#a16207", "#be185d"];
  var P = null;            // stato dei profili (chiave "profili")
  var inCorso = false;     // un cambio di profilo alla volta
  var chiestoAllAvvio = false;

  function ora() { return new Date().toISOString(); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function trova(id) { for (var i = 0; P && i < P.elenco.length; i++) if (P.elenco[i].id === id) return P.elenco[i]; return null; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { /* non disponibile */ } return null; }
  function progressoVuoto() { var p = { lessons: {} }; if (PD.migraProgressi) PD.migraProgressi(p); return p; }
  function progressoValido(p) { return p && typeof p === "object" && p.lessons && typeof p.lessons === "object"; }
  function nomePulito(n) { return String(n || "").replace(/\s+/g, " ").trim().slice(0, 40); }
  function lezioniFatte(p) {
    var n = 0, l = (p && p.lessons) || {};
    Object.keys(l).forEach(function (k) { if (l[k] && l[k].done) n++; });
    return n;
  }
  function quando(iso) {
    if (!iso) return "";
    var d = new Date(iso); if (isNaN(d.getTime())) return "";
    var oggi = new Date(), ieri = new Date(Date.now() - 864e5);
    if (d.toDateString() === oggi.toDateString()) return "oggi";
    if (d.toDateString() === ieri.toDateString()) return "ieri";
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  }

  /* ------------------------------------------------------------------ salvataggio
   * PD.store.save scrive subito la copia nel browser, annulla i salvataggi in attesa (timer di 400 ms)
   * della stessa chiave e ne programma uno nuovo con il valore attuale. Con il server scriviamo anche
   * subito, in ordine, aspettando ogni risposta: cosi' nulla del profilo vecchio finisce su quello nuovo. */
  function scrivi(chiave, valore) {
    PD.store.save(chiave, valore);
    if (!PD.server || PD.ospite || !PD.api) return Promise.resolve();   // tablet (ospite): solo nel browser
    return PD.api("/api/data/" + chiave, { value: valore }).then(function () {}, function (e) {
      if (window.console) console.warn("profili: salvataggio di " + chiave + " rimandato", e && e.message);
    });
  }
  function salvaProfili() { return scrivi("profili", P); }

  /* ------------------------------------------------------------------ caricamento */
  function normalizza(x) {
    if (!x || typeof x !== "object" || !Array.isArray(x.elenco)) return null;
    x.versione = x.versione || 1;
    if (typeof x.chiedi !== "boolean") x.chiedi = true;
    if (!x.dati || typeof x.dati !== "object") x.dati = {};
    x.elenco = x.elenco.filter(function (e) { return e && e.id; });
    x.elenco.forEach(function (e, i) {
      e.nome = nomePulito(e.nome) || ("Allievo " + (i + 1));
      e.icona = e.icona || "🙂"; e.colore = e.colore || COLORI[i % COLORI.length];
    });
    if (!x.elenco.length) return null;
    if (!x.attivo || !x.elenco.some(function (e) { return e.id === x.attivo; })) x.attivo = x.elenco[0].id;
    return x;
  }

  function carica() {
    return PD.store.load("profili").then(function (x) {
      P = normalizza(x);
      var tag = PD.progress.profilo;
      if (!P) {
        // primo avvio: un solo profilo che tiene i progressi gia' presenti (nessuno spostamento di dati)
        P = { versione: 1, attivo: "p1", chiedi: true, dati: {},
          elenco: [{ id: "p1", nome: nomePulito(PD.settings.studentName) || "Allievo 1", icona: "🙂", colore: COLORI[0], creato: ora(), ultimo: ora() }] };
        PD.progress.profilo = "p1";
        return salvaProfili().then(function () { return scrivi("progress", PD.progress); });
      }
      var att = P.attivo, d = P.dati[att];
      if (d && tag && tag !== att && P.dati[tag]) {
        // cambio di profilo interrotto prima di salvare i progressi: lo completiamo
        PD.progress = progressoValido(d.progress) ? d.progress : progressoVuoto();
    if (PD.migraProgressi) PD.migraProgressi(PD.progress);
        PD.history = Array.isArray(d.history) ? d.history : [];
        if (d.studentName != null) PD.settings.studentName = d.studentName;
        PD.progress.profilo = att;
        delete P.dati[att];
        return scrivi("history", PD.history).then(function () { return scrivi("settings", PD.settings); })
          .then(function () { return scrivi("progress", PD.progress); }).then(salvaProfili);
      }
      var cambiato = false;
      if (d) { delete P.dati[att]; cambiato = true; }     // cambio quasi completato: la copia di riserva non serve piu'
      if (PD.progress.profilo !== att) { PD.progress.profilo = att; PD.store.save("progress", PD.progress); }
      if (cambiato) return salvaProfili();
    }).catch(function (e) { if (window.console) console.error("profili:", e); });
  }

  /* ------------------------------------------------------------------ API pubblica */
  function elenco() {
    if (!P) return [];
    return P.elenco.map(function (e) { return { id: e.id, nome: e.nome, icona: e.icona, colore: e.colore, attivo: e.id === P.attivo }; });
  }
  function progressDi(id) {
    if (!P || id === P.attivo) return PD.progress;
    var d = P.dati[id];
    return d && progressoValido(d.progress) ? d.progress : { lessons: {} };
  }
  function saluta(prof) {
    var nome = (PD.settings.studentName || prof.nome || "").split(/\s+/)[0];
    var t = PD.testoSaluto ? PD.testoSaluto() : (PD.greeting ? PD.greeting(new Date()) : "Buongiorno") + (nome ? ", " + nome : "") + "!";
    PD.toast(prof.icona + " Benvenuti, " + prof.nome + "!", 3000);
    PD.speak(t);
  }
  function cambia(id) {
    var nuovo = trova(id);
    if (!nuovo) return Promise.reject(new Error("profilo inesistente"));
    if (inCorso) return Promise.reject(new Error("cambio di profilo gia' in corso"));
    ss("pd.profiloScelto", "1");
    if (id === P.attivo) {
      nuovo.ultimo = ora(); salvaProfili(); aggiornaBarra();
      PD.go("#/home"); saluta(nuovo);
      return Promise.resolve(id);
    }
    inCorso = true;
    if (PD.stopSpeech) PD.stopSpeech();
    var vecchio = P.attivo, d = P.dati[id] || {};
    // 1) i dati del profilo che lascia il computer vanno al sicuro in "profili" (dati[nuovo] resta come riserva)
    P.dati[vecchio] = { progress: PD.progress, history: PD.history, studentName: PD.settings.studentName || "" };
    P.dati[id] = d;
    P.attivo = id; nuovo.ultimo = ora();
    var passo1 = copia(P);
    // 2) il profilo nuovo diventa quello attivo
    PD.progress = progressoValido(d.progress) ? d.progress : progressoVuoto();
    PD.history = Array.isArray(d.history) ? d.history : [];
    PD.settings.studentName = d.studentName != null ? d.studentName : nuovo.nome;
    PD.progress.profilo = id;
    // 3) scrittura in ordine: profili (con riserva), conversazione, impostazioni, progressi; poi si toglie la riserva
    return scrivi("profili", passo1)
      .then(function () { return scrivi("history", PD.history); })
      .then(function () { return scrivi("settings", PD.settings); })
      .then(function () { return scrivi("progress", PD.progress); })
      .then(function () { delete P.dati[id]; return salvaProfili(); })
      .then(function () {
        inCorso = false;
        if (PD.applySettings) PD.applySettings();
        aggiornaBarra();
        PD.go("#/home");
        saluta(nuovo);
        return id;
      }, function (e) { inCorso = false; throw e; });
  }
  function crea(nome, icona) {
    nome = nomePulito(nome);
    if (!nome) throw new Error("nome mancante");
    var max = 0;
    P.elenco.forEach(function (e) { var n = +String(e.id).replace(/^p/, ""); if (n > max) max = n; });
    Object.keys(P.dati).forEach(function (k) { var n = +String(k).replace(/^p/, ""); if (n > max) max = n; });
    var id = "p" + (max + 1);
    P.elenco.push({ id: id, nome: nome, icona: ICONE.indexOf(icona) >= 0 ? icona : (icona || "🙂"), colore: COLORI[P.elenco.length % COLORI.length], creato: ora(), ultimo: "" });
    P.dati[id] = { progress: progressoVuoto(), history: [], studentName: nome };
    salvaProfili(); aggiornaBarra();
    return id;
  }
  function rinomina(id, nome) {
    var e = trova(id); nome = nomePulito(nome);
    if (!e || !nome) return false;
    var prima = e.nome; e.nome = nome;
    if (id === P.attivo) {
      if (!PD.settings.studentName || PD.settings.studentName === prima) { PD.settings.studentName = nome; PD.saveSettings(); }
    } else {
      var d = P.dati[id] || (P.dati[id] = { progress: progressoVuoto(), history: [], studentName: "" });
      if (!d.studentName || d.studentName === prima) d.studentName = nome;
    }
    salvaProfili(); aggiornaBarra();
    return true;
  }
  function cambiaIcona(id, icona) {
    var e = trova(id); if (!e || !icona) return false;
    e.icona = icona; salvaProfili(); aggiornaBarra(); return true;
  }
  function elimina(id) {
    if (!P || id === P.attivo) throw new Error("Non si può eliminare la persona che sta usando il computer.");
    if (P.elenco.length < 2) throw new Error("Deve restare almeno una persona.");
    if (!trova(id)) return false;
    P.elenco = P.elenco.filter(function (e) { return e.id !== id; });
    delete P.dati[id];
    salvaProfili(); aggiornaBarra();
    return true;
  }
  function esportaTutti() {
    return {
      app: "professore-digitale", tipo: "profili", version: PD.version, data: ora(), attivo: P ? P.attivo : "",
      profili: (P ? P.elenco : []).map(function (e) {
        var att = e.id === P.attivo, d = P.dati[e.id] || {};
        return { id: e.id, nome: e.nome, icona: e.icona, colore: e.colore, creato: e.creato, ultimo: e.ultimo, attivo: att,
          studentName: att ? PD.settings.studentName || "" : d.studentName || "",
          progress: copia(progressDi(e.id)) };   // le conversazioni restano private: non si esportano
      })
    };
  }

  PD.profili = {
    elenco: elenco,
    attivo: function () { return P ? P.attivo : ""; },
    nomeAttivo: function () { var e = P && trova(P.attivo); return e ? e.nome : (PD.settings.studentName || ""); },
    progressDi: progressDi, cambia: cambia, crea: crea, rinomina: rinomina, cambiaIcona: cambiaIcona, elimina: elimina,
    esportaTutti: esportaTutti,
    chiedi: function (v) { if (v === undefined) return !!(P && P.chiedi); P.chiedi = !!v; salvaProfili(); return P.chiedi; },
    icone: ICONE.slice()
  };

  /* ------------------------------------------------------------------ pulsante nella barra in alto */
  function aggiornaBarra() {
    var t = $(".topbar .tools"); if (!t || !P) return;
    var b = $("#btn-profilo");
    if (!b) {
      b = document.createElement("button");
      b.type = "button"; b.id = "btn-profilo"; b.className = "icon-btn pf-barra"; b.setAttribute("data-go", "#/profili");
      t.insertBefore(b, t.firstChild);
    }
    var e = trova(P.attivo);
    b.hidden = P.elenco.length < 2;
    b.innerHTML = '<span class="pf-barra-ico" aria-hidden="true">' + esc(e.icona) + '</span><span class="pf-barra-nome">' + esc(e.nome) + "</span>";
    b.title = "Sta usando il computer: " + e.nome + ". Premete per cambiare persona.";
    b.setAttribute("aria-label", "Persona: " + e.nome + ". Cambia persona");
  }

  /* ------------------------------------------------------------------ vista «Chi usa il computer?» */
  function statoNuovo() { return { nuova: false, iconaNuova: "🙂", modifica: null, cosa: "", elimina: null, passo: 0 }; }
  var stato = statoNuovo();

  function sceltaIcone(sel, attr) {
    return '<div class="pf-icone" role="radiogroup" aria-label="Scegliete un disegno">' + ICONE.map(function (ic) {
      return '<button type="button" class="pf-icona' + (ic === sel ? " scelta" : "") + '" role="radio" aria-checked="' + (ic === sel) + '" ' +
        attr + '="' + ic + '">' + ic + "</button>";
    }).join("") + "</div>";
  }

  function riquadri() {
    return '<div class="pf-griglia">' + P.elenco.map(function (e) {
      var att = e.id === P.attivo;
      return '<button type="button" class="pf-persona' + (att ? " attivo" : "") + '" data-pf-scegli="' + esc(e.id) + '" style="--pf-colore:' + esc(e.colore) + '">' +
        '<span class="pf-ico" aria-hidden="true">' + esc(e.icona) + '</span><span class="pf-nome">' + esc(e.nome) + "</span>" +
        (att ? '<span class="pf-stato">✓ Sta usando il computer</span>' : "") + "</button>";
    }).join("") +
      '<button type="button" class="pf-persona pf-nuova" id="pf-nuova"><span class="pf-ico" aria-hidden="true">➕</span><span class="pf-nome">Nuova persona</span></button></div>';
  }

  function moduloNuova() {
    if (!stato.nuova) return "";
    return '<div class="card pf-modulo" id="pf-modulo"><h2>➕ Una nuova persona</h2>' +
      '<div class="field"><label for="pf-nome">Come vi chiamate?</label>' +
      '<input type="text" id="pf-nome" class="pf-input" maxlength="40" placeholder="es. Maria" autocomplete="off"></div>' +
      "<p><b>Scegliete un disegno</b> per riconoscervi subito:</p>" + sceltaIcone(stato.iconaNuova, "data-pf-iconanuova") +
      '<p class="pf-errore" id="pf-errore" aria-live="polite"></p>' +
      '<div class="row"><button type="button" class="btn big" id="pf-crea">✓ Crea</button><button type="button" class="btn big ghost" id="pf-annulla">Annulla</button></div></div>';
  }

  function gestisci() {
    var righe = P.elenco.map(function (e) {
      var att = e.id === P.attivo, n = lezioniFatte(progressDi(e.id)), u = quando(e.ultimo);
      var h = '<li class="pf-riga"><div class="pf-riga-testa"><span class="pf-ico-p" aria-hidden="true">' + esc(e.icona) + "</span><div><b>" + esc(e.nome) + "</b>" +
        (att ? ' <span class="pf-badge">in uso ora</span>' : "") +
        '<div class="small muted">' + (n === 1 ? "1 lezione completata" : n + " lezioni completate") + (u ? " · ultimo uso: " + u : "") + "</div></div></div>" +
        '<div class="row pf-azioni"><button type="button" class="btn ghost" data-pf-rinomina="' + esc(e.id) + '">✏️ Cambia nome</button>' +
        '<button type="button" class="btn ghost" data-pf-icona="' + esc(e.id) + '">🎨 Cambia disegno</button>' +
        '<button type="button" class="btn ghost pf-elimina" data-pf-elimina="' + esc(e.id) + '"' + (att || P.elenco.length < 2 ? " disabled" : "") + ">🗑️ Elimina</button></div>";
      if (att) h += '<p class="small muted">Per eliminare questa persona, prima scegliete un\'altra persona.</p>';
      if (stato.modifica === e.id && stato.cosa === "nome") {
        h += '<div class="pf-pannello"><div class="field"><label for="pf-rinomina-' + esc(e.id) + '">Nuovo nome</label>' +
          '<input type="text" class="pf-input" id="pf-rinomina-' + esc(e.id) + '" maxlength="40" value="' + esc(e.nome) + '"></div>' +
          '<div class="row"><button type="button" class="btn" data-pf-salvanome="' + esc(e.id) + '">✓ Salva</button><button type="button" class="btn ghost" data-pf-chiudi="1">Annulla</button></div></div>';
      }
      if (stato.modifica === e.id && stato.cosa === "icona") {
        h += '<div class="pf-pannello"><p><b>Scegliete il nuovo disegno:</b></p>' + sceltaIcone(e.icona, "data-pf-nuovaicona") +
          '<div class="row"><button type="button" class="btn ghost" data-pf-chiudi="1">Chiudi</button></div></div>';
      }
      if (stato.elimina === e.id) {
        h += '<div class="pf-pannello pf-pericolo" role="alert"><p><b>⚠️ I progressi di ' + esc(e.nome) + " verranno cancellati da questo computer.</b><br>" +
          "Lezioni, quiz, attestati e conversazioni di " + esc(e.nome) + " non si potranno più recuperare.</p>" +
          (stato.passo === 1
            ? '<div class="row"><button type="button" class="btn danger" data-pf-conferma="' + esc(e.id) + '">Sì, voglio eliminare ' + esc(e.nome) + '</button><button type="button" class="btn ghost" data-pf-chiudi="1">No, lascia stare</button></div>'
            : '<p>Ultima conferma: siete proprio sicuri?</p><div class="row"><button type="button" class="btn danger" data-pf-conferma="' + esc(e.id) + '">🗑️ Elimina per sempre</button><button type="button" class="btn ghost" data-pf-chiudi="1">No, lascia stare</button></div>') + "</div>";
      }
      return h + "</li>";
    }).join("");
    return '<ul class="pf-elenco">' + righe + "</ul>";
  }

  PD.views.profili = function (el, args) { stato = statoNuovo(); disegna(el, args); };
  function disegna(el, args) {
    if (!P) { el.innerHTML = '<div class="card"><p>Caricamento…</p></div>'; return; }
    var avvio = args && args[0] === "scegli";
    el.innerHTML =
      '<div class="pf-vista' + (avvio ? " pf-avvio" : "") + '">' +
      '<h1>👥 Chi usa il computer?</h1>' +
      '<p class="lead">Toccate il vostro nome: il Professore ricorderà le <b>vostre</b> lezioni e i <b>vostri</b> attestati.</p>' +
      riquadri() + moduloNuova() +
      (avvio ? '<details class="card pf-gestisci" id="pf-gestisci"><summary>⚙️ Gestisci le persone</summary>' + gestisci() + "</details>"
        : '<div class="card pf-gestisci" id="pf-gestisci"><h2>⚙️ Gestisci</h2><p class="small muted">Cambiate il nome o il disegno, oppure eliminate chi non usa più questo computer.</p>' + gestisci() + "</div>") +
      '<p class="small muted pf-nota">🔒 Tutto resta su questo computer. Le impostazioni (colori, voce, testo grande) sono uguali per tutti.</p>' +
      (avvio ? "" : '<div class="row"><button type="button" class="btn ghost" data-go="#/home">🏠 Torna all\'inizio</button></div>') +
      "</div>";
    if (avvio && stato.modifica) { var g = $("#pf-gestisci", el); if (g) g.open = true; }
    if (avvio && stato.elimina) { var g2 = $("#pf-gestisci", el); if (g2) g2.open = true; }
    lega(el, args);
    if (stato.nuova) { var i = $("#pf-nome", el); if (i) { i.focus(); } }
  }
  function ridisegna(el, args) { disegna(el, args); }

  function lega(el, args) {
    $$("[data-pf-scegli]", el).forEach(function (b) {
      b.onclick = function () {
        stato = statoNuovo();
        $$("[data-pf-scegli]", el).forEach(function (x) { x.disabled = true; });
        cambia(b.getAttribute("data-pf-scegli")).catch(function (e) {
          PD.toast("Non sono riuscito a cambiare persona: " + e.message); ridisegna(el, args);
        });
      };
    });
    var nb = $("#pf-nuova", el);
    if (nb) nb.onclick = function () { stato.nuova = true; ridisegna(el, args); var m = $("#pf-modulo", el); if (m && m.scrollIntoView) m.scrollIntoView({ block: "center" }); };
    $$("[data-pf-iconanuova]", el).forEach(function (b) {
      b.onclick = function () {
        stato.iconaNuova = b.getAttribute("data-pf-iconanuova");
        $$("[data-pf-iconanuova]", el).forEach(function (x) { var s = x === b; x.classList.toggle("scelta", s); x.setAttribute("aria-checked", String(s)); });
      };
    });
    var cr = $("#pf-crea", el), an = $("#pf-annulla", el), nm = $("#pf-nome", el);
    if (an) an.onclick = function () { stato.nuova = false; ridisegna(el, args); };
    if (nm) nm.onkeydown = function (e) { if (e.key === "Enter" && cr) cr.click(); };
    if (cr) cr.onclick = function () {
      var nome = nomePulito(nm.value);
      if (!nome) { $("#pf-errore", el).textContent = "Scrivete il nome, per favore."; nm.focus(); return; }
      var doppio = P.elenco.some(function (e) { return e.nome.toLowerCase() === nome.toLowerCase(); });
      if (doppio) { $("#pf-errore", el).textContent = "C'è già una persona con questo nome: aggiungete l'iniziale del cognome (es. " + nome + " R.)."; nm.focus(); return; }
      crea(nome, stato.iconaNuova);
      stato.nuova = false; stato.iconaNuova = "🙂";
      ridisegna(el, args);
      PD.toast("✓ Fatto! Ora toccate «" + nome + "» per iniziare.", 4500);
    };
    $$("[data-pf-rinomina]", el).forEach(function (b) {
      b.onclick = function () { stato.modifica = b.getAttribute("data-pf-rinomina"); stato.cosa = "nome"; stato.elimina = null; ridisegna(el, args); var i = $("#pf-rinomina-" + stato.modifica, el); if (i) { i.focus(); i.select(); } };
    });
    $$("[data-pf-icona]", el).forEach(function (b) {
      b.onclick = function () { stato.modifica = b.getAttribute("data-pf-icona"); stato.cosa = "icona"; stato.elimina = null; ridisegna(el, args); };
    });
    $$("[data-pf-salvanome]", el).forEach(function (b) {
      var id = b.getAttribute("data-pf-salvanome"), i = $("#pf-rinomina-" + id, el);
      b.onclick = function () {
        if (!nomePulito(i.value)) { i.focus(); return; }
        rinomina(id, i.value); stato.modifica = null; ridisegna(el, args); PD.toast("✓ Nome cambiato.");
      };
      if (i) i.onkeydown = function (e) { if (e.key === "Enter") b.click(); };
    });
    $$("[data-pf-nuovaicona]", el).forEach(function (b) {
      b.onclick = function () { cambiaIcona(stato.modifica, b.getAttribute("data-pf-nuovaicona")); stato.modifica = null; ridisegna(el, args); PD.toast("✓ Disegno cambiato."); };
    });
    $$("[data-pf-elimina]", el).forEach(function (b) {
      b.onclick = function () { stato.elimina = b.getAttribute("data-pf-elimina"); stato.passo = 1; stato.modifica = null; ridisegna(el, args); };
    });
    $$("[data-pf-conferma]", el).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-pf-conferma"), e = trova(id);
        if (stato.passo === 1) { stato.passo = 2; ridisegna(el, args); return; }
        try { elimina(id); PD.toast("Eliminato: " + (e ? e.nome : "") + "."); } catch (err) { PD.toast(err.message); }
        stato.elimina = null; stato.passo = 0; ridisegna(el, args);
      };
    });
    $$("[data-pf-chiudi]", el).forEach(function (b) {
      b.onclick = function () { stato.modifica = null; stato.elimina = null; stato.passo = 0; ridisegna(el, args); };
    });
  }

  /* ------------------------------------------------------------------ riquadro nelle Impostazioni */
  PD.hooks.settingsCards.push({
    html: function () {
      if (!P) return "";
      return '<div class="card pf-impostazioni" id="pf-impostazioni"><h2 style="margin-top:0">👥 Persone che usano questo computer</h2>' +
        '<p class="small muted">Ognuno ha i suoi progressi, la sua conversazione e il suo nome sugli attestati. Le impostazioni sono uguali per tutti.</p>' +
        '<ul class="pf-mini">' + P.elenco.map(function (e) {
          return "<li><span aria-hidden=\"true\">" + esc(e.icona) + "</span> " + esc(e.nome) + (e.id === P.attivo ? ' <span class="pf-badge">in uso ora</span>' : "") + "</li>";
        }).join("") + "</ul>" +
        '<label class="switch"><input type="checkbox" id="pf-chiedi"' + (P.chiedi ? " checked" : "") + "> Chiedi chi sta usando il computer all'avvio (se le persone sono almeno due)</label>" +
        '<div class="row"><button type="button" class="btn ghost" data-go="#/profili">👥 Gestisci le persone</button></div></div>';
    },
    bind: function (el) {
      var c = $("#pf-chiedi", el);
      if (c) c.onchange = function () { P.chiedi = !!c.checked; salvaProfili(); PD.toast(P.chiedi ? "All'avvio chiederò chi sta usando il computer." : "All'avvio non lo chiederò più."); };
    }
  });

  /* ------------------------------------------------------------------ avvio */
  PD.hooks.dopoCaricamento.push(function () {
    return carica().then(function () {
      if (!P) return;
      aggiornaBarra();
      var salta = /[?&]noprofilo\b/.test(location.search) || ss("pd.profiloScelto") === "1";
      if (P.elenco.length >= 2 && P.chiedi && !salta) {
        chiestoAllAvvio = true;
        // la scelta della persona sostituisce il saluto generico: il saluto per nome arriva dopo la scelta
        ss("pd.salutato", "1");
        try { history.replaceState(null, "", location.pathname + location.search + "#/profili/scegli"); }
        catch (e) { location.hash = "#/profili/scegli"; }
      }
    });
  });
  var prevReady = PD.onReady;
  PD.onReady = function () {
    if (prevReady) prevReady();
    aggiornaBarra();
    // invito a voce: con il server l'avviatore permette l'audio subito; nel browser solo dopo un gesto dell'utente
    var attivo = navigator.userActivation ? navigator.userActivation.hasBeenActive : false;
    if (chiestoAllAvvio && PD.speak && ((PD.server && !PD.ospite) || attivo)) {
      setTimeout(function () {
        if (/^#\/profili/.test(location.hash)) PD.speak("Buongiorno! Chi sta usando il computer? Toccate il vostro nome.");
      }, 700);
    }
  };
})();
