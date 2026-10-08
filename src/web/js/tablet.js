/* ==============================================================================
 *  PROFESSORE DIGITALE - «📱 Condividi con i tablet dell'aula» (3.4), lato PC del facilitatore
 *  Tablet e telefoni sulla stessa rete Wi-Fi aprono il Professore da questo PC e usano le sue voci,
 *  la sua IA e i suoi contenuti, senza installare nulla. Spenta per impostazione predefinita:
 *  si accende solo da qui (vista #/tablet), con un codice di 6 cifre e un QR code.
 *  API locali (solo 127.0.0.1): GET /api/tablet, POST /api/tablet {azione: accendi|spegni|codice|togli, id}.
 *  Il lato tablet (modalità ospite, PD.ospite) sta in app.js e aula.js.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var timer = 0, firmaQr = "";

  function disponibile() { return !!(PD.server && !PD.ospite); }
  function fa(s) {
    if (s == null) return "";
    if (s < 15) return "adesso";
    if (s < 60) return s + " secondi fa";
    if (s < 3600) return Math.round(s / 60) + " min fa";
    return Math.round(s / 3600) + " ore fa";
  }
  function codiceBello(c) { return c ? c.slice(0, 3) + " " + c.slice(3) : ""; }

  /* ------------------------------------------------------------------ vista #/tablet */
  PD.views.tablet = function (el) {
    clearInterval(timer); firmaQr = "";
    if (!disponibile()) {
      el.innerHTML = '<h1>📱 Tablet dell\'aula</h1><p class="notice info">' + (PD.ospite ?
        "Questo è già un tablet collegato al PC dell'aula: la condivisione si gestisce dal PC del facilitatore." :
        "La condivisione con i tablet funziona con il programma installato (.exe per Windows, .deb per Linux), non con la versione portatile.") + "</p>";
      return;
    }
    el.innerHTML = '<h1>📱 Condividi con i tablet dell\'aula</h1>' +
      '<p class="lead">I tablet e i telefoni collegati alla <b>stessa rete Wi-Fi</b> di questo computer possono aprire il Professore e usare ' +
      "le sue voci naturali, la sua intelligenza artificiale e i suoi contenuti, <b>senza installare nulla</b>.</p>" +
      '<div id="tablet-corpo"><p class="muted">Carico…</p></div>';
    carica(el, true);
    timer = setInterval(function () {
      var v = document.getElementById("view-tablet");
      if (!document.getElementById("tablet-corpo") || !v || v.hidden) { clearInterval(timer); return; }
      carica(el, false);
    }, 3000);
  };

  function chiama(azione, extra) {
    var corpo = { azione: azione }, k;
    for (k in extra || {}) if (Object.prototype.hasOwnProperty.call(extra, k)) corpo[k] = extra[k];
    return PD.api("/api/tablet", corpo);
  }
  function carica(el, tutto) {
    return PD.api("/api/tablet").then(function (st) { disegna(el, st, tutto); }).catch(function (e) {
      var c = $("#tablet-corpo", el); if (c) c.innerHTML = '<p class="notice">Stato della condivisione non disponibile: ' + esc(e.message) + "</p>";
    });
  }

  function disegna(el, st, tutto) {
    var c = $("#tablet-corpo", el); if (!c) return;
    if (!st.attivo) {
      firmaQr = "";
      c.innerHTML = '<div class="card tablet-spento"><h2 style="margin-top:0">La condivisione è spenta</h2>' +
        "<p>Quando la accendete, questo computer accetta i tablet della rete locale <b>solo con il codice</b> che vedrete qui. " +
        "Potete cambiare il codice o spegnere tutto in qualsiasi momento.</p>" +
        (st.errore ? '<p class="notice">⚠️ Non riesco ad accenderla: ' + esc(st.errore) + ".</p>" : "") +
        '<button class="btn big" id="tablet-accendi" type="button">📱 Accendi la condivisione</button></div>' + privacy();
      $("#tablet-accendi", c).onclick = function () {
        var b = this; b.disabled = true;
        chiama("accendi").then(function (s2) {
          PD.settings.tabletCondividi = true; PD.saveSettings();
          PD.toast("📱 Condivisione accesa: i tablet possono collegarsi con il codice.", 4000);
          disegna(el, s2, true);
        }).catch(function (e) { b.disabled = false; PD.toast("Non riuscito: " + e.message, 6000); carica(el, true); });
      };
      return;
    }
    var primo = st.indirizzi[0] || "", firma = st.codice + "|" + st.indirizzi.join(",");
    if (tutto || firma !== firmaQr || !$("#tablet-qr", c)) {
      firmaQr = firma;
      var qr = "";
      try { qr = primo ? PD.qr.svg(primo) : ""; } catch (e) { qr = ""; }
      c.innerHTML = '<div class="card tablet-acceso"><div class="tablet-qr-riga">' +
        (qr ? '<div class="tablet-qr" id="tablet-qr" title="Inquadrate questo codice con la fotocamera del tablet">' + qr + "</div>" :
          '<div class="tablet-qr tablet-qr-vuoto" id="tablet-qr-vuoto"><p class="notice">Questo computer non è collegato a una rete locale (Wi-Fi o cavo): ' +
          "collegatelo alla stessa rete dei tablet.</p></div>") +
        '<div class="tablet-istruzioni"><h2 style="margin-top:0">Sul tablet</h2><ol>' +
        "<li>Collegatevi alla <b>stessa rete Wi-Fi</b> di questo computer.</li>" +
        "<li>Inquadrate il QR code con la fotocamera, <b>oppure</b> aprite il browser e scrivete l'indirizzo:</li></ol>" +
        '<div class="tablet-indirizzi" id="tablet-indirizzi">' + (st.indirizzi.length ? st.indirizzi.map(function (u) {
          return '<div class="tablet-url">' + esc(u.replace(/\?c=\d+$/, "")) + "</div>";
        }).join("") : '<p class="muted">nessun indirizzo di rete locale</p>') + "</div>" +
        '<p>Il codice da inserire è:</p><div class="tablet-codice" id="tablet-codice" aria-label="Codice ' + esc(st.codice.split("").join(" ")) + '">' + esc(codiceBello(st.codice)) + "</div>" +
        "</div></div>" +
        '<div class="row tablet-comandi"><button class="btn ghost" id="tablet-cambia" type="button">🔄 Cambia codice</button>' +
        '<button class="btn danger" id="tablet-spegni" type="button">⏹ Spegni la condivisione</button></div>' +
        '<p class="small muted">Cambiando il codice i tablet già collegati devono inserire quello nuovo. Dopo 12 ore il collegamento scade da solo.</p></div>' +
        '<div class="card"><h2 style="margin-top:0">Tablet collegati</h2><div id="tablet-dispositivi"></div></div>' + privacy();
      $("#tablet-cambia", c).onclick = function () {
        chiama("codice").then(function (s2) { PD.toast("🔄 Nuovo codice: " + codiceBello(s2.codice), 4000); disegna(el, s2, true); })
          .catch(function (e) { PD.toast("Non riuscito: " + e.message); });
      };
      $("#tablet-spegni", c).onclick = function () {
        var b = this;
        if (!b.getAttribute("data-conferma")) {
          b.setAttribute("data-conferma", "1"); b.textContent = "Sicuri? Premete di nuovo per spegnere";
          setTimeout(function () { if (b.parentNode) { b.removeAttribute("data-conferma"); b.textContent = "⏹ Spegni la condivisione"; } }, 5000);
          return;
        }
        b.disabled = true;
        chiama("spegni").then(function (s2) {
          PD.settings.tabletCondividi = false; PD.saveSettings();
          PD.toast("⏹ Condivisione spenta: i tablet non possono più collegarsi.", 4000);
          disegna(el, s2, true);
        }).catch(function (e) { b.disabled = false; PD.toast("Non riuscito: " + e.message); });
      };
    }
    dispositivi($("#tablet-dispositivi", c), st.dispositivi || [], el);
  }

  function dispositivi(box, lista, el) {
    if (!box) return;
    var aperto = document.activeElement && box.contains(document.activeElement);
    if (aperto) return;      // non ridisegno sotto il dito di chi sta premendo
    box.innerHTML = lista.length ? '<div class="tab-aula"><table class="tablet-tab"><thead><tr><th>Nome</th><th>Indirizzo</th><th>Pagina</th><th>Ultimo accesso</th><th></th></tr></thead><tbody>' +
      lista.map(function (d) {
        return "<tr><td><b>" + esc(d.nome || "(senza nome)") + "</b></td><td>" + esc(d.ip) + "</td><td>" + esc(d.pagina || "—") + "</td><td>" + fa(d.fa_s) +
          '</td><td><button class="btn ghost" type="button" data-tablet-togli="' + esc(d.id) + '" title="Scollega questo tablet">✕</button></td></tr>';
      }).join("") + "</tbody></table></div>" :
      '<p class="muted">Nessun tablet ancora. Il nome compare quando l\'allievo lo scrive nella pagina «Aula» del tablet.</p>';
    $$("[data-tablet-togli]", box).forEach(function (b) {
      b.onclick = function () {
        chiama("togli", { id: b.getAttribute("data-tablet-togli") }).then(function (s2) { PD.toast("Tablet scollegato: dovrà inserire di nuovo il codice."); disegna(el, s2, false); });
      };
    });
  }

  function privacy() {
    return '<div class="card"><h2 style="margin-top:0">🔒 Cosa vuol dire</h2><ul class="small">' +
      "<li>Questo computer apre una porta (8768) <b>solo verso la rete locale</b> dell'aula: da Internet non si raggiunge.</li>" +
      "<li>Entra solo chi conosce il codice. I tablet possono usare le lezioni, la voce, l'IA e i contenuti; " +
      "<b>non</b> possono leggere i dati, le impostazioni o i progressi di questo computer, né installare o cambiare nulla.</li>" +
      "<li>I progressi degli allievi restano <b>sui loro tablet</b>. Se questo PC è il facilitatore dell'aula, i tablet compaiono nel quadro dell'aula.</li>" +
      "<li>Quando avete finito, premete «Spegni la condivisione».</li></ul></div>";
  }

  /* ------------------------------------------------------------------ riquadro per Aula e Impostazioni */
  function cartaHTML() {
    if (!disponibile()) return "";
    return '<div class="card tablet-carta"><h2 style="margin-top:0">📱 Condividi con i tablet dell\'aula</h2>' +
      '<p class="small">Tablet e telefoni sulla stessa rete Wi-Fi usano il Professore di questo computer (voci, IA, contenuti) senza installare nulla. ' +
      '<span class="tablet-carta-stato" data-tablet-stato>…</span></p>' +
      '<button class="btn ghost" type="button" data-go="#/tablet">📱 Apri la condivisione</button></div>';
  }
  function cartaBind(el) {
    var s = $("[data-tablet-stato]", el); if (!s) return;
    PD.api("/api/tablet").then(function (st) {
      s.innerHTML = st.attivo ? "<b>✅ Accesa</b> · " + (st.dispositivi || []).length + " tablet collegati." : "<b>Spenta.</b>";
    }).catch(function () { s.textContent = ""; });
  }
  PD.tablet = { cartaHTML: cartaHTML, cartaBind: cartaBind };
  PD.hooks.settingsCards.push({ html: cartaHTML, bind: cartaBind });
})();
