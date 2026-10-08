#!/usr/bin/env python3
"""Crea l'app per telefono e tablet (PWA) da pubblicare sul sito: dist/pubblica/app/
Uso: make_pwa.py SRC_WEB DEST_DIR [--versione X.Y.Z]

DEST_DIR/
  index.html             la versione portatile (tools/make_standalone.py) + manifest, icone, service worker
  manifest.webmanifest   nome, colori, icone: «Aggiungi alla schermata Home»
  sw.js                  service worker (da tools/pwa/sw.js): funziona senza Internet dopo la prima apertura
  icone/                 PNG già pronte in src/web/img/pwa/ (create una volta da img/icon.svg)
  vendor/ocr/            tesseract.js e l'italiano: lettura delle foto, salvata al primo uso
Nessuna dipendenza oltre a Python 3. --versione serve solo ai test («nuova versione disponibile»).
Autore: Danilo D'Auria - Licenza MIT"""
import hashlib, json, os, shutil, sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
from make_standalone import crea_html, js_safe  # noqa: E402

ICONE = [  # file in src/web/img/pwa/, lato, uso nel manifest
    ("icona-192.png", 192, "any"),
    ("icona-512.png", 512, "any"),
    ("icona-maskable-192.png", 192, "maskable"),
    ("icona-maskable-512.png", 512, "maskable"),
    ("apple-touch-icon.png", 180, None),
]
TEMA = "#1d5c8f"          # --brand di app.css
TEMA_SCURO = "#11161c"    # --bg del tema scuro
SFONDO = "#f6f3ec"        # --bg del tema chiaro


def impronta(percorsi):
    h = hashlib.sha256()
    for p in percorsi:
        h.update(os.path.basename(p).encode())
        h.update(open(p, "rb").read())
    return h.hexdigest()[:12]


def crea_pwa(web, dest, versione=None):
    root = os.path.normpath(os.path.join(web, "..", ".."))
    if versione is None:
        versione = open(os.path.join(root, "VERSION")).read().strip()
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(os.path.join(dest, "icone"))

    # --- icone ---
    for nome, _lato, _uso in ICONE:
        shutil.copy2(os.path.join(web, "img", "pwa", nome), os.path.join(dest, "icone", nome))

    # --- manifest ---
    manifest = {
        "name": "Professore Digitale",
        "short_name": "Professore",
        "description": "Il maestro paziente per imparare a usare computer, telefono e Internet. Funziona anche senza Internet.",
        "lang": "it", "dir": "ltr",
        "id": "./", "start_url": "./", "scope": "./",
        "display": "standalone", "orientation": "any",
        "background_color": SFONDO, "theme_color": TEMA,
        "categories": ["education"],
        "icons": [{"src": "icone/" + n, "sizes": "%dx%d" % (l, l), "type": "image/png", "purpose": u}
                  for n, l, u in ICONE if u],
    }
    with open(os.path.join(dest, "manifest.webmanifest"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    # --- pagina: la portatile + testa per l'app ---
    html = crea_html(web, versione, titolo="Professore Digitale")
    registra = open(os.path.join(QUI, "pwa", "registra.js"), encoding="utf-8").read()
    testa = "\n".join([
        '<link rel="manifest" href="manifest.webmanifest">',
        '<meta name="theme-color" content="%s">' % TEMA,
        '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="%s">' % TEMA_SCURO,
        '<meta name="mobile-web-app-capable" content="yes">',
        '<meta name="apple-mobile-web-app-capable" content="yes">',
        '<meta name="apple-mobile-web-app-title" content="Professore">',
        '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
        '<link rel="apple-touch-icon" href="icone/apple-touch-icon.png">',
        '<link rel="icon" type="image/png" sizes="192x192" href="icone/icona-192.png">',
        "<script>\n" + js_safe(registra) + "</script>",
    ])
    segno_vp = '<meta name="viewport" content="width=device-width, initial-scale=1">'
    assert segno_vp in html, "manca il meta viewport in index.html"
    html = html.replace(segno_vp, segno_vp + "\n" + testa, 1)
    with open(os.path.join(dest, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    # --- lettura delle foto (OCR): stessi file del programma installato ---
    ocr_src = os.path.join(web, "vendor", "ocr")
    ocr_dst = os.path.join(dest, "vendor", "ocr")
    shutil.copytree(ocr_src, ocr_dst, ignore=shutil.ignore_patterns("LEGGIMI.txt"))
    ocr_file = sorted(os.path.join(d, f) for d, _s, fs in os.walk(ocr_dst) for f in fs)

    # --- service worker ---
    file_app = ["index.html", "manifest.webmanifest"] + ["icone/" + n for n, _l, _u in ICONE]
    sw = open(os.path.join(QUI, "pwa", "sw.js"), encoding="utf-8").read()
    sostituzioni = {
        "__VERSIONE__": versione,
        "__IMPRONTA__": impronta([os.path.join(dest, f) for f in file_app]),
        "__IMPRONTA_OCR__": impronta(ocr_file),
        "__FILE_APP__": json.dumps(file_app),
    }
    for k, v in sostituzioni.items():
        assert k in sw, k
        sw = sw.replace(k, v)
    with open(os.path.join(dest, "sw.js"), "w", encoding="utf-8") as f:
        f.write(sw)
    return dest


if __name__ == "__main__":
    args = sys.argv[1:]
    ver = None
    if "--versione" in args:
        i = args.index("--versione")
        ver = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        sys.exit("Uso: make_pwa.py SRC_WEB DEST_DIR [--versione X.Y.Z]")
    d = crea_pwa(args[0], args[1], ver)
    tot = sum(os.path.getsize(os.path.join(a, f)) for a, _s, fs in os.walk(d) for f in fs)
    print("creata l'app per telefono e tablet in", d, "(%.1f MB)" % (tot / 1e6))
