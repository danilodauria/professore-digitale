/* Professore Digitale - app per telefono e tablet (PWA).
 * Script incorporato da tools/make_pwa.py nel <head> di app/index.html (ES5, nessuna libreria).
 * - dice alle altre parti dell'interfaccia che siamo nell'app (PD_PWA) e che vendor/ocr/ è qui accanto;
 * - registra il service worker (solo https o localhost): dopo la prima apertura funziona senza Internet;
 * - quando c'è una nuova versione mostra un avviso gentile con il pulsante «Aggiorna».
 * Autore: Danilo D'Auria - Licenza MIT */
(function () {
  "use strict";
  window.PD_PWA = true;
  window.PD_OCR_LOCALE = true;
  if (!("serviceWorker" in navigator)) return;
  var h = location.hostname;
  if (location.protocol !== "https:" && h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]") return;

  var vuoleAggiornare = false;

  function avviso(reg) {
    if (document.getElementById("pd-nuova-versione") || !document.body) return;
    var box = document.createElement("div");
    box.id = "pd-nuova-versione";
    box.className = "notice info";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    box.style.cssText = "position:fixed;left:50%;top:calc(.6rem + env(safe-area-inset-top, 0px));transform:translateX(-50%);z-index:60;margin:0;" +
      "width:calc(100% - 2rem);max-width:34rem;box-shadow:var(--shadow);display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;" +
      "background:var(--panel);";
    box.innerHTML = '<span style="flex:1 1 14rem">🎉 <b>È disponibile una nuova versione del Professore.</b> ' +
      "I vostri progressi restano dove sono.</span>" +
      '<button type="button" class="btn" id="pd-aggiorna">Aggiorna</button>' +
      '<button type="button" class="btn ghost" id="pd-aggiorna-dopo">Più tardi</button>';
    document.body.appendChild(box);
    document.getElementById("pd-aggiorna").onclick = function () {
      this.disabled = true;
      this.textContent = "Aggiorno…";
      vuoleAggiornare = true;
      if (reg.waiting) reg.waiting.postMessage({ tipo: "aggiorna" });
      else location.reload();
    };
    document.getElementById("pd-aggiorna-dopo").onclick = function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    };
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      /* solo dopo «Aggiorna»: alla prima installazione non si ricarica niente */
      if (!vuoleAggiornare) return;
      vuoleAggiornare = false;
      location.reload();
    });
    navigator.serviceWorker.register("sw.js", { scope: "./" }).then(function (reg) {
      window.PD_SW = reg;
      if (reg.waiting && navigator.serviceWorker.controller) avviso(reg);
      reg.addEventListener("updatefound", function () {
        var nuovo = reg.installing;
        if (!nuovo) return;
        nuovo.addEventListener("statechange", function () {
          if (nuovo.state === "installed" && navigator.serviceWorker.controller) avviso(reg);
        });
      });
      /* il telefono resta in tasca per giorni: quando si torna all'app controllo se c'è una versione nuova */
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible" || !navigator.onLine) return;
        try { var p = reg.update(); if (p && p.then) p.then(null, function () { /* senza rete: pazienza */ }); } catch (e) { /* ignora */ }
      });
      /* app installata sulla schermata Home: chiedo al browser di non cancellare i progressi quando manca spazio */
      var installata = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
      if (installata && navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(function (gia) { if (!gia) return navigator.storage.persist(); }).then(null, function () { /* ignora */ });
      }
    }, function () { /* senza service worker l'app funziona lo stesso, ma solo con Internet */ });
  });
})();
