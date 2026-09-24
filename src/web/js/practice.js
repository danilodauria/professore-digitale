/* Professore Digitale - Palestra: esercizi pratici di mouse e tastiera
 * Autore: Danilo D'Auria - Licenza MIT */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var EX = [
    { id: "click", ico: "🎯", t: "Il clic", d: "Colpite i palloncini con un clic del tasto sinistro." },
    { id: "dblclick", ico: "📂", t: "Il doppio clic", d: "Aprite le cartelle con un doppio clic (toc-toc)." },
    { id: "drag", ico: "✋", t: "Trascinare", d: "Tenete premuto e portate i fogli dentro la cartella." },
    { id: "typing", ico: "⌨️", t: "La tastiera", d: "Scrivete le parole: dalle più facili fino alla chiocciola @." }
  ];
  var cleanup = null;
  function best(id) { var p = PD.progress.practice || {}; return p[id]; }
  function record(id, val, lowerIsBetter) {
    PD.progress.practice = PD.progress.practice || {};
    var old = PD.progress.practice[id];
    var better = old == null || (lowerIsBetter ? val < old : val > old);
    if (better) { PD.progress.practice[id] = val; PD.saveProgress(); }
    return better;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function praise() { var p = ["Bravissimi!", "Ottimo lavoro!", "Perfetto!", "Complimenti!", "Che mano ferma!"]; return p[Math.floor(Math.random() * p.length)]; }

  PD.views.practice = function (el, args) {
    if (cleanup) { cleanup(); cleanup = null; }
    var ex = EX.filter(function (e) { return e.id === args[0]; })[0];
    if (!ex) {
      el.innerHTML = '<h1>🎯 Palestra</h1><p class="lead">Piccoli esercizi per prendere confidenza. Non c\'è fretta e non si può sbagliare: si impara provando.</p><div class="grid">' +
        EX.map(function (e) {
          var b = best(e.id);
          return '<button class="card tile" data-go="#/practice/' + e.id + '"><span class="big-ico">' + e.ico + "</span><h3>" + e.t + "</h3><p>" + e.d + "</p>" +
            (b != null ? '<span class="badge done">Record: ' + (e.id === "typing" ? b + " parole" : b + " s") + "</span>" : "") + "</button>";
        }).join("") + "</div>";
      return;
    }
    el.innerHTML = '<div class="lesson-head"><span class="big-ico">' + ex.ico + "</span><div><h1>" + ex.t + '</h1><p class="muted" style="margin:0">' + ex.d +
      '</p></div><button class="btn ghost" data-go="#/practice" style="margin-left:auto">← Palestra</button></div><div id="ex-box"></div>';
    var box = $("#ex-box", el);
    ({ click: clickGame, dblclick: dblGame, drag: dragGame, typing: typingGame })[ex.id](box);
  };

  function finish(box, id, msg, again) {
    box.innerHTML = '<div class="card" style="text-align:center;padding:2rem"><div style="font-size:3rem">🏆</div><h2>' + praise() + "</h2><p>" + msg + "</p>" +
      '<div class="row" style="justify-content:center"><button class="btn big" id="again">↻ Ancora</button><button class="btn big ghost" data-go="#/practice">Altri esercizi</button></div></div>';
    $("#again", box).onclick = again;
    PD.speak(praise() + " " + msg.replace(/<[^>]+>/g, ""));
  }

  /* --- 1. Clic: palloncini --- */
  function clickGame(box) {
    var total = 10, hit = 0, t0 = 0;
    box.innerHTML = '<p class="score" id="sc">Palloncini colpiti: 0 su ' + total + '</p><div class="arena" id="arena"></div>';
    var arena = $("#arena", box);
    function spawn() {
      arena.innerHTML = "";
      var b = document.createElement("button"), size = Math.max(3.2, 5.5 - hit * 0.2);
      b.className = "target"; b.textContent = "🎈"; b.setAttribute("aria-label", "Palloncino");
      b.style.width = b.style.height = size + "rem";
      var W = arena.clientWidth, H = arena.clientHeight, px = size * parseFloat(getComputedStyle(document.documentElement).fontSize);
      b.style.left = rand(8, Math.max(9, W - px - 8)) + "px"; b.style.top = rand(8, Math.max(9, H - px - 8)) + "px";
      b.onclick = function () {
        if (!t0) t0 = Date.now();
        hit++; $("#sc", box).textContent = "Palloncini colpiti: " + hit + " su " + total;
        if (hit >= total) {
          var sec = Math.round((Date.now() - t0) / 100) / 10, rec = record("click", sec, true);
          finish(box, "click", "Avete colpito " + total + " palloncini in <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { clickGame(box); });
        } else spawn();
      };
      arena.appendChild(b);
    }
    spawn();
  }

  /* --- 2. Doppio clic: cartelle --- */
  function dblGame(box) {
    var names = ["Foto", "Lettere", "Ricette", "Musica", "Documenti"], opened = 0, t0 = Date.now();
    box.innerHTML = '<p class="score" id="sc">Cartelle aperte: 0 su ' + names.length + '</p><p class="small muted">Un clic seleziona la cartella (diventa colorata). Due clic veloci la aprono.</p><div class="arena" id="arena"></div>';
    var arena = $("#arena", box), W = arena.clientWidth, H = arena.clientHeight;
    names.forEach(function (n, i) {
      var b = document.createElement("button"); b.className = "folder-ico"; b.innerHTML = "📁<span>" + esc(n) + "</span>";
      var cols = Math.min(5, Math.max(2, Math.floor(W / 150)));
      b.style.left = (20 + (i % cols) * (W - 40) / cols) + "px"; b.style.top = (20 + Math.floor(i / cols) * 140 + rand(0, 30)) + "px";
      b.onclick = function () { $$(".folder-ico", arena).forEach(function (x) { x.classList.remove("sel"); }); b.classList.add("sel"); };
      b.ondblclick = function () {
        if (b.getAttribute("data-open")) return;
        b.setAttribute("data-open", "1"); b.innerHTML = "📂<span>" + esc(n) + " ✓</span>"; opened++;
        $("#sc", box).textContent = "Cartelle aperte: " + opened + " su " + names.length;
        if (opened === names.length) {
          var sec = Math.round((Date.now() - t0) / 1000), rec = record("dblclick", sec, true);
          setTimeout(function () { finish(box, "dblclick", "Avete aperto tutte le cartelle in <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { dblGame(box); }); }, 500);
        }
      };
      arena.appendChild(b);
    });
    void H;
  }

  /* --- 3. Trascinare: fogli nella cartella --- */
  function dragGame(box) {
    var items = ["📄", "🖼️", "🎵", "📄", "🖼️"], done = 0, t0 = Date.now();
    box.innerHTML = '<p class="score" id="sc">Fogli sistemati: 0 su ' + items.length + '</p><div class="arena" id="arena"><div class="dropzone" id="dz">📁</div></div>';
    var arena = $("#arena", box), dz = $("#dz", box);
    items.forEach(function (ico, i) {
      var d = document.createElement("div"); d.className = "draggable"; d.textContent = ico; d.setAttribute("role", "img"); d.setAttribute("aria-label", "Foglio da spostare");
      d.style.left = (20 + i * 70) + "px"; d.style.top = (30 + rand(0, 120)) + "px";
      var start = null;
      d.addEventListener("pointerdown", function (e) {
        e.preventDefault(); d.setPointerCapture(e.pointerId); d.style.cursor = "grabbing";
        start = { x: e.clientX, y: e.clientY, l: parseFloat(d.style.left), t: parseFloat(d.style.top) }; d.style.zIndex = 5;
      });
      d.addEventListener("pointermove", function (e) {
        if (!start) return;
        d.style.left = (start.l + e.clientX - start.x) + "px"; d.style.top = (start.t + e.clientY - start.y) + "px";
        dz.classList.toggle("hot", over(d, dz));
      });
      d.addEventListener("pointerup", function () {
        if (!start) return; start = null; d.style.cursor = "grab"; dz.classList.remove("hot");
        if (over(d, dz)) {
          d.remove(); done++; $("#sc", box).textContent = "Fogli sistemati: " + done + " su " + items.length;
          if (done === items.length) {
            var sec = Math.round((Date.now() - t0) / 1000), rec = record("drag", sec, true);
            finish(box, "drag", "Tutto in ordine in <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { dragGame(box); });
          }
        }
      });
      arena.appendChild(d);
    });
    function over(a, b) {
      var r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect(), cx = r1.left + r1.width / 2, cy = r1.top + r1.height / 2;
      return cx > r2.left && cx < r2.right && cy > r2.top && cy < r2.bottom;
    }
  }

  /* --- 4. Tastiera: parole progressive --- */
  function typingGame(box) {
    var WORDS = ["casa", "sole", "mare", "gatto", "nonna", "computer", "Roma", "Buongiorno", "Ciao Maria", "posta elettronica", "mario@esempio.it", "Password-Sicura-7"];
    var i = 0, t0 = Date.now();
    box.innerHTML = '<p class="score" id="sc"></p><div class="type-target" id="tt" aria-live="polite"></div>' +
      '<input class="type-input" id="ti" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Scrivete qui">' +
      '<p class="small muted" id="hint"></p><div class="row"><button class="btn ghost" id="skip">Salta questa parola</button><button class="btn ghost" id="say">🔊 Pronuncia</button></div>';
    var tt = $("#tt", box), ti = $("#ti", box);
    function hint(w) {
      if (/@/.test(w)) return "Suggerimento: la chiocciola @ si scrive con Alt Gr + ò.";
      if (/-/.test(w)) return "Suggerimento: il trattino - è il tasto in basso a destra, vicino a Shift.";
      if (/[A-Z]/.test(w)) return "Suggerimento: per la maiuscola tenete premuto Shift (⇧) e premete la lettera.";
      if (/ /.test(w)) return "Suggerimento: lo spazio si fa con la barra lunga in basso.";
      return "Scrivete la parola nel riquadro qui sotto. Se sbagliate, usate Backspace (⌫).";
    }
    function show() {
      var w = WORDS[i];
      $("#sc", box).textContent = "Parola " + (i + 1) + " di " + WORDS.length;
      $("#hint", box).textContent = hint(w); ti.value = ""; paint(); ti.focus();
    }
    function paint() {
      var w = WORDS[i], v = ti.value, h = "";
      for (var k = 0; k < w.length; k++) {
        var c = w[k] === " " ? "&nbsp;" : esc(w[k]);
        h += k < v.length ? '<span class="' + (v[k] === w[k] ? "ok" : "ko") + '">' + c + "</span>" : c;
      }
      tt.innerHTML = h;
    }
    function next(skipped) {
      i++;
      if (i >= WORDS.length) {
        var sec = Math.round((Date.now() - t0) / 1000), n = WORDS.length - (skipped || 0), rec = record("typing", n, false);
        finish(box, "typing", "Avete scritto tutte le parole in <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { typingGame(box); });
        return;
      }
      show();
    }
    var skipped = 0;
    ti.addEventListener("input", function () {
      paint();
      if (ti.value === WORDS[i]) { ti.disabled = true; PD.toast("✅ " + praise(), 1200); setTimeout(function () { ti.disabled = false; next(skipped); }, 700); }
    });
    $("#skip", box).onclick = function () { skipped++; next(skipped); };
    $("#say", box).onclick = function () { PD.speak(WORDS[i].replace("@", " chiocciola ").replace(/-/g, " trattino "), true); };
    show();
  }
})();
