/* Professore Digitale - Palestra: esercizi pratici di mouse e tastiera
 * Autore: Danilo D'Auria - Licenza MIT */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var EX = [
    { id: "click", ico: "🎯", t: "Il clic", d: "Colpite i palloncini con un clic del tasto sinistro." },
    { id: "dblclick", ico: "📂", t: "Il doppio clic", d: "Aprite le cartelle con un doppio clic (toc-toc)." },
    { id: "drag", ico: "✋", t: "Trascinare", d: "Tenete premuto e portate i fogli dentro la cartella." },
    { id: "typing", ico: "⌨️", t: "La tastiera", d: "Scrivete le parole: dalle più facili fino alla chiocciola @." },
    { id: "keys", ico: "⏎", t: "I tasti speciali", d: "Invio, Spazio, Cancella, le frecce, Esc: trovateli sulla tastiera." },
    { id: "scroll", ico: "🖲️", t: "Scorrere la pagina", d: "Usate la rotellina del mouse per trovare le stelle nascoste." },
    { id: "rightclick", ico: "🖱️", t: "Il clic destro", d: "Aprite il menu con il tasto destro e scegliete il comando giusto." },
    { id: "select", ico: "🖍️", t: "Selezionare il testo", d: "Doppio clic per una parola, triplo clic per una riga intera." },
    { id: "copypaste", ico: "📋", t: "Copia e incolla", d: "Copiate una frase e incollatela altrove: Ctrl + C e Ctrl + V." },
    { id: "memory", ico: "🧠", t: "Memory digitale", d: "Girate le carte e trovate le coppie: occhio e mouse insieme." },
    { id: "scam", ico: "🚩", t: "Riconosci la truffa", d: "Messaggi veri o truffe? Allenate l'occhio a scoprire i trucchi." }
  ];
  var RECORD = { typing: " parole", scam: " su 10" };
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
            (b != null ? '<span class="badge done">Record: ' + b + (RECORD[e.id] || " s") + "</span>" : "") + "</button>";
        }).join("") + "</div>";
      return;
    }
    el.innerHTML = '<div class="lesson-head"><span class="big-ico">' + ex.ico + "</span><div><h1>" + ex.t + '</h1><p class="muted" style="margin:0">' + ex.d +
      '</p></div><button class="btn ghost" data-go="#/practice" style="margin-left:auto">← Palestra</button></div><div id="ex-box"></div>';
    var box = $("#ex-box", el);
    ({ click: clickGame, dblclick: dblGame, drag: dragGame, typing: typingGame, keys: keysGame, scroll: scrollGame, rightclick: rightGame,
       select: selectGame, copypaste: copyGame, memory: memoryGame, scam: scamGame })[ex.id](box);
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
      var ultimoClic = 0;   // mani che tremano: due clic semplici vicini valgono come doppio clic
      b.addEventListener("click", function () {
        if (!(PD.tremore && PD.tremore.attivo())) return;
        var ora = Date.now();
        if (ora - ultimoClic <= PD.tremore.sogliaDoppioClic) { ultimoClic = 0; b.ondblclick(); } else ultimoClic = ora;
      });
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


  function secondi(t0) { return Math.round((Date.now() - t0) / 1000); }

  /* --- 5. Tasti speciali --- */
  function keysGame(box) {
    var K = [
      { k: "Enter", n: "Invio ⏎", h: "È il tasto grande a destra delle lettere, a forma di L rovesciata. Serve per andare a capo o confermare." },
      { k: " ", n: "Spazio", h: "È la barra lunga in basso, al centro. Separa le parole." },
      { k: "Backspace", n: "Cancella ⌫", h: "È in alto a destra, sopra Invio, con una freccia verso sinistra. Cancella la lettera prima del cursore." },
      { k: "Shift", n: "Maiuscolo ⇧ (Shift)", h: "Ce ne sono due, a sinistra e a destra, con una freccia verso l'alto. Si tiene premuto per scrivere le maiuscole." },
      { k: "Escape", n: "Esc", h: "È in alto a sinistra. Serve per annullare o chiudere una finestrella." },
      { k: "ArrowUp", n: "Freccia su ↑", h: "Le quattro frecce sono in basso a destra, raggruppate a forma di T rovesciata." },
      { k: "ArrowLeft", n: "Freccia sinistra ←", h: "Nel gruppo delle frecce, in basso a destra." },
      { k: "Tab", n: "Tab ⇥", h: "È a sinistra, sopra il tasto delle maiuscole fisse. Serve per passare alla casella successiva." },
      { k: "Delete", n: "Canc", h: "Spesso è sopra le frecce, vicino a Fine. Cancella la lettera dopo il cursore." },
      { k: "@", n: "Chiocciola @", h: "Tenete premuto Alt Gr (a destra dello Spazio) e premete il tasto ò." }
    ];
    var i = 0, t0 = Date.now(), errori = 0;
    box.innerHTML = '<p class="score" id="sc"></p><div class="card tasto-grande" id="tk" tabindex="0" aria-live="polite"></div><p class="small muted" id="hint"></p>' +
      '<div class="row"><button class="btn ghost" id="say">🔊 Ripeti</button></div>';
    var tk = $("#tk", box);
    function show() {
      $("#sc", box).textContent = "Tasto " + (i + 1) + " di " + K.length;
      tk.innerHTML = 'Premete il tasto<br><kbd>' + esc(K[i].n) + "</kbd>"; tk.className = "card tasto-grande";
      $("#hint", box).textContent = K[i].h; tk.focus();
    }
    function onKey(e) {
      if (!document.body.contains(tk)) { document.removeEventListener("keydown", onKey, true); return; }
      if (e.key === "Escape" && K[i].k !== "Escape") return;
      if (["Enter", " ", "Backspace", "Tab", "ArrowUp", "ArrowLeft", "Delete"].indexOf(e.key) >= 0) e.preventDefault();
      if (e.key === "AltGraph" || e.key === "Control" || e.key === "Alt" || (e.key === "Shift" && K[i].k !== "Shift")) return;
      if (e.key === K[i].k) {
        tk.className = "card tasto-grande giusto"; PD.toast("✅ " + praise(), 900);
        i++;
        if (i >= K.length) {
          document.removeEventListener("keydown", onKey, true);
          var sec = secondi(t0), rec = record("keys", sec, true);
          setTimeout(function () { finish(box, "keys", "Avete trovato tutti i " + K.length + " tasti in <b>" + sec + " secondi</b>" + (errori ? " (con " + errori + " tentativi in più)" : "") + "." + (rec ? " Nuovo record!" : ""), function () { keysGame(box); }); }, 500);
        } else setTimeout(show, 450);
      } else { errori++; tk.className = "card tasto-grande sbagliato"; setTimeout(function () { tk.className = "card tasto-grande"; }, 400); }
    }
    document.addEventListener("keydown", onKey, true);
    cleanupSet(function () { document.removeEventListener("keydown", onKey, true); });
    $("#say", box).onclick = function () { PD.speak("Premete il tasto " + K[i].n + ". " + K[i].h, true); };
    show();
  }

  /* --- 6. Scorrere: stelle nascoste in una pagina lunga --- */
  function scrollGame(box) {
    var N = 5, trovate = 0, t0 = Date.now(), ico = ["🌳", "🏠", "🚲", "🌻", "🐟", "☕", "📮", "🎈", "🍎", "🚗"];
    var righe = [], posti = [];
    while (posti.length < N) { var r = 6 + Math.floor(Math.random() * 54); if (posti.indexOf(r) < 0) posti.push(r); }
    for (var k = 0; k < 60; k++) {
      var celle = [];
      for (var c = 0; c < 6; c++) celle.push(posti.indexOf(k) >= 0 && c === (k % 6) ? '<button class="stella" aria-label="Stella">⭐</button>' : "<span>" + ico[(k * 7 + c * 3) % ico.length] + "</span>");
      righe.push('<div class="riga-scorri">' + celle.join("") + "</div>");
    }
    box.innerHTML = '<p class="score" id="sc">Stelle trovate: 0 su ' + N + '</p><p class="small muted">Mettete il puntatore dentro il riquadro e girate la <b>rotellina</b> del mouse ' +
      "(oppure trascinate la barra a destra). Quando vedete una ⭐ fateci clic.</p>" + '<div class="scorri" id="sz" tabindex="0">' + righe.join("") + "</div>";
    $$(".stella", box).forEach(function (s) {
      s.onclick = function () {
        s.disabled = true; s.textContent = "✨"; trovate++; $("#sc", box).textContent = "Stelle trovate: " + trovate + " su " + N;
        if (trovate === N) { var sec = secondi(t0), rec = record("scroll", sec, true); finish(box, "scroll", "Avete trovato tutte le stelle in <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { scrollGame(box); }); }
      };
    });
  }

  /* --- 7. Clic destro: menu contestuale --- */
  function rightGame(box) {
    var file = [["📄", "Lettera"], ["🖼️", "Foto del mare"], ["🎵", "Canzone"], ["📁", "Ricette"], ["📄", "Bolletta"]];
    var comandi = ["Apri", "Copia", "Rinomina", "Elimina"];
    var giri = [[0, "Copia"], [3, "Apri"], [1, "Rinomina"], [4, "Copia"], [2, "Apri"]], g = 0, t0 = Date.now(), menu = null;
    box.innerHTML = '<p class="score" id="sc"></p><p class="consegna" id="cons"></p><div class="arena" id="arena"><div class="file-griglia">' +
      file.map(function (f, i) { return '<button class="file-ico" data-f="' + i + '">' + f[0] + "<span>" + esc(f[1]) + "</span></button>"; }).join("") + "</div></div>";
    var arena = $("#arena", box);
    function show() {
      $("#sc", box).textContent = "Prova " + (g + 1) + " di " + giri.length;
      $("#cons", box).innerHTML = "Fate <b>clic con il tasto destro</b> su «" + esc(file[giri[g][0]][1]) + "», poi scegliete <b>" + giri[g][1] + "</b>.";
    }
    function chiudi() { if (menu) { menu.parentNode.removeChild(menu); menu = null; } }
    arena.addEventListener("contextmenu", function (e) {
      var f = e.target.closest(".file-ico"); e.preventDefault(); chiudi();
      if (!f) return;
      var r = arena.getBoundingClientRect();
      menu = document.createElement("div"); menu.className = "ctx-menu";
      menu.innerHTML = comandi.map(function (c) { return '<button data-c="' + c + '">' + c + "</button>"; }).join("");
      menu.style.left = Math.min(e.clientX - r.left, r.width - 170) + "px"; menu.style.top = Math.min(e.clientY - r.top, r.height - 180) + "px";
      arena.appendChild(menu);
      menu.onclick = function (ev) {
        var c = ev.target.getAttribute("data-c"); if (!c) return;
        var ok = +f.getAttribute("data-f") === giri[g][0] && c === giri[g][1];
        chiudi();
        if (!ok) { PD.toast("Quasi! Controllate il nome del file e il comando.", 2000); return; }
        PD.toast("✅ " + praise(), 1000); g++;
        if (g >= giri.length) { var sec = secondi(t0), rec = record("rightclick", sec, true); finish(box, "rightclick", "Il clic destro non ha più segreti: <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { rightGame(box); }); }
        else show();
      };
    });
    arena.addEventListener("click", function (e) {
      if (menu && !menu.contains(e.target)) chiudi();
      if (e.target.closest(".file-ico")) PD.toast("Questo è il clic sinistro: provate con il tasto destro del mouse.", 2200);
    });
    show();
  }

  /* --- 8. Selezionare il testo --- */
  function selectGame(box) {
    var frase = "Il computer è un amico paziente che aspetta i nostri tempi.";
    var compiti = [["parola", "computer"], ["parola", "paziente"], ["parola", "tempi"], ["riga", frase]], c = 0, t0 = Date.now();
    box.innerHTML = '<p class="score" id="sc"></p><p class="consegna" id="cons"></p><p class="testo-sel" id="ts">' + esc(frase) + "</p>" +
      '<p class="small muted">Suggerimento: <b>doppio clic</b> sopra una parola la seleziona (diventa colorata); <b>triplo clic</b> seleziona tutta la riga.</p>';
    function show() {
      $("#sc", box).textContent = "Prova " + (c + 1) + " di " + compiti.length;
      $("#cons", box).innerHTML = compiti[c][0] === "parola" ? "Selezionate la parola <b>«" + esc(compiti[c][1]) + "»</b>." : "Selezionate <b>tutta la frase</b>.";
    }
    function controlla() {
      var sel = String(window.getSelection ? window.getSelection() : "").replace(/[\s.]+$/, "").trim();
      var att = compiti[c][1].replace(/[\s.]+$/, "");
      if (!sel) return;
      if (sel === att) {
        PD.toast("✅ " + praise(), 1000); c++;
        if (c >= compiti.length) { var sec = secondi(t0), rec = record("select", sec, true); finish(box, "select", "Avete selezionato tutto in <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { selectGame(box); }); }
        else { setTimeout(function () { try { window.getSelection().removeAllRanges(); } catch (e) { /* ignora */ } }, 400); show(); }
      }
    }
    $("#ts", box).addEventListener("mouseup", function () { setTimeout(controlla, 30); });
    $("#ts", box).addEventListener("dblclick", function () { setTimeout(controlla, 30); });
    show();
  }

  /* --- 9. Copia e incolla --- */
  function copyGame(box) {
    var frasi = ["Buongiorno a tutti!", "mario.rossi@esempio.it", "Via Roma 10, Milano", "Ci vediamo giovedì alle 15"], i = 0, t0 = Date.now();
    box.innerHTML = '<p class="score" id="sc"></p><div class="copia-griglia"><div><p class="consegna">1. Copiate questa frase</p><input class="type-input" id="src" readonly></div>' +
      '<div><p class="consegna">2. Incollatela qui</p><input class="type-input" id="dst" autocomplete="off" spellcheck="false" placeholder="Incollate qui…"></div></div>' +
      '<ol class="small muted"><li>Fate clic sulla frase in alto e premete <kbd>Ctrl</kbd> + <kbd>A</kbd> (seleziona tutto), poi <kbd>Ctrl</kbd> + <kbd>C</kbd> (copia).</li>' +
      "<li>Fate clic nel riquadro in basso e premete <kbd>Ctrl</kbd> + <kbd>V</kbd> (incolla).</li><li>Potete anche usare il clic destro: Copia e poi Incolla.</li></ol>";
    var src = $("#src", box), dst = $("#dst", box);
    function show() { $("#sc", box).textContent = "Frase " + (i + 1) + " di " + frasi.length; src.value = frasi[i]; dst.value = ""; src.focus(); }
    src.addEventListener("focus", function () { setTimeout(function () { src.select(); }, 0); });
    dst.addEventListener("input", function () {
      if (dst.value.trim() !== frasi[i]) return;
      PD.toast("✅ " + praise(), 1000); i++;
      if (i >= frasi.length) { var sec = secondi(t0), rec = record("copypaste", sec, true); finish(box, "copypaste", "Copia e incolla imparato in <b>" + sec + " secondi</b>." + (rec ? " Nuovo record!" : ""), function () { copyGame(box); }); }
      else setTimeout(show, 500);
    });
    dst.addEventListener("keydown", function (e) {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); PD.toast("Non serve scrivere: usate Ctrl + V per incollare.", 1800); }
    });
    show();
  }

  /* --- 10. Memory --- */
  function memoryGame(box) {
    var simboli = ["🖱️", "⌨️", "🖥️", "📧", "🔒", "🌐"], carte = shuffle(simboli.concat(simboli)), aperte = [], coppie = 0, mosse = 0, t0 = Date.now(), blocco = false;
    box.innerHTML = '<p class="score" id="sc">Coppie: 0 su 6 · mosse: 0</p><div class="memory" id="mem">' +
      carte.map(function (c, i) { return '<button class="carta" data-i="' + i + '" aria-label="Carta coperta"><span>' + c + "</span></button>"; }).join("") + "</div>";
    $$(".carta", box).forEach(function (b) {
      b.onclick = function () {
        if (blocco || b.classList.contains("su")) return;
        b.classList.add("su"); b.setAttribute("aria-label", "Carta " + carte[+b.getAttribute("data-i")]); aperte.push(b);
        if (aperte.length < 2) return;
        mosse++;
        var a = aperte[0], c = aperte[1];
        if (carte[+a.getAttribute("data-i")] === carte[+c.getAttribute("data-i")]) {
          a.classList.add("ok"); c.classList.add("ok"); aperte = []; coppie++;
          if (coppie === simboli.length) { var sec = secondi(t0), rec = record("memory", sec, true); setTimeout(function () { finish(box, "memory", "Tutte le coppie in <b>" + mosse + " mosse</b> e " + sec + " secondi." + (rec ? " Nuovo record!" : ""), function () { memoryGame(box); }); }, 600); }
        } else { blocco = true; setTimeout(function () { a.classList.remove("su"); c.classList.remove("su"); aperte = []; blocco = false; }, 900); }
        $("#sc", box).textContent = "Coppie: " + coppie + " su 6 · mosse: " + mosse;
      };
    });
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* --- 11. Riconosci la truffa --- */
  function scamGame(box) {
    var M = shuffle([
      { da: "SMS · Poste", t: "Il suo conto è stato bloccato. Per sbloccarlo inserisca subito i suoi codici qui: poste-sicurezza-verifica.com", truffa: true, e: "Poste e banche non chiedono mai codici via SMS. Fretta + link strano = truffa." },
      { da: "SMS · Corriere", t: "Il suo pacco è in giacenza. Paghi 1,99 € di spese di spedizione a questo link per riceverlo.", truffa: true, e: "Il finto corriere chiede piccole somme per rubare i dati della carta." },
      { da: "WhatsApp · numero sconosciuto", t: "Ciao mamma, ho cambiato numero e ho il telefono rotto. Mi serve un bonifico urgente, ti spiego dopo.", truffa: true, e: "Classica truffa del «figlio in difficoltà»: chiamate il numero vecchio prima di fare qualunque cosa." },
      { da: "Email · Banca", t: "Gentile cliente, abbiamo rilevato un accesso sospetto. Confermi la password e il PIN rispondendo a questa email.", truffa: true, e: "Nessuna banca chiede password o PIN per email." },
      { da: "Email · «Lotteria Internazionale»", t: "Congratulazioni! Ha vinto 500.000 euro. Per ricevere il premio paghi le spese di pratica.", truffa: true, e: "Non si vince a una lotteria a cui non si è partecipato. E i premi veri non chiedono soldi." },
      { da: "Telefonata · «Tecnico informatico»", t: "Il suo computer ha un virus: installi questo programma così posso collegarmi e ripararlo.", truffa: true, e: "Nessuna azienda chiama per un virus sul vostro computer. Non fate entrare sconosciuti nel PC." },
      { da: "SMS · Farmacia di quartiere", t: "Buongiorno, i farmaci che ha ordinato sono pronti. Può ritirarli quando vuole in orario di apertura.", truffa: false, e: "Nessun link, nessuna richiesta di dati o soldi: un avviso normale." },
      { da: "Email · Comune", t: "Le ricordiamo che giovedì la raccolta della carta è anticipata al mattino. Per informazioni chiami il numero del Comune.", truffa: false, e: "Un'informazione utile, senza link da cliccare né dati da inserire." },
      { da: "WhatsApp · Nipote Luca (numero salvato)", t: "Nonna, domenica passo a trovarti con i bambini. Ti porto le foto del mare!", truffa: false, e: "Numero conosciuto, nessuna richiesta strana: un messaggio normale." },
      { da: "SMS · Medico di famiglia", t: "Promemoria: appuntamento domani alle 10:30 in ambulatorio. Se non può venire, ci telefoni.", truffa: false, e: "Un promemoria che non chiede dati né pagamenti." },
      { da: "Email · «Amazon»", t: "Il suo account verrà chiuso entro 24 ore se non aggiorna i dati della carta a questo indirizzo.", truffa: true, e: "Minaccia + scadenza + richiesta della carta: sono i tre segnali tipici del phishing." }
    ]).slice(0, 10);
    var i = 0, punti = 0;
    box.innerHTML = '<p class="score" id="sc"></p><div class="card messaggio" id="msg"></div><div class="row" id="scelte"><button class="btn big danger" data-v="1">🚩 È una truffa</button>' +
      '<button class="btn big" data-v="0">✅ È affidabile</button></div><div id="exp" aria-live="polite"></div>';
    function show() {
      var m = M[i];
      $("#sc", box).textContent = "Messaggio " + (i + 1) + " di " + M.length + " · giusti: " + punti;
      $("#msg", box).innerHTML = '<div class="small muted">' + esc(m.da) + "</div><p>" + esc(m.t) + "</p>";
      $("#exp", box).innerHTML = ""; $$("#scelte button", box).forEach(function (b) { b.disabled = false; });
    }
    $$("#scelte button", box).forEach(function (b) {
      b.onclick = function () {
        var m = M[i], ok = (b.getAttribute("data-v") === "1") === m.truffa;
        if (ok) punti++;
        $$("#scelte button", box).forEach(function (x) { x.disabled = true; });
        $("#exp", box).innerHTML = '<div class="notice ' + (ok ? "ok" : "") + '">' + (ok ? "✅ <b>Giusto!</b> " : "❌ <b>Attenzione!</b> ") + (m.truffa ? "Era una truffa. " : "Era un messaggio affidabile. ") + esc(m.e) +
          '<div class="row" style="margin-top:.6rem"><button class="btn" id="avanti">' + (i + 1 < M.length ? "Avanti →" : "Risultato 🏁") + "</button></div></div>";
        if (PD.settings.autoReadAnswers) PD.speak((ok ? "Giusto! " : "Attenzione! ") + m.e);
        $("#avanti", box).onclick = function () {
          PD.stopSpeech(); i++;
          if (i < M.length) show();
          else { var rec = record("scam", punti, false); finish(box, "scam", "Avete riconosciuto <b>" + punti + " messaggi su " + M.length + "</b>." + (rec ? " Nuovo record!" : "") + " Ricordate: nel dubbio, non cliccate e chiedete a una persona di fiducia.", function () { scamGame(box); }); }
        };
      };
    });
    show();
  }

  var cleanupFn = null;
  function cleanupSet(fn) { cleanupFn = fn; }
  window.addEventListener("hashchange", function () { if (cleanupFn) { cleanupFn(); cleanupFn = null; } });

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
