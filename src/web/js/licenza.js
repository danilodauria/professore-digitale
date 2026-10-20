/* ==========================================================================
 *  PROFESSORE DIGITALE - Licenze (dalla 3.5.2)
 *  Il CODICE è MIT; i CONTENUTI (lezioni, domande, quiz, percorsi, vademecum, immagini,
 *  grafica, il personaggio del Professore e il marchio della fenice) sono di Danilo D'Auria
 *  con licenza Creative Commons BY-NC-SA 4.0, come «Il Grande Quiz dell'Informatica».
 *  Qui: costanti, bollino CC, piè di pagina delle stampe e pagina #/licenza.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Codice MIT, contenuti CC BY-NC-SA 4.0
 * ========================================================================== */
(function () {
  "use strict";
  var PD = window.PD = window.PD || {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var L = PD.LICENZA = {
    autore: "Danilo D'Auria",
    anno: 2026,
    codice: "MIT",
    contenuti: "CC BY-NC-SA 4.0",
    nome: "Creative Commons Attribuzione – Non commerciale – Condividi allo stesso modo 4.0 Internazionale",
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.it",
    legale: "https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.it",
    sito: "https://danilodauria.github.io/professore-digitale/",
    quiz: "https://danilodauria.github.io/grande-quiz/",
    contatto: "danilodauria.site@gmail.com"
  };
  L.citazione = "«Professore Digitale – Cattedra Digitale Portatile» di Danilo D'Auria — un progetto FeniceOS — licenza CC BY-NC-SA 4.0 — " + L.sito;
  L.citazioneQuiz = "«Il Grande Quiz dell'Informatica» di Danilo D'Auria — un progetto FeniceOS — licenza CC BY-NC-SA 4.0 — " + L.quiz;

  function anni() { var a = new Date().getFullYear(); return a > L.anno ? L.anno + "–" + a : String(L.anno); }
  /* riga breve, testo semplice (stampe, attestati, pacchetti) */
  PD.licenzaBreve = function () { return "© " + anni() + " Danilo D'Auria · contenuti CC BY-NC-SA 4.0 · codice MIT"; };

  /* bollino Creative Commons disegnato in SVG (niente immagini esterne: funziona offline) */
  PD.ccBadge = function () {
    return '<svg class="cc-badge" viewBox="0 0 88 31" width="88" height="31" role="img" aria-label="Creative Commons BY-NC-SA 4.0">' +
      '<rect width="88" height="31" rx="4" fill="#abb1aa"/><rect x="1" y="1" width="86" height="29" rx="3" fill="#000"/>' +
      '<circle cx="15.5" cy="15.5" r="11.5" fill="#fff"/>' +
      '<text x="15.5" y="20" font-family="Arial, sans-serif" font-weight="700" font-size="11" text-anchor="middle" fill="#000">cc</text>' +
      '<text x="56" y="13" font-family="Arial, sans-serif" font-weight="700" font-size="8.5" text-anchor="middle" fill="#fff">BY · NC · SA</text>' +
      '<text x="56" y="24" font-family="Arial, sans-serif" font-size="7.5" text-anchor="middle" fill="#abb1aa">4.0 Internazionale</text></svg>';
  };

  /* piè di pagina comune a tutte le stampe; «extra» è HTML già pronto */
  PD.piedeStampa = function (extra) {
    return '<footer class="p-piede">Stampato dal Professore Digitale · ideato da Danilo D\'Auria · funziona senza Internet. ' +
      "Contenuti © " + anni() + " Danilo D'Auria, licenza Creative Commons CC BY-NC-SA 4.0 (citare l'autore, niente usi commerciali, " +
      "stessa licenza per le modifiche) · codice MIT." + (extra ? " " + extra : "") + "</footer>";
  };

  /* riquadro con la spiegazione (pagina #/licenza e Impostazioni) */
  PD.licenzaHTML = function () {
    return '<div class="card licenza-card" id="licenza-card"><h2 style="margin-top:0">📜 Licenza e diritti d\'autore</h2>' +
      '<div class="licenza-testa">' + PD.ccBadge() + '<p>Lezioni, domande, quiz, percorsi, vademecum, immagini e grafica sono opera di <b>Danilo D\'Auria</b> ' +
      "e sono distribuiti con licenza <a href=\"" + L.url + "\" target=\"_blank\" rel=\"license noopener\">" + esc(L.nome) + "</a> (" + L.contenuti + ").</p></div>" +
      "<p>Potete <b>usarli, stamparli, condividerli e adattarli</b>, alle tre condizioni della licenza:</p>" +
      '<ul class="licenza-regole">' +
      "<li><b>👤 Attribuzione</b> — citate sempre l'autore, Danilo D'Auria, il titolo e la licenza, e dite se avete fatto modifiche.</li>" +
      "<li><b>🚫💶 Non commerciale</b> — non si possono usare per guadagnarci (vendere, corsi a pagamento, pubblicità).</li>" +
      "<li><b>🔁 Condividi allo stesso modo</b> — le versioni modificate vanno condivise con la stessa licenza.</li></ul>" +
      '<p class="small">Usare il Professore in corsi gratuiti, centri anziani, scuole, biblioteche e associazioni, e stampare lezioni e attestati per gli allievi, è sempre permesso.</p>' +
      '<p class="small"><b>Come citarlo:</b></p><p class="citazione" id="licenza-citazione">' + esc(L.citazione) + "</p>" +
      '<p class="row"><button class="btn ghost" type="button" id="licenza-copia">📋 Copia la citazione</button>' +
      '<a class="btn ghost" href="' + L.legale + '" target="_blank" rel="noopener">⚖️ Testo legale completo</a></p>' +
      '<p class="small muted">Il <b>codice</b> del programma è software libero con licenza <b>MIT</b>. «Il Grande Quiz dell\'Informatica» ha la stessa licenza dei contenuti ' +
      "(" + esc(L.citazioneQuiz) + "). I componenti di altri autori (Mermaid, tesseract.js, Piper e le voci Giorgio, Serena e Paola, Vosk) mantengono la propria licenza, " +
      "elencata nel vademecum. Nonni Teach (domande, liberatoria, copertina) e Neura sono contenuti con la stessa licenza; le registrazioni delle interviste appartengono alle persone intervistate e si pubblicano solo con il loro consenso. I pacchetti creati da voi con «Crea lezioni e quiz» sono vostri. I diritti morali d'autore restano sempre all'autore. " +
      "Per altri usi: " + L.contatto + ".</p></div>";
  };
  PD.licenzaBind = function (el) {
    var b = el.querySelector("#licenza-copia"); if (!b) return;
    b.onclick = function () {
      var fatto = function () { if (PD.toast) PD.toast("Citazione copiata: incollatela dove volete."); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(L.citazione).then(fatto, copiaVecchia); return; }
      } catch (e) { /* si prova il modo vecchio */ }
      copiaVecchia();
      function copiaVecchia() {
        var t = document.createElement("textarea"); t.value = L.citazione; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); fatto(); } catch (e) { if (PD.toast) PD.toast("Selezionate la citazione e copiatela con Ctrl + C."); }
        document.body.removeChild(t);
      }
    };
  };

  PD.views = PD.views || {};
  PD.views.licenza = function (el) {
    el.innerHTML = '<div class="lesson-head"><span class="big-ico">📜</span><div><div class="small muted">Professore Digitale</div><h1>Licenza</h1></div></div>' +
      PD.licenzaHTML() + '<p class="row"><button class="btn ghost" data-go="#/settings">⚙️ Torna alle Impostazioni</button></p>';
    PD.licenzaBind(el);
  };
})();
