/* ==============================================================================
 *  PROFESSORE DIGITALE - Stampa della schermata o dell'argomento completo
 *  "Stampa questa pagina": cio' che si vede (senza menu e pulsanti).
 *  "Stampa l'argomento": la lezione intera con tutti gli schemi e il quiz, la conversazione
 *  completa, tutte le domande e risposte di un argomento. Funziona anche nella versione portatile.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, esc = PD.esc;

  function area() {
    var a = document.getElementById("print-area");
    if (!a) { a = document.createElement("div"); a.id = "print-area"; document.body.appendChild(a); }
    return a;
  }
  function pulisci() {
    document.body.classList.remove("printing");
    var st = document.getElementById("pd-print-page"); if (st) st.parentNode.removeChild(st);
    var a = document.getElementById("print-area"); if (a) a.innerHTML = "";
  }
  window.addEventListener("afterprint", function () { setTimeout(pulisci, 300); });

  /* stampa un contenuto HTML preparato apposta (orientamento: "verticale" o "orizzontale") */
  PD.printHTML = function (html, orient) {
    var a = area(); a.innerHTML = html;
    var st = document.createElement("style"); st.id = "pd-print-page";
    st.textContent = orient === "orizzontale" ? "@page { size: A4 landscape; margin: 0; } #print-area > svg { width: 297mm; height: 209mm; display: block; }"
      : "@page { size: A4; margin: 14mm 14mm 16mm; }";
    document.head.appendChild(st);
    document.body.classList.add("printing");
    setTimeout(function () { window.print(); }, 250);
  };

  function testata(titolo, sotto) {
    var d = new Date();
    return '<header class="p-testa"><div><b>Professore Digitale</b> · ' + esc(sotto || "Cattedra Digitale Portatile") + "</div><div>" +
      d.toLocaleDateString("it-IT") + "</div></header><h1>" + esc(titolo) + "</h1>";
  }
  function piede() {
    return '<footer class="p-piede">Stampato dal Professore Digitale · software libero ideato da Danilo D\'Auria · funziona senza Internet</footer>';
  }

  /* lezione intera: passi, consigli, schemi, quiz (con le soluzioni in fondo) */
  function lezione(id) {
    var L = (window.PD_LESSONS || []).filter(function (x) { return x.id === id; })[0];
    if (!L) return null;
    var html = testata(L.icon + " " + L.title, L.level + " · circa " + L.minutes + " minuti") + (L.goal ? '<p class="p-obiettivo"><b>Obiettivo:</b> ' + esc(L.goal) + "</p>" : "");
    L.steps.forEach(function (s, i) {
      html += '<section class="p-passo"><h2>' + (i + 1) + ". " + esc(s.t) + "</h2>" + PD.md(s.x) + (s.tip ? '<p class="p-tip">💡 ' + esc(s.tip) + "</p>" : "") +
        (s.d ? '<div class="p-schema" data-schema="' + i + '"></div>' : "") + "</section>";
    });
    if (L.quiz && L.quiz.length) {
      html += '<section class="p-quiz"><h2>✓ Quiz di ripasso</h2>' + L.quiz.map(function (q, i) {
        return "<p><b>" + (i + 1) + ". " + esc(q.q) + "</b><br>" + q.o.map(function (o, k) { return "☐ " + esc(o); }).join("<br>") + "</p>";
      }).join("") + '<p class="small"><b>Soluzioni:</b> ' + L.quiz.map(function (q, i) { return (i + 1) + ") " + esc(q.o[q.a]); }).join(" · ") + "</p></section>";
    }
    return { html: html + piede(), schemi: L.steps.map(function (s) { return s.d; }) };
  }

  function conversazione() {
    var h = PD.history || [];
    if (!h.length) return null;
    return { html: testata("💬 La nostra conversazione") + h.map(function (m) {
      return m.role === "user" ? '<div class="p-dom"><b>Domanda:</b> ' + esc(m.content) + "</div>" : '<div class="p-risp">' + PD.md(m.content) + "</div>";
    }).join("") + piede(), schemi: [] };
  }

  function domande(pack, titolo) {
    var kb = (window.PD_KB || []).filter(function (k) { return k.pack === pack; });
    var lez = (window.PD_LESSONS || []).filter(function (L) { return L.pack === pack; });
    if (!kb.length && !lez.length) return null;
    var html = testata(titolo) + (lez.length ? "<h2>Lezioni</h2><ol>" + lez.map(function (L) { return "<li><b>" + esc(L.title) + "</b> – " + esc(L.goal) + "</li>"; }).join("") + "</ol>" : "") +
      (kb.length ? "<h2>Domande e risposte</h2>" + kb.map(function (k) { return '<div class="p-qa"><h3>' + esc(k.q) + "</h3>" + PD.md(k.a) + "</div>"; }).join("") : "");
    return { html: html + piede(), schemi: [] };
  }

  /* cosa significa "argomento completo" nella pagina attuale */
  function argomento() {
    var parts = (location.hash.replace(/^#\/?/, "") || "home").split("/");
    if (parts[0] === "lessons" && parts[1]) return { etichetta: "Stampa la lezione intera", fn: function () { return lezione(parts[1]); } };
    if (parts[0] === "ask") return { etichetta: "Stampa tutta la conversazione", fn: conversazione };
    if (parts[0] === "cultura" && parts[1]) return { etichetta: "Stampa lezioni e domande dell'argomento", fn: function () {
      var p = (PD.packs && PD.packs.list || []).filter(function (e) { return e.pacchetto.id === parts[1]; })[0];
      return domande(parts[1], p ? p.pacchetto.titolo : "Cultura generale");
    } };
    if (parts[0] === "fenice") return { etichetta: "Stampa lezioni e domande su FeniceOS", fn: function () { return domande("feniceos", "🔥 FeniceOS, recupero ed economia circolare"); } };
    if (parts[0] === "libro") return { etichetta: "Stampa domande e risposte del libro", fn: function () { return domande("tecnologia-gentile", "📖 Tecnologia Gentile"); } };
    if (parts[0] === "attestato" && parts[1]) return { etichetta: "Stampa l'attestato", fn: function () {
      var a = (PD.progress.attestati || []).filter(function (x) { return x.codice === parts[1]; })[0];
      return a ? { svg: PD.attestatoSVG(a) } : null;
    } };
    return null;
  }

  PD.printTopic = function () {
    var arg = argomento(), doc = arg && arg.fn();
    if (!doc) { PD.toast("In questa pagina stampo quello che vedete."); window.print(); return; }
    if (doc.svg) { PD.printHTML(doc.svg, "orizzontale"); return; }
    PD.toast("🖨️ Preparo la stampa…", 2500);
    var a = area(); a.innerHTML = doc.html;
    var lavori = [];
    Array.prototype.forEach.call(a.querySelectorAll("[data-schema]"), function (box) {
      var code = doc.schemi[+box.getAttribute("data-schema")];
      if (code) lavori.push(PD.renderDiagram(box, code, ""));
    });
    Promise.all(lavori).catch(function () { /* senza schema si stampa il testo */ }).then(function () { PD.printHTML(a.innerHTML, "verticale"); });
  };

  /* pulsante 🖨️ nella barra in alto: piccolo menu con le due scelte */
  function menu(btn) {
    var m = document.getElementById("print-menu");
    if (m) { m.parentNode.removeChild(m); return; }
    var arg = argomento();
    m = document.createElement("div"); m.id = "print-menu"; m.className = "menu-pop"; m.setAttribute("role", "menu");
    m.innerHTML = '<button role="menuitem" data-p="vista">🖥️ Stampa questa pagina</button>' +
      (arg ? '<button role="menuitem" data-p="tutto">📄 ' + esc(arg.etichetta) + "</button>" : "") +
      '<p class="small muted">Nella finestra di stampa potete anche scegliere «Salva come PDF».</p>';
    document.body.appendChild(m);
    var r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 6) + "px"; m.style.right = Math.max(8, window.innerWidth - r.right) + "px";
    m.onclick = function (e) {
      var b = e.target.closest("[data-p]"); if (!b) return;
      m.parentNode.removeChild(m);
      if (b.getAttribute("data-p") === "vista") setTimeout(function () { window.print(); }, 50); else PD.printTopic();
    };
    setTimeout(function () {
      document.addEventListener("click", function chiudi(e) {
        if (!m.contains(e.target) && e.target !== btn) { if (m.parentNode) m.parentNode.removeChild(m); document.removeEventListener("click", chiudi); }
      });
    }, 0);
    var first = m.querySelector("button"); if (first) first.focus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var b = $("#btn-print"); if (b) b.onclick = function () { menu(b); };
  });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P") && e.shiftKey) { e.preventDefault(); PD.printTopic(); }
  });
})();
