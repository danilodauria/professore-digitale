/* ==============================================================================
 *  PROFESSORE DIGITALE - Occhi vivi
 *  Gli occhi del Professore seguono il puntatore del mouse (o il dito) in modo
 *  naturale: ogni occhio calcola la propria direzione (convergenza quando il
 *  puntatore e' vicino), il movimento e' smorzato, ci sono micro-movimenti,
 *  sguardi in giro quando nessuno muove il mouse, battiti di ciglia irregolari,
 *  pupille che si allargano al buio e sopracciglia che reagiscono.
 *  JavaScript puro (ES5), nessuna libreria. Consuma CPU solo mentre qualcosa si muove.
 *  Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD || (window.PD = {});
  var VB = 200;                                  // viewBox del disegno (0 0 200 200)
  var EYES = [[80, 103], [120, 103]];            // centri degli occhi nel disegno
  var RX = 3.6, RY = 2.5;                        // escursione massima dell'iride (unita' del disegno)
  var SELECTOR = "svg.prof, .brand svg";
  var raf = 0, lastT = 0;
  var mouse = { x: -1, y: -1, t: 0, inside: false, speed: 0 };
  var idle = { target: null, until: 0, next: 0 };
  var focusEl = null, focusUntil = 0;
  var blink = { start: -1, dur: 170, next: 0, double: false };
  var state = [];                                // stato per ciascun <svg> (WeakMap non serve: lista piccola)
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function enabled() {
    return !reduced && !(PD.settings && PD.settings.eyesFollow === false);
  }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function stateFor(svg) {
    for (var i = 0; i < state.length; i++) if (state[i].el === svg) return state[i];
    var s = { el: svg, lx: 0, ly: 0, rx: 0, ry: 0, pupil: 1, brow: 0, w: "" };
    state.push(s);
    if (state.length > 40) state = state.filter(function (x) { return document.documentElement.contains(x.el); });
    return s;
  }

  /* Dove guarda l'occhio (offset in unita' del disegno) dato un punto dello schermo */
  function aim(cx, cy, scale, px, py) {
    var dx = px - cx, dy = py - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.5) return [0, 0, d];
    // la deviazione cresce in fretta e poi si satura: 50 px di distanza sono gia' "guardare di lato"
    var k = 1 - Math.exp(-d / (55 + 20 * scale));
    return [dx / d * RX * k, dy / d * RY * k, d];
  }

  /* Bersaglio dello sguardo per lo stato attuale del Professore */
  function gazeTarget(t) {
    var st = PD.profState || "riposo";
    if (st === "pensiero") {                       // guarda in alto, come chi riflette
      return { mode: "fixed", ox: -RX * 0.55 + Math.sin(t / 700) * 0.5, oy: -RY * 0.95 };
    }
    if (focusEl && t < focusUntil && document.documentElement.contains(focusEl)) {
      var r = focusEl.getBoundingClientRect();
      if (r.width > 0) return { mode: "point", x: r.left + Math.min(r.width * 0.35, 260), y: r.top + r.height / 2 };
    }
    if (mouse.inside && t - mouse.t < 6000) return { mode: "point", x: mouse.x, y: mouse.y };
    // nessuno muove il mouse: ogni tanto si guarda attorno, poi torna a guardare chi ha davanti
    if (t > idle.next) {
      var r2 = Math.random();
      idle.target = r2 < 0.45 ? { ox: 0, oy: 0 } : { ox: rand(-1, 1) * RX * 0.8, oy: rand(-0.7, 0.5) * RY };
      idle.next = t + rand(1800, 4200);
    }
    return { mode: "fixed", ox: idle.target ? idle.target.ox : 0, oy: idle.target ? idle.target.oy : 0 };
  }

  function lidValue(t) {
    if (blink.start < 0) {
      if (t > blink.next) { blink.start = t; blink.dur = rand(140, 200); }
      else return 0;
    }
    var p = (t - blink.start) / blink.dur;
    if (p >= 1) {
      blink.start = -1;
      if (blink.double) { blink.double = false; blink.next = t + 90; }
      else { blink.next = t + rand(2200, 6500); blink.double = Math.random() < 0.18; }
      return 0;
    }
    // chiusura rapida (35%), riapertura piu' lenta
    return p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
  }

  function frame(ts) {
    raf = 0;
    var t = ts || now(), dt = lastT ? Math.min(64, t - lastT) : 16.7; lastT = t;
    var svgs = document.querySelectorAll(SELECTOR);
    var on = enabled();
    var tgt = on ? gazeTarget(t) : { mode: "fixed", ox: 0, oy: 0 };
    var lid = on ? lidValue(t) : 0;
    var dark = document.documentElement.getAttribute("data-theme") !== "light";
    var ease = 1 - Math.pow(1 - (PD.profState === "spiegazione" ? 0.12 : 0.2), dt / 16.7);
    var busy = lid > 0 || blink.start >= 0;

    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i], r = svg.getBoundingClientRect();
      if (r.width < 4 || r.bottom < 0 || r.top > window.innerHeight) continue;
      var s = stateFor(svg);
      var scale = Math.min(r.width, r.height) / VB;
      var offX = r.left + (r.width - VB * scale) / 2, offY = r.top + (r.height - VB * scale) / 2;
      var want = [], near = 1e9;
      for (var e = 0; e < 2; e++) {
        if (tgt.mode === "point") {
          var a = aim(offX + EYES[e][0] * scale, offY + EYES[e][1] * scale, scale, tgt.x, tgt.y);
          want.push([a[0], a[1]]); near = Math.min(near, a[2]);
        } else want.push([tgt.ox, tgt.oy]);
      }
      // pupille: piu' grandi al buio e quando qualcosa si avvicina al viso (interesse)
      var wantPupil = (dark ? 1.22 : 1) + (near < 90 ? 0.14 : 0);
      // sopracciglia: si alzano un poco quando il puntatore arriva veloce o molto vicino (sorpresa)
      var wantBrow = on && (mouse.speed > 2.2 || near < 60) && t - mouse.t < 400 ? -1.8 : 0;

      s.lx += (want[0][0] - s.lx) * ease; s.ly += (want[0][1] - s.ly) * ease;
      s.rx += (want[1][0] - s.rx) * ease; s.ry += (want[1][1] - s.ry) * ease;
      s.pupil += (wantPupil - s.pupil) * 0.08 * dt / 16.7;
      s.brow += (wantBrow - s.brow) * 0.15;
      if (Math.abs(want[0][0] - s.lx) + Math.abs(want[0][1] - s.ly) + Math.abs(want[1][0] - s.rx) +
          Math.abs(want[1][1] - s.ry) > 0.02 || Math.abs(wantPupil - s.pupil) > 0.01 || Math.abs(wantBrow - s.brow) > 0.05) busy = true;

      var gx = -(s.lx + s.rx) * 0.22, gy = -(s.ly + s.ry) * 0.22;    // il riflesso si sposta meno dell'iride
      var w = s.lx.toFixed(2) + s.ly.toFixed(2) + s.rx.toFixed(2) + s.ry.toFixed(2) + s.pupil.toFixed(2) + s.brow.toFixed(1) + lid.toFixed(2);
      if (w !== s.w) {
        s.w = w;
        var st = svg.style;
        st.setProperty("--pd-lx", s.lx.toFixed(2) + "px"); st.setProperty("--pd-ly", s.ly.toFixed(2) + "px");
        st.setProperty("--pd-rx", s.rx.toFixed(2) + "px"); st.setProperty("--pd-ry", s.ry.toFixed(2) + "px");
        st.setProperty("--pd-gx", gx.toFixed(2) + "px"); st.setProperty("--pd-gy", gy.toFixed(2) + "px");
        st.setProperty("--pd-pupil", s.pupil.toFixed(3)); st.setProperty("--pd-brow", s.brow.toFixed(2) + "px");
        st.setProperty("--pd-lid", lid.toFixed(3));
      }
    }
    mouse.speed *= 0.85;
    if (busy || (on && tgt.mode === "fixed" && PD.profState === "pensiero")) kick();
    else lastT = 0;
  }

  function kick() { if (!raf) raf = (window.requestAnimationFrame || function (f) { return setTimeout(function () { f(now()); }, 16); })(frame); }
  PD.eyesKick = kick;

  /* Sguardo verso un elemento per qualche istante (es. la casella dove l'allievo scrive) */
  PD.eyesLookAt = function (el, ms) { focusEl = el; focusUntil = now() + (ms || 1500); kick(); };

  function onMove(x, y) {
    var t = now();
    if (mouse.t && mouse.x >= 0) {
      var d = Math.abs(x - mouse.x) + Math.abs(y - mouse.y), dt = Math.max(8, t - mouse.t);
      mouse.speed = Math.max(mouse.speed, d / dt);
      // un salto lungo e veloce dello sguardo spesso si accompagna a un battito di ciglia
      if (d / dt > 4 && blink.start < 0 && t - blink.next > -1500 && Math.random() < 0.35) blink.next = t;
    }
    mouse.x = x; mouse.y = y; mouse.t = t; mouse.inside = true;
    kick();
  }

  function start() {
    document.documentElement.classList.add("eyes-js");
    blink.next = now() + rand(1500, 4000);
    var opts = { passive: true };
    if (window.PointerEvent) document.addEventListener("pointermove", function (e) { onMove(e.clientX, e.clientY); }, opts);
    else document.addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY); }, opts);
    document.addEventListener("touchstart", function (e) { var p = e.touches[0]; if (p) onMove(p.clientX, p.clientY); }, opts);
    document.addEventListener("mouseout", function (e) { if (!e.relatedTarget) { mouse.inside = false; kick(); } });
    window.addEventListener("blur", function () { mouse.inside = false; kick(); });
    window.addEventListener("scroll", kick, opts);
    window.addEventListener("resize", kick);
    document.addEventListener("input", function (e) {
      var el = e.target;
      if (el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /text|search|url/.test(el.type)))) PD.eyesLookAt(el, 1800);
    });
    // battiti di ciglia e sguardi in giro anche quando nessuno muove il mouse
    setInterval(function () { if (!document.hidden) kick(); }, 700);
    kick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
