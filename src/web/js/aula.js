/* ==============================================================================
 *  PROFESSORE DIGITALE - Quadro dell'aula (rete locale)
 *  Il PC del facilitatore vede i PC degli allievi collegati alla stessa rete: chi c'e', cosa sta
 *  facendo, a che punto e' con le lezioni, quiz e attestati, che computer usa. Puo' mandare un
 *  messaggio a tutti. Si attiva solo se lo sceglie l'utente; i dati restano nella rete locale.
 *  Dalla 3.3 «✋ Mano alzata»: l'allievo chiede aiuto con un pulsante, il facilitatore vede un avviso
 *  (con un suono gentile, disattivabile) ovunque nell'app e risponde «Arrivo!» o «Risolto».
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
  function annuncio(a) {
    if (a && a.id && a.testo && a.id !== PD.progress.ultimoAnnuncio) {
      PD.progress.ultimoAnnuncio = a.id; PD.saveProgress();
      PD.bubble("📣 **Messaggio dal facilitatore:** " + a.testo, [{ t: "Ho capito", fn: function () {} }], 0);
      PD.speak("Messaggio dal facilitatore. " + a.testo, true);
    }
  }

  /* ------------------------------------------------------------------ tablet ospite (3.4)
   *  Un tablet collegato al PC dell'aula (PD.ospite) non ha un server suo: invia la presenza al PC con
   *  POST /api/ospite/presenza {nome, attivita, progressi, mano}; il PC la mette nel quadro dell'aula
   *  (se è il facilitatore) con le stesse regole di /aula/ciao e risponde {ok, aula, nome, annuncio, mano?}.
   *  La mano alzata del tablet vive qui, nel browser: da = istante della richiesta (identificativo). */
  var ospite = { aula: null, ok: true, nome: "", mano: { alzata: false, da: 0, messaggio: "", risposta: "" } };
  function statoOspite() {
    var m = ospite.mano;
    return { ruolo: ospite.aula ? "allievo" : "", invio: { ok: ospite.ok, fa_s: 0 },
      mano: { alzata: m.alzata, da: m.da, messaggio: m.messaggio, risposta: m.risposta } };
  }
  function presenzaOspite() {
    var m = ospite.mano;
    if (m.alzata && Date.now() / 1000 - m.da > 30 * 60) { m.alzata = false; m.messaggio = ""; m.risposta = ""; }   // dopo 30 minuti si abbassa
    var corpo = { nome: PD.settings.studentName || "", attivita: attivitaCorrente(), progressi: riepilogo(),
      mano: { alzata: m.alzata, da: m.da, messaggio: m.alzata ? m.messaggio : "" } };
    return PD.api("/api/ospite/presenza", corpo).then(function (r) {
      var prima = ospite.aula;
      ospite.ok = true; ospite.aula = !!r.aula; ospite.nome = r.nome || "";
      if (r.mano && r.mano.da === m.da) {
        if (r.mano.stato === "risolto") { m.alzata = false; m.messaggio = ""; m.risposta = "risolto"; }
        else if (r.mano.stato === "arrivo" && m.alzata) m.risposta = "arrivo";
      }
      annuncio(r.annuncio);
      if (prima !== ospite.aula) mani.ruolo(statoOspite());
      return r;
    }).catch(function () { ospite.ok = false; return null; });
  }
  PD.aulaOspite = function () { return statoOspite(); };

  PD.aulaPresenza = function () {
    if (PD.ospite) return presenzaOspite();
    if (!PD.server || PD.settings.aulaRuolo !== "allievo") return Promise.resolve(null);
    var S = PD.status || { tts: { engines: [] }, stt: {} };
    var corpo = {
      utente: PD.settings.studentName || "",
      componenti: { ia: PD.aiReady() ? PD.currentModel() : "guida interna", voce: (S.tts.engines || [])[0] || "browser", microfono: S.stt.engine || "" },
      attivita: attivitaCorrente(), progressi: riepilogo()
    };
    return PD.api("/api/aula/presenza", corpo).then(function (r) {
      annuncio(r.annuncio);
      return r;
    }).catch(function () { return null; });
  };
  var prevHash = "";
  window.addEventListener("hashchange", function () {
    // quando l'allievo cambia pagina il facilitatore lo vede subito (al massimo una volta ogni 4 secondi)
    if ((PD.settings.aulaRuolo !== "allievo" && !PD.ospite) || location.hash === prevHash) return;
    prevHash = location.hash; clearTimeout(PD._aulaT); PD._aulaT = setTimeout(PD.aulaPresenza, 4000);
  });

  /* ------------------------------------------------------------------ vista */
  PD.views.aula = function (el) {
    clearInterval(timer);
    if (PD.ospite) return vistaOspite(el);
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

  /* pagina Aula sul tablet ospite: nome, stato del collegamento, cosa viene inviato */
  function vistaOspite(el) {
    el.innerHTML = '<h1>🏫 Aula</h1><div class="card"><h2 style="margin-top:0">📱 Questo tablet è collegato al PC dell\'aula</h2>' +
      '<p>Usate la voce, l\'intelligenza artificiale e i contenuti del PC del facilitatore. <b>I vostri progressi restano su questo tablet.</b></p>' +
      '<div class="field"><label for="ao-nome">Il vostro nome (lo vedrà il facilitatore)</label><div class="row">' +
      '<input type="text" id="ao-nome" maxlength="60" placeholder="es. Maria Rossi" value="' + esc(PD.settings.studentName || "") + '" style="flex:1;min-width:12rem">' +
      '<button class="btn" id="ao-salva" type="button">💾 Salva</button></div></div><div id="ao-stato" aria-live="polite"></div>' +
      '<p class="notice info small">🔒 Al PC del facilitatore arrivano solo, nella rete dell\'aula: il vostro nome, la pagina che state usando, le lezioni completate, ' +
      "i risultati dei quiz, gli attestati e la mano alzata. <b>Mai</b> le conversazioni con il Professore.</p></div>";
    function stato() {
      var b = $("#ao-stato", el); if (!b) return;
      b.innerHTML = ospite.aula ? '<p class="notice ok">✅ Siete nel quadro dell\'aula' + (ospite.nome ? " «" + esc(ospite.nome) + "»" : "") +
          '. Se vi serve aiuto premete «✋ Ho bisogno di aiuto».</p>'
        : ospite.ok ? '<p class="notice">Il PC del facilitatore non ha acceso il quadro dell\'aula: il pulsante «✋ Ho bisogno di aiuto» comparirà quando lo farà.</p>'
          : '<p class="notice">⚠️ Il PC dell\'aula non risponde. Controllate di essere collegati alla stessa rete Wi-Fi.</p>';
    }
    $("#ao-salva", el).onclick = function () {
      PD.settings.studentName = $("#ao-nome", el).value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim().slice(0, 60); PD.saveSettings();
      presenzaOspite().then(function () { stato(); PD.toast("👍 Nome salvato: il facilitatore lo vede nel quadro dell'aula."); });
    };
    presenzaOspite().then(stato); stato();
  }

  function carica(el, tutto) {
    PD.api("/api/aula").then(function (st) { ultimoStato = st; disegna(el, st, tutto); mani.aggiorna(st); }).catch(function (e) {
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
        '<div id="aula-campi"></div></div><div id="aula-vivo"></div>' + (PD.tablet ? PD.tablet.cartaHTML() : "") +
        '<div class="card"><h2 style="margin-top:0">🔍 La rete dell\'aula</h2><p class="small muted">Cerca i PC dei facilitatori e il server degli aggiornamenti nella rete locale.</p>' +
        '<button class="btn ghost" id="aula-cerca">🔍 Cerca nella rete</button><div id="aula-rete" style="margin-top:.6rem"></div></div>';
      campi(c, ruolo);
      $$("[data-ruolo]", c).forEach(function (r) {
        r.onchange = function () { campi(c, this.value); };
      });
      $("#aula-cerca", c).onclick = function () { cerca(c); };
      if (PD.tablet) PD.tablet.cartaBind(c);
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
        ultimoStato = st; mani.ruolo(st);
        if (r === "allievo") PD.aulaPresenza().then(function () { carica(document.getElementById("view-aula"), true); });
        else disegna(document.getElementById("view-aula"), st, true);
      }).catch(function (e) { PD.toast("Non riuscito: " + e.message); });
    };
  }

  function vivo(box, st) {
    if (!box) return;
    if (st.ruolo === "facilitatore") {
      var cl = ordinaMani(st.clienti || []), on = cl.filter(function (x) { return x.online; });
      var alzate = cl.filter(manoAlzata).length;
      var lez = cl.reduce(function (a, x) { return a + x.progressi.lezioni_fatte; }, 0), att = cl.reduce(function (a, x) { return a + x.progressi.attestati.length; }, 0);
      box.innerHTML = '<div class="numeri">' + numero(on.length, "allievi collegati ora") + numero(cl.length, "PC visti in aula") + numero(lez, "lezioni completate") +
        numero(att, "attestati ottenuti") + (alzate ? '<div class="card numero pd-mano-numero"><b>✋ ' + alzate + "</b><span>" + (alzate === 1 ? "chiede aiuto" : "chiedono aiuto") + "</span></div>" : "") + "</div>" +
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
      mani.collega(box);
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
    var m = manoAlzata(x) ? x.mano : null;
    return '<tr class="' + (x.online ? "on" : "off") + (m ? " pd-mano-riga" : "") + '"><td><span class="stato-dot ' + (x.online ? "on" : "") + '" title="' + (x.online ? "collegato" : "non collegato") + '"></span></td>' +
      "<td><b>" + esc(x.utente || "(senza nome)") + "</b>" + (x.attivita.inattivo_s > 300 && x.online ? '<br><span class="small muted">😴 inattivo da ' + Math.round(x.attivita.inattivo_s / 60) + " min</span>" : "") +
        (m ? '<div class="pd-mano-cella"><b>✋ Chiede aiuto ' + attesa(m.attesa_s) + "</b>" + (m.messaggio ? "<br>«" + esc(m.messaggio) + "»" : "") +
          '<div class="row">' + pulsantiRisposta(x) + "</div></div>" : "") + "</td>" +
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
  /* ==================================================================================
   *  ✋ MANO ALZATA (3.3)
   *  Allievo: pulsante fisso «✋ Ho bisogno di aiuto» → POST /api/aula/mano {alzata, messaggio}
   *           (il server invia subito la presenza al facilitatore) e si controlla la risposta in /api/aula.
   *  Facilitatore: ogni 5 s /api/aula (anche fuori dalla pagina Aula) → riquadro in alto con suono gentile;
   *           «Arrivo!» / «Risolto» → POST /api/aula/rispondi {id, stato}.
   * ================================================================================== */
  var MANO_MAX = 120;
  function manoAlzata(x) { return !!(x && x.mano && x.mano.alzata); }
  function ordinaMani(cl) {
    // prima chi ha la mano alzata, a partire da chi aspetta da più tempo; poi gli altri nell'ordine di prima
    return cl.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      var ma = manoAlzata(a.x), mb = manoAlzata(b.x);
      if (ma !== mb) return ma ? -1 : 1;
      if (ma) return (b.x.mano.attesa_s || 0) - (a.x.mano.attesa_s || 0) || a.i - b.i;
      return a.i - b.i;
    }).map(function (o) { return o.x; });
  }
  function attesa(s) {
    s = s || 0;
    if (s < 60) return "da meno di un minuto";
    return "da " + Math.floor(s / 60) + " min";
  }
  function pulsantiRisposta(x) {
    var arrivo = x.mano && x.mano.stato === "arrivo";
    return '<button class="btn pd-mano-arrivo" type="button" data-mano-rispondi="arrivo" data-mano-id="' + esc(x.id) + '"' + (arrivo ? " disabled" : "") + ">" +
      (arrivo ? "🏃 State arrivando" : "🏃 Arrivo!") + "</button>" +
      '<button class="btn ghost pd-mano-risolto" type="button" data-mano-rispondi="risolto" data-mano-id="' + esc(x.id) + '">✅ Risolto</button>';
  }
  function pulisci(t) { return String(t || "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/^\s+|\s+$/g, "").slice(0, MANO_MAX); }

  var mani = (function () {
    var ruoloOra = "", giro = 0, visti = {}, firma = "", actx = null, suonati = 0, titolo0 = document.title, ultimo = null;
    var elAllievo = null, statoMano = { alzata: false, risposta: "" }, invioOk = true, inCorso = false, firmaAllievo = "";

    /* ---------- suono gentile (WebAudio, nessun file) ---------- */
    function suono() {
      if (PD.settings.aulaManoSuono === false) return false;
      try {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
        actx = actx || new AC();
        if (actx.state === "suspended" && actx.resume) actx.resume();
        var t0 = actx.currentTime, note = [659.25, 880], i;
        for (i = 0; i < note.length; i++) {
          var o = actx.createOscillator(), g = actx.createGain(), t = t0 + i * 0.2;
          o.type = "sine"; o.frequency.value = note[i];
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
          o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.5);
        }
        suonati++;
        return true;
      } catch (e) { return false; }
    }

    /* ---------- posizione dei riquadri fissi (non coprono la barra né altri pulsanti) ---------- */
    function posiziona() {
      if (!elAllievo) return;
      var sb = $(".sidebar"), stretto = window.innerWidth <= 900, basso = 16, sinistra = 16;
      if (sb && sb.offsetWidth) {
        if (stretto) basso += sb.offsetHeight; else sinistra = Math.max(16, Math.round(sb.getBoundingClientRect().right) + 16);
      }
      if (stretto) sinistra = 10;
      var guida = document.getElementById("enti-guida-bar");
      if (guida && guida.offsetHeight && !stretto) basso += guida.offsetHeight + 10;
      elAllievo.style.bottom = basso + "px"; elAllievo.style.left = sinistra + "px";
      elAllievo.style.maxWidth = "calc(100vw - " + (sinistra + 10) + "px)";
      document.documentElement.style.setProperty("--pd-mano-spazio", (elAllievo.offsetHeight + basso + 16) + "px");
    }

    /* ---------- PC dell'allievo ---------- */
    function disegnaAllievo() {
      if (!elAllievo) return;
      var m = statoMano, f = [m.alzata, m.risposta, m.messaggio, invioOk].join("|");
      if (f === firmaAllievo && elAllievo.innerHTML) { posiziona(); return; }   // niente da cambiare: non disturbo chi scrive
      firmaAllievo = f;
      if (!m.alzata) {
        elAllievo.className = "pd-mano pd-mano-riposo";
        elAllievo.innerHTML = '<button class="pd-mano-btn" type="button" id="pd-mano-alza">✋ Ho bisogno di aiuto</button>';
        $("#pd-mano-alza", elAllievo).onclick = function () { alza(true); };
      } else {
        var arriva = m.risposta === "arrivo";
        elAllievo.className = "pd-mano pd-mano-su" + (arriva ? " arriva" : "");
        var input = $("#pd-mano-msg", elAllievo), scritto = input ? input.value : "", fuoco = input && document.activeElement === input;
        elAllievo.innerHTML = '<p class="pd-mano-titolo" role="status" aria-live="polite">' +
          (arriva ? "🏃 Il facilitatore sta arrivando 🙂" : "✋ Mano alzata – il facilitatore arriva") + "</p>" +
          (invioOk ? "" : '<p class="pd-mano-nota small">⚠️ Il PC del facilitatore non risponde: alzate la mano anche davvero!</p>') +
          (m.messaggio ? '<p class="pd-mano-nota small">Il vostro messaggio: «' + esc(m.messaggio) + "»</p>" : "") +
          '<div class="pd-mano-scrivi"><label class="sr-only" for="pd-mano-msg">Cosa vi serve? (facoltativo)</label>' +
          '<input type="text" id="pd-mano-msg" maxlength="' + MANO_MAX + '" placeholder="Cosa vi serve? (facoltativo)" autocomplete="off">' +
          '<button class="btn ghost" type="button" id="pd-mano-invia">Invia</button></div>' +
          '<button class="btn pd-mano-giu" type="button" id="pd-mano-giu">👇 Abbassa la mano</button>';
        input = $("#pd-mano-msg", elAllievo); input.value = scritto; if (fuoco) input.focus();
        $("#pd-mano-invia", elAllievo).onclick = function () { alza(true, pulisci(input.value)); };
        input.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); alza(true, pulisci(input.value)); } };
        $("#pd-mano-giu", elAllievo).onclick = function () { alza(false); };
      }
      document.documentElement.classList.add("pd-mano-on");
      posiziona();
    }
    function alza(su, messaggio) {
      if (inCorso) return; inCorso = true;
      if (PD.ospite) return alzaOspite(su, messaggio);
      var corpo = { alzata: su }; if (messaggio !== undefined) corpo.messaggio = messaggio;
      // prima la presenza aggiornata (pagina in uso), poi la mano: il server la invia subito al facilitatore
      (su && !statoMano.alzata && PD.aulaPresenza ? PD.aulaPresenza() : Promise.resolve()).then(function () {
        return PD.api("/api/aula/mano", corpo);
      }).then(function (r) {
        inCorso = false;
        var prima = statoMano.alzata; statoMano = r.mano || statoMano;
        if (su && !prima) PD.toast("✋ Ho avvisato il facilitatore: arriva appena può.", 4500);
        else if (su && messaggio !== undefined) { PD.toast("✉️ Messaggio inviato al facilitatore."); var i = $("#pd-mano-msg", elAllievo); if (i) i.value = ""; }
        else if (!su) PD.toast("👇 Mano abbassata.");
        disegnaAllievo(); pianifica(1500);
      }).catch(function (e) { inCorso = false; PD.toast("Non riuscito: " + e.message, 5000); });
    }
    function alzaOspite(su, messaggio) {
      var m = ospite.mano, prima = m.alzata;
      if (su && !m.alzata) m.da = Math.max(Math.floor(Date.now() / 1000), m.da + 1);   // nuova richiesta
      if (su) { m.alzata = true; if (!prima) m.risposta = ""; if (messaggio !== undefined || !prima) m.messaggio = messaggio || ""; }
      else { m.alzata = false; m.messaggio = ""; m.risposta = ""; }
      presenzaOspite().then(function (r) {
        inCorso = false;
        if (!r) { PD.toast("Non riuscito: il PC dell'aula non risponde.", 5000); invioOk = false; }
        statoMano = statoOspite().mano;
        if (r && su && !prima) PD.toast("✋ Ho avvisato il facilitatore: arriva appena può.", 4500);
        else if (r && su && messaggio !== undefined) { PD.toast("✉️ Messaggio inviato al facilitatore."); var i = $("#pd-mano-msg", elAllievo); if (i) i.value = ""; }
        else if (r && !su) PD.toast("👇 Mano abbassata.");
        disegnaAllievo(); pianifica(1500);
      });
    }
    function controllaAllievo() {
      return (PD.ospite ? presenzaOspite().then(statoOspite) : PD.api("/api/aula")).then(function (st) {
        if (st.ruolo !== "allievo") { ruolo(st); return; }
        var m = st.mano || { alzata: false, risposta: "" }, prima = statoMano;
        invioOk = !(st.invio && st.invio.ok === false && st.invio.fa_s != null);
        if (m.alzata && m.risposta === "arrivo" && prima.risposta !== "arrivo") {
          PD.toast("🙂 Il facilitatore sta arrivando!", 6000); PD.speak("Il facilitatore sta arrivando.", true);
        }
        if (!m.alzata && prima.alzata) {
          if (m.risposta === "risolto") { PD.toast("✅ Il facilitatore ha segnato «risolto». Buon lavoro!", 6000); PD.speak("Bene! Buon lavoro.", true); }
          else PD.toast("👇 La mano si è abbassata.", 4000);
        }
        statoMano = m; disegnaAllievo();
      });
    }

    /* ---------- PC del facilitatore ---------- */
    function riquadro() {
      var el = document.getElementById("pd-mani");
      if (!el) {
        el = document.createElement("div"); el.id = "pd-mani"; el.className = "pd-mani"; el.setAttribute("role", "region");
        el.setAttribute("aria-label", "Richieste di aiuto"); el.hidden = true; document.body.appendChild(el);
      }
      return el;
    }
    function aggiorna(st) {
      if (!st || st.ruolo !== "facilitatore") return;
      ultimo = st;
      var lista = ordinaMani((st.clienti || []).filter(manoAlzata)), el = riquadro(), nuove = 0, i, chiavi = {};
      for (i = 0; i < lista.length; i++) {
        var k = lista[i].id + ":" + lista[i].mano.da; chiavi[k] = 1;
        if (!visti[k]) { visti[k] = 1; nuove++; }
      }
      visti = chiavi;
      if (nuove) { suono(); PD.toast("✋ " + (lista[0].utente || "Un allievo") + " chiede aiuto.", 4000); }
      document.title = (lista.length ? "✋ (" + lista.length + ") " : "") + titolo0.replace(/^✋ \(\d+\) /, "");
      var f = JSON.stringify(lista.map(function (x) { return [x.id, x.mano.da, x.mano.stato, x.mano.messaggio, Math.floor(x.mano.attesa_s / 60), x.attivita.titolo]; })) + PD.settings.aulaManoSuono;
      if (f === firma && !el.hidden === !!lista.length) return;
      firma = f;
      if (!lista.length) { el.hidden = true; el.innerHTML = ""; return; }
      var mostra = lista.slice(0, 3), suonoOn = PD.settings.aulaManoSuono !== false;
      el.innerHTML = '<div class="pd-mani-testa"><b>✋ ' + (lista.length === 1 ? "Un allievo chiede aiuto" : lista.length + " allievi chiedono aiuto") + "</b>" +
        '<button class="icon-btn" type="button" id="pd-mani-suono" aria-pressed="' + suonoOn + '" title="' + (suonoOn ? "Disattiva il suono" : "Attiva il suono") + '">' + (suonoOn ? "🔔" : "🔕") + "</button></div>" +
        mostra.map(function (x) {
          return '<div class="pd-mani-voce' + (x.mano.stato === "arrivo" ? " arrivo" : "") + '"><p class="pd-mani-testo">✋ <b>' + esc(x.utente || "Un allievo") + "</b> (" + esc(x.pc || x.ip || "") +
            ") chiede aiuto – " + esc(x.attivita.titolo || "—") + " – " + attesa(x.mano.attesa_s) + "</p>" +
            (x.mano.messaggio ? '<p class="pd-mani-msg">«' + esc(x.mano.messaggio) + "»</p>" : "") + '<div class="row">' + pulsantiRisposta(x) + "</div></div>";
        }).join("") +
        (lista.length > mostra.length ? '<p class="small"><a href="#/aula">Altre ' + (lista.length - mostra.length) + " richieste nel quadro dell'aula →</a></p>" : "");
      el.hidden = false;
      var tb = $(".topbar"); if (tb) el.style.top = Math.max(8, Math.round(tb.getBoundingClientRect().bottom) + 8) + "px";
      $("#pd-mani-suono", el).onclick = function () {
        PD.settings.aulaManoSuono = PD.settings.aulaManoSuono === false; PD.saveSettings();
        if (PD.settings.aulaManoSuono) suono();
        aggiorna(ultimo);
      };
      collega(el);
    }
    function collega(box) {
      $$("[data-mano-rispondi]", box).forEach(function (b) {
        b.onclick = function () {
          var stato = b.getAttribute("data-mano-rispondi"); b.disabled = true;
          PD.api("/api/aula/rispondi", { id: b.getAttribute("data-mano-id"), stato: stato }).then(function () {
            PD.toast(stato === "arrivo" ? "🏃 L'allievo vede: «Il facilitatore sta arrivando»." : "✅ Fatto: la mano è abbassata.");
          }).catch(function (e) { PD.toast("Non riuscito: " + e.message, 5000); }).then(function () {
            firma = "";
            var v = document.getElementById("view-aula");
            if (v && !v.hidden && document.getElementById("aula-corpo")) carica(v, false);
            else controllaFacilitatore();
          });
        };
      });
    }
    function controllaFacilitatore() {
      return PD.api("/api/aula").then(function (st) { if (st.ruolo !== "facilitatore") ruolo(st); else aggiorna(st); });
    }

    /* ---------- ciclo ---------- */
    function pianifica(ms) {
      clearTimeout(giro);
      giro = setTimeout(function () {
        var p = null, v = document.getElementById("view-aula");
        if (ruoloOra === "allievo" && statoMano.alzata) p = controllaAllievo();
        // nella pagina Aula il quadro si aggiorna già da solo ogni 5 secondi (carica → aggiorna)
        else if (ruoloOra === "facilitatore" && !(v && !v.hidden && document.getElementById("aula-corpo"))) p = controllaFacilitatore();
        (p || Promise.resolve()).catch(function () { /* server spento */ }).then(function () { if (ruoloOra) pianifica(); });
      }, ms || (ruoloOra === "allievo" ? 4000 : 5000));
    }
    function ruolo(st) {
      var r = PD.server ? ((st && st.ruolo) || "") : "";
      if (r !== "allievo" && elAllievo) { elAllievo.parentNode.removeChild(elAllievo); elAllievo = null; document.documentElement.classList.remove("pd-mano-on"); }
      if (r !== "facilitatore") { var el = document.getElementById("pd-mani"); if (el) { el.hidden = true; el.innerHTML = ""; } firma = ""; visti = {}; document.title = titolo0; }
      if (r === "allievo") {
        if (!elAllievo) { elAllievo = document.createElement("div"); elAllievo.id = "pd-mano"; document.body.appendChild(elAllievo); }
        if (st && st.mano) statoMano = st.mano;
        disegnaAllievo();
      }
      if (r === "facilitatore" && st && st.clienti) aggiorna(st);
      ruoloOra = r;
      if (r) pianifica(r === "facilitatore" ? 300 : 0); else clearTimeout(giro);
    }
    window.addEventListener("resize", posiziona);
    window.addEventListener("hashchange", function () { setTimeout(posiziona, 300); });
    return { aggiorna: aggiorna, ruolo: ruolo, collega: collega, suono: suono, posiziona: posiziona,
      stato: function () { return { ruolo: ruoloOra, mano: statoMano, suonati: suonati }; } };
  })();
  PD.aulaMano = mani;

  var prevReady = PD.onReady;
  PD.onReady = function () {
    if (prevReady) prevReady();
    if (PD.ospite) { presenzaOspite(); return; }     // la risposta dice se il PC è il facilitatore (mani.ruolo)
    if (!PD.server || !PD.settings.aulaRuolo) return;
    PD.api("/api/aula").then(function (st) { mani.ruolo(st); }).catch(function () { /* aula non disponibile */ });
  };
})();
