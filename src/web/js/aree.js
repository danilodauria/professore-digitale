/* ==============================================================================
 *  PROFESSORE DIGITALE - Percorsi tematici
 *  Cultura generale (storia, geografia, scienze, arte, attualita'), FeniceOS e riuso,
 *  il libro "Tecnologia Gentile". Ogni percorso mostra lezioni, domande e risposte
 *  consultabili e il proprio Grande Quiz con attestato. I contenuti arrivano dai pacchetti.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var ICONE = { "cultura-storia": "🏛️", "cultura-geografia": "🌍", "cultura-scienze": "🔬", "cultura-arte": "🎨", "cultura-attualita": "📰" };
  var ORDINE = ["cultura-storia", "cultura-geografia", "cultura-scienze", "cultura-arte", "cultura-attualita"];

  function pacchetto(id) { return ((PD.packs && PD.packs.list) || []).filter(function (e) { return e.pacchetto.id === id; }).map(function (e) { return e.pacchetto; })[0]; }
  function domande(pack) { return (window.PD_KB || []).filter(function (k) { return k.pack === pack; }); }
  function proveDi(pack) { return (window.PD_PROVE || []).filter(function (p) { return p.pack === pack; }); }
  function norm(s) { s = String(s || "").toLowerCase(); return s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s; }
  function nomeBreve(t) { return String(t || "").replace(/^Cultura generale\s*·\s*/, ""); }

  /* blocco riutilizzabile: lezioni + quiz + domande e risposte di un pacchetto */
  function blocchi(packId, opz) {
    opz = opz || {};
    var lez = (window.PD_LESSONS || []).filter(function (L) { return L.pack === packId; });
    var kb = domande(packId), prove = proveDi(packId), r = PD.progress.quiz || {};
    var st = PD.lessonStats(lez);
    var h = "";
    if (lez.length) {
      h += '<h2 class="sez">' + (opz.titoloLezioni || "📚 Lezioni") + ' <span class="small muted">' + st.done + " di " + st.total + " completate</span></h2>" +
        '<div class="grid">' + lez.map(function (L) {
          var p = PD.progress.lessons[L.id] || {}, seen = (p.seen || []).length;
          var badge = p.done ? '<span class="badge done">✓ Completata' + (p.quiz ? " · quiz " + p.quiz.score + "/" + p.quiz.total : "") + "</span>"
            : seen ? '<span class="badge">In corso · ' + seen + "/" + L.steps.length + "</span>" : '<span class="badge">' + L.minutes + " min</span>";
          return '<button class="card tile" data-go="#/lessons/' + esc(L.id) + '"><span class="big-ico">' + L.icon + "</span><h3>" + esc(L.title) + "</h3><p>" + esc(L.goal) + "</p>" + badge + "</button>";
        }).join("") + "</div>";
    }
    if (prove.length) {
      h += prove.map(function (P) {
        var x = r[P.id];
        return '<div class="card quiz-banner"><span class="big-ico">' + esc(P.icona) + '</span><div><h3>' + esc(P.titolo) + "</h3><p class=\"small\">" + P.domande_per_prova +
          " domande a sorpresa tra " + P.domande.length + ". Superatelo per ottenere l'attestato." + (x ? " Miglior risultato: <b>" + x.perc + "%</b>" + (x.superata ? " ✓" : "") : "") +
          '</p></div><button class="btn big" data-go="#/quiz/' + esc(P.id) + '">' + (x && x.superata ? "↻ Rifai il quiz" : "🏆 Al quiz") + "</button></div>";
      }).join("");
    }
    if (kb.length) {
      h += '<h2 class="sez">' + (opz.titoloDomande || "❓ Domande e risposte") + ' <span class="small muted">' + kb.length + "</span></h2>" +
        '<input type="search" class="qa-cerca" placeholder="Cercate una parola, per esempio: ' + esc(opz.esempio || "Garibaldi") + '" aria-label="Cerca tra le domande">' +
        '<div class="qa-lista">' + kb.map(function (k, i) {
          return '<details class="qa" data-i="' + i + '"><summary>' + esc(k.q) + '</summary><div class="qa-corpo">' + PD.md(k.a) +
            (k.d ? '<div class="chalkboard qa-schema"></div>' : "") + '<div class="row small"><button class="btn ghost" data-leggi="' + i + '">🔊 Leggi</button>' +
            (k.l ? '<button class="btn ghost" data-go="#/lessons/' + esc(k.l) + '">📚 Apri la lezione</button>' : "") + "</div></div></details>";
        }).join("") + "</div>";
    }
    return { html: h, kb: kb };
  }
  function lega(el, kb) {
    var cerca = $(".qa-cerca", el);
    if (cerca) cerca.oninput = function () {
      var q = norm(this.value.trim());
      $$(".qa", el).forEach(function (d) {
        var k = kb[+d.getAttribute("data-i")], t = norm(k.q + " " + k.a + " " + k.k.join(" "));
        d.hidden = !!q && t.indexOf(q) < 0;
      });
    };
    $$(".qa", el).forEach(function (d) {
      d.addEventListener("toggle", function () {
        var k = kb[+d.getAttribute("data-i")], b = $(".qa-schema", d);
        if (d.open && b && !b.getAttribute("data-ok")) { b.setAttribute("data-ok", "1"); PD.renderDiagram(b, k.d, ""); }
      });
    });
    $$("[data-leggi]", el).forEach(function (b) {
      b.onclick = function () { var k = kb[+b.getAttribute("data-leggi")]; PD.speak(k.q + ". " + k.a, true); };
    });
  }
  PD.areaBlocchi = blocchi; PD.areaLega = lega;

  /* ------------------------------------------------------------------ CULTURA GENERALE */
  PD.views.cultura = function (el, args) {
    var ids = ((PD.packs && PD.packs.list) || []).map(function (e) { return e.pacchetto.id; }).filter(function (id) { return /^cultura-/.test(id); });
    ids.sort(function (a, b) { var x = ORDINE.indexOf(a), y = ORDINE.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    if (args[0] && ids.indexOf(args[0]) >= 0) {
      var P = pacchetto(args[0]), b = blocchi(args[0], { esempio: { "cultura-storia": "Garibaldi", "cultura-geografia": "Alpi", "cultura-scienze": "Sole", "cultura-arte": "Leonardo", "cultura-attualita": "Costituzione" }[args[0]] });
      el.innerHTML = '<div class="lesson-head"><span class="big-ico">' + (ICONE[args[0]] || "📘") + '</span><div><div class="small muted">Cultura generale</div><h1>' +
        esc(nomeBreve(P.titolo)) + '</h1></div><button class="btn ghost" data-go="#/cultura" style="margin-left:auto">← Cultura generale</button></div>' +
        '<p class="lead">' + esc(P.descrizione || "") + "</p>" + b.html;
      lega(el, b.kb);
      return;
    }
    el.innerHTML = '<div class="hero">' + PD.profHTML() + '<div><h1>🌍 Cultura generale</h1><p class="lead">Il computer è anche una finestra sul mondo. ' +
      "Qui trovate lezioni brevi di <b>storia, geografia, scienze, arte e attualità</b>, con schemi alla lavagna, centinaia di domande e risposte " +
      "e un Grande Quiz per ogni materia, con attestato finale.</p></div></div>" +
      (ids.length ? '<div class="grid">' + ids.map(function (id) {
        var P = pacchetto(id), lez = PD.lessonsOf("cultura", id), st = PD.lessonStats(lez), pr = proveDi(id)[0], x = pr && (PD.progress.quiz || {})[pr.id];
        return '<button class="card tile materia" data-go="#/cultura/' + esc(id) + '"><span class="big-ico">' + (ICONE[id] || "📘") + "</span><h3>" + esc(nomeBreve(P.titolo)) + "</h3><p>" +
          lez.length + " lezioni · " + domande(id).length + " domande e risposte" + (pr ? " · Grande Quiz" : "") + "</p>" +
          '<div class="progress"><span style="width:' + Math.round(100 * st.done / Math.max(1, st.total)) + '%"></span></div>' +
          (x && x.superata ? '<span class="badge done">🎓 Attestato ottenuto</span>' : "") + "</button>";
      }).join("") + "</div>" : '<p class="notice">I contenuti di cultura generale non sono installati.</p>');
  };

  /* ------------------------------------------------------------------ FENICEOS */
  PD.views.fenice = function (el) {
    var F = window.PD_FENICE;
    if (!F) { el.innerHTML = '<h1>🔥 FeniceOS</h1><p class="notice">Pagina non disponibile.</p>'; return; }
    var b = blocchi("feniceos", { titoloLezioni: "📚 Le lezioni sul riuso", esempio: "RAEE" });
    el.innerHTML =
      '<section class="fenice-hero"><div class="fenice-fiamma" aria-hidden="true"><span>🔥</span></div><div><div class="ka">Il sistema operativo della rinascita digitale</div>' +
      "<h1>" + esc(F.titolo) + '</h1><p class="motto">«' + esc(F.motto) + '»</p><p>' + esc(F.intro) + "</p>" +
      '<p class="small">Ideato e sviluppato da <b>Danilo D\'Auria</b> · Tecnico IT &amp; Divulgatore Digitale per il Sociale</p></div></section>' +
      '<div class="numeri">' + F.numeri.map(function (n) { return '<div class="card numero"><b>' + esc(n.v) + "</b><span>" + esc(n.t) + "</span></div>"; }).join("") + "</div>" +
      '<nav class="indice-fenice" aria-label="Argomenti">' + F.sezioni.map(function (s) { return '<a href="#/fenice" data-sez="' + esc(s.id) + '">' + s.icona + " " + esc(s.titolo) + "</a>"; }).join("") + "</nav>" +
      F.sezioni.map(function (s, i) {
        return '<section class="card sezione-fenice" id="fen-' + esc(s.id) + '"><h2>' + s.icona + " " + esc(s.titolo) + '</h2><div class="sf-corpo' + (s.schema ? " con-schema" : "") + '"><div>' + PD.md(s.testo) + "</div>" +
          (s.schema ? '<div class="chalkboard" data-fsch="' + i + '"></div>' : "") + "</div></section>";
      }).join("") +
      '<section class="card"><h2>💾 Provare FeniceOS dalla chiavetta</h2><ol class="passi-grandi">' + F.passi_chiavetta.map(function (p) { return "<li>" + PD.md(p).replace(/^<p>|<\/p>$/g, "") + "</li>"; }).join("") + "</ol>" +
      '<p class="notice small">⚠️ Creare la chiavetta cancella tutto ciò che contiene, e installare il sistema può cancellare il disco: fatevi sempre aiutare dal facilitatore e fate prima una copia dei vostri file.</p></section>' +
      '<section class="card"><h2>🖥️ Di cosa ha bisogno</h2><table class="tabella"><tbody>' + F.requisiti.map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</tbody></table></section>" +
      '<section class="card manifesto"><h2>📜 Il manifesto della tecnologia gentile</h2><ol>' + F.manifesto.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ol></section>" +
      b.html +
      '<h2 class="sez">💡 Domande frequenti su FeniceOS</h2>' + F.faq.map(function (f) { return '<details class="qa"><summary>' + esc(f.q) + '</summary><div class="qa-corpo">' + PD.md(f.a) + "</div></details>"; }).join("");
    $$("[data-fsch]", el).forEach(function (box) { var s = F.sezioni[+box.getAttribute("data-fsch")]; PD.renderDiagram(box, s.schema, ""); });
    $$("[data-sez]", el).forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); var t = document.getElementById("fen-" + a.getAttribute("data-sez")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); };
    });
    lega(el, b.kb);
  };

  /* ------------------------------------------------------------------ TECNOLOGIA GENTILE (il libro) */
  PD.views.libro = function (el) {
    var P = pacchetto("tecnologia-gentile"), b = P ? blocchi("tecnologia-gentile", { titoloLezioni: "📖 I capitoli", titoloDomande: "❓ Domande e risposte sul libro", esempio: "sostenibile" }) : null;
    el.innerHTML = '<section class="libro-hero"><div class="libro-copertina" aria-hidden="true"><div class="lc-autore">Danilo D\'Auria</div><div class="lc-titolo">Tecnologia<br>Gentile</div>' +
      '<div class="lc-sotto">Informatica Sostenibile</div><div class="lc-foglia">🌿</div></div><div><div class="ka">Il libro</div><h1>Tecnologia Gentile</h1>' +
      '<p class="motto">Informatica Sostenibile</p><p>Il libro di <b>Danilo D\'Auria</b>, ideatore del Professore Digitale e di FeniceOS, pubblicato su Amazon. ' +
      "Racconta un'informatica a misura di persona: inclusiva, rispettosa dell'ambiente e di chi sta imparando.</p>" +
      (P ? '<p class="small muted">' + esc(P.descrizione || "") + "</p>" : "") + "</div></section>" +
      (b ? b.html : '<div class="card"><h2 style="margin-top:0">📚 Domande e risposte in arrivo</h2><p>Le domande e risposte sul libro, i capitoli riassunti e il quiz con attestato ' +
        "si aggiungono con il pacchetto di contenuti <b>«tecnologia-gentile»</b> (Impostazioni → Contenuti aggiuntivi, oppure Controlla aggiornamenti).</p></div>");
    if (b) lega(el, b.kb);
  };
})();
