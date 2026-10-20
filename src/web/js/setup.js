/* ==============================================================================
 *  PROFESSORE DIGITALE - Configurazione guidata di IA e voce (versione Windows)
 *  Mostra cosa c'e' nel computer, propone il modello di IA migliore per quella
 *  macchina e installa tutto con un clic; prepara e legge la "chiavetta" per i
 *  PC senza Internet. Su Linux e nella versione portatile spiega cosa fare.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, esc = PD.esc, $ = PD.$;
  var poll = null, info = null;

  function gb(mb) { return (Math.round(mb / 1024 * 10) / 10).toString().replace(".", ","); }
  function yes(v) { return v ? "✔" : "—"; }
  function stopPoll() { if (poll) { clearTimeout(poll); poll = null; } }

  PD.views.setup = function (el) {
    stopPoll();
    if (!PD.server || !PD.status || !PD.status.setup) {
      el.innerHTML = '<h1>🧰 Configura IA e voce</h1>' + (PD.server && PD.isMac()
        ? '<div class="card"><p>Sul Mac l\'intelligenza artificiale si attiva installando <b>Ollama per Mac</b> (da <b>ollama.com</b>); le voci si scelgono in Impostazioni di Sistema → Accessibilità → Contenuto letto ad alta voce.</p></div>'
        : PD.server
        ? '<div class="card"><p>Su Linux la configurazione si fa dal menu delle applicazioni (<b>Professore Digitale: configura IA</b> e <b>configura microfono</b>) oppure dal terminale con <code>professore-digitale-setup-ia</code> e <code>professore-digitale-setup-voce</code>.</p></div>'
        : '<div class="card"><p>Questa è la versione portatile: l\'intelligenza artificiale e il microfono si configurano nella versione installata (<b>.exe</b> per Windows, <b>.deb</b> per Linux, <b>.zip</b> per Mac).</p></div>');
      return;
    }
    el.innerHTML = '<h1>🧰 Configura IA e voce</h1><p class="lead">Il Professore controlla il vostro computer e sceglie da solo l\'intelligenza artificiale più adatta. ' +
      'Internet serve <b>solo adesso</b>, per scaricare; poi tutto funziona senza rete e nulla esce dal computer.</p><div id="setup-body"><p class="muted">Controllo il computer…</p></div>';
    PD.api("/api/setup/info").then(function (r) { info = r; render(el); })
      .catch(function (e) { $("#setup-body", el).innerHTML = '<div class="notice">Configurazione non disponibile: ' + esc(e.message) + "</div>"; });
  };

  function render(el) {
    var h = info.hardware, p = info.piano, ins = info.installato;
    var box = $("#setup-body", el);
    var html = '<div class="settings">';
    // --- il computer
    html += '<div class="card"><h2 style="margin-top:0">💻 Il vostro computer</h2><dl class="kv">' +
      "<dt>Sistema</dt><dd>" + esc(h.os) + "</dd>" +
      "<dt>Processore</dt><dd>" + esc(h.cpu) + " · " + h.cpus + " core" + (h.arch !== "arm64" ? " · istruzioni AVX2 " + yes(h.avx2) : "") + "</dd>" +
      "<dt>Memoria</dt><dd>" + gb(h.ram_mb) + " GB</dd>" +
      "<dt>Scheda video</dt><dd>" + esc(h.gpu) + (h.vram_mb ? " · " + gb(h.vram_mb) + " GB" : "") + (h.gpu_dedicata ? " · <b>utile all'IA</b>" : "") + "</dd>" +
      "<dt>Spazio libero</dt><dd>" + (h.disco_libero_mb ? gb(h.disco_libero_mb) + " GB" : "—") + "</dd></dl>" +
      '<p class="small muted">Catalogo dei modelli: versione ' + esc(info.catalogo || "—") + ' · <button class="btn ghost" id="cat-upd" style="min-height:2rem;padding:.2rem .7rem">Cerca un catalogo più recente</button></p><div id="cat-res" class="small"></div></div>';
    // --- intelligenza artificiale
    html += '<div class="card"><h2 style="margin-top:0">🤖 Intelligenza artificiale locale</h2><p class="small">' + esc(p.motivo) + "</p>";
    if (ins.ia && ins.ia.modello) html += '<p class="notice ok small">Già configurata: <b>' + esc(ins.ia.modello) + "</b> (" + (ins.ia.motore === "ollama" ? "Ollama" : "motore compatibile") + ").</p>";
    if (p.motore !== "nessuno") {
      html += '<div class="models" id="models">' + p.modelli.map(function (m) {
        var tag = m.consigliato ? '<span class="badge done">Consigliato per questo PC</span>' : m.lento ? '<span class="badge">Potrebbe essere lento</span>' :
          !m.adatto ? '<span class="badge warn">Troppo grande per questo PC</span>' : "";
        return '<label class="model' + (m.adatto || m.lento ? "" : " off") + '"><input type="radio" name="modello" value="' + esc(m.nome) + '"' + (m.consigliato ? " checked" : "") + ">" +
          '<span><b>' + esc(m.titolo) + "</b> · " + String(m.gb).replace(".", ",") + " GB " + tag + '<br><span class="small muted">' + esc(m.descrizione) + "</span></span></label>";
      }).join("") + '<label class="model"><input type="radio" name="modello" value=""><span><b>Non installare l\'IA</b><br><span class="small muted">Il Professore userà la guida interna (sempre disponibile).</span></span></label></div>';
    }
    html += "</div>";
    // --- voce e microfono
    html += '<div class="card"><h2 style="margin-top:0">🔊 Voce e 🎤 microfono</h2>' +
      (ins.voce_windows ? '<p class="notice ok small">Voce italiana di Windows presente: <b>' + esc(ins.voce_windows) + "</b>.</p>"
        : '<p class="notice small">Windows non ha una voce italiana installata. Su Windows 10 e 11: <b>Impostazioni → Ora e lingua → Voce → Aggiungi voci → Italiano</b>. In alternativa installate qui sotto la voce naturale.</p>') +
      (p.microfono_possibile ? sw("s-mic", "Microfono: riconoscimento vocale italiano offline (circa 50 MB)" + (ins.microfono ? " — già installato" : ""), !ins.microfono)
        : '<p class="small muted">Il microfono richiede Windows a 64 bit.</p>') +
      (p.voce_naturale_possibile ? sw("s-piper", "Voce naturale «Paola», più morbida di quella di Windows (circa 80 MB)" + (ins.voce_naturale ? " — già installata" : ""), !ins.voce_naturale && !ins.voce_windows)
        : '<p class="small muted">La voce naturale richiede Windows 7 o successivo a 64 bit.</p>') +
      (p.browser_xp ? sw("s-browser", "Browser Supermium aggiornato, compatibile con Windows XP e Vista", false) : "") + "</div>";
    html += "</div>";
    // --- pulsante e avanzamento
    html += '<div class="card setup-go"><button class="btn big" id="go">▶ Configura automaticamente</button>' +
      '<p class="small muted" style="margin:.6rem 0 0">Ogni file viene scaricato dalla fonte ufficiale e controllato con la sua impronta digitale (SHA-256). Potete continuare a usare il Professore mentre scarica.</p>' +
      '<div id="job" hidden></div></div>';
    // --- chiavetta
    var mm = info.modelli_per_motore || {};
    html += '<div class="settings"><div class="card"><h2 style="margin-top:0">💾 Computer senza Internet: la chiavetta</h2>' +
      '<p class="small">Su un PC collegato preparate una chiavetta con tutto il necessario; sui PC senza rete premete «Installa dalla chiavetta». Ogni file viene verificato.</p>' +
      '<div class="field"><label>I PC di destinazione hanno</label><select id="kit-mot"><option value="ollama">Windows 10 22H2 o Windows 11</option><option value="compatibile">Windows 7, 8 o 8.1 (64 bit)</option><option value="">Nessuna IA (solo voce)</option></select></div>' +
      '<div class="field"><label>Modello</label><select id="kit-mod"></select></div>' +
      sw("k-mic", "Microfono", true) + sw("k-piper", "Voce naturale", true) + sw("k-browser", "Browser per Windows XP e Vista", false) +
      '<div class="row" style="margin-top:.6rem"><button class="btn ghost" id="kit-prep">💾 Prepara la chiavetta</button><button class="btn" id="kit-inst">📥 Installa dalla chiavetta</button></div></div>' +
      '<div class="card"><h2 style="margin-top:0">🧹 Togliere i componenti</h2><p class="small muted">Liberano spazio; il Professore continua a funzionare con la guida interna e la voce di Windows.</p>' +
      '<div class="row"><button class="btn ghost" data-rm="ia">Togli l\'IA</button><button class="btn ghost" data-rm="microfono">Togli il microfono</button><button class="btn ghost" data-rm="voce">Togli la voce naturale</button></div>' +
      '<p class="small muted">Ollama, se installato, si toglie da <b>Impostazioni di Windows → App</b>.</p></div></div>';
    box.innerHTML = html;

    function fillKit() {
      var mot = $("#kit-mot", box).value, list = mm[mot] || [];
      $("#kit-mod", box).innerHTML = list.map(function (m) { return '<option value="' + esc(m.nome) + '">' + esc(m.titolo) + " · " + String(m.gb).replace(".", ",") + " GB</option>"; }).join("");
      $("#kit-mod", box).disabled = !list.length;
      var mine = list.filter(function (m) { return m.nome === p.modello; })[0];
      if (mine) $("#kit-mod", box).value = mine.nome;
    }
    if (p.motore === "compatibile") $("#kit-mot", box).value = "compatibile";
    fillKit();
    $("#kit-mot", box).onchange = fillKit;
    $("#go", box).onclick = function () {
      var r = box.querySelector('input[name="modello"]:checked');
      var body = { modello: r ? r.value : "", microfono: chk("s-mic"), voce_naturale: chk("s-piper"), browser: chk("s-browser") };
      start("/api/setup/start", body);
    };
    $("#kit-prep", box).onclick = function () {
      var mot = $("#kit-mot", box).value;
      start("/api/setup/kit-prepare", { motore: mot, modello: mot ? $("#kit-mod", box).value : "", microfono: chk("k-mic"), voce_naturale: chk("k-piper"), browser: chk("k-browser") },
        "Si apre una finestra di Windows: scegliete la chiavetta (potrebbe comparire dietro a questa finestra).");
    };
    $("#kit-inst", box).onclick = function () { start("/api/setup/kit-install", {}, "Si apre una finestra di Windows: scegliete la cartella ProfessoreDigitale-kit sulla chiavetta."); };
    PD.$$("[data-rm]", box).forEach(function (b) {
      b.onclick = function () {
        if (!b.getAttribute("data-confirm")) { b.setAttribute("data-confirm", "1"); b.textContent = "Sicuri? Premete di nuovo"; return; }
        PD.api("/api/setup/remove", { cosa: b.getAttribute("data-rm") }).then(function () { PD.toast("Componente tolto."); return PD.detect(); })
          .then(function () { PD.views.setup(el); }).catch(function (e) { PD.toast("Non riuscito: " + e.message); });
      };
    });
    $("#cat-upd", box).onclick = function () {
      var out = $("#cat-res", box); out.textContent = "Controllo…";
      PD.api("/api/update-check", { url: PD.settings.updateUrl || PD.status.update_url }).then(function (r) {
        if (!r.catalogo_ia) { out.textContent = "Nessun catalogo più recente pubblicato."; return; }
        if (r.catalogo_ia.versione && PD.cmpVersion(r.catalogo_ia.versione, info.catalogo) <= 0) { out.textContent = "Avete già il catalogo più recente."; return; }
        return PD.api("/api/setup/catalog-update", r.catalogo_ia).then(function (c) { PD.toast("Catalogo aggiornato alla versione " + c.versione + "."); PD.views.setup(el); });
      }).catch(function (e) { out.textContent = "Controllo non riuscito: " + e.message; });
    };
    function chk(id) { var n = $("#" + id, box); return !!(n && n.checked); }
    if (info.lavoro_in_corso) follow();
  }

  function sw(id, label, on) { return '<label class="switch"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + ">" + esc(label) + "</label>"; }

  function start(url, body, hint) {
    var job = $("#job");
    if (hint) PD.toast(hint, 6000);
    PD.api(url, body).then(function () { follow(); }).catch(function (e) {
      if (job) { job.hidden = false; job.innerHTML = '<div class="notice">' + esc(e.message) + "</div>"; }
    });
  }

  function follow() {
    stopPoll();
    var job = $("#job"); if (!job) return;
    job.hidden = false;
    var go = $("#go"); if (go) go.disabled = true;
    PD.api("/api/setup/progress").then(function (s) {
      var pct = s.percento >= 0 ? Math.round(s.percento) : null;
      var bytes = s.totale > 0 ? " · " + mb(s.fatto) + " di " + mb(s.totale) : (s.fatto > 0 ? " · " + mb(s.fatto) : "");
      job.innerHTML = '<h3 style="margin:1rem 0 .3rem">' + esc(s.titolo || "Configurazione") + (s.passi ? " · passo " + s.passo + " di " + s.passi : "") + "</h3>" +
        '<p style="margin:.2rem 0">' + esc(s.fase) + bytes + "</p>" +
        '<div class="progress big"><span class="' + (pct == null && s.in_corso ? "indef" : "") + '" style="width:' + (pct == null ? (s.finito ? 100 : 30) : pct) + '%"></span></div>' +
        (s.in_corso ? '<button class="btn ghost" id="job-stop" style="margin-top:.6rem">■ Annulla</button>' : "") +
        (s.finito ? (s.riuscito ? '<div class="notice ok"><b>✅ Fatto!</b> ' + (s.modello ? "Intelligenza artificiale pronta: <b>" + esc(s.modello) + "</b>. " : "") +
          'Da ora il computer può restare scollegato da Internet.<div class="row" style="margin-top:.6rem"><button class="btn" data-go="#/ask">💬 Provate subito: fate una domanda</button></div></div>'
          : '<div class="notice"><b>Configurazione non completata.</b> ' + esc(s.errore) + "<br>Potete riprovare: i file già scaricati e verificati non vengono riscaricati.</div>") : "") +
        '<details class="small" style="margin-top:.6rem"' + (s.finito && !s.riuscito ? " open" : "") + '><summary>Dettagli</summary><ul class="log">' +
        s.registro.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></details>";
      var st = $("#job-stop"); if (st) st.onclick = function () { PD.api("/api/setup/cancel", {}); st.disabled = true; st.textContent = "Annullo…"; };
      if (s.in_corso) { poll = setTimeout(follow, 800); return; }
      if (go) go.disabled = false;
      if (s.finito && s.riuscito) {
        if (s.motore === "ollama" && s.modello) { PD.settings.model = s.modello; PD.saveSettings(); }
        PD.api("/api/stt-reprobe", {}).catch(function () {}).then(PD.detect).then(function () { PD.renderChips(); });
      }
    }).catch(function () { poll = setTimeout(follow, 2000); });
  }
  function mb(b) { return b >= 1073741824 ? (Math.round(b / 107374182.4) / 10).toString().replace(".", ",") + " GB" : Math.round(b / 1048576) + " MB"; }

  window.addEventListener("hashchange", function () { if (!/^#\/setup/.test(location.hash)) stopPoll(); });
})();
