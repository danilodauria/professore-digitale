/* Professore Digitale - Lavagna: schemi pronti e disegno libero
 * Autore: Danilo D'Auria - Licenza MIT */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, esc = PD.esc;
  var COLORS = ["#f8fafc", "#fde047", "#f472b6", "#60a5fa", "#4ade80", "#fb923c"];
  var pen = { color: COLORS[0], size: 5, eraser: false };
  var saved = null; // immagine del disegno (dataURL), persiste tra le visite alla sezione

  function gallery() {
    var items = [];
    if (PD.lastDiagram) items.push({ key: "last", title: "Ultimo schema: " + PD.lastDiagram.title, code: PD.lastDiagram.code });
    window.PD_LESSONS.forEach(function (L) {
      L.steps.forEach(function (s, i) { if (s.d) items.push({ key: L.id + ":" + i, title: L.icon + " " + L.title + " — " + s.t, code: s.d }); });
    });
    return items;
  }

  PD.views.board = function (el, args) {
    var mode = args[0] === "disegno" ? "draw" : "diagrams";
    var items = gallery();
    el.innerHTML = '<h1>🖊️ Lavagna</h1><p class="lead">Mostrate uno schema pronto alla classe, oppure disegnate liberamente con il mouse o con il dito.</p>' +
      '<div class="row" style="margin-bottom:1rem"><button class="btn ' + (mode === "diagrams" ? "" : "ghost") + '" data-go="#/board">📊 Schemi pronti</button>' +
      '<button class="btn ' + (mode === "draw" ? "" : "ghost") + '" data-go="#/board/disegno">✏️ Disegno libero</button></div>' +
      (mode === "diagrams"
        ? '<div class="field" style="max-width:40rem"><label for="diag-pick">Scegliete lo schema</label><select id="diag-pick">' +
          items.map(function (it, i) { return '<option value="' + i + '">' + esc(it.title) + "</option>"; }).join("") + "</select></div>" +
          '<div class="row" style="margin-bottom:.8rem"><button class="btn ghost" id="diag-prev">← Precedente</button><button class="btn ghost" id="diag-next">Successivo →</button>' +
          '<button class="btn ghost" id="diag-full">⛶ Schermo intero</button></div><div class="chalkboard" id="big-board" style="min-height:55vh"></div>'
        : '<div class="board-tools">' + COLORS.map(function (c) {
            return '<button class="swatch" style="background:' + c + '" data-color="' + c + '" aria-label="Gesso colore ' + c + '" aria-pressed="' + (!pen.eraser && pen.color === c) + '"></button>';
          }).join("") +
          '<label class="small">Spessore <input type="range" id="pen-size" min="2" max="30" value="' + pen.size + '"></label>' +
          '<button class="btn ghost" id="eraser" aria-pressed="' + pen.eraser + '">🧽 Cancellino</button>' +
          '<button class="btn ghost" id="undo">↶ Annulla</button><button class="btn ghost" id="clear">🗑️ Pulisci</button>' +
          '<button class="btn ghost" id="save-png">💾 Salva immagine</button></div>' +
          '<div class="board-wrap"><canvas id="board-canvas" aria-label="Lavagna per disegnare"></canvas></div>');
    if (mode === "diagrams") setupDiagrams(el, items); else setupDraw(el);
  };

  function setupDiagrams(el, items) {
    var pick = $("#diag-pick", el), board = $("#big-board", el), i = 0;
    function show() { pick.value = i; PD.renderDiagram(board, items[i].code, items[i].title); }
    pick.onchange = function () { i = +this.value; show(); };
    $("#diag-prev", el).onclick = function () { i = (i - 1 + items.length) % items.length; show(); };
    $("#diag-next", el).onclick = function () { i = (i + 1) % items.length; show(); };
    $("#diag-full", el).onclick = function () { if (board.requestFullscreen) board.requestFullscreen(); };
    show();
  }

  function setupDraw(el) {
    var cv = $("#board-canvas", el), ctx = cv.getContext("2d"), drawing = false, last = null, undo = [], inited = false;
    function resize() {
      var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      var snapshot = inited ? cv.toDataURL() : saved; inited = true;
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = getComputedStyle(cv.parentNode).backgroundColor || "#23392f"; ctx.fillRect(0, 0, r.width, r.height);
      if (snapshot) { var img = new Image(); img.onload = function () { ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = snapshot; }
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function line(a, b) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = pen.eraser ? (getComputedStyle(cv.parentNode).backgroundColor || "#23392f") : pen.color;
      ctx.lineWidth = pen.eraser ? pen.size * 4 : pen.size;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    cv.addEventListener("pointerdown", function (e) {
      drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId);
      undo.push(cv.toDataURL()); if (undo.length > 20) undo.shift();
      line(last, { x: last.x + 0.1, y: last.y + 0.1 });
    });
    cv.addEventListener("pointermove", function (e) { if (!drawing) return; var p = pos(e); line(last, p); last = p; });
    function end() { if (drawing) { drawing = false; saved = cv.toDataURL(); } }
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", end);
    el.querySelector(".board-tools").addEventListener("click", function (e) {
      var sw = e.target.closest("[data-color]");
      if (sw) {
        pen.color = sw.getAttribute("data-color"); pen.eraser = false;
        PD.$$(".swatch", el).forEach(function (b) { b.setAttribute("aria-pressed", b === sw); });
        $("#eraser", el).setAttribute("aria-pressed", "false");
      }
    });
    $("#pen-size", el).oninput = function () { pen.size = +this.value; };
    $("#eraser", el).onclick = function () { pen.eraser = !pen.eraser; this.setAttribute("aria-pressed", pen.eraser); };
    $("#undo", el).onclick = function () {
      var prev = undo.pop(); if (!prev) return;
      var img = new Image(), r = cv.getBoundingClientRect();
      img.onload = function () { ctx.drawImage(img, 0, 0, r.width, r.height); saved = cv.toDataURL(); }; img.src = prev;
    };
    $("#clear", el).onclick = function () { undo.push(cv.toDataURL()); saved = null; inited = false; resize(); };
    $("#save-png", el).onclick = function () {
      var a = document.createElement("a"); a.href = cv.toDataURL("image/png");
      a.download = "lavagna-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".png"; a.click();
    };
    resize();
    var t; window.addEventListener("resize", function () { if (!document.body.contains(cv)) return; clearTimeout(t); t = setTimeout(resize, 200); });
  }
})();
