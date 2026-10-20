/* ==============================================================================
 *  PROFESSORE DIGITALE - NONNI TEACH (dalla 3.6, trasferito identico dal Consulente Digitale)
 *  Neura intervista i nonni (centro anziani, scuola primaria, biblioteca, famiglia…): legge le domande con la
 *  sua voce, registra le risposte dal microfono, le salva sul computer e monta il podcast con i capitoli.
 *  Poi prepara il sito del podcast (pagina + feed RSS + copertina) da caricare nel repository GitHub
 *  «nonni-teach», e lo fa ascoltare anche da qui. Nulla esce dal computer senza che lo carichiate voi;
 *  si pubblica solo con il consenso scritto.
 *  Aprendo questa pagina il Professore lascia la cattedra a Neura (neura.js); uscendo torna lui.
 *  API del server: /api/nonni… (pd_nonni.py e windows/src/pd_nonni.c). Sui tablet ospiti e nella versione
 *  portatile/app per telefono non si registra: si ascoltano i podcast pubblicati e si stampa la liberatoria.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Codice MIT, contenuti CC BY-NC-SA 4.0
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var NT = PD.nonniTeach = { stato: null };
  var reg = null;       // registrazione in corso {rec, stream, ctx, pezzi, inizio, timer}
  var SITO = "https://danilodauria.github.io/nonni-teach/";

  function uno(a, f) { for (var i = 0; i < a.length; i++) if (f(a[i])) return a[i]; return null; }
  function avviso(msg, ms) { PD.toast(msg, ms || 4000); }
  function conferma(titolo, testo) { return Promise.resolve(window.confirm(titolo + "\n\n" + testo)); }
  function neura(s) { if (PD.neura) PD.neura.stato(s); }
  function scrive() { return !!(PD.server && !PD.ospite); }    // registrare e salvare servono il programma sul PC
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function dataEstesa() { try { return new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function codiceScheda() { var d = new Date(); function z(n) { return ("0" + n).slice(-2); } return "NT-" + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "-" + z(d.getHours()) + z(d.getMinutes()); }
  function copiaTesto(t) {
    function vecchio() { var a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (e) { /* ignora */ } document.body.removeChild(a); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(vecchio); else vecchio(); } catch (e) { vecchio(); }
    avviso("📋 Copiato.", 2000);
  }
  function prefs() {
    var s = PD.settings;
    return { url: s.nonniUrl || SITO, titolo: s.nonniTitolo || "Nonni Teach", autore: s.nonniAutore || "", email: s.nonniEmail || "" };
  }

  NT.testo = function (q, ep) {
    var t = q.replace(/\{luogo\}/g, ep.luogo || "il tuo quartiere");
    t = ep.intervistato ? t.replace(/\{nome\}/g, ep.intervistato) : t.replace(/^\{nome\},\s*/, "").replace(/\s*\{nome\}/g, "");
    return cap(t);
  };
  function mescola(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  /* sceglie le domande: apertura + temi a rotazione + una del contesto + chiusura */
  NT.scegli = function (ep, temi, quante) {
    var N = PD.NONNI, out = [], usati = {};
    N.apertura.forEach(function (q) { out.push({ testo: q, tema: "apertura" }); });
    var mazzi = temi.map(function (t) { return { t: t, d: mescola(N.temi[t].d) }; }), ctx = mescola((N.contesti[ep.contesto] || {}).extra || []);
    var corpo = Math.max(1, quante - out.length - N.chiusura.length), giro = 0;
    if (ctx.length) { out.push({ testo: ctx[0], tema: "contesto" }); corpo--; }
    while (corpo > 0 && mazzi.some(function (m) { return m.d.length; })) {
      var m = mazzi[giro++ % mazzi.length];
      if (!m.d.length) continue;
      var q = m.d.shift(); if (usati[q]) continue; usati[q] = 1;
      out.push({ testo: q, tema: m.t }); corpo--;
    }
    N.chiusura.forEach(function (q) { out.push({ testo: q, tema: "chiusura" }); });
    return out.map(function (x) { return { testo: NT.testo(x.testo, ep), tema: x.tema, nota: "" }; });
  };
  NT.altra = function (ep, tema, gia) {
    var N = PD.NONNI, pool = tema && N.temi[tema] ? N.temi[tema].d : [].concat.apply([], Object.keys(N.temi).map(function (k) { return N.temi[k].d; }));
    var libere = pool.map(function (q) { return NT.testo(q, ep); }).filter(function (q) { return gia.indexOf(q) < 0; });
    return libere.length ? libere[Math.floor(Math.random() * libere.length)] : null;
  };

  function api(p, corpo) { return PD.api(p, corpo); }
  function salvaEp(ep) { return api("/api/nonni/salva", { episodio: ep }).then(function (e) { ep.id = e.id; ep.data = e.data; return e; }); }
  function urlFile(id, nome) { return "/api/nonni/" + encodeURIComponent(id) + "/file/" + encodeURIComponent(nome) + "?v=" + Date.now(); }
  function parla(t) { if (PD.settings.voice) PD.speak(t); }
  function inviaFile(url, blob, tipo) {
    return fetch(url, { method: "POST", headers: { "Content-Type": tipo || blob.type || "application/octet-stream" }, body: blob })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "salvataggio non riuscito"); return j; }); });
  }

  /* ------------------------------------------------------------------ registrazione dal microfono */
  function formato() {
    var c = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"];
    if (!window.MediaRecorder) return null;
    for (var i = 0; i < c.length; i++) if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(c[i])) return c[i];
    return "";
  }
  function avviaRegistrazione(livello, tempo) {
    var f = formato();
    if (f === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error("questo browser non può registrare dal microfono"));
    PD.stopSpeech();
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
      var rec = new MediaRecorder(stream, f ? { mimeType: f, audioBitsPerSecond: 64000 } : undefined), pezzi = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) pezzi.push(e.data); };
      rec.start(1000);
      var ctx = null, an = null, buf = null;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an); buf = new Uint8Array(an.fftSize); } catch (e) { ctx = null; }
      reg = { rec: rec, stream: stream, ctx: ctx, pezzi: pezzi, inizio: Date.now() };
      reg.timer = setInterval(function () {
        var s = Math.floor((Date.now() - reg.inizio) / 1000);
        if (tempo) tempo.textContent = Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2);
        if (an && livello) {
          an.getByteTimeDomainData(buf); var p = 0; for (var i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i] - 128));
          livello.style.width = Math.min(100, p / 1.1) + "%";
          if (PD.neura && p > 18) { PD.neura.stato("ascolto"); PD.neura.livello(p / 110); }
        }
      }, 120);
      neura("ascolto");
    });
  }
  function fermaRegistrazione() {
    return new Promise(function (risolvi) {
      if (!reg) return risolvi(null);
      var r = reg; reg = null;
      clearInterval(r.timer);
      r.rec.onstop = function () {
        r.stream.getTracks().forEach(function (t) { t.stop(); });
        if (r.ctx) try { r.ctx.close(); } catch (e) { /* niente */ }
        risolvi(new Blob(r.pezzi, { type: (r.rec.mimeType || "audio/webm").split(";")[0] }));
      };
      try { r.rec.stop(); } catch (e) { risolvi(null); }
      neura("pensiero");
    });
  }
  NT.annulla = function () { if (reg) fermaRegistrazione(); };
  function carica(ep, n, blob) {
    return inviaFile("/api/nonni/" + encodeURIComponent(ep.id) + "/audio/" + n, blob, blob.type || "audio/webm");
  }

  /* ------------------------------------------------------------------ stampe (liberatoria e scheda) */
  function stampa(titolo, corpo, codice) {
    PD.printHTML('<div class="nt-p"><header class="p-testa"><div><b>Professore Digitale</b> · Nonni Teach, condotto da Neura</div><div>' +
      esc(new Date().toLocaleDateString("it-IT")) + "</div></header><h1>" + esc(titolo) + "</h1>" + corpo +
      PD.piedeStampa(codice ? "Codice: " + esc(codice) + "." : "") + "</div>");
  }
  NT.stampaLiberatoria = function (ep) {
    ep = ep || {};
    var riga = "________________________________";
    var h = "<p>Il/La sottoscritto/a <b>" + (ep.intervistato ? esc(ep.intervistato) : riga) + "</b>, nato/a a " + riga + " il __________,</p>" +
      "<p>in relazione all'intervista del progetto <b>Nonni Teach</b> realizzata " + (ep.luogo ? "a <b>" + esc(ep.luogo) + "</b>" : "presso " + riga) +
      (ep.intervistatore ? " da <b>" + esc(ep.intervistatore) + "</b>" : "") + " in data " + dataEstesa() + ",</p>" +
      "<h2>Dichiaro</h2><ol class=\"f-linea\"><li>di aver ricevuto spiegazioni chiare sullo scopo dell'intervista: conservare e trasmettere ricordi, saperi ed esperienze;</li>" +
      "<li>☐ di <b>acconsentire alla registrazione</b> della mia voce, che sarà conservata sul computer dell'ente/famiglia indicato;</li>" +
      "<li>☐ di <b>acconsentire alla pubblicazione</b> della registrazione (podcast su un sito Internet e sui canali dell'ente), con il nome: ☐ completo ☐ solo nome ☐ anonimo;</li>" +
      "<li>che la registrazione potrà essere diffusa con licenza Creative Commons BY-NC-SA 4.0 (uso non commerciale, citando la fonte);</li>" +
      "<li>di sapere che posso <b>ritirare il consenso</b> in qualsiasi momento, chiedendo la cancellazione della registrazione;</li>" +
      "<li>di essere informato/a che la voce è un dato personale, trattato secondo il Regolamento UE 2016/679 (GDPR) dal titolare indicato qui sotto, solo per le finalità del progetto.</li></ol>" +
      '<table class="f-tab"><tr><th>Titolare del trattamento (ente, scuola, associazione, famiglia)</th><td></td></tr><tr><th>Contatto per revoca e cancellazione</th><td></td></tr></table>' +
      '<p style="font-size:9pt">Se nella registrazione compaiono le voci di <b>minorenni</b> (per esempio gli alunni che fanno le domande), serve anche il consenso scritto di chi esercita la responsabilità genitoriale; ' +
      "in alternativa registrate solo la voce dell'adulto intervistato. Questo è un modello indicativo: adattatelo alle regole del vostro ente.</p>" +
      '<div class="f-firme"><div>Luogo e data<br><br>________________________</div><div>Firma della persona intervistata<br><br>________________________</div><div>Firma del responsabile del progetto<br><br>________________________</div></div>';
    stampa("Liberatoria per registrazione e pubblicazione — Nonni Teach", h, codiceScheda());
  };
  NT.stampaScheda = function (ep) {
    var h = '<table class="f-tab"><tr><th>Persona intervistata</th><td>' + esc(ep.intervistato || "") + "</td></tr><tr><th>Luogo</th><td>" + esc(ep.luogo || "") +
      "</td></tr><tr><th>Contesto</th><td>" + esc(((PD.NONNI.contesti[ep.contesto] || {}).nome) || "") + "</td></tr><tr><th>Intervista di</th><td>" + esc(ep.intervistatore || "") +
      "</td></tr><tr><th>Consensi</th><td>registrazione " + (ep.consenso_registrare ? "sì" : "no") + " · pubblicazione " + (ep.consenso_pubblicare ? "sì" : "no") + "</td></tr></table>" +
      "<h2>Domande e appunti</h2><ol class=\"f-linea\">" + ep.domande.map(function (q) { return "<li><b>" + esc(q.testo) + "</b>" + (q.file ? " 🎙️" : "") + (q.nota ? "<br>" + esc(q.nota) : "<br><br>") + "</li>"; }).join("") + "</ol>";
    stampa("Nonni Teach — " + (ep.titolo || "Intervista"), h, ep.id);
  };

  /* ------------------------------------------------------------------ pagina */
  var TAB = [["nuova", "🎙️ Nuova intervista"], ["archivio", "🗂️ Archivio"], ["pubblica", "🌐 Pubblica e ascolta"], ["liberatoria", "📄 Liberatoria"]];
  var TAB_OSPITE = [["ascolta", "🎧 Ascolta i podcast"], ["liberatoria", "📄 Liberatoria"]];
  PD.views.nonni = function (el, parti) {
    if (PD.neura) PD.neura.entra();
    var tabs = scrive() ? TAB : TAB_OSPITE;
    var tab = parti[0] && uno(tabs, function (t) { return t[0] === parti[0]; }) ? parti[0] : tabs[0][0];
    el.innerHTML = '<div class="nt-hero"><div class="nt-neura"><canvas class="neura-canvas" aria-hidden="true"></canvas><div class="neura-stato" aria-live="polite">' +
      esc(PD.neura ? PD.neura.nomeStato() : "") + '</div></div><div><h1>🎙️ Nonni Teach</h1><p class="lead">I nonni insegnano: <b>Neura</b> fa le domande, registra le risposte e crea il podcast da ascoltare e pubblicare. ' +
      "Qui conduce lei; quando uscite da Nonni Teach torna il Professore.</p></div></div>" +
      '<div class="nt-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" class="btn ghost" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<div id="nt-banner"></div><div id="nt-corpo"></div>';
    if (PD.neura) PD.neura.crea($(".neura-canvas", el));
    $$("[data-tab]", el).forEach(function (b) { b.onclick = function () { NT.annulla(); PD.go("#/nonni/" + b.getAttribute("data-tab")); }; });
    var c = $("#nt-corpo", el);
    if (tab === "ascolta") { ascolta(c); return; }
    if (!scrive() && tab !== "liberatoria") { c.innerHTML = '<div class="card nt-avviso">Nonni Teach registra e salva sul computer: serve il Professore Digitale installato e avviato sul PC.</div>'; return; }
    if (scrive()) banner($("#nt-banner", el));
    ({ nuova: nuova, archivio: archivio, pubblica: pubblica, liberatoria: liberatoria }[tab])(c, parti[1]);
  };

  /* ---------- interviste fatte con il Consulente Digitale (fino alla 1.3.1): si copiano qui con un clic */
  function banner(box) {
    api("/api/nonni").then(function (j) {
      var cd = j.consulente || {};
      if (!cd.nuove || !box) return;
      box.innerHTML = '<div class="card nt-trasferisci"><b>📥 ' + (cd.nuove === 1 ? "C'è 1 intervista registrata" : "Ci sono " + cd.nuove + " interviste registrate") +
        " con il Consulente Digitale</b> su questo computer. Nonni Teach adesso sta qui, nel Professore Digitale: copiatele con un clic (nel Consulente restano com'erano)." +
        '<div class="row"><button class="btn" id="nt-trasf">📥 Copia le interviste qui</button></div></div>';
      $("#nt-trasf", box).onclick = function () { importa(box); };
    }, function () { /* niente */ });
  }
  function dopoImport(r) {
    var p = r.prefs || {}, s = PD.settings, cambiato = false;
    [["url", "nonniUrl"], ["titolo", "nonniTitolo"], ["autore", "nonniAutore"], ["email", "nonniEmail"]].forEach(function (k) {
      if (p[k[0]] && !s[k[1]]) { s[k[1]] = p[k[0]]; cambiato = true; }
    });
    if (cambiato) PD.saveSettings();
    neura("felice");
    avviso("✅ Interviste copiate: " + r.copiate + (r.saltate ? " (già presenti: " + r.saltate + ")" : "") + ".", 6000);
  }
  function importa(box) {
    neura("pensiero");
    api("/api/nonni/importa", {}).then(function (r) { dopoImport(r); if (box) box.innerHTML = ""; PD.go("#/nonni/archivio"); },
      function (e) { neura("errore"); avviso("Copia non riuscita: " + e.message, 8000); });
  }
  function importaBackup(file, poi) {
    if (!file) return;
    neura("pensiero");
    avviso("📥 Leggo la copia del Consulente…", 3000);
    inviaFile("/api/nonni/importa-backup", file, "application/zip").then(function (r) { dopoImport(r); if (poi) poi(); },
      function (e) { neura("errore"); avviso("Importazione non riuscita: " + e.message, 9000); });
  }

  /* ---------- 1) preparazione */
  function contestoIniziale() {
    var c = String(PD.settings.percorsoContesto || "");
    if (/scuol/.test(c)) return "scuola";
    if (/bibliot/.test(c)) return "biblioteca";
    if (/famigl|casa/.test(c)) return "famiglia";
    if (/rsa|riposo|residenz/.test(c)) return "rsa";
    return "centro";
  }
  function nuova(c, idRiprendi) {
    if (idRiprendi) { api("/api/nonni/" + encodeURIComponent(idRiprendi)).then(function (e) { intervista(c, e, 0); }, function (e) { c.innerHTML = '<div class="card nt-avviso">' + esc(e.message) + "</div>"; }); return; }
    var N = PD.NONNI, ep = NT.stato || { contesto: contestoIniziale(), intervistato: "", luogo: "", intervistatore: "", consenso_registrare: false, consenso_pubblicare: false };
    NT.stato = ep;
    var temiSel = (N.contesti[ep.contesto] || N.contesti.centro).temi.slice(), quante = 10;
    function disegna() {
      c.innerHTML = '<div class="card nt-come">💡 <b>Come funziona.</b> Scegliete dove vi trovate e chi intervistate; Neura prepara le domande (ne ha ' + N.totale() + " in " + Object.keys(N.temi).length +
        " temi), le legge ad alta voce e registra ogni risposta. Alla fine il podcast è pronto da ascoltare, stampare e, con il consenso, pubblicare.</div>" +
        "<h2>1. Dove siete?</h2><div class=\"nt-griglia\">" + Object.keys(N.contesti).map(function (k) { var x = N.contesti[k];
          return '<button type="button" class="card tile nt-ctx' + (ep.contesto === k ? " scelta" : "") + '" data-ctx="' + k + '" aria-pressed="' + (ep.contesto === k) + '"><span class="big-ico">' + x.icona + "</span><h3>" + esc(x.nome) + "</h3><p>" + esc(x.testo) + "</p></button>"; }).join("") + "</div>" +
        "<h2>2. Chi intervistiamo?</h2><div class=\"nt-campi\"><label>Come lo chiamiamo nelle domande<input id=\"nt-nome\" placeholder=\"es. nonno Pippo, signora Maria\" value=\"" + esc(ep.intervistato) + "\"></label>" +
        "<label>Quartiere o paese<input id=\"nt-luogo\" placeholder=\"es. il quartiere San Lorenzo, Bagnoli\" value=\"" + esc(ep.luogo) + "\"></label>" +
        "<label>Chi fa l'intervista<input id=\"nt-chi\" placeholder=\"es. classe 4ª B, il nipote Luca, la biblioteca\" value=\"" + esc(ep.intervistatore) + "\"></label>" +
        "<label>Quante domande<select id=\"nt-quante\">" + [6, 8, 10, 12, 16, 20].map(function (n) { return "<option" + (n === quante ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select></label></div>" +
        "<h2>3. Di cosa parliamo?</h2><div class=\"nt-temi\">" + Object.keys(N.temi).map(function (k) {
          return '<label class="nt-tema"><input type="checkbox" data-tema="' + k + '"' + (temiSel.indexOf(k) >= 0 ? " checked" : "") + "> " + N.temi[k].icona + " " + esc(N.temi[k].nome) + "</label>"; }).join("") + "</div>" +
        "<h2>4. Consenso</h2><div class=\"card\"><label class=\"nt-tema\"><input type=\"checkbox\" id=\"nt-c1\"" + (ep.consenso_registrare ? " checked" : "") + "> La persona intervistata ha dato il consenso a <b>registrare</b> la sua voce (obbligatorio)</label><br>" +
        "<label class=\"nt-tema\"><input type=\"checkbox\" id=\"nt-c2\"" + (ep.consenso_pubblicare ? " checked" : "") + "> …e a <b>pubblicare</b> il podcast su Internet (facoltativo)</label>" +
        '<p class="small muted">Meglio con la liberatoria firmata: <a href="#/nonni/liberatoria">📄 stampatela qui</a>. Se le domande le fanno dei bambini, per pubblicare serve anche il consenso dei genitori, oppure registrate solo la voce del nonno.</p></div>' +
        '<div class="row"><button type="button" class="btn big" id="nt-prepara">🧠 Neura prepara le domande</button></div><div id="nt-elenco"></div>';
      $$("[data-ctx]", c).forEach(function (b) { b.onclick = function () { leggi(); ep.contesto = b.getAttribute("data-ctx"); temiSel = N.contesti[ep.contesto].temi.slice(); disegna(); }; });
      $("#nt-prepara", c).onclick = function () {
        leggi();
        if (!temiSel.length) return avviso("Scegliete almeno un tema.");
        neura("pensiero");
        ep.domande = NT.scegli(ep, temiSel, quante); ep.titolo = ep.intervistato ? "I racconti di " + ep.intervistato : "Nonni Teach — " + N.contesti[ep.contesto].nome;
        elenco();
        setTimeout(function () { neura("felice"); }, 500);
      };
    }
    function leggi() {
      if (!$("#nt-nome", c)) return;
      ep.intervistato = $("#nt-nome", c).value.trim(); ep.luogo = $("#nt-luogo", c).value.trim(); ep.intervistatore = $("#nt-chi", c).value.trim();
      quante = +$("#nt-quante", c).value; ep.consenso_registrare = $("#nt-c1", c).checked; ep.consenso_pubblicare = $("#nt-c2", c).checked && ep.consenso_registrare;
      temiSel = $$("[data-tema]", c).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute("data-tema"); });
    }
    function elenco() {
      var box = $("#nt-elenco", c);
      box.innerHTML = '<h2>Le domande di Neura</h2><label class="nt-campo-largo">Titolo dell\'episodio<input id="nt-titolo" value="' + esc(ep.titolo) + '"></label><ol class="nt-domande">' + ep.domande.map(function (q, i) {
        return '<li><span contenteditable="true" data-q="' + i + '">' + esc(q.testo) + '</span> <small class="badge">' + esc((PD.NONNI.temi[q.tema] || {}).nome || q.tema) + '</small> <button type="button" class="btn ghost nt-mini" data-cambia="' + i + '" title="Un\'altra domanda" aria-label="Un\'altra domanda">↻</button><button type="button" class="btn ghost nt-mini" data-togli="' + i + '" title="Togli" aria-label="Togli la domanda">✖</button></li>'; }).join("") + "</ol>" +
        '<div class="row"><input id="nt-mia" placeholder="Aggiungete una vostra domanda" style="flex:1;min-width:14rem"><button type="button" class="btn ghost" id="nt-agg">➕ Aggiungi</button></div>' +
        '<div class="row"><button type="button" class="btn big" id="nt-via">🎙️ Inizia l\'intervista</button><button type="button" class="btn ghost" id="nt-stampa-d">🖨️ Stampa le domande</button></div>';
      $$("[data-q]", box).forEach(function (s) { s.oninput = function () { ep.domande[+s.getAttribute("data-q")].testo = s.textContent.trim(); }; });
      $$("[data-cambia]", box).forEach(function (b) { b.onclick = function () { var i = +b.getAttribute("data-cambia"), q = NT.altra(ep, ep.domande[i].tema, ep.domande.map(function (x) { return x.testo; })); if (q) { ep.domande[i].testo = q; elenco(); } }; });
      $$("[data-togli]", box).forEach(function (b) { b.onclick = function () { ep.domande.splice(+b.getAttribute("data-togli"), 1); elenco(); }; });
      $("#nt-agg", box).onclick = function () { var t = $("#nt-mia", box).value.trim(); if (t) { ep.domande.splice(ep.domande.length - 1, 0, { testo: t, tema: "vostra", nota: "" }); elenco(); } };
      $("#nt-titolo", box).oninput = function () { ep.titolo = this.value; };
      $("#nt-stampa-d", box).onclick = function () { NT.stampaScheda(ep); };
      $("#nt-via", box).onclick = function () {
        leggi();
        if (!ep.consenso_registrare) { avviso("Prima serve il consenso a registrare (punto 4).", 5000); $("#nt-c1", c).focus(); return; }
        salvaEp(ep).then(function (e) { NT.stato = null; intervista(c, e, 0); }, function (e) { neura("errore"); avviso(e.message, 6000); });
      };
      if (box.scrollIntoView) box.scrollIntoView({ behavior: "smooth" });
    }
    disegna();
  }

  /* ---------- 2) intervista */
  function intervista(c, ep, i) {
    if (i == null) i = 0;
    var primaVuota = uno(ep.domande, function (q) { return !q.file; });
    if (i === 0 && primaVuota && ep.domande.indexOf(primaVuota) > 0) i = ep.domande.indexOf(primaVuota);
    function mostra() {
      var q = ep.domande[i], fatte = ep.domande.filter(function (x) { return x.file; }).length;
      c.innerHTML = '<div class="nt-palco"><div class="row"><b>' + esc(ep.titolo) + '</b><span style="flex:1"></span><small class="muted">' + fatte + " risposte registrate su " + ep.domande.length + "</small></div>" +
        '<div class="nt-puntini">' + ep.domande.map(function (x, k) { return '<button type="button" class="' + (k === i ? "ora " : "") + (x.file ? "fatta" : "") + '" data-vai="' + k + '" aria-label="Domanda ' + (k + 1) + '">' + (k + 1) + "</button>"; }).join("") + "</div>" +
        '<div class="nt-domanda"><small>Domanda ' + (i + 1) + " di " + ep.domande.length + '</small><p id="nt-q">' + esc(q.testo) + "</p></div>" +
        '<div class="nt-reg"><div class="nt-livello"><i id="nt-liv"></i></div><b id="nt-tempo">0:00</b></div>' +
        '<div class="row nt-comandi"><button type="button" class="btn big ghost" id="nt-leggi">🔊 Neura fa la domanda</button><button type="button" class="btn big" id="nt-rec">🎙️ Registra la risposta</button>' +
        '<button type="button" class="btn ghost" id="nt-salta">⏭ Avanti</button><button type="button" class="btn ghost" id="nt-altra">↻ Altra domanda</button></div>' +
        (q.file ? '<div class="card"><b>Risposta registrata</b>' + (q.durata ? " (" + Math.round(q.durata) + " s)" : "") + '<audio controls src="' + urlFile(ep.id, q.file) + '"></audio><small class="muted">Potete registrarla di nuovo: la nuova sostituisce questa.</small></div>' : "") +
        '<label class="nt-campo-largo">Appunti su questa risposta (facoltativo: nomi, date, parole in dialetto)<textarea id="nt-nota" rows="2">' + esc(q.nota || "") + "</textarea></label>" +
        '<div class="row"><button type="button" class="btn ghost" id="nt-fine">🎚️ Fine: crea il podcast</button><button type="button" class="btn ghost" id="nt-scheda">🖨️ Scheda dell\'intervista</button></div></div>';
      $$("[data-vai]", c).forEach(function (b) { b.onclick = function () { if (reg) return; i = +b.getAttribute("data-vai"); mostra(); }; });
      $("#nt-leggi", c).onclick = function () { PD.speak(q.testo, true); };
      $("#nt-nota", c).onchange = function () { q.nota = this.value; salvaEp(ep).catch(function () {}); };
      $("#nt-salta", c).onclick = function () { if (reg) return; if (i < ep.domande.length - 1) { i++; mostra(); leggiAuto(); } else fine(); };
      $("#nt-altra", c).onclick = function () {
        if (reg) return;
        var n = NT.altra(ep, q.tema, ep.domande.map(function (x) { return x.testo; }));
        if (!n) return avviso("Non ho altre domande su questo tema.");
        if (q.file) return avviso("Questa domanda ha già una risposta: per cambiarla usate «Avanti».");
        q.testo = n; salvaEp(ep).then(function () { mostra(); leggiAuto(); });
      };
      $("#nt-scheda", c).onclick = function () { NT.stampaScheda(ep); };
      $("#nt-fine", c).onclick = fine;
      var b = $("#nt-rec", c);
      b.onclick = function () {
        if (!reg) {
          avviaRegistrazione($("#nt-liv", c), $("#nt-tempo", c)).then(function () {
            b.textContent = "⏹ Fine della risposta"; b.classList.add("nt-in-reg"); $("#nt-q", c).classList.add("nt-ascolto");
          }, function (e) { neura("errore"); avviso("🎙️ Microfono non disponibile: " + e.message + ". Controllate che sia collegato e consentito.", 8000); });
        } else {
          b.disabled = true; b.textContent = "💾 Salvo…";
          fermaRegistrazione().then(function (blob) {
            if (!blob || blob.size < 1200) { avviso("Registrazione troppo breve, riprovate."); neura("riposo"); mostra(); return; }
            return carica(ep, i + 1, blob).then(function (r) {
              q.file = r.file; q.durata = r.durata; neura("felice");
              avviso("✅ Risposta " + (i + 1) + " salvata", 2500);
              if (i < ep.domande.length - 1) { i++; mostra(); leggiAuto(); } else fine();
            });
          }).catch(function (e) { neura("errore"); avviso("Salvataggio non riuscito: " + e.message, 8000); mostra(); });
        }
      };
    }
    function leggiAuto() { if (PD.settings.voice) setTimeout(function () { PD.speak(ep.domande[i].testo); }, 300); }
    function fine() { NT.annulla(); PD.go("#/nonni/archivio"); setTimeout(function () { NT.monta(ep.id); }, 600); }
    mostra(); leggiAuto();
  }

  /* ---------- FFmpeg: serve per unire le risposte in un MP3 (si installa una volta, dalla fonte ufficiale) */
  function aiutoFfmpeg(sistema) {
    var win = sistema === "windows", cmd = win ? "winget install --id Gyan.FFmpeg -e" : "sudo apt install ffmpeg";
    return '<div class="card nt-ffmpeg"><b>🎚️ Per unire le risposte in un unico podcast MP3 serve FFmpeg</b>, un programma libero e gratuito. Intanto le risposte si ascoltano (e si pubblicano) una per una.' +
      (win ? "<ol><li>Aprite il menu Start, scrivete <b>Terminale</b> (o <b>PowerShell</b>) e apritelo.</li><li>Incollate questo comando e premete Invio:</li></ol>"
        : "<ol><li>Aprite il <b>Terminale</b> (Ctrl+Alt+T).</li><li>Incollate questo comando, premete Invio e scrivete la vostra password:</li></ol>") +
      '<div class="row"><code class="nt-cmd">' + esc(cmd) + '</code><button type="button" class="btn ghost" data-copia="' + esc(cmd) + '">📋 Copia</button></div>' +
      (win ? '<p class="small muted">Su Windows 7 o 8, oppure senza winget: scaricate FFmpeg da <b>ffmpeg.org</b> (versione «essentials») e copiate <code>ffmpeg.exe</code> nella cartella <code>%LOCALAPPDATA%\\ProfessoreDigitale\\ffmpeg</code>.</p>' : "") +
      '<div class="row"><button type="button" class="btn" id="nt-ricontrolla">🔄 L\'ho installato: controlla di nuovo</button></div></div>';
  }

  /* ---------- montaggio del podcast */
  NT.monta = function (id) {
    avviso("🎚️ Neura monta il podcast…", 3000);
    neura("pensiero");
    return api("/api/nonni/" + encodeURIComponent(id) + "/monta", {}).then(function (r) {
      if (r.serve_ffmpeg) {
        neura("riposo");
        avviso("🎚️ Per creare il podcast serve FFmpeg: le istruzioni sono nell'Archivio.", 7000);
        if (/^#\/nonni\/archivio/.test(location.hash)) PD.route(); else PD.go("#/nonni/archivio");
        return r;
      }
      neura("felice");
      avviso("✅ Podcast pronto: " + r.capitoli.length + " capitoli, " + Math.max(1, Math.round(r.durata / 60)) + " minuti" + (r.voce_domande ? "" : " (le domande sono nei titoli dei capitoli: la voce del computer non è installata)"), 7000);
      if (/^#\/nonni/.test(location.hash)) PD.route();
      return r;
    }, function (e) { neura("errore"); avviso("Montaggio non riuscito: " + e.message, 9000); });
  };

  /* ---------- 3) archivio */
  function archivio(c) {
    c.innerHTML = '<p class="muted">Carico le interviste…</p>';
    api("/api/nonni").then(function (j) {
      var imp = '<details class="card nt-imp"><summary>📥 Interviste registrate con il Consulente Digitale</summary><p class="small">Nonni Teach prima stava nel Consulente Digitale. ' +
        (j.consulente && j.consulente.episodi ? "Su questo computer ce ne sono " + j.consulente.episodi + " (" + j.consulente.nuove + " da copiare). " : "Su questo computer non ne ho trovate. ") +
        "Da un altro computer: nel Consulente, in Impostazioni, premete <b>💾 Crea un backup</b> spuntando «con le registrazioni» e scegliete qui il file .cdbackup.</p>" +
        '<div class="row">' + (j.consulente && j.consulente.nuove ? '<button type="button" class="btn ghost" id="nt-imp-pc">📥 Copia da questo computer</button>' : "") +
        '<label class="btn ghost nt-file">📂 Scegli il file .cdbackup<input type="file" id="nt-imp-file" accept=".cdbackup,.zip" hidden></label></div></details>';
      if (!j.episodi.length) {
        c.innerHTML = '<p class="nt-vuoto">Ancora nessuna intervista. <a href="#/nonni/nuova">🎙️ Iniziate la prima</a>.</p>' + imp;
      } else {
        c.innerHTML = (j.ffmpeg ? "" : aiutoFfmpeg(j.sistema)) +
          '<p class="small muted">Le registrazioni sono salvate sul computer, nella cartella dei dati del Professore Digitale (nonni-teach). Nulla viene pubblicato senza che lo facciate voi.</p>' +
          j.episodi.map(function (e) {
            return '<div class="card nt-ep" data-ep="' + esc(e.id) + '"><div class="row"><b>🎙️ ' + esc(e.titolo) + '</b><span style="flex:1"></span>' +
              (e.consenso_pubblicare ? '<span class="badge done">pubblicabile</span>' : '<span class="badge">solo archivio</span>') + (e.podcast ? ' <span class="badge done">podcast pronto</span>' : "") +
              (e.origine ? ' <span class="badge">dal ' + esc(e.origine) + "</span>" : "") + "</div>" +
              '<small class="muted">' + esc([e.intervistato, e.luogo, (PD.NONNI.contesti[e.contesto] || {}).nome, e.data].filter(Boolean).join(" · ")) + " · " + e.risposte + " risposte</small>" +
              '<div class="row"><button type="button" class="btn" data-ascolta>▶ Ascolta</button><button type="button" class="btn ghost" data-continua>🎙️ Continua</button>' +
              '<button type="button" class="btn ghost" data-monta>🎚️ ' + (e.podcast ? "Rifai" : "Crea") + ' il podcast</button><button type="button" class="btn ghost" data-stampa>🖨️ Scheda</button><button type="button" class="btn ghost" data-elimina aria-label="Elimina l\'intervista">🗑️</button></div><div class="nt-ascolto-box"></div></div>';
          }).join("") + imp;
      }
      $$("[data-copia]", c).forEach(function (b) { b.onclick = function () { copiaTesto(b.getAttribute("data-copia")); }; });
      var rc = $("#nt-ricontrolla", c); if (rc) rc.onclick = function () { archivio(c); };
      var ip = $("#nt-imp-pc", c); if (ip) ip.onclick = function () { importa(null); };
      var fi = $("#nt-imp-file", c); if (fi) fi.onchange = function () { importaBackup(fi.files[0], function () { archivio(c); }); };
      $$(".nt-ep", c).forEach(function (box) {
        var id = box.getAttribute("data-ep");
        $("[data-continua]", box).onclick = function () { PD.go("#/nonni/nuova/" + id); };
        $("[data-monta]", box).onclick = function () { NT.monta(id); };
        $("[data-stampa]", box).onclick = function () { api("/api/nonni/" + id).then(NT.stampaScheda); };
        $("[data-elimina]", box).onclick = function () {
          conferma("Eliminare l'intervista?", "Saranno cancellate dal computer anche le registrazioni. Non si può annullare.").then(function (ok) {
            if (ok) api("/api/nonni/" + id + "/elimina", {}).then(function () { archivio(c); }); });
        };
        $("[data-ascolta]", box).onclick = function () {
          var dove = $(".nt-ascolto-box", box);
          api("/api/nonni/" + id).then(function (e) {
            var h = "";
            if (e.podcast) h += '<audio controls preload="metadata" src="' + urlFile(e.id, e.podcast) + '"></audio>' + (e.capitoli || []).map(function (k) {
              return '<button type="button" class="btn ghost nt-cap" data-t="' + k.inizio + '">' + Math.floor(k.inizio / 60) + ":" + ("0" + Math.floor(k.inizio % 60)).slice(-2) + "</button> " + esc(k.titolo); }).join("<br>");
            else h += e.domande.filter(function (q) { return q.file; }).map(function (q) { return "<p><b>" + esc(q.testo) + '</b><audio controls preload="none" src="' + urlFile(e.id, q.file) + '"></audio></p>'; }).join("") || '<p class="nt-vuoto">Nessuna risposta registrata.</p>';
            dove.innerHTML = h;
            $$("[data-t]", dove).forEach(function (b) { b.onclick = function () { var a = $("audio", dove); a.currentTime = +b.getAttribute("data-t"); a.play(); }; });
          });
        };
      });
    }, function (e) { c.innerHTML = '<div class="card nt-avviso">' + esc(e.message) + "</div>"; });
  }

  /* ---------- 4) pubblicazione (repository «nonni-teach» su GitHub) e ascolto online */
  function leggiFeed(u, box) {
    box.innerHTML = '<p class="muted">Carico gli episodi…</p>';
    fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("feed non trovato (" + r.status + ")"); return r.text(); }).then(function (t) {
      var xml = new DOMParser().parseFromString(t, "application/xml"), items = [].slice.call(xml.getElementsByTagName("item"));
      box.innerHTML = items.length ? items.map(function (it) {
        var en = it.getElementsByTagName("enclosure")[0], tit = (it.getElementsByTagName("title")[0] || {}).textContent || "", src = en ? en.getAttribute("url") : "";
        return /^https:\/\//.test(src) ? "<p><b>" + esc(tit) + '</b><audio controls preload="none" src="' + esc(src) + '"></audio></p>' : "";
      }).join("") : '<p class="nt-vuoto">Il feed non contiene ancora episodi.</p>';
    }).catch(function (e) { box.innerHTML = '<div class="nt-avviso">Non riesco a leggere ' + esc(u) + ": " + esc(e.message) + ". Il sito è già stato pubblicato? Serve Internet.</div>"; });
  }
  function pubblica(c) {
    var p = prefs();
    c.innerHTML = '<div class="nt-due"><div class="card"><h3>🌐 Prepara il sito del podcast</h3><p>Il Professore crea una cartella con la pagina del podcast, il <b>feed RSS</b> (per le app dei podcast), la <b>copertina</b> e gli audio, ' +
      "solo per le interviste con il <b>consenso alla pubblicazione</b>. Si carica nel vostro repository GitHub <b>nonni-teach</b>.</p>" +
      '<label class="nt-campo-largo">Indirizzo del sito<input id="nt-url" value="' + esc(p.url) + '"></label><label class="nt-campo-largo">Nome del podcast<input id="nt-tit" value="' + esc(p.titolo) + '"></label>' +
      '<label class="nt-campo-largo">Curato da<input id="nt-aut" placeholder="es. Centro anziani San Lorenzo" value="' + esc(p.autore) + '"></label>' +
      '<label class="nt-campo-largo">Email di contatto (la chiedono Spotify e Apple Podcasts)<input id="nt-email" type="email" placeholder="es. podcast@esempio.it" value="' + esc(p.email) + '"></label>' +
      '<div class="row"><button type="button" class="btn" id="nt-crea">🛠️ Crea il sito</button></div><div id="nt-esito"></div></div>' +
      '<div class="card"><h3>🎧 Ascolta i podcast pubblicati</h3><p>Legge il feed del sito e fa ascoltare gli episodi qui dentro (serve Internet).</p><div class="row"><button type="button" class="btn ghost" id="nt-ascolta">▶ Carica gli episodi</button></div><div id="nt-online"></div></div></div>' +
      '<h2>Come pubblicarlo su GitHub (gratis)</h2><ol class="nt-passi"><li>Il repository <code>nonni-teach</code> c\'è già (danilodauria/nonni-teach). Un altro ente può crearne uno suo, pubblico, con lo stesso nome.</li>' +
      "<li>Con <b>GitHub Desktop</b>: <i>File → Clone repository</i> e scegliete <code>nonni-teach</code> (solo la prima volta).</li><li>Premete «Crea il sito», poi «Scarica lo zip» ed estraetelo dentro la cartella del repository, sostituendo i file.</li>" +
      "<li>In GitHub Desktop: scrivete un riepilogo (es. «Nuovo episodio»), <b>Commit to main</b> e poi <b>Push origin</b>.</li><li>Solo la prima volta: su GitHub → <i>Settings → Pages → Deploy from a branch → main</i>.</li>" +
      "<li>Dopo un minuto il podcast è online all'indirizzo indicato; il feed è <code>feed.xml</code>: si aggiunge una volta a Spotify for Creators e ad Apple Podcasts Connect (servono copertina ed email, già pronte).</li></ol>" +
      '<p class="small muted">Per i social: condividete il link dell\'episodio con i pulsanti qui sopra (il programma non pubblica nulla da solo sui vostri profili).</p>';
    function salvaPrefs() {
      var s = PD.settings;
      s.nonniUrl = $("#nt-url", c).value.trim(); s.nonniTitolo = $("#nt-tit", c).value.trim(); s.nonniAutore = $("#nt-aut", c).value.trim(); s.nonniEmail = $("#nt-email", c).value.trim();
      PD.saveSettings();
      return { url: s.nonniUrl || SITO, titolo: s.nonniTitolo, autore: s.nonniAutore, email: s.nonniEmail };
    }
    $("#nt-crea", c).onclick = function () {
      var x = salvaPrefs(), es = $("#nt-esito", c);
      if (x.email && !/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$/.test(x.email)) {
        es.innerHTML = '<div class="nt-avviso">L\'indirizzo email non sembra giusto: controllatelo (es. podcast@esempio.it).</div>'; $("#nt-email", c).focus(); return;
      }
      if (!/^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~\/-]*)?$/.test(x.url)) {
        es.innerHTML = '<div class="nt-avviso">L\'indirizzo del sito deve iniziare con https:// (es. https://danilodauria.github.io/nonni-teach/).</div>'; $("#nt-url", c).focus(); return;
      }
      es.innerHTML = '<p class="muted">Preparo il sito…</p>';
      neura("pensiero");
      api("/api/nonni/sito", x).then(function (r) {
        var link = r.url, testo = "🎙️ " + (x.titolo || "Nonni Teach") + ": i nonni raccontano. Ascoltate i nuovi episodi! " + link;
        neura("felice");
        es.innerHTML = '<div class="nt-ok">✔ Sito pronto con <b>' + r.episodi + "</b> episodi.<br><small>Cartella: " + esc(r.cartella) + "</small></div>" +
          (r.avvisi || []).map(function (a) { return '<div class="nt-avviso">' + esc(a) + "</div>"; }).join("") +
          '<div class="row"><a class="btn" href="/api/nonni/sito.zip" download>⬇️ Scarica lo zip</a><button type="button" class="btn ghost" id="nt-copia">📋 Copia il messaggio per i social</button>' +
          '<a class="btn ghost" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link) + '">Facebook ↗</a>' +
          '<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(testo) + '">WhatsApp ↗</a></div>';
        $("#nt-copia", es).onclick = function () { copiaTesto(testo); };
        if (!r.episodi) es.insertAdjacentHTML("beforeend", '<div class="nt-avviso">Nessuna intervista ha il consenso alla pubblicazione: il sito è vuoto.</div>');
      }, function (e) { neura("errore"); es.innerHTML = '<div class="nt-avviso">' + esc(e.message) + "</div>"; });
    };
    $("#nt-ascolta", c).onclick = function () { var x = salvaPrefs(); leggiFeed(x.url.replace(/\/?$/, "/") + "feed.xml", $("#nt-online", c)); };
  }

  /* ---------- sui tablet, sul telefono e nella versione portatile: si ascoltano i podcast pubblicati */
  function ascolta(c) {
    var u = prefs().url.replace(/\/?$/, "/") + "feed.xml";
    c.innerHTML = '<div class="card"><h3>🎧 I podcast di Nonni Teach</h3><p>Gli episodi pubblicati, da ascoltare qui (serve Internet: il Professore si collega solo quando premete il pulsante). ' +
      'Le interviste si registrano con il Professore Digitale installato sul computer.</p><div class="row"><button type="button" class="btn" id="nt-carica">▶ Carica gli episodi</button></div><div id="nt-online"></div></div>';
    $("#nt-carica", c).onclick = function () { leggiFeed(u, $("#nt-online", c)); };
  }

  /* ---------- 5) liberatoria */
  function liberatoria(c) {
    c.innerHTML = '<div class="card"><h3>📄 Liberatoria per la registrazione e la pubblicazione</h3><p>Un modello semplice da far firmare prima dell\'intervista: consenso a registrare, a pubblicare (con nome completo, solo nome o anonimo), ' +
      "licenza Creative Commons, diritto di ritirare il consenso, riferimento al GDPR e attenzione ai minorenni.</p>" +
      '<div class="nt-campi"><label>Persona intervistata<input id="nt-l-nome"></label><label>Luogo<input id="nt-l-luogo"></label><label>Chi fa l\'intervista<input id="nt-l-chi"></label></div>' +
      '<div class="row"><button type="button" class="btn" id="nt-l-stampa">🖨️ Stampa la liberatoria</button></div>' +
      '<p class="small muted">È un modello indicativo, non una consulenza legale: scuole ed enti lo adattino al proprio regolamento sulla privacy.</p></div>';
    $("#nt-l-stampa", c).onclick = function () { NT.stampaLiberatoria({ intervistato: $("#nt-l-nome", c).value, luogo: $("#nt-l-luogo", c).value, intervistatore: $("#nt-l-chi", c).value }); };
  }

  /* riquadro nell'Inizio */
  PD.hooks.homeTiles.push(function () {
    return PD.tileHTML("🎙️", "Nonni Teach", "Neura intervista i nonni e crea il podcast dei loro ricordi.", "#/nonni", "nonni-home");
  });
})();
