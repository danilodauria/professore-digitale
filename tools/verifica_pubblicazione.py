#!/usr/bin/env python3
"""Verifica una cartella da pubblicare: impronte in SHA256SUMS e coerenza con aggiornamenti.json.
Uso: verifica_pubblicazione.py CARTELLA   -> stampa la versione, esce con 1 se qualcosa non torna.
Autore: Danilo D'Auria - Licenza MIT"""
import hashlib, json, os, sys
d = sys.argv[1]
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
try:
    info = json.load(open(os.path.join(d, "aggiornamenti.json"), encoding="utf-8"))
except (OSError, ValueError) as e:
    sys.exit("✘ aggiornamenti.json mancante o non valido: %s" % e)
somme = os.path.join(d, "SHA256SUMS")
if os.path.isfile(somme):
    for riga in open(somme, encoding="utf-8"):
        if not riga.strip():
            continue
        h, nome = riga.split(None, 1); nome = nome.strip().lstrip("*")
        if nome == "aggiornamenti.json":
            continue   # viene riscritto da pubblica-contenuti.sh
        p = os.path.join(d, nome)
        if not os.path.isfile(p) or sha(p) != h:
            sys.exit("✘ %s: file mancante o danneggiato" % nome)
def chk(rel, h):
    p = os.path.join(d, rel)
    if not os.path.isfile(p) or sha(p) != h:
        sys.exit("✘ %s non corrisponde ad aggiornamenti.json" % rel)
chk(info["pacchetto"], info["sha256"])
if "windows" in info:
    chk(info["windows"]["pacchetto"], info["windows"]["sha256"])
    chk(info["windows"]["zip"], info["windows"]["zip_sha256"])
if "catalogo_ia" in info:
    chk(info["catalogo_ia"]["url"], info["catalogo_ia"]["sha256"])
for c in info.get("contenuti", []):
    chk(c["url"], c["sha256"])
print(info["versione"])
