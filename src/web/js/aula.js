/* ==============================================================================
 *  PROFESSORE DIGITALE - Quadro dell'aula (rete locale)
 *  Il PC del facilitatore vede i PC degli allievi collegati alla stessa rete: chi c'e', cosa sta
 *  facendo, a che punto e' con le lezioni, quiz e attestati, che computer usa. Puo' mandare un
 *  messaggio a tutti. Si attiva solo se lo sceglie l'utente; i dati restano nella rete locale.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var timer = 0, ultimoStato = null;
  var NOMI_VISTA = { lettera: "Spiegami una lettera", mente: "Ginnastica per la mente", editor: "Crea lezioni e quiz", vita: "Vita digitale", truffa: "È una truffa?", ripasso: "Ripasso", competenze: "Competenze", enti: "Registro e incontri", profili: "Chi usa il computer", home: "Inizio", lessons: "Lezioni", ask: "Chiedi al Professore", board: "Lavagna", practice: "Palestra", quiz: "Quiz",
    attestato: "Attestato", cultura: "Cultura generale", fenice: "FeniceOS", libro: "Tecnologia Gentile", aula: "Aula", settings: "Impostazioni", sostieni: "Sostieni il progetto", setup: "Configura IA e voce" };

  function fa(s) {
    if (s == null) return "mai";
    if (s < 15) return "adesso";
    if (s < 60) return s + " secondi fa";
    if (s < 3600) return Math.round(s / 60) + " min fa";
    if (s < 86400) return Math.round(s / 3600) + " ore fa";
    return Math.round(s / 86400) + " giorni fa";
  }

  /* ------------------------------------------------------------------ cosa invia il PC dell'allievo */
  function attivitaCorrente() {
    var parts = (location.hash.replace(/^#\/?/, "") || "home").split("/"), v = parts[0], t = NOMI_VISTA[v] || v;
    if (v === "lessons" && parts[1]) {
      var L = (window.PD_LESSONS || []).filter(function (x) { return x.id === parts[1]; })[0];
      if (L) t = "Lezione: " + L.title + (parts[2] === "quiz" ? " (quiz)" : parts[2] ? " (passo " + (+parts[2] + 1) + ")" : "");
    } else if (v === "quiz" && parts[1]) {
      var P = (window.PD_PROVE || []).filter(function (x) { return x.id === parts[1]; })[0]; if (P) t = P.titolo;
    } else if (v === "practice" && parts[1]) t = "Palestra: " + parts[1];
    return { vista: v, titolo: t, inattivo_s: PD.idleState ? PD.idleState().inattivo_s : 0 };
  }
  function riepilogo() {
    var st = PD.lessonStats(), prat = PD.progress.practice || {};
    return {
      lezioni_fatte: st.done, lezioni_totali: st.total, quiz: PD.quizSummary ? PD.quizSummary() : [],
      attestati: (PD.progress.attestati || []).map(function (a) { return { titolo: a.titolo, data: (a.data || "").slice(0, 10), punteggio: a.perc }; }),
      palestra: Object.keys(prat).length
    };
  }
  PD.aulaPresenza = function () {
    if (!PD.server || PD.settings.aulaRuolo !== "allievo") return Promise.resolve(null);
    var S = PD.status || { tts: { engines: [] }, stt: {} };
    var corpo = {
      utente: PD.settings.studentName || "",
      componenti: { ia: PD.aiReady() ? PD.currentModel() : "guida interna", voce: (S.tts.engines || [])[0] || "browser", microfono: S.stt.engine || "" },
      attivita: attivitaCorrente(), progressi: riepilogo()
    };
    return PD.api("/api/aula/presenza", corpo).then(function (r) {
      var a = r.annuncio;
      if (a && a.id && a.testo && a.id !== PD.progress.ultimoAnnuncio) {
        PD.progress.ultimoAnnuncio = a.id; PD.saveProgress();
        PD.bubble("📣 **Messaggio dal facilitatore:** " + a.testo, [{ t: "Ho capito", fn: function () {} }], 0);
        PD.speak("Messaggio dal facilitatore. " + a.testo, true);
      }
      return r;
    }).catch(function () { return null; });
  };
  var prevHash = "";
  window.addEventListener("hashchange", function () {
    // quando l'allievo cambia pagina il facilitatore lo vede subito (al massimo una volta ogni 4 secondi)
    if (PD.settings.aulaRuolo !== "allievo" || location.hash === prevHash) return;
    prevHash = location.hash; clearTimeout(PD._aulaT); PD._aulaT = setTimeout(PD.aulaPresenza, 4000);
  });

  /* ------------------------------------------------------------------ vista */
  PD.views.aula = function (el) {
    clearInterval(timer);
    if (!PD.server) {
      el.innerHTML = '<h1>🏫 Aula</h1><p class="notice info">Il quadro dell\'aula funziona con il programma installato (.exe per Windows, .deb per Linux), non con la versione portatile.</p>';
      return;
    }
    el.innerHTML = '<h1>🏫 Aula</h1><p class="lead">Collegate i computer dell\'aula alla stessa rete (Wi-Fi o cavo): il PC del facilitatore vede in tempo reale ' +
      "chi è collegato, cosa sta facendo e a che punto è. Niente Internet: i dati restano nella rete dell'aula.</p><div id=\"aula-corpo\"><p class=\"muted\">Carico…</p></div>";
    carica(el, true);
    timer = setInterval(function () {
      if (!document.getElementById("aula-corpo") || $("#view-aula").hidden) { clearInterval(timer); return; }
      if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) carica(el, false);
    }, 5000);
  };

  function carica(el, tutto) {
    PD.api("/api/aula").then(function (st) { ultimoStato = st; disegna(el, st, tutto); }).catch(function (e) {
      var c = $("#aula-corpo", el); if (c) c.innerHTML = '<p class="notice">Stato dell\'aula non disponibile: ' + esc(e.message) + "</p>";
    });
  }

  function disegna(el, st, tutto) {
    var c = $("#aula-corpo", el); if (!c) return;
    var s = PD.settings, ruolo = st.ruolo || "";
    if (tutto || !$("#aula-ruoli", c)) {
      c.innerHTML = '<div class="card" id="aula-ruoli"><h2 style="margin-top:0">Questo computer è…</h2><div class="ruoli">' +
        ruoloCard("facilitatore", "🧑‍🏫", "Il PC del facilitatore", "Riceve i progressi degli allievi e mostra il quadro dell'aula.", ruolo) +
        ruoloCard("allievo", "🧑‍🎓", "Il PC di un allievo", "Si collega da solo al PC del facilitatore e gli invia nome, attività e progressi.", ruolo) +
        ruoloCard("", "💻", "Un PC senza aula", "Nessun collegamento: tutto resta su questo computer.", ruolo) + "</div>" +
        '<div id="aula-campi"></div></div><div id="aula-vivo"></div>' +
        '<div class="card"><h2 style="margin-top:0">🔍 La rete dell\'aula</h2><p class="small muted">Cerca i PC dei facilitatori e il server degli aggiornamenti nella rete locale.</p>' +
        '<button class="btn ghost" id="aula-cerca">🔍 Cerca nella rete</button><div id="aula-rete" style="margin-top:.6rem"></div></div>';
      campi(c, ruolo);
      $$("[data-ruolo]", c).forEach(function (r) {
        r.onchange = function () { campi(c, this.value); };
      });
      $("#aula-cerca", c).onclick = function () { cerca(c); };
    }
    vivo($("#aula-vivo", c), st);
    void s;
  }
  function ruoloCard(v, ico, t, d, cur) {
    return '<label class="model ruolo"><input type="radio" name="aula-ruolo" data-ruolo value="' + v + '"' + (v === cur ? " checked" : "") + '><span class="big-ico">' + ico +
      "</span><span><b>" + t + '</b><br><span class="small muted">' + d + "</span></span></label>";
  }
  function campi(c, ruolo) {
    var s = PD.settings, box = $("#aula-campi", c);
    function f(id, lab, val, extra) { return '<div class="field"><label for="' + id + '">' + lab + '</label><input type="text" id="' + id + '" value="' + esc(val || "") + '" ' + (extra || "") + "></div>"; }
    var h = "";
    if (ruolo === "facilitatore") {
      h = f("a-nome", "Nome dell'aula", s.aulaNome || "Aula", 'maxlength="60"') +
        '<div class="field"><label for="a-codice">Codice dell\'aula (da dire agli allievi)</label><div class="row"><input type="text" id="a-codice" maxlength="8" inputmode="numeric" value="' +
        esc(s.aulaCodice || "") + '" style="max-width:10rem;font-size:1.4rem;letter-spacing:.2em"><button class="btn ghost" type="button" id="a-nuovo">🎲 Nuovo codice</button></div>' +
        '<span class="small muted">Solo chi conosce il codice può collegarsi. Lasciate vuoto per accettare tutti i PC della rete.</span></div>';
    } else if (ruolo === "allievo") {
      h = f("a-allievo", "Il vostro nome (lo vedrà il facilitatore)", s.studentName, 'maxlength="60" placeholder="es. Maria Rossi"') +
        f("a-codice", "Codice dell'aula (ve lo dice il facilitatore)", s.aulaCodice, 'maxlength="8" inputmode="numeric"') +
        f("a-server", "Indirizzo del PC del facilitatore (facoltativo: di solito si trova da solo)", s.aulaServer, 'maxlength="100" placeholder="es. 192.168.1.10"') +
        '<p class="notice info small">🔒 Verranno inviati al PC del facilitatore, solo nella rete locale: il vostro nome, la pagina che state usando, le lezioni completate, ' +
        "i risultati dei quiz e gli attestati, il nome e la memoria di questo computer. <b>Mai</b> le conversazioni con il Professore.</p>";
    } else h = '<p class="small muted">Il Professore non comunica con altri computer.</p>';
    box.innerHTML = h + '<button class="btn" id="a-salva">💾 Salva e applica</button>';
    var nuovo = $("#a-nuovo", box);
    if (nuovo) nuovo.onclick = function () { $("#a-codice", box).value = String(1000 + Math.floor(Math.random() * 9000)); };
    $("#a-salva", box).onclick = function () {
      var r = ($("[data-ruolo]:checked", c) || {}).value || "";
      s.aulaRuolo = r;
      if ($("#a-nome", box)) s.aulaNome = $("#a-nome", box).value.trim() || "Aula";
      if ($("#a-codice", box)) s.aulaCodice = $("#a-codice", box).value.replace(/\D/g, "").slice(0, 8);
      if ($("#a-allievo", box)) s.studentName = $("#a-allievo", box).value.trim();
      if ($("#a-server", box)) s.aulaServer = $("#a-server", box).value.trim();
      PD.saveSettings();
      // salvataggio immediato (non ritardato) perche' il server legga subito il nuovo ruolo
      PD.api("/api/data/settings", { value: s }).then(function () { return PD.api("/api/aula/applica", {}); }).then(function (st) {
        PD.toast(r === "facilitatore" ? "🧑‍🏫 Questo è ora il PC del facilitatore." : r === "allievo" ? "🧑‍🎓 Collegamento all'aula attivato." : "Aula disattivata.");
        ultimoStato = st;
        if (r === "allievo") PD.aulaPresenza().then(function () { carica(document.getElementById("view-aula"), true); });
        else disegna(document.getElementById("view-aula"), st, true);
      }).catch(function (e) { PD.toast("Non riuscito: " + e.message); });
    };
  }

  function vivo(box, st) {
    if (!box) return;
    if (st.ruolo === "facilitatore") {
      var cl = st.clienti || [], on = cl.filter(function (x) { return x.online; });
      var lez = cl.reduce(function (a, x) { return a + x.progressi.lezioni_fatte; }, 0), att = cl.reduce(function (a, x) { return a + x.progressi.attestati.length; }, 0);
      box.innerHTML = '<div class="numeri">' + numero(on.length, "allievi collegati ora") + numero(cl.length, "PC visti in aula") + numero(lez, "lezioni completate") +
        numero(att, "attestati ottenuti") + "</div>" +
        '<div class="card"><h2 style="margin-top:0">🖥️ Questo PC: «' + esc(st.nome) + '»</h2><dl class="kv"><dt>Nome del computer</dt><dd>' + esc(st.pc) + "</dd>" +
        "<dt>Indirizzi in rete</dt><dd>" + (st.ips.length ? esc(st.ips.join(", ")) : "nessuna rete") + "</dd><dt>Codice dell'aula</dt><dd>" + (st.codice ? "<b>" + esc(st.codice) + "</b>" : "nessuno (accetta tutti)") + "</dd>" +
        "<dt>In ascolto per gli allievi</dt><dd>" + (st.in_ascolto ? "✅ porta " + st.porta : "❌ porta " + st.porta + " occupata o bloccata dal firewall") + "</dd>" +
        "<dt>Ricerca automatica</dt><dd>" + (st.scoperta ? "✅ attiva" : "⚠️ non attiva: sui PC degli allievi scrivete l'indirizzo " + esc(st.ips[0] || "") + " a mano") + "</dd></dl></div>" +
        '<div class="card"><h2 style="margin-top:0">📣 Messaggio a tutti gli allievi</h2><div class="row"><input type="text" id="ann-testo" maxlength="300" style="flex:1;min-width:14rem;padding:.6rem;border-radius:10px;border:2px solid var(--line)" placeholder="es. Tra cinque minuti facciamo una pausa">' +
        '<button class="btn" id="ann-invia">📣 Invia</button></div>' + (st.annuncio && st.annuncio.testo ? '<p class="small muted">Ultimo messaggio: «' + esc(st.annuncio.testo) + "»</p>" : "") + "</div>" +
        '<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🧑‍🎓 Gli allievi</h2><div class="row">' +
        '<button class="btn ghost" id="aula-csv">⬇️ Esporta elenco</button><button class="btn ghost" id="aula-pulisci">🧹 Togli i PC non collegati</button></div></div>' +
        (cl.length ? '<div class="tab-aula"><table><thead><tr><th></th><th>Allievo</th><th>Cosa sta facendo</th><th>Lezioni</th><th>Quiz e attestati</th><th>Computer</th><th>Ultimo contatto</th><th></th></tr></thead><tbody>' +
          cl.map(riga).join("") + "</tbody></table></div>" : '<p class="muted">Nessun allievo ancora. Sui PC degli allievi: Aula → «Il PC di un allievo» → codice ' + esc(st.codice || "") + " → Salva.</p>") + "</div>";
      var inv = $("#ann-invia", box);
      if (inv) inv.onclick = function () {
        var t = $("#ann-testo", box).value.trim(); if (!t) return;
        PD.api("/api/aula/annuncio", { testo: t }).then(function () { PD.toast("📣 Messaggio inviato: gli allievi lo vedranno entro pochi secondi."); $("#ann-testo", box).value = ""; });
      };
      $("#aula-pulisci", box).onclick = function () {
        Promise.all(cl.filter(function (x) { return !x.online; }).map(function (x) { return PD.api("/api/aula/rimuovi", { id: x.id }); }))
          .then(function () { carica(document.getElementById("view-aula"), false); });
      };
      $("#aula-csv", box).onclick = function () { csv(cl); };
      $$("[data-togli]", box).forEach(function (b) {
        b.onclick = function () { PD.api("/api/aula/rimuovi", { id: b.getAttribute("data-togli") }).then(function () { carica(document.getElementById("view-aula"), false); }); };
      });
    } else if (st.ruolo === "allievo") {
      var inv2 = st.invio || {}, srv = st.server;
      box.innerHTML = '<div class="card"><h2 style="margin-top:0">🧑‍🎓 Collegamento all\'aula</h2>' +
        (inv2.ok ? '<p class="notice ok">✅ Collegato al PC del facilitatore' + (srv && srv.nome ? " «" + esc(srv.nome) + "»" : "") + (srv && srv.ip ? " (" + esc(srv.ip) + ")" : "") +
          ". Ultimo invio: " + fa(inv2.fa_s) + ".</p>" : '<p class="notice">⏳ ' + esc(inv2.errore || "Ricerca del PC del facilitatore in corso…") + "</p>") +
        "<dl class=\"kv\"><dt>Il vostro nome</dt><dd>" + esc(st.allievo || PD.settings.studentName || "(non indicato)") + "</dd><dt>Questo computer</dt><dd>" + esc(st.pc) +
        " · " + esc(st.ips.join(", ") || "nessuna rete") + "</dd></dl>" +
        (st.annuncio && st.annuncio.testo ? '<p class="notice info">📣 Ultimo messaggio del facilitatore: «' + esc(st.annuncio.testo) + "»</p>" : "") +
        '<button class="btn ghost" id="aula-ora">🔄 Invia adesso</button></div>';
      $("#aula-ora", box).onclick = function () { PD.aulaPresenza().then(function () { carica(document.getElementById("view-aula"), false); }); };
    } else box.innerHTML = "";
  }
  function numero(v, t) { return '<div class="card numero"><b>' + v + "</b><span>" + esc(t) + "</span></div>"; }
  function riga(x) {
    var p = x.progressi, perc = p.lezioni_totali ? Math.round(100 * p.lezioni_fatte / p.lezioni_totali) : 0;
    var verDiversa = x.versione && x.versione !== (ultimoStato && ultimoStato.versione);
    return '<tr class="' + (x.online ? "on" : "off") + '"><td><span class="stato-dot ' + (x.online ? "on" : "") + '" title="' + (x.online ? "collegato" : "non collegato") + '"></span></td>' +
      "<td><b>" + esc(x.utente || "(senza nome)") + "</b>" + (x.attivita.inattivo_s > 300 && x.online ? '<br><span class="small muted">😴 inattivo da ' + Math.round(x.attivita.inattivo_s / 60) + " min</span>" : "") + "</td>" +
      "<td>" + esc(x.attivita.titolo || "—") + "</td>" +
      '<td style="min-width:7rem">' + p.lezioni_fatte + " / " + p.lezioni_totali + '<div class="progress"><span style="width:' + perc + '%"></span></div></td>' +
      "<td>" + (p.quiz.length ? p.quiz.map(function (q) { return (q.superata ? "🎓 " : "📝 ") + esc(q.titolo.replace(/^Il Grande Quiz (dell'|di |del )?/i, "")) + " " + q.migliore + "%"; }).join("<br>") : "—") + "</td>" +
      '<td class="small">' + esc(x.pc) + "<br>" + esc(x.sistema.os) + (x.sistema.ram_mb ? " · " + (Math.round(x.sistema.ram_mb / 102.4) / 10) + " GB" : "") +
      "<br>" + (x.componenti.ia && x.componenti.ia !== "guida interna" ? "🤖 " + esc(x.componenti.ia) + " " : "") + (x.componenti.microfono ? "🎤 " : "") +
      (verDiversa ? '<br><span class="badge warn">versione ' + esc(x.versione) + "</span>" : "") + "</td>" +
      '<td class="small">' + fa(x.fa_s) + "<br>" + esc(x.ip) + "</td>" +
      '<td><button class="btn ghost" data-togli="' + esc(x.id) + '" title="Togli dall\'elenco">✕</button></td></tr>';
  }
  function csv(cl) {
    var righe = [["Allievo", "Computer", "Sistema", "Indirizzo", "Collegato", "Attività", "Lezioni completate", "Lezioni totali", "Quiz", "Attestati", "Ultimo contatto"]];
    cl.forEach(function (x) {
      righe.push([x.utente, x.pc, x.sistema.os, x.ip, x.online ? "sì" : "no", x.attivita.titolo, x.progressi.lezioni_fatte, x.progressi.lezioni_totali,
        x.progressi.quiz.map(function (q) { return q.titolo + " " + q.migliore + "%"; }).join("; "), x.progressi.attestati.map(function (a) { return a.titolo; }).join("; "), fa(x.fa_s)]);
    });
    var testo = "﻿" + righe.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(";"); }).join("\r\n");
    PD.download(new Blob([testo], { type: "text/csv;charset=utf-8" }), "aula-" + new Date().toISOString().slice(0, 10) + ".csv");
  }
  function cerca(c) {
    var out = $("#aula-rete", c); out.innerHTML = '<p class="muted">🔍 Cerco nella rete…</p>';
    Promise.all([PD.api("/api/aula/cerca", {}), PD.checkNet(true)]).then(function (r) {
      var x = r[0], net = r[1];
      out.innerHTML = '<dl class="kv"><dt>Questo computer</dt><dd>' + esc(x.pc) + " · " + esc(x.ips.join(", ") || "nessuna rete locale") + "</dd>" +
        "<dt>Internet</dt><dd>" + (net ? "🌐 collegato" : net === false ? "📴 non collegato" : "non controllato") + "</dd>" +
        "<dt>PC dei facilitatori</dt><dd>" + (x.trovati.length ? x.trovati.map(function (t) {
          return "🧑‍🏫 <b>" + esc(t.nome) + "</b> (" + esc(t.pc) + ", " + esc(t.ip) + ", versione " + esc(t.versione) + ")" + (t.codice_richiesto ? " · serve il codice" : "");
        }).join("<br>") : "nessuno trovato") + "</dd>" +
        "<dt>Server degli aggiornamenti</dt><dd>" + (x.aggiornamenti ? (x.aggiornamenti.raggiungibile ? "✅ " : "❌ ") + esc(x.aggiornamenti.url) : "non configurato nella rete locale") + "</dd></dl>";
    }).catch(function (e) { out.innerHTML = '<p class="notice">Ricerca non riuscita: ' + esc(e.message) + "</p>"; });
  }
})();
