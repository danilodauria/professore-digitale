#!/usr/bin/env python3
"""Genera il file AppStream (metainfo) con l'elenco delle versioni preso da packaging/changelog.
Uso: metainfo.py modello.xml changelog > risultato.xml   —   Autore: Danilo D'Auria - Licenza MIT"""
import re, sys
from email.utils import parsedate_to_datetime
from xml.sax.saxutils import escape
tpl = open(sys.argv[1], encoding="utf-8").read()
log = open(sys.argv[2], encoding="utf-8").read()
releases = []
for block in re.split(r"\n(?=\S)", log.strip()):
    m = re.match(r"^\S+ \(([^)]+)\)", block)
    d = re.search(r"^ -- .*?>  (.+)$", block, re.M)
    if not m or not d:
        continue
    items = [escape(re.sub(r"\s+", " ", x).strip()) for x in re.findall(r"^  \* (.+(?:\n    .+)*)", block, re.M)]
    date = parsedate_to_datetime(d.group(1)).strftime("%Y-%m-%d")
    desc = "".join("<li>%s</li>" % i for i in items[:12])
    releases.append('    <release version="%s" date="%s"><description><ul>%s</ul></description></release>' % (m.group(1), date, desc))
out = re.sub(r"<releases>.*?</releases>", "<releases>\n" + "\n".join(releases) + "\n  </releases>", tpl, flags=re.S)
sys.stdout.write(out)
