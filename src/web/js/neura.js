/* ==============================================================================
 *  PROFESSORE DIGITALE - «Neura», il cervello digitale olografico (dalla 3.6)
 *  Viene dal Consulente Digitale: è lei che conduce NONNI TEACH. Quando si apre Nonni Teach il Professore
 *  le lascia la cattedra (in alto, nella pagina e nella voce, che diventa femminile); quando si esce torna lui.
 *
 *  Il cervello è fatto di neuroni luminosi disegnati in tempo reale (canvas 2D, nessuna libreria):
 *  ruota piano, guarda verso il puntatore del mouse, e cambia colore e ritmo secondo lo stato:
 *    riposo (azzurro) · ascolto (verde, onde che seguono la voce) · pensiero (viola, impulsi veloci)
 *    parla (oro, pulsa con le parole) · errore (rosso) · felice (turchese)
 *  Si adatta da solo ai PC lenti (meno neuroni) e rispetta «riduci movimento».
 *
 *  API:  PD.neura.crea(canvas, {mini}) · PD.neura.stato("ascolto"|...) · PD.neura.livello(0..1)
 *        PD.neura.entra() / PD.neura.esci() / PD.neura.attiva()   (cambio di conduttore, lo usa nonni.js)
 *        PD.neura.voce()  -> id della voce femminile del PC (Serena, Paola, Pico, espeak femminile) o ""
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Codice MIT, personaggio CC BY-NC-SA 4.0
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$;
  var COLORI = {
    riposo: [56, 189, 248], ascolto: [52, 211, 153], pensiero: [167, 139, 250],
    parla: [251, 191, 36], errore: [248, 113, 113], felice: [94, 234, 212]
  };
  var NOMI_STATO = { riposo: "Neura è pronta", ascolto: "Vi ascolto…", pensiero: "Sto pensando…", parla: "Sto parlando", errore: "Qualcosa non va", felice: "Fatto!" };
  var G = { stato: "riposo", livello: 0, livelloObiettivo: 0, mx: 0, my: 0, istanze: [], avviato: false, attiva: false };
  var ridotto = false;
  try { ridotto = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { /* ignora */ }
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 40); };
  function adesso() { return window.performance && performance.now ? performance.now() : Date.now(); }

  /* ------------------------------------------------------------------ geometria del cervello */
  function generaCervello(n) {
    var punti = [], oro = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = oro * i;
      var sx = Math.cos(th) * r, sy = y, sz = Math.sin(th) * r;
      if (Math.abs(sx) < 0.06) continue;                          // scissura tra i due emisferi
      var pieghe = 1 + 0.05 * Math.sin(11 * sy + 7 * sz) + 0.035 * Math.sin(13 * sz - 5 * sx) + 0.025 * Math.sin(17 * sx + 9 * sy);
      var X = (sx + (sx > 0 ? 0.09 : -0.09)) * 0.95 * pieghe;
      var Y = sy * 0.8 * pieghe;
      var Z = sz * 1.2 * pieghe;
      if (Y < -0.32) Y = -0.32 + (Y + 0.32) * 0.35;               // base piatta
      Y -= 0.1 * Math.max(0, Z);                                   // lobo frontale piu' basso
      punti.push({ x: X, y: Y + 0.12, z: Z, e: sx > 0 ? 1 : -1, t: 0 });
    }
    var nc = Math.round(n * 0.12);                                  // cervelletto
    for (var c = 0; c < nc; c++) {
      var u = Math.random() * 2 * Math.PI, v = Math.acos(2 * Math.random() - 1);
      var px = Math.sin(v) * Math.cos(u), py = Math.sin(v) * Math.sin(u), pz = Math.cos(v);
      punti.push({ x: px * 0.55, y: -0.4 + py * 0.2, z: -0.95 + pz * 0.28, e: px > 0 ? 1 : -1, t: 1 });
    }
    for (var s = 0; s < 9; s++) {                                   // tronco encefalico
      var k = s / 8;
      punti.push({ x: (Math.random() - .5) * 0.12, y: -0.4 - k * 0.6, z: -0.45 - k * 0.12, e: 0, t: 2 });
    }
    // collegamenti: i 3 vicini piu' prossimi nello stesso emisfero
    var archi = [], visto = {};
    for (var a = 0; a < punti.length; a++) {
      var vicini = [];
      for (var b = 0; b < punti.length; b++) {
        if (a === b) continue;
        var p = punti[a], q = punti[b];
        if (p.e && q.e && p.e !== q.e && p.t === 0 && q.t === 0) continue;
        var d = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) + (p.z - q.z) * (p.z - q.z);
        vicini.push([d, b]);
      }
      vicini.sort(function (m, w) { return m[0] - w[0]; });
      for (var j = 0; j < 3 && j < vicini.length; j++) {
        var bb = vicini[j][1], key = a < bb ? a + "-" + bb : bb + "-" + a;
        if (!visto[key] && vicini[j][0] < 0.12) { visto[key] = 1; archi.push([a, bb]); }
      }
    }
    // qualche ponte tra i due emisferi (corpo calloso)
    for (var x = 0; x < 10; x++) {
      var i1 = Math.floor(Math.random() * punti.length), i2 = Math.floor(Math.random() * punti.length);
      if (punti[i1].e === -1 && punti[i2].e === 1 && Math.abs(punti[i1].y - punti[i2].y) < .25 && Math.abs(punti[i1].z - punti[i2].z) < .3) archi.push([i1, i2]);
    }
    return { punti: punti, archi: archi };
  }

  /* ------------------------------------------------------------------ un cervello su un canvas (sempre su fondo scuro) */
  function Istanza(canvas, opz) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.opz = opz || {};
    this.mini = !!this.opz.mini;
    var n = this.mini ? 110 : (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2 ? 240 : 380);
    this.geo = generaCervello(n);
    this.angolo = Math.random() * 6; this.incl = 0; this.impulsi = []; this.onde = []; this.colore = COLORI.riposo.slice();
    this.t0 = adesso(); this.ultimo = this.t0; this.lento = 0;
    this.proiettati = new Array(this.geo.punti.length);
    this.ridimensiona();
  }
  Istanza.prototype.ridimensiona = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), r = this.c.getBoundingClientRect();
    var w = Math.max(40, r.width || this.c.width), h = Math.max(40, r.height || this.c.height);
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.w = w; this.h = h; this.dpr = dpr;
  };
  Istanza.prototype.disegna = function (ora) {
    var ctx = this.ctx, w = this.w, h = this.h, dt = Math.min(0.1, (ora - this.ultimo) / 1000);
    this.ultimo = ora;
    if (dt > 0.045) this.lento++; else if (this.lento > 0) this.lento -= 0.2;
    if (this.lento > 90 && this.geo.punti.length > 100) {      // PC lento: meno neuroni
      this.geo = generaCervello(Math.round(this.geo.punti.length * 0.6)); this.proiettati = new Array(this.geo.punti.length); this.lento = 0; this.impulsi = [];
    }
    var st = G.stato, obiettivo = COLORI[st] || COLORI.riposo;
    for (var k = 0; k < 3; k++) this.colore[k] += (obiettivo[k] - this.colore[k]) * Math.min(1, dt * 4);
    var col = this.colore, rgb = Math.round(col[0]) + "," + Math.round(col[1]) + "," + Math.round(col[2]);
    var vel = { riposo: 0.18, ascolto: 0.25, pensiero: 0.9, parla: 0.32, errore: 0.1, felice: 0.5 }[st] || 0.2;
    if (ridotto) vel *= 0.3;
    this.angolo += dt * vel;
    var lv = G.livello;
    var guardaX = this.mini ? 0 : G.mx * 0.55, guardaY = this.mini ? 0 : G.my * 0.35;
    this.incl += (guardaY - this.incl) * Math.min(1, dt * 3);
    var a = this.angolo + guardaX, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(this.incl - 0.15), sb = Math.sin(this.incl - 0.15);
    var tempo = (ora - this.t0) / 1000;
    var respiro = 1 + 0.025 * Math.sin(tempo * 1.6) + (st === "parla" ? lv * 0.08 + 0.02 * Math.sin(tempo * 9) : 0) + (st === "ascolto" ? lv * 0.05 : 0);
    var scala = Math.min(w, h) * (this.mini ? 0.36 : 0.33) * respiro, cx = w / 2, cy = h / 2 + (this.mini ? 2 : h * 0.02);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // alone
    var g = ctx.createRadialGradient(cx, cy, scala * 0.1, cx, cy, scala * 1.9);
    g.addColorStop(0, "rgba(" + rgb + "," + (0.28 + lv * 0.25) + ")");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, scala * 1.9, 0, 6.2832); ctx.fill();

    // onde dell'ascolto
    if (st === "ascolto" && Math.random() < 0.08 + lv * 0.5) this.onde.push({ r: scala * 0.9, a: 0.5 + lv * 0.5 });
    for (var o = this.onde.length - 1; o >= 0; o--) {
      var on = this.onde[o]; on.r += dt * scala * 1.1; on.a -= dt * 0.7;
      if (on.a <= 0) { this.onde.splice(o, 1); continue; }
      ctx.strokeStyle = "rgba(" + rgb + "," + on.a.toFixed(3) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); if (ctx.ellipse) ctx.ellipse(cx, cy, on.r * 1.15, on.r * 0.9, 0, 0, 6.2832); else ctx.arc(cx, cy, on.r, 0, 6.2832); ctx.stroke();
    }

    // anelli olografici
    if ((!this.mini || st !== "riposo") && ctx.ellipse) {
      ctx.lineWidth = 1;
      for (var an = 0; an < (this.mini ? 1 : 2); an++) {
        ctx.strokeStyle = "rgba(" + rgb + ",0.28)";
        if (ctx.setLineDash) ctx.setLineDash(an ? [2, 9] : [14, 8]);
        ctx.beginPath(); ctx.ellipse(cx, cy + scala * 0.05, scala * (1.45 + an * 0.22), scala * (0.32 + an * 0.06), 0, tempo * (an ? -0.4 : 0.3), tempo * (an ? -0.4 : 0.3) + 5.3); ctx.stroke();
      }
      if (ctx.setLineDash) ctx.setLineDash([]);
    }

    // proiezione dei neuroni
    var P = this.geo.punti, pr = this.proiettati, foc = 3.2;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      var x1 = p.x * ca - p.z * sa, z1 = p.x * sa + p.z * ca;
      var y2 = p.y * cb - z1 * sb, z2 = p.y * sb + z1 * cb;
      var f = foc / (foc + z2);
      pr[i] = { x: cx + x1 * scala * f, y: cy - y2 * scala * f, z: z2, f: f };
    }
    ctx.globalCompositeOperation = "lighter";
    // collegamenti
    var A = this.geo.archi;
    ctx.lineWidth = this.mini ? 0.6 : 0.8;
    for (var e = 0; e < A.length; e++) {
      var p1 = pr[A[e][0]], p2 = pr[A[e][1]];
      var prof = (2 - (p1.z + p2.z) / 2) / 3.2;
      ctx.strokeStyle = "rgba(" + rgb + "," + Math.max(0.04, Math.min(0.55, prof * 0.42)).toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    // neuroni
    for (var q = 0; q < pr.length; q++) {
      var pp = pr[q], dep = (1.6 - pp.z) / 3;
      var rr = (this.mini ? 0.9 : 1.5) * pp.f * (0.7 + dep);
      ctx.fillStyle = "rgba(" + rgb + "," + Math.max(0.15, Math.min(1, dep * 1.2)).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(pp.x, pp.y, rr, 0, 6.2832); ctx.fill();
    }
    // impulsi lungo le sinapsi
    var frequenza = { riposo: 2, ascolto: 6, pensiero: 26, parla: 10, errore: 1, felice: 14 }[st] || 2;
    frequenza *= (1 + lv * 2) * (this.mini ? 0.4 : 1);
    if (Math.random() < frequenza * dt && A.length) this.impulsi.push({ e: Math.floor(Math.random() * A.length), t: 0, v: 0.8 + Math.random() * 1.6, salti: 2 + Math.floor(Math.random() * 4) });
    for (var m = this.impulsi.length - 1; m >= 0; m--) {
      var im = this.impulsi[m];
      if (!A[im.e]) { this.impulsi.splice(m, 1); continue; }
      im.t += dt * im.v * (st === "pensiero" ? 2.2 : 1);
      if (im.t >= 1) {
        if (--im.salti <= 0) { this.impulsi.splice(m, 1); continue; }
        var fine = A[im.e][1], prossimi = [];
        for (var z = 0; z < A.length; z++) if (A[z][0] === fine) prossimi.push(z);
        if (!prossimi.length) { this.impulsi.splice(m, 1); continue; }
        im.e = prossimi[Math.floor(Math.random() * prossimi.length)]; im.t = 0;
      }
      var s1 = pr[A[im.e][0]], s2 = pr[A[im.e][1]];
      var ix = s1.x + (s2.x - s1.x) * im.t, iy = s1.y + (s2.y - s1.y) * im.t;
      var gr = ctx.createRadialGradient(ix, iy, 0, ix, iy, this.mini ? 4 : 7);
      gr.addColorStop(0, "rgba(255,255,255,.95)");
      gr.addColorStop(0.35, "rgba(" + rgb + ",.8)"); gr.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(ix, iy, this.mini ? 4 : 7, 0, 6.2832); ctx.fill();
    }
    // linea di scansione (pensiero)
    if (st === "pensiero" && !this.mini) {
      var sy2 = cy + Math.sin(tempo * 2.4) * scala * 0.9;
      var lg = ctx.createLinearGradient(cx - scala * 1.4, 0, cx + scala * 1.4, 0);
      lg.addColorStop(0, "rgba(" + rgb + ",0)"); lg.addColorStop(0.5, "rgba(" + rgb + ",.55)"); lg.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = lg; ctx.fillRect(cx - scala * 1.4, sy2 - 1, scala * 2.8, 2);
    }
    ctx.globalCompositeOperation = "source-over";
  };

  function ciclo(ora) {
    G.livello += (G.livelloObiettivo - G.livello) * 0.25;
    G.livelloObiettivo *= 0.9;
    if (G.stato === "parla") G.livelloObiettivo = Math.max(G.livelloObiettivo, 0.25 + 0.25 * Math.random());
    if (!document.hidden) {
      for (var i = 0; i < G.istanze.length; i++) {
        var ist = G.istanze[i];
        if (!document.documentElement.contains(ist.c)) { G.istanze.splice(i, 1); i--; continue; }
        if (ist.c.offsetParent !== null) ist.disegna(ora);
      }
    }
    if (G.istanze.length) raf(ciclo); else G.avviato = false;
  }
  function avvia() { if (!G.avviato) { G.avviato = true; raf(ciclo); } }
  window.addEventListener("mousemove", function (e) { G.mx = e.clientX / window.innerWidth - 0.5; G.my = e.clientY / window.innerHeight - 0.5; });
  window.addEventListener("resize", function () { G.istanze.forEach(function (i) { i.ridimensiona(); }); });

  /* ------------------------------------------------------------------ voce di Neura: femminile */
  function voceNeura() {
    var voci = (PD.status && PD.status.tts && PD.status.tts.voices) || [];
    var f = voci.filter(function (v) { return v.genere === "f" && v.naturale; })[0] || voci.filter(function (v) { return v.genere === "f"; })[0];
    return f ? f.id : "";
  }

  /* ------------------------------------------------------------------ cambio di conduttore: Professore ⇄ Neura */
  var brandOriginale = null;
  function marchio(on) {
    var b = $(".topbar .brand"); if (!b) return;
    if (on) {
      if (brandOriginale === null) brandOriginale = b.innerHTML;
      b.innerHTML = '<canvas class="neura-mini" width="48" height="48" aria-hidden="true"></canvas><div><b>Neura</b><small>conduce Nonni Teach</small></div>';
      PD.neura.crea($(".neura-mini", b), { mini: true });
      b.setAttribute("title", "In Nonni Teach conduce Neura; uscendo torna il Professore");
    } else if (brandOriginale !== null) {
      b.innerHTML = brandOriginale; brandOriginale = null; b.removeAttribute("title");
    }
  }
  var NEURA_SALUTO = "Ciao, sono Neura! Il Professore mi ha lasciato la cattedra: in Nonni Teach faccio io le domande ai nonni, registro le loro risposte e preparo il podcast.";

  PD.neura = {
    crea: function (canvas, opz) {
      if (!canvas || !canvas.getContext) return null;
      for (var i = 0; i < G.istanze.length; i++) if (G.istanze[i].c === canvas) return G.istanze[i];
      var ist = new Istanza(canvas, opz); G.istanze.push(ist); avvia(); return ist;
    },
    stato: function (s) {
      if (s === undefined) return G.stato;
      if (!COLORI[s]) s = "riposo";
      G.stato = s;
      document.documentElement.setAttribute("data-neura", s);
      $$(".neura-stato").forEach(function (el) { el.textContent = NOMI_STATO[s]; });
      if (s === "felice" || s === "errore") setTimeout(function () { if (G.stato === s) PD.neura.stato("riposo"); }, 2200);
    },
    livello: function (v) { G.livelloObiettivo = Math.max(G.livelloObiettivo, Math.max(0, Math.min(1, v))); },
    nomeStato: function () { return NOMI_STATO[G.stato]; },
    voce: voceNeura,
    attiva: function () { return G.attiva; },
    /* Neura prende la cattedra (aprendo Nonni Teach) */
    entra: function () {
      if (G.attiva) return;
      G.attiva = true;
      PD.stopSpeech();
      document.documentElement.setAttribute("data-conduttore", "neura");
      PD.voceSpeciale = { server: voceNeura(), femminile: true };
      marchio(true);
      PD.neura.stato("riposo");
      var primaVolta = true;
      try { primaVolta = !sessionStorage.getItem("pd.neuraSalutata"); sessionStorage.setItem("pd.neuraSalutata", "1"); } catch (e) { /* ignora */ }
      if (primaVolta && PD.settings.greet !== false) setTimeout(function () { if (G.attiva) PD.speak(NEURA_SALUTO); }, 350);
      else PD.toast("🧠 Ora conduce Neura. Uscendo da Nonni Teach torna il Professore.", 3000);
    },
    /* il Professore riprende la cattedra (uscendo da Nonni Teach) */
    esci: function () {
      if (!G.attiva) return;
      G.attiva = false;
      if (PD.nonniTeach && PD.nonniTeach.annulla) PD.nonniTeach.annulla();
      PD.stopSpeech();
      PD.voceSpeciale = null;
      document.documentElement.removeAttribute("data-conduttore");
      marchio(false);
      PD.setProf("riposo");
      PD.toast("👨‍🏫 Il Professore è tornato alla cattedra.", 2500);
    },
    salutoProva: NEURA_SALUTO
  };
  /* mentre Neura parla, il cervello si illumina d'oro */
  PD.onSpeaking = function (on) {
    if (!G.attiva) return;
    if (on) PD.neura.stato("parla"); else if (G.stato === "parla") PD.neura.stato("riposo");
  };
  /* uscendo dalla pagina di Nonni Teach (qualunque altra sezione) torna il Professore */
  window.addEventListener("hashchange", function () {
    var v = (location.hash.replace(/^#\/?/, "") || "home").split("/")[0];
    if (v !== "nonni") PD.neura.esci();
  });
})();
