/* ==============================================================================
 *  PROFESSORE DIGITALE - «Palestra della vita digitale»
 *  Simulazioni senza rischi delle cose della vita reale che spaventano (accesso con identita'
 *  digitale, prenotare una visita, pagare un avviso...). Tutto e' finto: siti, telefono, codici e soldi.
 *  Nomi di fantasia, nessun marchio reale, nessun dato esce dal computer.
 *
 *  CONTRATTO per i simulatori (usato anche da vita-sim2.js: NON cambiarlo):
 *    PD.vita.registra({ id, icona, titolo, descrizione, durata, digcomp: [...], ordine, avvia: function (box, ctx) {} })
 *    PD.vita.elenco()  -> simulatori ordinati per «ordine»
 *    PD.vita.stato(id) -> PD.progress.vita[id] || null  ({ fatto, volte, errori, quando })
 *    ctx.passo(testo) ctx.bravo(testo) ctx.errore(testo) ctx.telefono(opz|null) ctx.fine({messaggio, consigli}) ctx.esci()
 *  Aggiunte facoltative (non fanno parte del contratto minimo):
 *    ctx.indirizzo(url, sicuro)  barra dell'indirizzo finta (sicuro=false mostra «Non sicuro»)
 *    ctx.foglio(opz|null)        foglio «sul tavolo» accanto alla simulazione: { titolo, html }
 *    ctx.controlla(campi)        controllo tollerante dei campi con «Compila per me» dopo 2 errori
 *    PD.vita.aiuti               { schermo, norm, giorno, dataLunga, dataBreve, ora }
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;

  /* ------------------------------------------------------------------------
   *  Registro dei simulatori (contratto)
   * ---------------------------------------------------------------------- */
  var SIMS = [];
  PD.vita = {
    registra: function (sim) {
      if (!sim || !sim.id || typeof sim.avvia !== "function") return;
      SIMS = SIMS.filter(function (s) { return s.id !== sim.id; });
      SIMS.push(sim);
    },
    elenco: function () {
      return SIMS.slice().sort(function (a, b) { return (a.ordine || 99) - (b.ordine || 99); });
    },
    stato: function (id) {
      return (PD.progress && PD.progress.vita && PD.progress.vita[id]) || null;
    }
  };

  /* ------------------------------------------------------------------------
   *  Piccoli aiuti per chi scrive i simulatori
   * ---------------------------------------------------------------------- */
  var GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  function due(n) { return (n < 10 ? "0" : "") + n; }
  /* confronto tollerante: niente spazi, trattini, punti, barre; maiuscole = minuscole */
  function norm(s) { return String(s == null ? "" : s).toLowerCase().replace(/[\s\-.\/_]+/g, ""); }
  /* un giorno feriale fra n giorni (mai date fisse che invecchiano) */
  function giorno(n) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  }
  function dataLunga(d) { return GIORNI[d.getDay()] + " " + d.getDate() + " " + MESI[d.getMonth()] + " " + d.getFullYear(); }
  function dataBreve(d) { return due(d.getDate()) + "/" + due(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function ora(d) { d = d || new Date(); return due(d.getHours()) + ":" + due(d.getMinutes()); }

  /* Disegna una schermata nella finta pagina. Gli elementi con data-az="nome" chiamano azioni.nome(el).
   * Premendo Invio in un campo si preme il pulsante con la classe «vs-primario» della stessa schermata. */
  function schermo(box, html, azioni) {
    box.innerHTML = html;
    box._vitaAz = azioni || {};
    if (!box._vitaLegato) {
      box._vitaLegato = true;
      box.addEventListener("click", function (e) {
        var t = e.target.closest ? e.target.closest("[data-az]") : null;
        if (!t || !box.contains(t)) return;
        var f = box._vitaAz && box._vitaAz[t.getAttribute("data-az")];
        if (f) { e.preventDefault(); if (!t.disabled) f(t, e); }
      });
      box.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" || !e.target || e.target.tagName !== "INPUT") return;
        var p = $(".vs-primario", box); if (p) { e.preventDefault(); p.click(); }
      });
    }
    var sc = box.closest ? box.closest(".vita-browser") : null;
    if (sc && box.parentNode) { box.scrollTop = 0; portaInVista(sc); }
  }
  /* dopo un cambio di pagina, se la finta finestra e' finita sotto la guida, la riporta in vista */
  /* parte alta dello schermo coperta da elementi fissi: la guida (schermi larghi) o la sola fascia PROVA (telefono) */
  function coperto() {
    var g = $(".vita-guida"), f = $(".vita-prova");
    if (g && window.getComputedStyle(g).position === "sticky") return g.getBoundingClientRect().bottom;
    return f ? f.getBoundingClientRect().bottom : 0;
  }
  function portaInVista(elem) {
    var r = elem.getBoundingClientRect(), sopra = coperto();
    if (r.top < sopra - 4) window.scrollBy(0, r.top - sopra - 8);
  }
  /* sul telefono la guida non resta fissa: a ogni nuovo passo la si riporta sotto gli occhi */
  function guidaInVista() {
    var g = $(".vita-guida");
    if (!g || window.getComputedStyle(g).position === "sticky") return;
    var r = g.getBoundingClientRect(), sopra = coperto();
    if (r.top < sopra - 2 || r.top > window.innerHeight * 0.45) window.scrollBy(0, r.top - sopra - 6);
  }
  PD.vita.aiuti = { schermo: schermo, norm: norm, giorno: giorno, dataLunga: dataLunga, dataBreve: dataBreve, ora: ora };

  /* ------------------------------------------------------------------------
   *  Voce: i messaggi detti nello stesso istante (bravo + passo) si leggono insieme
   * ---------------------------------------------------------------------- */
  var coda = [], codaTimer = null;
  function dici(t) {
    if (!PD.settings.voice || !t) return;
    coda.push(t); clearTimeout(codaTimer);
    codaTimer = setTimeout(function () { var s = coda.join(" "); coda = []; if (corrente) PD.speak(s); }, 80);
  }
  function zitto() { clearTimeout(codaTimer); coda = []; if (PD.stopSpeech) PD.stopSpeech(); }

  /* ------------------------------------------------------------------------
   *  Esecuzione di un simulatore
   * ---------------------------------------------------------------------- */
  var corrente = null;
  window.addEventListener("hashchange", function () {
    if (corrente && location.hash.indexOf("#/vita/") !== 0) { corrente = null; zitto(); }
  });

  function iconaTel(t) {
    t = String(t || "").toLowerCase();
    if (t.indexOf("sms") >= 0 || t.indexOf("messagg") >= 0) return "💬";
    if (t.indexOf("mail") >= 0 || t.indexOf("posta") >= 0) return "✉️";
    if (t.indexOf("banca") >= 0) return "🏦";
    if (t.indexOf("chiamata") >= 0 || t.indexOf("telefon") >= 0) return "📞";
    return "📱";
  }
  function urlHTML(url) {
    var m = String(url || "").match(/^(https?:\/\/)?(www\.)?([^\/?#]+)(.*)$/i);
    if (!m) return esc(url);
    return '<span class="vita-url-p">' + esc((m[1] || "") + (m[2] || "")) + "</span><b>" + esc(m[3]) + '</b><span class="vita-url-p">' + esc(m[4] || "") + "</span>";
  }

  function avvia(el, sim) {
    zitto();
    var run = { sim: sim, errori: 0, testo: "", campi: {}, finito: false };
    corrente = run;
    el.innerHTML =
      '<div class="vita-run">' +
      '<div class="lesson-head vita-head"><span class="big-ico" aria-hidden="true">' + esc(sim.icona) + "</span><div>" +
      '<div class="small muted">🏛️ Palestra della vita digitale' + (sim.durata ? " · circa " + esc(sim.durata) : "") + "</div><h1>" + esc(sim.titolo) + "</h1></div>" +
      '<button class="btn ghost vita-esci" type="button" style="margin-left:auto">✕ Esci</button></div>' +
      '<div class="vita-prova" role="note">🧪 <b>PROVA</b> — è una simulazione: niente di reale<span class="vita-prova-lungo">, nessun dato esce dal computer</span></div>' +
      '<div class="vita-guida">' +
      '<div class="vita-fumetto-riga"><div class="vita-prof" aria-hidden="true">' + PD.profHTML() + "</div>" +
      '<div class="vita-fumetto"><div class="vita-esito" aria-live="polite"></div><div class="vita-testo" aria-live="polite"></div>' +
      '<div class="vita-fumetto-piede"><button class="btn ghost vita-aiuto" type="button">💡 Aiutami</button>' +
      '<span class="small muted vita-conta"></span></div></div></div></div>' +
      '<div class="vita-scena">' +
      '<div class="vita-browser" role="region" aria-label="Finta finestra del browser">' +
      '<div class="vita-barra"><span class="vita-pallini" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="vita-frecce" aria-hidden="true">← →</span>' +
      '<div class="vita-url" title="Indirizzo del sito (finto)"><span class="vita-lucchetto" aria-label="Collegamento protetto">🔒</span><span class="vita-url-testo"></span></div></div>' +
      '<div class="vita-pagina"></div></div>' +
      '<div class="vita-lato"><div class="vita-foglio" hidden></div><div class="vita-tel" hidden></div></div>' +
      "</div>" +
      '<div class="vita-fine" hidden></div></div>';

    var R = $(".vita-run", el), box = $(".vita-pagina", el), scena = $(".vita-scena", el);
    var fumetto = $(".vita-fumetto", el), esito = $(".vita-esito", el), testoEl = $(".vita-testo", el);
    var foglioEl = $(".vita-foglio", el), telEl = $(".vita-tel", el), lato = $(".vita-lato", el);
    function vivo() { return corrente === run && !run.finito; }
    function aggiornaLato() {
      var c = !foglioEl.hidden || !telEl.hidden;
      scena.className = "vita-scena" + (c ? " con-lato" : "");
      lato.hidden = !c;
    }
    function contaErr() {
      $(".vita-conta", el).textContent = run.errori ? "Piccoli sbagli finora: " + run.errori : "";
    }
    function scuoti(cls) {
      fumetto.classList.remove("vita-scuoti"); fumetto.classList.remove("vita-ok");
      void fumetto.offsetWidth;
      fumetto.classList.add(cls);
    }

    var ctx = {
      passo: function (t) {
        if (!vivo()) return;
        run.testo = String(t || "");
        testoEl.innerHTML = PD.md(run.testo);
        dici(run.testo);
        guidaInVista();
      },
      bravo: function (t) {
        if (!vivo()) return;
        esito.className = "vita-esito ok";
        esito.innerHTML = "✅ " + PD.md(t || "Bravi!").replace(/^<p>|<\/p>$/g, "");
        scuoti("vita-ok");
        dici(t);
      },
      errore: function (t) {
        if (!vivo()) return;
        run.errori++; contaErr();
        esito.className = "vita-esito sbaglio";
        esito.innerHTML = "💡 " + PD.md(t || "Non è questo: riprovate con calma.").replace(/^<p>|<\/p>$/g, "");
        scuoti("vita-scuoti");
        dici(t);
        portaInVista(fumetto); guidaInVista();
      },
      telefono: function (o) {
        if (!vivo()) return;
        if (!o) { telEl.hidden = true; telEl.innerHTML = ""; aggiornaLato(); return; }
        var pulsanti = o.pulsanti || [];
        telEl.innerHTML =
          '<div class="vita-tel-cornice" role="region" aria-label="Finto telefono"><div class="vita-tel-cam" aria-hidden="true"></div>' +
          '<div class="vita-tel-stato"><span>' + ora() + '</span><span aria-hidden="true">📶 🔋</span></div>' +
          '<div class="vita-tel-schermo"><div class="vita-tel-app">' + iconaTel(o.titolo) + " " + esc(o.titolo || "Telefono") + "</div>" +
          '<div class="vita-notifica">' + (o.mittente ? '<div class="vita-mitt">' + esc(o.mittente) + "</div>" : "") +
          '<div class="vita-msg">' + esc(o.testo || "").replace(/\n/g, "<br>") + "</div></div>" +
          '<div class="vita-tel-pulsanti">' + pulsanti.map(function (p, i) {
            return '<button type="button" class="vita-tel-btn' + (p.stile ? " " + esc(p.stile) : "") + '" data-i="' + i + '">' + esc(p.testo) + "</button>";
          }).join("") + "</div></div>" +
          '<div class="vita-tel-tasto" aria-hidden="true"></div></div>';
        $$(".vita-tel-btn", telEl).forEach(function (b) {
          b.onclick = function () { var p = pulsanti[+b.getAttribute("data-i")]; if (p && p.azione && vivo()) p.azione(); };
        });
        telEl.hidden = false; aggiornaLato();
        telEl.classList.remove("vibra"); void telEl.offsetWidth; telEl.classList.add("vibra");
        if (window.innerWidth <= 900) setTimeout(function () { try { telEl.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { telEl.scrollIntoView(); } }, 150);
      },
      fine: function (o) {
        if (!vivo()) return;
        o = o || {};
        run.finito = true;
        PD.progress.vita = PD.progress.vita || {};
        var prima = PD.progress.vita[sim.id] || {};
        PD.progress.vita[sim.id] = { fatto: true, volte: (prima.volte || 0) + 1, errori: run.errori, quando: new Date().toISOString() };
        PD.saveProgress();
        var e = run.errori;
        var frase = e === 0 ? "Nessuno sbaglio: perfetto!" : e === 1 ? "Un solo piccolo sbaglio: ottimo lavoro!"
          : e + " piccoli sbagli: è normalissimo. Sbagliare qui non costa niente ed è il modo migliore per imparare.";
        scena.hidden = true;
        esito.className = "vita-esito ok"; esito.innerHTML = "🏅 Simulazione completata!";
        testoEl.innerHTML = PD.md(o.messaggio || "Ce l'avete fatta!");
        scuoti("vita-ok");
        var fin = $(".vita-fine", el);
        fin.innerHTML = '<div class="card vita-fine-card"><div class="vita-medaglia" aria-hidden="true">🏅</div>' +
          "<h2>Ce l'avete fatta!</h2>" + PD.md(o.messaggio || "") +
          '<p class="vita-errori ' + (e ? "" : "zero") + '">' + (e ? "💡 " : "⭐ ") + esc(frase) + "</p>" +
          ((o.consigli && o.consigli.length) ? '<h3>Da ricordare nella vita reale</h3><ul class="vita-consigli">' +
            o.consigli.map(function (c) { return "<li>" + PD.md(c).replace(/^<p>|<\/p>$/g, "") + "</li>"; }).join("") + "</ul>" : "") +
          (sim.digcomp && sim.digcomp.length ? '<p class="small muted">Competenze digitali allenate (DigComp): ' + esc(sim.digcomp.join(", ")) + "</p>" : "") +
          '<div class="row"><button class="btn big vita-rifai" type="button">🔁 Rifai</button>' +
          '<button class="btn big ghost" type="button" data-go="#/vita">🏛️ Torna alla Vita digitale</button></div></div>';
        fin.hidden = false;
        $(".vita-rifai", fin).onclick = function () { avvia(el, sim); window.scrollTo(0, 0); };
        dici((o.messaggio || "Ce l'avete fatta!") + " " + frase);
        $(".vita-fumetto-piede", el).hidden = true;
        window.scrollTo(0, 0);
      },
      esci: function () { corrente = null; zitto(); PD.go("#/vita"); },
      /* --- aggiunte facoltative --- */
      indirizzo: function (url, sicuro) {
        if (corrente !== run) return;
        $(".vita-url-testo", el).innerHTML = urlHTML(url);
        var l = $(".vita-lucchetto", el), u = $(".vita-url", el);
        if (sicuro === false) { l.textContent = "⚠️"; l.setAttribute("aria-label", "Non sicuro"); u.classList.add("non-sicuro"); }
        else { l.textContent = "🔒"; l.setAttribute("aria-label", "Collegamento protetto"); u.classList.remove("non-sicuro"); }
      },
      foglio: function (o) {
        if (!vivo()) return;
        if (!o) { foglioEl.hidden = true; foglioEl.innerHTML = ""; aggiornaLato(); return; }
        foglioEl.innerHTML = (o.titolo ? '<div class="vita-foglio-tit">' + esc(o.titolo) + "</div>" : "") + (o.html || "");
        foglioEl.hidden = false; aggiornaLato();
      },
      controlla: function (campi) {
        for (var i = 0; i < campi.length; i++) {
          var c = campi[i], v = c.el.value, ok = c.confronta ? c.confronta(v) : norm(v) === norm(c.atteso);
          var k = c.chiave || c.el.id || c.nome;
          if (ok) { c.el.classList.remove("vita-sbagliato"); c.el.removeAttribute("aria-invalid"); continue; }
          run.campi[k] = (run.campi[k] || 0) + 1;
          c.el.classList.add("vita-sbagliato"); c.el.setAttribute("aria-invalid", "true");
          ctx.errore((String(v).replace(/\s/g, "") === "" ? "Manca " + c.nome + ". " : "Controllate " + c.nome + ". ") + (c.aiuto || ""));
          if (run.campi[k] >= 2 && !c.el._vitaCompila) {
            var b = document.createElement("button");
            b.type = "button"; b.className = "vita-compila"; b.textContent = "✍️ Compila per me";
            b.onclick = function (cc, bb) {
              return function () { cc.el.value = cc.mostra || cc.atteso; cc.el.classList.remove("vita-sbagliato"); cc.el.removeAttribute("aria-invalid"); bb.parentNode.removeChild(bb); cc.el._vitaCompila = false; cc.el.focus(); };
            }(c, b);
            c.el._vitaCompila = true;
            c.el.parentNode.insertBefore(b, c.el.nextSibling);
          }
          try { c.el.focus(); } catch (e) { /* ignora */ }
          return false;
        }
        return true;
      }
    };

    $(".vita-esci", el).onclick = function () { ctx.esci(); };
    $(".vita-aiuto", el).onclick = function () {
      esito.className = "vita-esito"; esito.innerHTML = "";
      scuoti("vita-ok");
      if (run.testo) { zitto(); dici("Ecco che cosa fare. " + run.testo); }
      $$("[data-vita-aiuto]", box).forEach(function (x) {
        x.classList.remove("vita-indica"); void x.offsetWidth; x.classList.add("vita-indica");
        setTimeout(function () { x.classList.remove("vita-indica"); }, 4200);
      });
      portaInVista(fumetto); guidaInVista();
    };
    ctx.indirizzo(sim.indirizzo || "https://www.borgoprova.it");
    aggiornaLato(); contaErr();
    try { sim.avvia(box, ctx); }
    catch (e) {
      if (window.console) console.error(e);
      box.innerHTML = '<div class="notice">Questa simulazione non è partita per un errore interno. Tornate indietro e riprovate.</div>';
    }
  }

  /* ------------------------------------------------------------------------
   *  Vista: indice e simulatore
   * ---------------------------------------------------------------------- */
  PD.views.vita = function (el, args) {
    var sim = args && args[0] ? PD.vita.elenco().filter(function (s) { return s.id === args[0]; })[0] : null;
    if (sim) { avvia(el, sim); return; }
    if (corrente) { corrente = null; zitto(); }
    var L = PD.vita.elenco();
    var fatti = L.filter(function (s) { var st = PD.vita.stato(s.id); return st && st.fatto; }).length;
    el.innerHTML =
      '<div class="vita-indice">' +
      '<div class="hero vita-hero">' + PD.profHTML() + "<div><h1>🏛️ Palestra della vita digitale</h1>" +
      '<p class="lead">Qui potete provare, <b>senza nessun rischio</b>, le cose della vita di tutti i giorni che a volte fanno paura: ' +
      "entrare con l'identità digitale, prenotare una visita, pagare un avviso, usare la banca e i messaggi.</p>" +
      "<p>Tutto è <b>finto</b>: siti, telefono, codici e soldi. Il Professore vi guida passo passo e, se sbagliate, vi dà un suggerimento. " +
      "Sbagliare qui non costa niente: anzi, è il modo migliore per imparare.</p></div></div>" +
      '<div class="notice info">🚩 In ogni prova si nasconde almeno una <b>trappola</b>, come nella vita vera: un messaggio truffa o un sito falso. ' +
      "Imparate a riconoscerla!</div>" +
      (L.length ? '<div class="vita-avanz"><span>Prove completate: <b>' + fatti + " su " + L.length + '</b></span><div class="progress"><span style="width:' +
        Math.round(fatti / L.length * 100) + '%"></span></div></div>' : "") +
      '<div class="grid vita-griglia">' + L.map(function (s) {
        var st = PD.vita.stato(s.id);
        return '<button class="card tile vita-tile' + (st && st.fatto ? " fatto" : "") + '" type="button" data-go="#/vita/' + esc(s.id) + '" data-sim="' + esc(s.id) + '">' +
          '<span class="big-ico" aria-hidden="true">' + esc(s.icona) + "</span>" +
          "<h3>" + esc(s.titolo) + (st && st.fatto ? ' <span class="vita-fatto" title="Già fatto">✅</span>' : "") + "</h3>" +
          "<p>" + esc(s.descrizione) + "</p>" +
          '<span class="vita-tile-piede"><span class="small muted">⏱️ ' + esc(s.durata || "") +
          (st && st.fatto ? " · fatto " + st.volte + (st.volte === 1 ? " volta" : " volte") : "") + "</span>" +
          '<span class="vita-inizia">' + (st && st.fatto ? "🔁 Rifai" : "▶ Inizia") + "</span></span></button>";
      }).join("") + "</div>" +
      (L.length ? "" : '<p class="muted">Le simulazioni non sono disponibili.</p>') +
      '<p class="small muted vita-nota">Nelle prove non si scrive nessun dato vero e il computer non si collega a niente. ' +
      "Nella vita reale non date mai a nessuno le vostre password e i codici che arrivano sul telefono.</p></div>";
  };

  PD.hooks.homeTiles.push(function () {
    return PD.tileHTML("🏛️", "Palestra della vita digitale", "Provate senza rischi SPID, visite, pagamenti, banca e messaggi.", "#/vita");
  });

  /* ==========================================================================
   *  I SIMULATORI
   * ======================================================================== */

  /* piccoli pezzi comuni delle finte pagine */
  function testaSito(cls, ico, nome, sotto, destra) {
    return '<header class="vs-testa"><span class="vs-logo" aria-hidden="true">' + ico + "</span><div><b>" + esc(nome) + "</b>" +
      (sotto ? "<small>" + esc(sotto) + "</small>" : "") + "</div>" + (destra || "") + "</header>";
  }
  function sito(cls, corpo) { return '<div class="vs-sito ' + cls + '">' + corpo + "</div>"; }
  function campo(id, etichetta, opz) {
    opz = opz || {};
    return '<div class="vs-campo"><label for="' + id + '">' + etichetta + "</label>" +
      '<input id="' + id + '" type="' + (opz.tipo || "text") + '" autocomplete="off" autocapitalize="off" spellcheck="false"' +
      (opz.ph ? ' placeholder="' + esc(opz.ph) + '"' : "") + (opz.mode ? ' inputmode="' + opz.mode + '"' : "") + ">" +
      (opz.nota ? '<span class="vs-nota">' + opz.nota + "</span>" : "") + "</div>";
  }
  function piede(t) { return '<footer class="vs-piede">' + t + " · Sito di fantasia per esercitarsi</footer>"; }

  /* --------------------------------------------------------------------------
   *  a) Entrare con l'identità digitale
   * ------------------------------------------------------------------------ */
  function simIdentita(box, ctx) {
    var D = { utente: "mario.provetti", password: "Girasole48", codice: "47" };
    var foglietto = '<div class="vf-postit"><p><b>Gestore:</b> Identità Prova</p><p><b>Nome utente:</b><br><code>' + D.utente + "</code></p>" +
      "<p><b>Password:</b><br><code>" + D.password + '</code></p><p class="vf-piccolo">Dati inventati per la prova.</p></div>' +
      '<p class="small muted">Nella vita reale non tenete la password su un foglietto vicino al computer: conservatela in un posto sicuro.</p>';
    var comune = function (corpo, destra) {
      return sito("vs-comune", testaSito("", "🏰", "Comune di Borgoprova", "Sito ufficiale", destra) + corpo + piede("Comune di Borgoprova"));
    };

    /* 1. risultati della ricerca, con l'annuncio falso */
    function ricerca() {
      ctx.indirizzo("https://www.cercaprova.it/cerca?q=certificato+residenza+borgoprova");
      schermo(box, sito("vs-cerca",
        '<div class="vs-cerca-testa"><span class="vs-cerca-logo">Cerca<b>Prova</b></span><div class="vs-cerca-box">🔍 certificato residenza Borgoprova</div></div>' +
        '<div class="vs-risultati">' +
        '<div class="vs-ris vs-annuncio"><span class="vs-sponsor">Annuncio</span><span class="vs-ris-url">https://borgoprova-servizi.top</span>' +
        '<a href="#" data-az="falso" class="vs-ris-tit">Certificati di Borgoprova in 1 minuto — senza identità digitale!</a>' +
        "<p>Niente code e niente password. Basta il numero della carta d'identità. Servizio veloce garantito.</p></div>" +
        '<div class="vs-ris"><span class="vs-ris-url">https://www.comune.borgoprova.it › servizi</span>' +
        '<a href="#" data-az="vero" data-vita-aiuto class="vs-ris-tit">Comune di Borgoprova — Servizi online</a>' +
        "<p>Sito ufficiale del Comune. Certificati anagrafici, tributi, scuola. Accesso con identità digitale.</p></div>" +
        '<div class="vs-ris"><span class="vs-ris-url">https://www.giornaleprova.it › borgoprova</span>' +
        '<a href="#" data-az="giornale" class="vs-ris-tit">Borgoprova, nuovi orari dell\'ufficio anagrafe</a>' +
        "<p>Gli uffici del Comune ricevono anche su appuntamento…</p></div></div>"), {
        falso: function () {
          ctx.errore("Fermi! Guardate l'indirizzo: **borgoprova-servizi.top** non è il sito del Comune. È un **annuncio** a pagamento e promette «senza identità digitale»: è un trucco per rubare i dati. Scegliete il risultato con l'indirizzo **comune.borgoprova.it**.");
        },
        giornale: function () { ctx.errore("Questo è un giornale, non il Comune. Cercate il risultato con l'indirizzo comune.borgoprova.it."); },
        vero: function () { ctx.bravo("Giusto! Avete scelto il sito ufficiale e avete evitato l'annuncio falso."); home(); }
      });
      ctx.passo("Vogliamo il **certificato di residenza**. Abbiamo cercato su internet e sono usciti questi risultati. Attenzione: uno è una **trappola**. " +
        "Leggete l'indirizzo scritto sopra ogni titolo e aprite il sito **vero** del Comune di Borgoprova.");
    }
    /* 2. pagina iniziale del Comune */
    function home() {
      ctx.indirizzo("https://www.comune.borgoprova.it");
      schermo(box, comune(
        '<nav class="vs-menu"><a href="#" data-az="altro">Notizie</a><a href="#" data-az="altro">Uffici e orari</a>' +
        '<a href="#" data-az="servizi" data-vita-aiuto class="vs-menu-forte">Servizi online</a><a href="#" data-az="altro">Contatti</a></nav>' +
        '<div class="vs-banda"><h2>Benvenuti a Borgoprova</h2><p>Il Comune è anche online: certificati, pagamenti e iscrizioni da casa.</p></div>' +
        '<div class="vs-colonne"><div class="vs-box"><h3>📰 Notizie</h3><p>Sabato mercato in piazza. Dal lunedì nuovi orari della biblioteca.</p></div>' +
        '<div class="vs-box"><h3>🕘 Ufficio anagrafe</h3><p>Lunedì-venerdì 9-12. Molti certificati si possono avere online.</p></div></div>'), {
        altro: function () { ctx.errore("Qui non ci sono i certificati. Cercate nel menu la voce «Servizi online»."); },
        servizi: function () { ctx.bravo("Bene!"); servizi(); }
      });
      ctx.passo("Ora siete sul sito del Comune. Guardate in alto, nella barra dell'indirizzo: c'è il **lucchetto 🔒** e c'è scritto **comune.borgoprova.it**. " +
        "È il sito giusto. Adesso premete **«Servizi online»** nel menu.");
    }
    /* 3. elenco dei servizi */
    function servizi() {
      ctx.indirizzo("https://www.comune.borgoprova.it/servizi-online");
      var S = [["tributi", "🗑️", "Tassa sui rifiuti"], ["anagrafe", "📄", "Certificati anagrafici"], ["scuola", "🏫", "Iscrizioni scolastiche"], ["sosta", "🅿️", "Permessi di sosta"]];
      schermo(box, comune('<div class="vs-corpo"><h2>Servizi online</h2><p>Scegliete il servizio che vi serve.</p><div class="vs-servizi">' +
        S.map(function (s) { return '<button type="button" class="vs-servizio" data-az="' + s[0] + '"' + (s[0] === "anagrafe" ? " data-vita-aiuto" : "") + '><span aria-hidden="true">' + s[1] + "</span>" + s[2] + "</button>"; }).join("") +
        "</div></div>"), {
        tributi: sbagliato, scuola: sbagliato, sosta: sbagliato,
        anagrafe: function () { ctx.bravo("Esatto: il certificato di residenza è un certificato anagrafico."); accesso(); }
      });
      function sbagliato() { ctx.errore("Questo servizio non c'entra. Il certificato di residenza si trova in **«Certificati anagrafici»**."); }
      ctx.passo("Ecco i servizi del Comune. Quale contiene il certificato di residenza? Premete **«Certificati anagrafici»**.");
    }
    /* 4. richiesta di accesso */
    function accesso() {
      schermo(box, comune('<div class="vs-corpo vs-centro"><h2>📄 Certificati anagrafici</h2>' +
        "<p>Per richiedere un certificato dovete farvi riconoscere. Scegliete come entrare:</p>" +
        '<div class="vs-accessi"><button type="button" class="vs-btn vs-btn-grande" data-az="id" data-vita-aiuto>🔑 Entra con identità digitale</button>' +
        '<button type="button" class="vs-btn vs-btn-sec vs-btn-grande" data-az="cie">🪪 Entra con carta d\'identità elettronica</button></div>' +
        '<p class="vs-nota">Il Comune non vi chiederà mai la password per email o per telefono.</p></div>'), {
        cie: function () { ctx.passo("Anche la **carta d'identità elettronica** è una strada giusta, nella realtà. Oggi però proviamo l'identità digitale: premete **«Entra con identità digitale»**."); },
        id: function () { ctx.bravo("Perfetto."); gestori(); }
      });
      ctx.passo("Il Comune deve sapere chi siete. Premete **«Entra con identità digitale»**. (Nella realtà assomiglia allo SPID.)");
    }
    /* 5. scelta del gestore */
    function gestori() {
      ctx.foglio({ titolo: "📝 Il vostro foglietto", html: foglietto });
      var G = ["Chiave Sicura Prova", "Identità Prova", "Accesso Amico Prova", "Firma Facile Prova"];
      schermo(box, comune('<div class="vs-corpo"><h2>🔑 Entra con identità digitale</h2><p>Scegliete il vostro gestore di identità digitale:</p>' +
        '<div class="vs-gestori">' + G.map(function (g, i) {
          return '<button type="button" class="vs-gestore" data-az="g' + i + '"' + (i === 1 ? " data-vita-aiuto" : "") + '><span class="vs-g-ico" aria-hidden="true">' + ["🛡️", "🟢", "🤝", "✒️"][i] + "</span>" + esc(g) + "</button>";
        }).join("") + "</div></div>"), {
        g0: no, g2: no, g3: no,
        g1: function () { ctx.bravo("Giusto, il vostro gestore è Identità Prova."); login(); }
      });
      function no() { ctx.errore("Questo non è il vostro gestore. Guardate il **foglietto**: c'è scritto «Identità Prova»."); }
      ctx.passo("Ognuno ha un **gestore**, cioè chi gli ha dato l'identità digitale. Sul **foglietto** accanto c'è scritto il vostro. Trovatelo nell'elenco e premetelo.");
    }
    /* 6. nome utente e password */
    function login() {
      ctx.indirizzo("https://login.identitaprova.it");
      schermo(box, sito("vs-idp", testaSito("", "🟢", "Identità Prova", "Accesso sicuro") +
        '<div class="vs-corpo vs-form-stretto"><p class="vs-richiesta">Richiesta di accesso da: <b>Comune di Borgoprova</b></p>' +
        campo("vs-utente", "Nome utente", { ph: "es. nome.cognome" }) +
        campo("vs-pwd", "Password", { tipo: "password" }) +
        '<label class="vs-mostra"><input type="checkbox" id="vs-mostra"> Mostra la password</label>' +
        '<div class="row"><button type="button" class="vs-btn vs-primario" data-az="entra" data-vita-aiuto>Entra</button>' +
        '<a href="#" data-az="dimenticata" class="small">Password dimenticata?</a></div></div>' + piede("Identità Prova")), {
        dimenticata: function () { ctx.passo("Nella realtà da qui si recupera la password. Oggi la password è sul **foglietto**: scrivetela e premete **«Entra»**."); },
        entra: function () {
          var ok = ctx.controlla([
            { el: $("#vs-utente", box), atteso: D.utente, nome: "il nome utente", aiuto: "Copiatelo dal foglietto: mario.provetti (con il punto in mezzo)." },
            { el: $("#vs-pwd", box), atteso: D.password, nome: "la password", aiuto: "Copiatela dal foglietto: Girasole48. Potete premere «Mostra la password» per vedere cosa avete scritto." }
          ]);
          if (ok) { ctx.bravo("Dati giusti!"); attesa(); }
        }
      });
      $("#vs-mostra", box).onchange = function () { $("#vs-pwd", box).type = this.checked ? "text" : "password"; };
      setTimeout(function () { try { $("#vs-utente", box).focus({ preventScroll: true }); } catch (e) { /* ignora */ } }, 50);
      ctx.passo("Questa è la pagina del gestore: guardate l'indirizzo, **login.identitaprova.it**, con il lucchetto. Scrivete il **nome utente** e la **password** del foglietto, poi premete **«Entra»**. " +
        "Non preoccupatevi delle maiuscole: qui la prova è tollerante (nella realtà contano).");
    }
    /* 7. trappola: SMS che chiede il codice per telefono */
    function attesa() {
      ctx.foglio(null);
      schermo(box, sito("vs-idp", testaSito("", "🟢", "Identità Prova", "Accesso sicuro") +
        '<div class="vs-corpo vs-centro"><h2>📱 Conferma sul telefono</h2><p>Aprite l\'app <b>Identità Prova</b> sul vostro telefono e autorizzate l\'accesso.</p>' +
        '<p>Numero di controllo:</p><div class="vs-numero" aria-label="Numero di controllo ' + D.codice + '">' + D.codice + "</div>" +
        '<p class="vs-nota">Il numero sul telefono deve essere uguale a questo.</p><p class="vs-attesa">⏳ In attesa della conferma…</p></div>' + piede("Identità Prova")), {});
      ctx.telefono({
        titolo: "SMS", mittente: "Numero sconosciuto",
        testo: "IDENTITA PROVA - Assistenza: per completare l'accesso vi chiamerà un nostro operatore. Comunicategli il codice che vedete sullo schermo. Se non lo fate entro 10 minuti l'account sarà bloccato.",
        pulsanti: [
          { testo: "📞 Aspetto la chiamata e do il codice", azione: function () {
            ctx.errore("No! Nessun gestore, banca o Comune vi chiederà **mai** di dire un codice al telefono. Chi lo chiede è un truffatore: con quel codice entrerebbe al posto vostro. E la fretta («entro 10 minuti») è un trucco.");
          } },
          { testo: "🗑️ Non rispondo e lo elimino", stile: "verde", azione: function () {
            ctx.bravo("Bravissimi! Era una **truffa**: i codici non si dicono a nessuno, nemmeno a chi dice di essere un operatore.");
            notifica();
          } }
        ]
      });
      ctx.passo("Mentre aspettate, sul telefono è arrivato un **SMS**. Leggetelo con attenzione. Che cosa fate?");
    }
    /* 8. notifica vera da autorizzare */
    function notifica() {
      ctx.telefono({
        titolo: "App Identità Prova", mittente: "Richiesta di accesso",
        testo: "Autorizzi l'accesso a Comune di Borgoprova?\n\nNumero di controllo: " + D.codice + "\nOggi, ore " + ora(),
        pulsanti: [
          { testo: "✅ Autorizza", stile: "verde", azione: function () { ctx.bravo("Accesso autorizzato!"); area(); } },
          { testo: "❌ Nega", azione: function () {
            ctx.errore("Il numero è uguale (" + D.codice + ") e l'accesso l'avete chiesto voi proprio adesso: potete autorizzare. «Nega» si usa quando arriva una richiesta che **non** avete fatto voi.");
          } }
        ]
      });
      ctx.passo("Ora è arrivata la richiesta **vera**, dentro l'app Identità Prova. Confrontate il **numero di controllo** sul telefono con quello sul computer. " +
        "Sono uguali e l'accesso lo avete chiesto voi? Allora premete **«Autorizza»** sul telefono.");
    }
    /* 9. area personale */
    function area() {
      ctx.telefono(null);
      ctx.indirizzo("https://www.comune.borgoprova.it/area-personale");
      var esci = '<button type="button" class="vs-esci" data-az="esci">👤 Mario Provetti · Esci</button>';
      var C = [["nascita", "Certificato di nascita"], ["residenza", "Certificato di residenza"], ["famiglia", "Stato di famiglia"]];
      schermo(box, comune('<div class="vs-corpo"><h2>Area personale</h2><p>Benvenuto, <b>Mario Provetti</b>. Ecco i certificati che potete scaricare gratis:</p>' +
        '<ul class="vs-lista">' + C.map(function (c) {
          return '<li><span>📄 ' + c[1] + '</span><button type="button" class="vs-btn vs-btn-sec" data-az="' + c[0] + '"' + (c[0] === "residenza" ? " data-vita-aiuto" : "") + ">⬇️ Scarica</button></li>";
        }).join("") + "</ul></div>", esci), {
        nascita: altro, famiglia: altro,
        esci: function () { ctx.passo("Uscire alla fine è giustissimo! Ma prima prendiamo il certificato: premete **«Scarica»** accanto a **«Certificato di residenza»**."); },
        residenza: function () { ctx.bravo("Ecco il certificato."); documento(); }
      });
      function altro() { ctx.errore("Questo è un altro certificato. A noi serve quello di **residenza**: premete «Scarica» sulla sua riga."); }
      ctx.passo("Siete entrati nella vostra **area personale** del Comune. Premete **«Scarica»** accanto a **«Certificato di residenza»**.");
    }
    /* 10. il certificato, il salvataggio e l'uscita */
    function documento() {
      var oggi = new Date(), salvato = false;
      var esci = '<button type="button" class="vs-esci" data-az="esci">👤 Mario Provetti · Esci</button>';
      schermo(box, comune('<div class="vs-corpo"><div class="vs-doc"><div class="vs-filigrana" aria-hidden="true">FAC-SIMILE · PROVA</div>' +
        '<p class="vs-doc-ente">🏰 COMUNE DI BORGOPROVA<br><small>Ufficio anagrafe</small></p><h3>CERTIFICATO DI RESIDENZA</h3>' +
        "<p>Si certifica che <b>PROVETTI MARIO</b>, nato a Borgoprova, risulta residente in questo Comune in <b>Via dei Tigli 1</b>.</p>" +
        "<p>Borgoprova, " + dataBreve(oggi) + '</p><p class="vs-doc-nota">Documento di prova senza alcun valore.</p></div>' +
        '<div class="row"><button type="button" class="vs-btn vs-primario" data-az="salva" data-vita-aiuto>💾 Salva sul computer</button></div>' +
        '<div class="vs-salvato" hidden></div></div>', esci), {
        salva: function () {
          salvato = true;
          var s = $(".vs-salvato", box); s.hidden = false;
          s.innerHTML = "✅ Salvato nella cartella <b>Scaricati</b> con il nome <code>certificato-residenza.pdf</code> <small>(per finta: nella prova non si salva niente)</small>";
          $(".vs-esci", box).setAttribute("data-vita-aiuto", "");
          ctx.bravo("Certificato salvato!");
          ctx.passo("Ultima cosa, importantissima: quando avete finito premete sempre **«Esci»**, in alto a destra, accanto al vostro nome. Così nessun altro può usare il vostro accesso.");
        },
        esci: function () {
          if (!salvato) { ctx.passo("Prima salviamo il certificato: premete **«Salva sul computer»**. Poi usciremo."); return; }
          ctx.indirizzo("https://www.comune.borgoprova.it");
          ctx.fine({
            messaggio: "Siete entrati nel sito del Comune con l'identità digitale, avete scaricato il certificato di residenza e siete usciti. E avete scoperto due trappole!",
            consigli: [
              "Prima di scrivere qualsiasi dato guardate la **barra dell'indirizzo**: lucchetto 🔒 e nome giusto del sito (per esempio *comune.borgoprova.it*, non *borgoprova-servizi.top*).",
              "Attenzione agli **annunci** in cima ai risultati di ricerca: possono portare a siti falsi.",
              "La **password** e i **codici** che arrivano sul telefono non si dicono **mai** a nessuno: né al telefono, né per SMS, né per email. Nemmeno a chi dice di essere un operatore.",
              "Autorizzate sul telefono **solo** gli accessi che avete chiesto voi in quel momento, e controllate che il numero sia lo stesso.",
              "Alla fine premete sempre **«Esci»**.",
              "Questa prova assomiglia allo **SPID** e alla **CIE**: nella realtà i passi sono molto simili. Se avete dubbi chiedete all'ufficio del vostro Comune."
            ]
          });
        }
      });
      ctx.passo("Ecco il vostro certificato (finto). Premete **«Salva sul computer»** per conservarlo.");
    }
    ricerca();
  }

  /* --------------------------------------------------------------------------
   *  b) Prenotare una visita medica
   * ------------------------------------------------------------------------ */
  function simVisita(box, ctx) {
    var D = { cf: "PRVMRA45C12Z000X", tessera: "34567", nre: "0800A1234567", nreMostra: "0800A 1234567", codPren: "SP-4821" };
    var scelta = null;
    var foglio = '<div class="vf-tessera"><div class="vf-tess-tit">TESSERA SANITARIA <small>— DI PROVA</small></div>' +
      '<div class="vf-tess-riga"><span>Cognome e nome</span><b>PROVETTI MARIO</b></div>' +
      '<div class="vf-tess-riga"><span>Codice fiscale</span><b>' + D.cf + "</b></div>" +
      '<div class="vf-tess-riga"><span>Numero tessera</span><b>80380 00000 000<u>34567</u></b></div></div>' +
      '<div class="vf-ricetta"><div class="vf-ric-tit">PROMEMORIA RICETTA <small>— FAC-SIMILE</small></div>' +
      '<div class="vf-tess-riga"><span>Codice ricetta</span><b>' + D.nreMostra + "</b></div>" +
      '<div class="vf-tess-riga"><span>Prescrizione</span><b>Visita cardiologica</b></div>' +
      '<div class="vf-tess-riga"><span>Priorità</span><b>P (programmata)</b></div>' +
      '<p class="vf-piccolo">Dati inventati per la prova.</p></div>';
    var salute = function (corpo) { return sito("vs-salute", testaSito("", "➕", "Salute Prova", "Prenotazioni sanitarie della regione (di prova)") + corpo + piede("Salute Prova")); };

    function home(perDisdire) {
      ctx.indirizzo("https://www.saluteprova.it");
      schermo(box, salute('<div class="vs-corpo"><h2>Cosa volete fare?</h2><div class="vs-servizi">' +
        '<button type="button" class="vs-servizio" data-az="prenota"' + (perDisdire ? "" : " data-vita-aiuto") + '><span aria-hidden="true">📅</span>Prenota una visita o un esame</button>' +
        '<button type="button" class="vs-servizio" data-az="referti"><span aria-hidden="true">📋</span>Referti</button>' +
        '<button type="button" class="vs-servizio" data-az="ticket"><span aria-hidden="true">💶</span>Paga il ticket</button>' +
        '<button type="button" class="vs-servizio" data-az="disdici"' + (perDisdire ? " data-vita-aiuto" : "") + '><span aria-hidden="true">✖️</span>Disdici una prenotazione</button></div></div>'), {
        prenota: function () { if (perDisdire) { ctx.errore("Ora non vogliamo prenotare, ma **disdire**: premete «Disdici una prenotazione»."); return; } ctx.bravo("Bene."); paziente(); },
        referti: function () { ctx.errore("I referti sono i risultati delle visite. Noi " + (perDisdire ? "vogliamo disdire: premete «Disdici una prenotazione»." : "vogliamo prenotare: premete «Prenota una visita o un esame».")); },
        ticket: function () { ctx.errore("Il ticket si paga dopo aver prenotato. " + (perDisdire ? "Ora premete «Disdici una prenotazione»." : "Prima premete «Prenota una visita o un esame».")); },
        disdici: function () { if (!perDisdire) { ctx.errore("Prima prenotiamo! Premete «Prenota una visita o un esame»."); return; } ctx.bravo("Giusto."); disdetta(); }
      });
      if (perDisdire) ctx.passo("Ora immaginiamo che non possiate più andare alla visita. **Disdire è importante**: si libera il posto per un altro malato. Premete **«Disdici una prenotazione»**.");
      else ctx.passo("Il medico vi ha dato una ricetta per una **visita cardiologica**. Siete sul sito **Salute Prova** (guardate l'indirizzo: saluteprova.it, con il lucchetto). Premete **«Prenota una visita o un esame»**.");
    }
    function paziente() {
      ctx.foglio({ titolo: "🗂️ Tessera e ricetta", html: foglio });
      schermo(box, salute('<div class="vs-corpo vs-form-stretto"><h2>1. Chi è il paziente</h2>' +
        campo("vs-cf", "Codice fiscale", { ph: "16 lettere e numeri" }) +
        campo("vs-tess", "Ultime 5 cifre della tessera sanitaria", { mode: "numeric", nota: "Le trovate sul retro della tessera." }) +
        '<button type="button" class="vs-btn vs-primario" data-az="avanti" data-vita-aiuto>Avanti →</button></div>'), {
        avanti: function () {
          if (ctx.controlla([
            { el: $("#vs-cf", box), atteso: D.cf, nome: "il codice fiscale", aiuto: "Copiatelo con calma dalla tessera, lettera per lettera: " + D.cf + "." },
            { el: $("#vs-tess", box), confronta: function (v) { var n = norm(v); return n === D.tessera || n === "803800000000034567"; }, atteso: D.tessera, nome: "le ultime 5 cifre della tessera", aiuto: "Sono le ultime 5 cifre del numero, quelle sottolineate: 34567." }
          ])) { ctx.bravo("Dati del paziente giusti."); ricetta(); }
        }
      });
      ctx.passo("Accanto trovate la **tessera sanitaria** e il **promemoria della ricetta** (finti). Scrivete il **codice fiscale** e le **ultime 5 cifre** del numero della tessera, poi premete **«Avanti»**.");
    }
    function ricetta() {
      schermo(box, salute('<div class="vs-corpo vs-form-stretto"><h2>2. La ricetta</h2>' +
        campo("vs-nre", "Codice della ricetta (NRE)", { ph: "es. 0800A 0000000", nota: "È scritto in alto sul promemoria della ricetta." }) +
        '<button type="button" class="vs-btn vs-primario" data-az="avanti" data-vita-aiuto>Avanti →</button></div>'), {
        avanti: function () {
          if (ctx.controlla([{ el: $("#vs-nre", box), atteso: D.nre, mostra: D.nreMostra, nome: "il codice della ricetta", aiuto: "Copiatelo dal promemoria: " + D.nreMostra + " (gli spazi non contano)." }])) {
            ctx.bravo("Ricetta trovata: visita cardiologica."); date();
          }
        }
      });
      ctx.passo("Ora scrivete il **codice della ricetta**: lo trovate sul promemoria, accanto a «Codice ricetta». Poi premete **«Avanti»**.");
    }
    function date() {
      var P = [
        { luogo: "Poliambulatorio di Borgoprova", via: "Via della Fonte 3 · vicino a casa", d: giorno(12), ora: "10:30" },
        { luogo: "Ospedale di Valleprova", via: "a 25 km", d: giorno(8), ora: "09:00" },
        { luogo: "Casa della salute di Montebosco", via: "a 12 km", d: giorno(20), ora: "15:45" }
      ];
      schermo(box, salute('<div class="vs-corpo"><h2>3. Scegliete dove e quando</h2><p class="vs-richiesta">Visita cardiologica · priorità P</p>' +
        '<div class="vs-proposte">' + P.map(function (p, i) {
          return '<button type="button" class="vs-proposta" data-az="p' + i + '"' + (i === 0 ? " data-vita-aiuto" : "") + "><b>" + esc(p.luogo) + "</b><span>" + esc(p.via) + "</span>" +
            '<span class="vs-quando">📅 ' + dataLunga(p.d) + " · ore " + p.ora + "</span></button>";
        }).join("") + '</div><p class="vs-nota">Se nessuna data va bene, nella realtà si può chiedere di vederne altre.</p></div>'), {
        p0: function () { sceglie(P[0]); }, p1: function () { sceglie(P[1]); }, p2: function () { sceglie(P[2]); }
      });
      function sceglie(p) { scelta = p; ctx.bravo("Avete scelto: " + p.luogo + "."); riepilogo(); }
      ctx.passo("Il sito propone **tre appuntamenti**. Scegliete quello che preferite: guardate il **luogo**, il **giorno** e l'**ora**. Per esempio quello di Borgoprova è vicino a casa.");
    }
    function riepilogo() {
      ctx.foglio(null);
      schermo(box, salute('<div class="vs-corpo vs-form-stretto"><h2>4. Controllate e confermate</h2>' +
        '<dl class="vs-riep"><dt>Paziente</dt><dd>PROVETTI MARIO</dd><dt>Visita</dt><dd>Visita cardiologica</dd><dt>Dove</dt><dd>' + esc(scelta.luogo) + "</dd>" +
        "<dt>Quando</dt><dd>" + dataLunga(scelta.d) + ", ore " + scelta.ora + "</dd></dl>" +
        '<label class="vs-mostra"><input type="checkbox" id="vs-sms" checked> Voglio un SMS di promemoria</label>' +
        '<div class="row"><button type="button" class="vs-btn vs-primario" data-az="conferma" data-vita-aiuto>✔ Conferma la prenotazione</button>' +
        '<button type="button" class="vs-btn vs-btn-sec" data-az="indietro">← Cambia data</button></div></div>'), {
        indietro: function () { date(); },
        conferma: function () { ctx.bravo("Prenotazione confermata!"); confermata(); }
      });
      ctx.passo("Prima di confermare, **controllate** sempre il riepilogo: nome, tipo di visita, luogo, giorno e ora. Se è tutto giusto premete **«Conferma la prenotazione»**.");
    }
    function confermata() {
      ctx.indirizzo("https://www.saluteprova.it/prenotazione");
      schermo(box, salute('<div class="vs-corpo vs-centro"><div class="vs-ok-grande" aria-hidden="true">✅</div><h2>Prenotazione confermata</h2>' +
        '<p>Codice di prenotazione:</p><div class="vs-numero">' + D.codPren + "</div>" +
        "<p>" + esc(scelta.luogo) + "<br>" + dataLunga(scelta.d) + ", ore " + scelta.ora + "</p>" +
        '<p class="vs-nota">Il pagamento del ticket, se dovuto, si fa dopo, con i canali ufficiali. Non vi chiederemo mai di pagare con un link in un SMS.</p>' +
        '<button type="button" class="vs-btn vs-btn-sec" data-az="home">🏠 Torna alla pagina iniziale</button></div>'), {
        home: function () { ctx.passo("Un momento: prima guardate il **telefono**."); }
      });
      ctx.telefono({
        titolo: "SMS", mittente: "SalutePrv",
        testo: "Salute Prova: confermata Visita cardiologica " + dataBreve(scelta.d) + " ore " + scelta.ora + " presso " + scelta.luogo + ". Codice " + D.codPren + ". Per disdire: sito Salute Prova, «Disdici».",
        pulsanti: [{ testo: "👍 Ho letto", stile: "verde", azione: function () { ctx.bravo("Ottimo, conservate questo SMS: c'è il codice per disdire."); trappola(); } }]
      });
      ctx.passo("Fatto! Sul telefono è arrivato l'**SMS di conferma** con il giorno, l'ora e il **codice di prenotazione**. Leggetelo e premete **«Ho letto»**.");
    }
    function trappola() {
      ctx.telefono({
        titolo: "SMS", mittente: "Numero sconosciuto",
        testo: "AVVISO SANITA': la vostra prenotazione NON è ancora valida. Pagate 2 € entro oggi per confermarla: saluteprova-conferma.top/paga",
        pulsanti: [
          { testo: "💳 Apro il link e pago 2 €", azione: function () {
            ctx.errore("Fermi! È una **truffa**: la prenotazione è già confermata e nessun servizio sanitario chiede di pagare con un link in un SMS. Guardate l'indirizzo strano: **saluteprova-conferma.top**. Con quei «2 €» rubano i dati della carta.");
          } },
          { testo: "🗑️ È una truffa: lo elimino", stile: "verde", azione: function () {
            ctx.bravo("Bravissimi! Avete riconosciuto la truffa.");
            ctx.telefono(null); home(true);
          } }
        ]
      });
      ctx.passo("Pochi minuti dopo arriva **un altro SMS**. Leggetelo bene: è vero o è una trappola?");
    }
    function disdetta() {
      ctx.indirizzo("https://www.saluteprova.it/disdici");
      schermo(box, salute('<div class="vs-corpo vs-form-stretto"><h2>Disdici una prenotazione</h2>' +
        campo("vs-cf2", "Codice fiscale") + campo("vs-cod", "Codice di prenotazione", { ph: "es. SP-0000", nota: "È scritto nell'SMS di conferma." }) +
        '<button type="button" class="vs-btn vs-primario" data-az="cerca" data-vita-aiuto>🔍 Cerca la prenotazione</button></div>'), {
        cerca: function () {
          if (ctx.controlla([
            { el: $("#vs-cf2", box), atteso: D.cf, nome: "il codice fiscale", aiuto: "È lo stesso di prima: " + D.cf + "." },
            { el: $("#vs-cod", box), atteso: D.codPren, nome: "il codice di prenotazione", aiuto: "Era nell'SMS di conferma: " + D.codPren + "." }
          ])) { ctx.bravo("Prenotazione trovata."); annulla(); }
        }
      });
      ctx.foglio({ titolo: "💬 L'SMS di conferma", html: '<div class="vf-postit"><p>Codice fiscale: <b>' + D.cf + "</b></p><p>Codice di prenotazione: <b>" + D.codPren + "</b></p></div>" });
      ctx.passo("Per trovare la prenotazione servono il **codice fiscale** e il **codice di prenotazione** dell'SMS (ve li abbiamo ricopiati accanto). Scriveteli e premete **«Cerca la prenotazione»**.");
    }
    function annulla() {
      ctx.foglio(null);
      schermo(box, salute('<div class="vs-corpo vs-form-stretto"><h2>Prenotazione ' + D.codPren + "</h2>" +
        '<dl class="vs-riep"><dt>Visita</dt><dd>Visita cardiologica</dd><dt>Dove</dt><dd>' + esc(scelta.luogo) + "</dd><dt>Quando</dt><dd>" + dataLunga(scelta.d) + ", ore " + scelta.ora + "</dd></dl>" +
        '<button type="button" class="vs-btn vs-rosso vs-primario" data-az="annulla" data-vita-aiuto>✖ Annulla la prenotazione</button></div>'), {
        annulla: function () {
          ctx.telefono({ titolo: "SMS", mittente: "SalutePrv", testo: "Salute Prova: la prenotazione " + D.codPren + " è stata annullata. Grazie per aver liberato il posto.", pulsanti: [] });
          schermo(box, salute('<div class="vs-corpo vs-centro"><div class="vs-ok-grande" aria-hidden="true">🗓️</div><h2>Prenotazione annullata</h2><p>Il posto è di nuovo libero per un altro paziente.</p>' +
            '<button type="button" class="vs-btn vs-primario" data-az="fine" data-vita-aiuto>✔ Ho finito</button></div>'), {
            fine: function () {
              ctx.fine({
                messaggio: "Avete prenotato una visita con la ricetta, ricevuto la conferma, riconosciuto un SMS truffa e imparato a disdire.",
                consigli: [
                  "Tenete a portata di mano **tessera sanitaria** e **promemoria della ricetta**: servono il codice fiscale e il codice della ricetta.",
                  "Prima di confermare **controllate il riepilogo**: tipo di visita, luogo, giorno e ora.",
                  "Conservate l'**SMS o l'email di conferma**: c'è il codice per disdire.",
                  "Nessun servizio sanitario chiede di **pagare con un link in un SMS** per confermare una prenotazione. Nel dubbio chiamate il numero che trovate sul sito ufficiale della vostra Regione o chiedete al medico.",
                  "Se non potete andare, **disdite** per tempo: liberate il posto per un altro malato (e in alcune regioni chi non disdice deve pagare).",
                  "Questa prova assomiglia al **CUP** e al **Fascicolo sanitario**: nella realtà i passi sono simili."
                ]
              });
            }
          });
          ctx.bravo("Prenotazione annullata.");
          ctx.passo("Fatto: la visita è annullata ed è arrivato l'SMS che lo conferma. Premete **«Ho finito»**.");
        }
      });
      ctx.passo("Ecco la prenotazione. Controllate che sia quella giusta e premete **«Annulla la prenotazione»**.");
    }
    home(false);
  }

  /* --------------------------------------------------------------------------
   *  c) Pagare un avviso (tassa rifiuti)
   * ------------------------------------------------------------------------ */
  function simPagamento(box, ctx) {
    var scad = giorno(30);
    var D = { avviso: "301234567890123456", avvisoMostra: "3012 3456 7890 1234 56", ente: "80012345678", importo: "87,50", banca: "Banca del Borgo" };
    var lettera = '<div class="vf-lettera"><div class="vf-let-testa">🏰 <b>COMUNE DI BORGOPROVA</b><br><small>Ufficio Tributi</small></div>' +
      '<h4>AVVISO DI PAGAMENTO</h4><p>Tassa sui rifiuti — rata unica<br>Intestatario: <b>PROVETTI MARIO</b></p>' +
      '<div class="vf-let-griglia"><span>Importo</span><b>' + D.importo + " €</b><span>Scadenza</span><b>" + dataBreve(scad) + "</b>" +
      "<span>Codice avviso</span><b>" + D.avvisoMostra + "</b><span>Codice fiscale ente</span><b>" + D.ente + "</b></div>" +
      '<div class="vf-qr" aria-hidden="true"></div><p class="vf-piccolo">Potete pagare sul sito PagaFacile Prova, con l\'app della banca, in banca o in tabaccheria. ' +
      "FAC-SIMILE: dati inventati.</p></div>";
    var paga = function (corpo) { return sito("vs-paga", testaSito("", "💠", "PagaFacile Prova", "Pagamenti verso gli enti pubblici (di prova)") + corpo + piede("PagaFacile Prova")); };

    /* 1. posta con l'email truffa */
    function posta() {
      ctx.indirizzo("https://posta.postaprova.it/in-arrivo");
      ctx.foglio({ titolo: "✉️ La lettera arrivata a casa", html: lettera });
      schermo(box, sito("vs-posta", testaSito("", "✉️", "Posta Prova", "La vostra casella di posta") +
        '<div class="vs-corpo"><ul class="vs-mail-lista">' +
        '<li><button type="button" class="vs-mail nuova" data-az="apri" data-vita-aiuto><b>Tributi Borgoprova &lt;avvisi@borgoprova-pagamenti.top&gt;</b><span>⚠️ URGENTE: avviso SCADUTO - multa in arrivo</span><small>oggi</small></button></li>' +
        '<li><button type="button" class="vs-mail" data-az="altra"><b>Biblioteca di Borgoprova</b><span>Il libro che avete prenotato è arrivato</span><small>ieri</small></button></li>' +
        "</ul></div>"), {
        altra: function () { ctx.passo("Questa è una mail tranquilla della biblioteca. Aprite invece quella **urgente** in cima."); },
        apri: email
      });
      ctx.passo("Vi è arrivata a casa una **lettera del Comune** con un avviso di pagamento per la tassa sui rifiuti (la vedete accanto). Prima di pagare, controlliamo la **posta**: c'è un'email urgente. Apritela.");
    }
    function email() {
      schermo(box, sito("vs-posta", testaSito("", "✉️", "Posta Prova", "La vostra casella di posta") +
        '<div class="vs-corpo"><div class="vs-mail-aperta"><p class="vs-mail-da">Da: <b>Tributi Borgoprova</b> &lt;avvisi@<u>borgoprova-pagamenti.top</u>&gt;</p>' +
        "<h3>⚠️ URGENTE: il vostro avviso è SCADUTO</h3><p>Gentile contribuente, il vostro avviso di pagamento risulta scaduto. " +
        "Per evitare una <b>multa di 150 €</b> pagate subito, entro 24 ore, con la carta di credito.</p>" +
        '<p><span class="vs-finto-link">👉 PAGA SUBITO QUI</span></p></div>' +
        '<div class="row"><button type="button" class="vs-btn vs-rosso" data-az="paga">💳 Paga subito</button>' +
        '<button type="button" class="vs-btn vs-btn-sec" data-az="elimina" data-vita-aiuto>🚩 È una truffa: elimina</button></div></div>'), {
        paga: function () {
          ctx.errore("Fermi! Guardate il **mittente**: borgoprova-pagamenti.top non è il Comune. E sulla lettera la scadenza è il **" + dataBreve(scad) + "**: non è scaduto niente. Fretta, minacce di multa e richiesta della carta sono i segni della **truffa**.");
        },
        elimina: function () { ctx.bravo("Bravissimi! Era una **truffa**: mittente strano, fretta e minaccia di multa."); preferiti(); }
      });
      ctx.passo("Leggete l'email con calma. Guardate **chi la manda** (l'indirizzo dopo «Da:») e confrontate con la **lettera** del Comune. Che cosa fate?");
    }
    /* 2. nuova scheda con i preferiti */
    function preferiti() {
      ctx.indirizzo("Nuova scheda");
      schermo(box, sito("vs-scheda", '<div class="vs-corpo vs-centro"><h2>Nuova scheda</h2><p>I vostri siti preferiti:</p><div class="vs-preferiti">' +
        '<button type="button" class="vs-pref" data-az="comune"><span aria-hidden="true">🏰</span>Comune di Borgoprova</button>' +
        '<button type="button" class="vs-pref" data-az="paga" data-vita-aiuto><span aria-hidden="true">💠</span>PagaFacile Prova</button>' +
        '<button type="button" class="vs-pref" data-az="meteo"><span aria-hidden="true">⛅</span>Meteo Prova</button></div></div>'), {
        comune: function () { ctx.errore("Il Comune va bene per informarsi, ma la lettera dice di pagare su **PagaFacile Prova**: premete quel preferito."); },
        meteo: function () { ctx.errore("Il meteo non c'entra! Premete **PagaFacile Prova**."); },
        paga: function () { ctx.bravo("Bene."); pagaHome(); }
      });
      ctx.passo("Ora paghiamo l'avviso **vero**, quello della lettera, sul sito indicato nella lettera. Non usate mai i link delle email sospette: aprite il sito dai vostri **preferiti**. Premete **«PagaFacile Prova»**.");
    }
    function pagaHome() {
      ctx.indirizzo("https://www.pagafacileprova.it");
      schermo(box, paga('<div class="vs-corpo"><div class="vs-banda"><h2>Pagate in modo sicuro</h2><p>Avvisi di Comuni, scuole, sanità e altri enti.</p></div>' +
        '<div class="vs-servizi"><button type="button" class="vs-servizio" data-az="avviso" data-vita-aiuto><span aria-hidden="true">🧾</span>Paga un avviso</button>' +
        '<button type="button" class="vs-servizio" data-az="ente"><span aria-hidden="true">🏛️</span>Cerca un ente</button>' +
        '<button type="button" class="vs-servizio" data-az="ric"><span aria-hidden="true">📂</span>Le mie ricevute</button></div></div>'), {
        ente: function () { ctx.errore("Non serve cercare l'ente: abbiamo già l'avviso. Premete **«Paga un avviso»**."); },
        ric: function () { ctx.errore("Le ricevute arrivano dopo aver pagato. Premete **«Paga un avviso»**."); },
        avviso: function () { ctx.bravo("Giusto."); codici(); }
      });
      ctx.passo("Siete su **PagaFacile Prova**: controllate l'indirizzo, **pagafacileprova.it**, con il lucchetto. Premete **«Paga un avviso»**.");
    }
    /* 3. codice avviso e codice ente */
    function codici() {
      schermo(box, paga('<div class="vs-corpo vs-form-stretto"><h2>Paga un avviso</h2>' +
        campo("vs-avv", "Codice avviso", { mode: "numeric", ph: "18 cifre", nota: "È sulla lettera. Gli spazi non contano." }) +
        campo("vs-ente", "Codice fiscale dell'ente", { mode: "numeric", ph: "11 cifre" }) +
        '<p class="vs-nota">📷 Con il telefono si può anche inquadrare il codice QR della lettera.</p>' +
        '<button type="button" class="vs-btn vs-primario" data-az="cerca" data-vita-aiuto>🔍 Cerca l\'avviso</button></div>'), {
        cerca: function () {
          if (ctx.controlla([
            { el: $("#vs-avv", box), atteso: D.avviso, mostra: D.avvisoMostra, nome: "il codice avviso", aiuto: "Copiatelo dalla lettera, a gruppi di 4 cifre: " + D.avvisoMostra + "." },
            { el: $("#vs-ente", box), atteso: D.ente, nome: "il codice fiscale dell'ente", aiuto: "È sulla lettera: " + D.ente + "." }
          ])) { ctx.bravo("Avviso trovato!"); dettaglio(); }
        }
      });
      ctx.passo("Copiate dalla **lettera** il **codice avviso** (18 cifre) e il **codice fiscale dell'ente** (11 cifre). Fate con calma, un gruppo di cifre alla volta. Poi premete **«Cerca l'avviso»**.");
    }
    /* 4. controllo di ente e importo */
    function dettaglio() {
      schermo(box, paga('<div class="vs-corpo vs-form-stretto"><h2>Dettaglio dell\'avviso</h2>' +
        '<dl class="vs-riep"><dt>Ente</dt><dd>Comune di Borgoprova</dd><dt>Causale</dt><dd>Tassa sui rifiuti — rata unica</dd>' +
        "<dt>Intestatario</dt><dd>PROVETTI MARIO</dd><dt>Scadenza</dt><dd>" + dataBreve(scad) + '</dd><dt>Importo</dt><dd class="vs-importo">' + D.importo + " €</dd></dl>" +
        "<p><b>Ente e importo sono uguali a quelli della lettera?</b></p>" +
        '<div class="row"><button type="button" class="vs-btn vs-primario" data-az="si" data-vita-aiuto>✔ Sì, sono uguali: continua</button>' +
        '<button type="button" class="vs-btn vs-btn-sec" data-az="no">✖ No, qualcosa è diverso</button></div></div>'), {
        no: function () { ctx.errore("Guardate meglio: ente **Comune di Borgoprova** e importo **" + D.importo + " €**, proprio come sulla lettera. (Se fossero diversi, nella realtà, non si paga e si chiede al Comune.)"); },
        si: function () { ctx.bravo("Giusto: tutto corrisponde."); metodo(); }
      });
      ctx.passo("**Prima di pagare si controlla sempre.** Confrontate l'**ente** e l'**importo** con quelli della lettera. Sono uguali?");
    }
    /* 5. metodo e banca */
    function metodo() {
      schermo(box, paga('<div class="vs-corpo"><h2>Come volete pagare?</h2><p class="vs-richiesta">Importo: <b>' + D.importo + " €</b></p><div class=\"vs-servizi\">" +
        '<button type="button" class="vs-servizio" data-az="carta"><span aria-hidden="true">💳</span>Carta di pagamento</button>' +
        '<button type="button" class="vs-servizio" data-az="app" data-vita-aiuto><span aria-hidden="true">🏦</span>Con l\'app della mia banca</button>' +
        '<button type="button" class="vs-servizio" data-az="sportello"><span aria-hidden="true">🏪</span>Stampa e pago allo sportello</button></div></div>'), {
        carta: function () { ctx.passo("Anche la carta si può usare, nella realtà. Oggi però proviamo il modo più semplice, **senza scrivere numeri di carta**: premete **«Con l'app della mia banca»**."); },
        sportello: function () { ctx.passo("Giusto anche questo: con la lettera si può pagare in banca, alla posta o in tabaccheria. Oggi però proviamo online: premete **«Con l'app della mia banca»**."); },
        app: function () { ctx.bravo("Bene."); banche(); }
      });
      ctx.passo("Ci sono vari modi per pagare. Scegliete **«Con l'app della mia banca»**: la conferma arriverà sul vostro telefono.");
    }
    function banche() {
      ctx.foglio({ titolo: "📝 Promemoria", html: '<div class="vf-postit"><p>La mia banca è:<br><b>' + D.banca + '</b></p><p class="vf-piccolo">Banca di fantasia.</p></div>' + lettera });
      var B = ["Cassa di Valleprova", D.banca, "Banca Collina Prova"];
      schermo(box, paga('<div class="vs-corpo"><h2>Scegliete la vostra banca</h2><div class="vs-gestori">' + B.map(function (b, i) {
        return '<button type="button" class="vs-gestore" data-az="b' + i + '"' + (i === 1 ? " data-vita-aiuto" : "") + '><span class="vs-g-ico" aria-hidden="true">🏦</span>' + esc(b) + "</button>";
      }).join("") + "</div></div>"), {
        b0: no, b2: no,
        b1: function () { ctx.bravo("Giusto: Banca del Borgo."); conferma(); }
      });
      function no() { ctx.errore("Non è la vostra banca. Guardate il **promemoria**: è la **" + D.banca + "**."); }
      ctx.passo("Scegliete la **vostra** banca (è scritta sul promemoria accanto).");
    }
    /* 6. conferma sul telefono */
    function conferma() {
      ctx.foglio(null);
      schermo(box, paga('<div class="vs-corpo vs-centro"><h2>📱 Confermate sul telefono</h2><p>Aprite l\'app <b>' + D.banca + "</b> sul telefono e confermate il pagamento di <b>" + D.importo + " €</b>.</p>" +
        '<p class="vs-attesa">⏳ In attesa della conferma…</p></div>'), {});
      ctx.telefono({
        titolo: "App " + D.banca, mittente: "Conferma pagamento",
        testo: "Beneficiario: Comune di Borgoprova\nCausale: Tassa sui rifiuti\nImporto: " + D.importo + " €\nCommissione: 1,00 € (esempio)\nTotale: 88,50 €",
        pulsanti: [
          { testo: "✅ Conferma", stile: "verde", azione: function () { ctx.bravo("Pagamento confermato!"); ctx.telefono({ titolo: "App " + D.banca, mittente: "Pagamento eseguito", testo: "Avete pagato 88,50 € a Comune di Borgoprova.", pulsanti: [] }); ricevuta(); } },
          { testo: "✖ Annulla", azione: function () { ctx.errore("Beneficiario e importo sono giusti (Comune di Borgoprova, " + D.importo + " €, più la commissione): potete confermare. «Annulla» si usa se qualcosa non torna."); } }
        ]
      });
      ctx.passo("Sul telefono si è aperta l'app della banca. **Leggete bene**: a chi pagate (beneficiario) e quanto (importo). C'è anche una piccola **commissione**. Se tutto è giusto, premete **«Conferma»**.");
    }
    /* 7. ricevuta */
    function ricevuta() {
      ctx.foglio(null);
      ctx.indirizzo("https://www.pagafacileprova.it/ricevuta");
      var oggi = new Date();
      schermo(box, paga('<div class="vs-corpo"><div class="vs-doc vs-ricevuta"><div class="vs-filigrana" aria-hidden="true">FAC-SIMILE · PROVA</div>' +
        '<h3>✅ Ricevuta di pagamento</h3><dl class="vs-riep"><dt>Ente</dt><dd>Comune di Borgoprova</dd><dt>Causale</dt><dd>Tassa sui rifiuti</dd>' +
        "<dt>Codice avviso</dt><dd>" + D.avvisoMostra + "</dd><dt>Importo</dt><dd>" + D.importo + " €</dd><dt>Data</dt><dd>" + dataBreve(oggi) + " " + ora(oggi) + "</dd>" +
        '<dt>Esito</dt><dd>Pagato</dd></dl><p class="vs-doc-nota">Ricevuta di prova senza alcun valore.</p></div>' +
        '<div class="row"><button type="button" class="vs-btn vs-primario" data-az="scarica" data-vita-aiuto>⬇️ Scarica la ricevuta</button></div><div class="vs-salvato" hidden></div></div>'), {
        scarica: function () {
          var s = $(".vs-salvato", box); s.hidden = false;
          s.innerHTML = "✅ Ricevuta salvata nella cartella <b>Scaricati</b> <small>(per finta: nella prova non si salva niente)</small>" +
            '<div class="row" style="margin-top:.6rem"><button type="button" class="vs-btn vs-primario" data-az="fine">✔ Ho finito</button></div>';
          box._vitaAz.fine = function () {
            ctx.fine({
              messaggio: "Avete pagato un avviso del Comune con l'app della banca, senza scrivere numeri di carta, e avete salvato la ricevuta. E avete smascherato un'email truffa!",
              consigli: [
                "Pagate solo gli avvisi che conoscete, partendo dalla **lettera vera** o dal sito ufficiale dell'ente. Mai dai link di email o SMS sospetti.",
                "Segni della truffa: **mittente strano**, **fretta**, **minaccia di multe**, richiesta dei dati della carta.",
                "Prima di pagare controllate **ente**, **causale** e **importo**; sul telefono leggete **a chi** pagate e **quanto**.",
                "**Conservate la ricevuta** (scaricata o stampata): è la prova che avete pagato.",
                "Nel dubbio telefonate all'ufficio tributi del vostro Comune, usando il numero scritto sulla lettera o sul sito ufficiale.",
                "Questa prova assomiglia a **pagoPA**: nella realtà i passi sono simili, e si può pagare anche in banca, alla posta o in tabaccheria."
              ]
            });
          };
          ctx.bravo("Ricevuta salvata!");
          ctx.passo("Bene! La ricevuta va **conservata**: è la prova che avete pagato. Premete **«Ho finito»**.");
        }
      });
      ctx.passo("Il pagamento è riuscito. Ora **salvate la ricevuta**: premete **«Scarica la ricevuta»**.");
    }
    posta();
  }

  PD.vita.registra({ id: "identita", icona: "🔑", titolo: "Entrare con l'identità digitale",
    descrizione: "Come lo SPID o la CIE: entrate nel sito del Comune e scaricate un certificato. Con due trappole da scoprire.",
    durata: "10 minuti", digcomp: ["2.2", "4.2"], ordine: 1, indirizzo: "https://www.cercaprova.it", avvia: simIdentita });
  PD.vita.registra({ id: "visita", icona: "🩺", titolo: "Prenotare una visita medica",
    descrizione: "Come il CUP: prenotate con la ricetta, ricevete il promemoria e imparate a disdire. Attenti agli SMS!",
    durata: "10 minuti", digcomp: ["2.2", "1.1"], ordine: 2, indirizzo: "https://www.saluteprova.it", avvia: simVisita });
  PD.vita.registra({ id: "pagamento", icona: "🧾", titolo: "Pagare un avviso (tassa rifiuti, bollo)",
    descrizione: "Con il codice della lettera e l'app della banca, senza numeri di carta. Poi la ricevuta. Occhio alle email false.",
    durata: "10 minuti", digcomp: ["2.2", "4.2"], ordine: 3, indirizzo: "https://posta.postaprova.it", avvia: simPagamento });
})();
