/* Professore Digitale - service worker dell'app per telefono e tablet (PWA).
 * Creato da tools/make_pwa.py a partire da tools/pwa/sw.js (i segnaposto __...__ vengono sostituiti).
 * - all'installazione mette da parte la pagina, il manifest e le icone;
 * - la pagina: prima la rete (al massimo ATTESA_RETE ms), poi la copia salvata -> funziona senza Internet;
 * - vendor/ocr/ (lettura delle foto): salvato al primo uso, poi preso sempre dalla copia;
 * - mai richieste verso altri siti; le copie delle versioni vecchie si cancellano all'attivazione.
 * ES5: niente arrow, let/const, async. Autore: Danilo D'Auria - Licenza MIT */
"use strict";
var VERSIONE = "__VERSIONE__";
var CACHE_APP = "professore-app-" + VERSIONE + "-__IMPRONTA__";
var CACHE_OCR = "professore-ocr-__IMPRONTA_OCR__";
var PREFISSI = ["professore-app-", "professore-ocr-"];
var FILE_APP = __FILE_APP__;
var ATTESA_RETE = 3000;

function assoluto(rel) { return new URL(rel, self.registration.scope).href; }
var PAGINA = assoluto("index.html");

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE_APP).then(function (cache) {
    return cache.addAll(FILE_APP.map(function (f) { return new Request(assoluto(f), { cache: "reload" }); }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (nomi) {
    return Promise.all(nomi.filter(function (n) {
      var nostro = PREFISSI.some(function (p) { return n.indexOf(p) === 0; });
      return nostro && n !== CACHE_APP && n !== CACHE_OCR;      /* le cache di altri siti dello stesso dominio non si toccano */
    }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) {
  if (e.data && e.data.tipo === "aggiorna") self.skipWaiting();
});

function paginaSenzaRete() {
  return new Response('<!DOCTYPE html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Professore Digitale</title><body style="font:20px/1.5 system-ui,sans-serif;padding:1.5rem;max-width:32rem;margin:auto">' +
    "<h1>📶 Serve Internet, solo la prima volta</h1><p>Il Professore non è ancora salvato su questo dispositivo. " +
    "Collegatevi a Internet (Wi-Fi o dati) e riaprite questa pagina: dopo funzionerà anche senza Internet.</p>" +
    '<p><button onclick="location.reload()" style="font-size:1.1rem;padding:.6rem 1.2rem">Riprova</button></p></body></html>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* rete prima (con un tempo massimo), poi la copia salvata */
function paginaPrincipale(req) {
  return caches.open(CACHE_APP).then(function (cache) {
    return new Promise(function (risolvi) {
      var fatto = false, timer = null;
      function dai(r) { if (!fatto && r) { fatto = true; if (timer) clearTimeout(timer); risolvi(r); } }
      function copia(riserva) { return cache.match(PAGINA).then(function (c) { dai(c || riserva); }); }
      timer = setTimeout(function () { timer = null; copia(null); }, ATTESA_RETE);
      fetch(req).then(function (r) {
        if (r && r.ok && r.type === "basic" && !r.redirected) {
          cache.put(PAGINA, r.clone());
          dai(r);
        } else {
          copia(r);
        }
      }, function () {
        copia(paginaSenzaRete());
      });
    });
  });
}

/* copia salvata prima, rete solo la prima volta */
function primaLaCopia(req, nome) {
  return caches.open(nome).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (c) {
      if (c) return c;
      return fetch(req).then(function (r) {
        if (r && r.ok && r.type === "basic" && r.status === 200) cache.put(req, r.clone());
        return r;
      });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              /* mai altri siti */
  var scope = self.registration.scope;
  if (req.url.indexOf(scope) !== 0) return;                     /* fuori dall'app (es. /api/): rete normale */
  var rel = url.pathname.substring(new URL(scope).pathname.length);
  if (rel === "" || rel === "index.html") {
    e.respondWith(paginaPrincipale(req));
  } else if (rel.indexOf("vendor/ocr/") === 0) {
    e.respondWith(primaLaCopia(req, CACHE_OCR));
  } else if (FILE_APP.indexOf(rel) >= 0) {
    e.respondWith(primaLaCopia(req, CACHE_APP));
  }
});
