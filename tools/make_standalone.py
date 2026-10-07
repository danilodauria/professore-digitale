#!/usr/bin/env python3
"""Crea la versione portatile a file singolo (professore-digitale.html):
tutto incluso (CSS, JS, icona, motore degli schemi), si apre con doppio clic, senza Internet.
Autore: Danilo D'Auria - Licenza MIT"""
import base64, os, re, sys
web = sys.argv[1]; out = sys.argv[2]
root = os.path.normpath(os.path.join(web, "..", ".."))
import json, glob
VERSION = open(os.path.join(root, "VERSION")).read().strip()
packs = []
for f in sorted(glob.glob(os.path.join(web, "..", "contenuti", "*.json"))):
    packs.append(json.load(open(f, encoding="utf-8")))
html = open(os.path.join(web, "index.html"), encoding="utf-8").read()

def rd(p): return open(os.path.join(web, p), encoding="utf-8").read()
def js_safe(s): return s.replace("</script", "<\\/script").replace("<!--", "<\\!--")

html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', lambda m: "<style>\n" + rd(m.group(1)) + "\n</style>", html)
icon = base64.b64encode(open(os.path.join(web, "img/icon.svg"), "rb").read()).decode()
html = html.replace('href="img/icon.svg"', 'href="data:image/svg+xml;base64,' + icon + '"')
def inline_script(m):
    return "<script>\n" + js_safe(rd(m.group(1))) + "\n</script>"
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_script, html)
boot = "window.PD_VERSION=%s;window.PD_PACKS_BUILTIN=%s;" % (json.dumps(VERSION), json.dumps(packs, ensure_ascii=False))
html = html.replace("<script>\n", "<script>\n" + js_safe(boot) + "\n", 1)
mermaid = js_safe(rd("vendor/mermaid.min.js"))
html = html.replace("</body>", '<script type="text/plain" id="pd-mermaid-src">' + mermaid + "</script>\n</body>")
html = html.replace("<title>Professore Digitale</title>", "<title>Professore Digitale (versione portatile)</title>")
assert 'src="js/' not in html and 'href="css/' not in html
open(out, "w", encoding="utf-8").write(html)
print("creato", out, "%.1f MB" % (os.path.getsize(out) / 1e6))
