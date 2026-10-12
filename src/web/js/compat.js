/* Professore Digitale - controllo del browser (scritto in JavaScript "antico", per farsi capire anche
 * da Internet Explorer). Se il browser e' troppo vecchio spiega con calma cosa fare, invece di mostrare
 * una pagina vuota. Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
(function () {
  var ok = !!(window.fetch && window.Promise && Object.assign && document.querySelector && window.addEventListener &&
              Array.prototype.forEach && window.URL && "classList" in document.documentElement);
  if (ok) return;
  window.PD_BROWSER_VECCHIO = true;
  var msg = '<div style="max-width:42em;margin:2em auto;padding:1.5em 2em;font:20px/1.5 Arial,sans-serif;background:#fffdf8;' +
    'border:3px solid #1d5c8f;border-radius:16px;color:#1f2a37">' +
    '<h1 style="color:#1d5c8f;font-size:1.6em;margin-top:0">Professore Digitale</h1>' +
    '<p><b>Questo browser &egrave; troppo vecchio</b> per mostrare le lezioni del Professore.</p>' +
    '<p>Ecco cosa fare:</p><ul>' +
    '<li><b>Windows XP e Vista:</b> installate il browser <b>Supermium</b>. Lo trovate sulla chiavetta del corso ' +
    '(cartella ProfessoreDigitale-kit\\browser) oppure chiedete al facilitatore.</li>' +
    '<li><b>Windows 7, 8, 10 e 11:</b> usate Microsoft Edge, Google Chrome o Firefox aggiornati.</li></ul>' +
    '<p>Poi riaprite il Professore Digitale: si aprir&agrave; da solo nel browser giusto.</p>' +
    '<p style="font-size:.8em;color:#4b5563">Ideato e sviluppato da Danilo D\'Auria &middot; Codice MIT &middot; Contenuti CC BY-NC-SA 4.0</p></div>';
  function show() {
    var b = document.body;
    if (!b) return;
    b.innerHTML = msg;
    b.style.background = "#f6f3ec";
  }
  if (document.body) show();
  if (window.attachEvent) window.attachEvent("onload", show);
  else if (window.addEventListener) window.addEventListener("load", show, false);
})();
