/* ==============================================================================
 *  PROFESSORE DIGITALE - «Sostieni il progetto»
 *  Mostra come fare un contributo libero (PayPal o bonifico) con i codici QR gia' pronti
 *  in data-sostieni.js (generati da tools/genera-sostieni.py). Nessun collegamento automatico:
 *  il sito di PayPal si apre solo se l'utente fa clic sul pulsante.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, esc = PD.esc, D = window.PD_SOSTIENI;
  if (!D) return;

  function ibanLeggibile(i) { return i.replace(/(.{4})/g, "$1 ").replace(/\s+$/, ""); }

  /* Copia negli appunti: API moderna se c'e', altrimenti il vecchio metodo (funziona anche in file:// e browser datati). */
  function copia(testo, cosa, btn) {
    function fatto(ok) {
      var m = ok ? "✅ " + cosa + " copiato. Ora potete incollarlo con Ctrl + V." : "Non sono riuscito a copiarlo: selezionatelo con il mouse e premete Ctrl + C.";
      var out = btn && btn.parentNode && btn.parentNode.parentNode.querySelector(".sostieni-esito");
      if (out) out.textContent = m;
      if (PD.toast) PD.toast(m);
    }
    try {
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(testo).then(function () { fatto(true); }, function () { vecchio(); }); return; }
    } catch (e) { /* si prova il vecchio metodo */ }
    vecchio();
    function vecchio() {
      var t = document.createElement("textarea"); t.value = testo; t.setAttribute("readonly", "");
      t.style.position = "fixed"; t.style.left = "-9999px"; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(t); fatto(ok);
    }
  }

  /* Riquadro per le Impostazioni (breve) */
  PD.sostieniHTML = function () {
    return '<div class="card sostieni-card" id="sostieni-card"><h2 style="margin-top:0">❤️ Sostieni il progetto</h2>' +
      '<p class="small muted">Il Professore Digitale è <b>gratuito</b> e lo resterà per tutti. Se vi è stato utile, potete aiutare ' +
      "Danilo D'Auria a continuare a migliorarlo con un <b>contributo libero</b>, con PayPal o con un bonifico.</p>" +
      '<button class="btn ghost" data-go="#/sostieni">❤️ Vedi come contribuire</button></div>';
  };

  PD.views.sostieni = function (el) {
    el.innerHTML =
      '<div class="card sostieni"><h1 style="margin-top:0">❤️ Sostieni il progetto</h1>' +
      '<p class="lead">Il Professore Digitale è <b>gratuito</b>, <b>libero</b> (codice MIT, contenuti Creative Commons BY-NC-SA 4.0: <a href="#/licenza" data-go="#/licenza">cosa potete fare</a>) e funziona senza Internet. ' +
      "È nato per aiutare chi muove i primi passi con il computer e per dare nuova vita ai PC usati.</p>" +
      "<p>Se vi è stato utile, potete sostenere il lavoro di <b>" + esc(D.intestatario) + "</b> con un <b>contributo libero</b>, " +
      "della cifra che preferite. Non è obbligatorio: il programma resta uguale per tutti.</p></div>" +

      '<div class="sostieni-grid">' +
      '<div class="card sostieni-modo"><h2>💳 Con PayPal</h2>' +
      '<div class="sostieni-qr" aria-label="Codice QR per PayPal">' + D.qrPaypal + "</div>" +
      '<p class="small">Inquadrate il codice con la fotocamera del telefono, oppure aprite il collegamento dal computer.</p>' +
      '<p class="sostieni-dato"><code>' + esc(D.paypal.replace(/^https?:\/\//, "")) + "</code></p>" +
      '<div class="row"><a class="btn" href="' + esc(D.paypal) + '" target="_blank" rel="noopener">🌐 Apri PayPal</a>' +
      '<button class="btn ghost" data-copia="' + esc(D.paypal) + '" data-cosa="Collegamento">📋 Copia il collegamento</button></div>' +
      '<p class="small muted">Serve Internet solo in questo momento. Scegliete l\'importo e, se possibile, l\'opzione per <b>beni e servizi</b> ' +
      "quando pagate una prestazione (installazione, corso…).</p>" +
      '<p class="small sostieni-esito" aria-live="polite"></p></div>' +

      '<div class="card sostieni-modo"><h2>🏦 Con un bonifico</h2>' +
      '<div class="sostieni-qr" aria-label="Codice QR per il bonifico">' + D.qrIban + "</div>" +
      '<p class="small">Molte app della banca leggono questo codice («QR SEPA») e compilano da sole il bonifico. Se la vostra non lo legge, copiate l\'IBAN.</p>' +
      '<dl class="kv"><dt>Intestatario</dt><dd>' + esc(D.intestatario) + "</dd>" +
      "<dt>IBAN</dt><dd><code class=\"sostieni-iban\">" + ibanLeggibile(esc(D.iban)) + "</code><br><span class=\"small muted\">" + esc(D.conto) + "</span></dd>" +
      "<dt>Causale</dt><dd>" + esc(D.causale) + "</dd></dl>" +
      '<div class="row"><button class="btn" data-copia="' + esc(D.iban) + '" data-cosa="IBAN">📋 Copia l\'IBAN</button>' +
      '<button class="btn ghost" data-copia="' + esc(D.causale) + '" data-cosa="Causale">📋 Copia la causale</button></div>' +
      '<p class="small sostieni-esito" aria-live="polite"></p></div>' +
      "</div>" +

      '<div class="card"><h2 style="margin-top:0">🤝 Servizi su richiesta</h2>' +
      "<p>Danilo offre anche <b>installazione e configurazione</b> del Professore Digitale, <b>recupero di vecchi PC</b> con FeniceOS, " +
      "<b>corsi e laboratori</b> per gruppi, associazioni, scuole e biblioteche. Per un preventivo scrivete a <b>" + esc(D.email) + "</b>.</p>" +
      '<p class="notice info small">🔒 <b>Per la vostra sicurezza</b>: per fare un contributo non servono mai codici, PIN o password. ' +
      "Nessuno del progetto ve li chiederà, né al telefono né per messaggio. In caso di dubbio, chiedete a una persona di fiducia.</p>" +
      '<p class="row"><button class="btn ghost" data-go="#/settings">⚙️ Torna alle impostazioni</button><button class="btn ghost" data-go="#/home">🏠 Torna all\'inizio</button></p></div>';
  };

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-copia]") : null;
    if (!b) return;
    e.preventDefault();
    copia(b.getAttribute("data-copia"), b.getAttribute("data-cosa") || "Testo", b);
  });
})();
