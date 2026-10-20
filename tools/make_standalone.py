#!/usr/bin/env python3
"""Crea la versione portatile a file singolo (professore-digitale.html):
tutto incluso (CSS, JS, icona, motore degli schemi), si apre con doppio clic, senza Internet.
Uso: make_standalone.py SRC_WEB FILE_HTML
La funzione crea_html() la usa anche tools/make_pwa.py (app per telefono e tablet).
Autore: Danilo D'Auria - Licenza MIT"""
import base64, glob, json, os, re, sys


def js_safe(s):
    return s.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def prima_di_body(html, pezzo):
    """Inserisce prima dell'ULTIMO </body> (il codice di Mermaid ne contiene altri, dentro le stringhe)."""
    i = html.rfind("</body>")
    return html[:i] + pezzo + "\n" + html[i:]


def crea_html(web, versione=None, titolo="Professore Digitale (versione portatile)"):
    """Restituisce l'HTML a file singolo. versione=None -> quella scritta in VERSION."""
    root = os.path.normpath(os.path.join(web, "..", ".."))
    if versione is None:
        versione = open(os.path.join(root, "VERSION")).read().strip()
    packs = []
    for f in sorted(glob.glob(os.path.join(web, "..", "contenuti", "*.json"))):
        packs.append(json.load(open(f, encoding="utf-8")))
    html = open(os.path.join(web, "index.html"), encoding="utf-8").read()

    def rd(p):
        return open(os.path.join(web, p), encoding="utf-8").read()

    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', lambda m: "<style>\n" + rd(m.group(1)) + "\n</style>", html)
    icon = base64.b64encode(open(os.path.join(web, "img/icon.svg"), "rb").read()).decode()
    html = html.replace('href="img/icon.svg"', 'href="data:image/svg+xml;base64,' + icon + '"')
    html = re.sub(r'<script src="(js/[^"]+)"></script>', lambda m: "<script>\n" + js_safe(rd(m.group(1))) + "\n</script>", html)
    boot = "window.PD_VERSION=%s;window.PD_PACKS_BUILTIN=%s;" % (json.dumps(versione), json.dumps(packs, ensure_ascii=False))
    html = html.replace("<script>\n", "<script>\n" + js_safe(boot) + "\n", 1)
    mermaid = js_safe(rd("vendor/mermaid.min.js"))
    html = prima_di_body(html, '<script type="text/plain" id="pd-mermaid-src">' + mermaid + "</script>")
    # 3.7: dizionari delle lingue dentro la pagina (in file:// il browser non può leggerli a parte)
    for f in sorted(glob.glob(os.path.join(web, "i18n", "*.json"))):
        lingua = os.path.splitext(os.path.basename(f))[0]
        testo = json.dumps(json.load(open(f, encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))
        html = prima_di_body(html, '<script type="application/json" id="pd-i18n-%s">%s</script>' % (lingua, js_safe(testo)))
    html = html.replace("<title>Professore Digitale</title>", "<title>" + titolo + "</title>")
    assert 'src="js/' not in html and 'href="css/' not in html
    return html


if __name__ == "__main__":
    web, out = sys.argv[1], sys.argv[2]
    open(out, "w", encoding="utf-8").write(crea_html(web))
    print("creato", out, "%.1f MB" % (os.path.getsize(out) / 1e6))
