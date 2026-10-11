/* ==============================================================================
 *  PROFESSORE DIGITALE - Il Professore "presente"
 *  - all'avvio saluta a voce in base all'ora del computer (buongiorno, buon pomeriggio, buonasera);
 *  - se nessuno lo usa per qualche minuto propone un consiglio, poi un secondo, poi si mette
 *    in attesa (occhi socchiusi) finche' qualcuno muove il mouse o tocca la tastiera;
 *  - all'uscita ricorda i promemoria e le cose da fare, e augura la buona notte se e' tardi;
 *  - la nuvoletta del Professore mostra i messaggi con pulsanti grandi.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, esc = PD.esc;

  /* tempi dei consigli (secondi di inattivita'); i test li accorciano */
  PD.idleConfig = { primo: 180, secondo: 420, attesa: 600 };
  var idle = { ultimo: Date.now(), fase: 0, ultimoConsiglio: "" };

  /* ------------------------------------------------------------------ nuvoletta */
  var bubbleTimer = 0;
  PD.bubble = function (testo, pulsanti, durata) {
    var b = document.getElementById("pd-bubble");
    if (!b) { b = document.createElement("div"); b.id = "pd-bubble"; b.className = "pd-bubble"; b.setAttribute("role", "status"); document.body.appendChild(b); }
    b.innerHTML = '<svg class="mini" aria-hidden="true"><use href="#prof-svg"/></svg><div class="testo"><p>' + PD.md(testo).replace(/^<p>|<\/p>$/g, "") + "</p>" +
      (pulsanti && pulsanti.length ? '<div class="row">' + pulsanti.map(function (p, i) {
        return '<button class="btn ' + (i ? "ghost" : "") + '" data-b="' + i + '">' + esc(p.t) + "</button>";
      }).join("") + "</div>" : "") + '</div><button class="chiudi" aria-label="Chiudi" title="Chiudi">✕</button>';
    b.hidden = false;
    b.onclick = function (e) {
      if (e.target.closest(".chiudi")) { PD.bubbleClose(); return; }
      var x = e.target.closest("[data-b]"); if (!x) return;
      var p = pulsanti[+x.getAttribute("data-b")];
      PD.bubbleClose(); PD.stopSpeech();
      if (p.go) PD.go(p.go); else if (p.fn) p.fn();
    };
    clearTimeout(bubbleTimer);
    if (durata !== 0) bubbleTimer = setTimeout(PD.bubbleClose, durata || 20000);
    if (PD.eyesKick) PD.eyesKick();
  };
  PD.bubbleClose = function () { var b = document.getElementById("pd-bubble"); if (b) b.hidden = true; clearTimeout(bubbleTimer); };

  /* ------------------------------------------------------------------ promemoria */
  function prom() { return PD.progress.promemoria || (PD.progress.promemoria = []); }
  PD.renderPromemoria = function (box) {
    if (!box) return;
    var L = prom();
    box.innerHTML = '<h2 style="margin-top:0;font-size:1.2rem">📝 I miei promemoria</h2>' +
      '<p class="small muted">Scrivete le cose da non dimenticare: il Professore ve le ricorda quando uscite.</p>' +
      (L.length ? '<ul class="prom-lista">' + L.map(function (x, i) {
        return '<li><span>' + esc(x.t) + '</span><button class="btn ghost" data-fatto="' + i + '" title="Segna come fatto">✓ Fatto</button></li>';
      }).join("") + "</ul>" : "") +
      '<form class="row prom-nuovo"><input type="text" maxlength="140" placeholder="es. Chiamare il medico per la ricetta" aria-label="Nuovo promemoria">' +
      '<button class="btn" type="submit">➕ Aggiungi</button></form>';
    box.querySelector("form").onsubmit = function (e) {
      e.preventDefault();
      var inp = box.querySelector("input"), t = inp.value.trim(); if (!t) return;
      prom().push({ t: t, quando: new Date().toISOString() }); PD.saveProgress(); PD.renderPromemoria(box);
      PD.toast("📝 Promemoria aggiunto.");
    };
    Array.prototype.forEach.call(box.querySelectorAll("[data-fatto]"), function (b) {
      b.onclick = function () { prom().splice(+b.getAttribute("data-fatto"), 1); PD.saveProgress(); PD.renderPromemoria(box); PD.toast("✓ Fatto!"); };
    });
  };

  /* ------------------------------------------------------------------ saluto all'avvio */
  function primoNome() { return (PD.settings.studentName || "").split(/\s+/)[0]; }
  PD.testoSaluto = function (d) {
    d = d || new Date();
    var nome = primoNome(), nx = PD.nextLesson ? PD.nextLesson() : null, n = prom().length;
    var t = PD.greeting(d) + (nome ? ", " + nome : "") + "! Sono il Professore Digitale.";
    if (PD.isLate(d)) t += " È piuttosto tardi: facciamo qualcosa di breve, e poi a riposare.";
    else if (nx) t += " Oggi possiamo continuare con la lezione: " + nx.title + ".";
    else t += " Cosa vi piacerebbe fare oggi?";
    if (n) t += " Avete " + (n === 1 ? "un promemoria" : n + " promemoria") + " da ricordare.";
    return t;
  };
  function saluta() {
    var t = PD.testoSaluto(), nx = PD.nextLesson ? PD.nextLesson() : null;
    PD.bubble(t, nx && !PD.isLate() ? [{ t: "▶ Continua la lezione", go: "#/lessons/" + nx.id }, { t: "Più tardi", fn: function () {} }] : null, 14000);
    if (!PD.settings.voice) return;
    var attiva = navigator.userActivation ? navigator.userActivation.hasBeenActive : false;
    var dopoTocco = function () { if (PD.invitoVoce) PD.invitoVoce(function () { PD.speak(t); }); else alPrimoGesto(function () { PD.speak(t); }); };
    // telefoni e tablet (anche i tablet ospiti): il browser non lascia parlare prima di un tocco → invito «Toccate qui» (voce.js)
    if (PD.mobile && !attiva && PD.voceDaSbloccare && PD.voceDaSbloccare()) { dopoTocco(); return; }
    // l'avviatore apre il browser con la riproduzione automatica permessa; altrove si chiede un clic
    if (PD.server && !PD.ospite && !attiva) {
      fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, rate: PD.settings.rate, voice: PD.settings.voiceId || "" }) })
        .then(function (r) { if (!r.ok) throw new Error("voce"); return r.blob(); })
        .then(function (b) {
          var a = new Audio(URL.createObjectURL(b));
          return a.play().then(function () { PD.setProf("spiegazione"); a.onended = function () { if (PD.profState === "spiegazione") PD.setProf("riposo"); }; });
        })
        .catch(function (e) { if (e && e.name === "NotAllowedError") dopoTocco(); else PD.speak(t); });
    } else PD.speak(t);   // se il browser non lascia parlare, PD.speak mostra l'invito (voce.js)
  }
  /* usata anche dalla maschera del percorso (percorsi.js) per salutare dopo la scelta: se il browser non lascia
   * parlare (telefono non ancora toccato) compare l'invito «Toccate qui» di voce.js */
  PD.saluta = saluta;
  function alPrimoGesto(fn) {
    var fatto = false;
    function via() { if (fatto) return; fatto = true; document.removeEventListener("pointerdown", via, true); document.removeEventListener("keydown", via, true); setTimeout(fn, 60); }
    document.addEventListener("pointerdown", via, true); document.addEventListener("keydown", via, true);
  }

  /* ------------------------------------------------------------------ inattivita' */
  function consigli() {
    var c = [], nx = PD.nextLesson ? PD.nextLesson() : null, n = prom().length, q = (PD.progress.quiz || {}).informatica;
    if (nx) c.push({ k: "lezione", t: "Che ne dite di continuare con la lezione «" + nx.title + "»? Bastano pochi minuti.", p: [{ t: "▶ Apri la lezione", go: "#/lessons/" + nx.id }] });
    if (!q || !q.superata) c.push({ k: "quiz", t: "Vi sentite pronti per il **Grande Quiz dell'Informatica**? Superatelo e stampate il vostro attestato!", p: [{ t: "🏆 Al quiz", go: "#/quiz/informatica" }] });
    c.push({ k: "palestra", t: "Un po' di allenamento in **Palestra**? Provate a riconoscere le truffe o a usare il copia e incolla.", p: [{ t: "🎯 In palestra", go: "#/practice" }] });
    c.push({ k: "cultura", t: "Lo sapevate? Nella **Cultura generale** ci sono lezioni di storia, geografia, scienze, arte e attualità.", p: [{ t: "🌍 Scopri", go: "#/cultura" }] });
    c.push({ k: "fenice", t: "Avete un vecchio computer in cantina? Con **FeniceOS** può tornare a nuova vita.", p: [{ t: "🔥 FeniceOS", go: "#/fenice" }] });
    c.push({ k: "chiedi", t: "Avete un dubbio sul computer o sul telefono? Chiedetemelo: potete scrivere o parlare.", p: [{ t: "💬 Fai una domanda", go: "#/ask" }] });
    c.push({ k: "pausa", t: "Un consiglio per la salute: ogni tanto alzatevi, fate due passi e guardate lontano per riposare gli occhi.", p: [] });
    if (n) c.push({ k: "promemoria", t: "Vi ricordo che avete " + (n === 1 ? "un promemoria" : n + " promemoria") + ": «" + prom()[0].t + "».", p: [{ t: "📝 Vedi", go: "#/home" }] });
    if (PD.isLate()) c.unshift({ k: "tardi", t: "Si è fatto tardi: quando avete finito, salvate il lavoro e spegnete il computer dal menu. Buona notte!", p: [] });
    return c.filter(function (x) { return x.k !== idle.ultimoConsiglio; });
  }
  function occupato() {
    var v = (location.hash.replace(/^#\/?/, "") || "home").split("/")[0];
    return !PD.settings.idleTips || document.hidden || !$("#btn-stop").hidden || PD.profState === "pensiero" || PD.profState === "ascolto" ||
      (v === "practice" && location.hash.split("/").length > 2) || document.body.classList.contains("printing") || $(".uscita");
  }
  function controlla() {
    var s = (Date.now() - idle.ultimo) / 1000, cfg = PD.idleConfig;
    if (occupato()) return;
    if (idle.fase === 0 && s >= cfg.primo) consiglia(1);
    else if (idle.fase === 1 && s >= cfg.secondo) consiglia(2);
    else if (idle.fase === 2 && s >= cfg.attesa) {
      idle.fase = 3;
      PD.bubble("Mi metto in attesa. Quando volete ricominciare, muovete il mouse o premete un tasto: sono qui.", null, 15000);
      if (PD.settings.voice) PD.speak("Mi metto in attesa. Quando volete, sono qui.");
      setTimeout(function () { if (idle.fase === 3) PD.setProf("attesa"); }, 4000);
    }
  }
  function consiglia(fase) {
    idle.fase = fase;
    var c = consigli(); if (!c.length) return;
    var x = c[Math.floor(Math.random() * Math.min(c.length, fase === 1 ? 2 : c.length))];
    idle.ultimoConsiglio = x.k;
    PD.bubble(x.t, x.p.concat(x.p.length ? [{ t: "No, grazie", fn: function () {} }] : []), 30000);
    if (PD.settings.voice) PD.speak(x.t);
  }
  function attivita() {
    var era = idle.fase;
    idle.ultimo = Date.now(); idle.fase = 0;
    if (era === 3) {
      if (PD.profState === "attesa") PD.setProf("riposo");
      PD.bubble("Bentornati! " + (primoNome() ? primoNome() + ", c" : "C") + "osa facciamo adesso?", null, 5000);
    }
  }
  PD.idleState = function () { return { fase: idle.fase, inattivo_s: Math.round((Date.now() - idle.ultimo) / 1000) }; };
  PD.idleReset = attivita;

  /* ------------------------------------------------------------------ uscita */
  PD.testoCongedo = function (d) {
    d = d || new Date();
    var h = d.getHours(), nome = primoNome(), L = prom(), nx = PD.nextLesson ? PD.nextLesson() : null, righe = [];
    righe.push("Prima di andare" + (nome ? ", " + nome : "") + ", ecco cosa non dimenticare.");
    L.forEach(function (x) { righe.push("Promemoria: " + x.t + "."); });
    if (nx) righe.push("La prossima volta continuiamo con la lezione: " + nx.title + ".");
    righe.push("Salvate il lavoro, chiudete i programmi e spegnete il computer dal menu, con Arresta.");
    righe.push(PD.isLate(d) ? "Buona notte, e sogni d'oro!" : h < 13 && h >= 5 ? "Arrivederci e buona giornata!" : h < 18 && h >= 5 ? "Arrivederci e buon pomeriggio!" : "Arrivederci e buona serata!");
    return righe;
  };
  PD.esci = function () {
    var righe = PD.testoCongedo(), ov = document.createElement("div");
    ov.className = "uscita"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = '<div class="card uscita-card">' + PD.profHTML() + "<div><h2>" + (PD.isLate() ? "🌙 Buona notte!" : "👋 Arrivederci!") + "</h2><ul>" +
      righe.slice(0, -1).map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul><p><b>" + esc(righe[righe.length - 1]) + "</b></p>" +
      '<div class="row"><button class="btn big" id="u-esci">🚪 Esci adesso</button><button class="btn big ghost" id="u-resta">↩ Resto ancora</button></div></div></div>';
    document.body.appendChild(ov);
    var chiuso = false;
    function resta() { chiuso = true; PD.stopSpeech(); if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function vai() {
      if (chiuso) return; chiuso = true; PD.stopSpeech();
      ov.querySelector(".uscita-card").innerHTML = PD.profHTML() + "<div><h2>" + (PD.isLate() ? "🌙 Buona notte!" : "👋 Arrivederci!") +
        "</h2><p>Il Professore si è chiuso. Ora potete chiudere questa finestra.</p></div>";
      var stop = PD.server && !PD.ospite ? PD.api("/api/shutdown", {}).catch(function () {}) : Promise.resolve();   // un tablet non spegne il PC
      stop.then(function () { setTimeout(function () { try { window.close(); } catch (e) { /* finestra non chiudibile da script */ } }, 400); });
    }
    $("#u-esci", ov).onclick = vai; $("#u-resta", ov).onclick = resta;
    $("#u-esci", ov).focus();
    if (PD.settings.goodbye && PD.settings.voice) {
      PD.speak(righe.join(" "), true).then(function () { if (!chiuso) setTimeout(function () { if (!chiuso && $("#btn-stop").hidden) vai(); }, 1500); });
    }
  };

  /* ------------------------------------------------------------------ avvio */
  var prevReady = PD.onReady;
  PD.onReady = function () {
    if (prevReady) prevReady();
    var gia = false;
    try { gia = sessionStorage.getItem("pd.salutato") === "1"; sessionStorage.setItem("pd.salutato", "1"); } catch (e) { /* ignora */ }
    if (PD.settings.greet && !gia && !/[?&]nosaluto\b/.test(location.search)) setTimeout(saluta, 900);
    setInterval(controlla, 5000);
  };
  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(function (ev) {
    document.addEventListener(ev, attivita, { passive: true, capture: true });
  });
  document.addEventListener("DOMContentLoaded", function () {
    var b = $("#btn-exit"); if (b) b.onclick = function () { PD.esci(); };
  });
})();
