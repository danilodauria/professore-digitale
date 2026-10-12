#!/usr/bin/env python3
"""Professore Digitale - scrive autore e licenza dentro le immagini del progetto (dalla 3.5.2).

Le immagini (icone, personaggio, schermate dei vademecum, copertina) sono contenuti di Danilo D'Auria con
licenza CC BY-NC-SA 4.0. Questo script aggiunge i metadati SENZA ricomprimere i pixel:
  - PNG: blocchi tEXt  Author / Copyright / License / Source
  - JPEG: un segmento di commento (COM) subito dopo l'inizio del file
  - SVG: <metadata> con RDF Creative Commons + commento
È idempotente (salta i file che hanno già i metadati). BMP e ICO non hanno metadati: li copre LICENZE.txt.

Uso:  tools/licenza-immagini.py [--controlla] [CARTELLE O FILE ...]
      senza argomenti tratta le cartelle del progetto. Con --controlla non scrive nulla ed esce con 1
      se qualche immagine non ha la licenza (lo usa tests/test_licenza.py).
Autore: Danilo D'Auria - Codice MIT, contenuti CC BY-NC-SA 4.0"""
import os
import struct
import sys
import zlib

AUTORE = "Danilo D'Auria"
COPYRIGHT = "(c) 2026 Danilo D'Auria - Professore Digitale, un progetto FeniceOS"
LICENZA = "CC BY-NC-SA 4.0 - https://creativecommons.org/licenses/by-nc-sa/4.0/"
FONTE = "https://danilodauria.github.io/professore-digitale/"
SEGNO = "CC BY-NC-SA 4.0"
CARTELLE = ["src/web/img", "docs/sorgenti", "tools/pwa"]
ESTENSIONI = (".png", ".jpg", ".jpeg", ".svg")


def _chunk(tipo, dati):
    return struct.pack(">I", len(dati)) + tipo + dati + struct.pack(">I", zlib.crc32(tipo + dati) & 0xFFFFFFFF)


def png(b):
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("non è un PNG")
    if SEGNO.encode() in b:
        return None
    # dopo IHDR (primo blocco): 8 firma + 4 lunghezza + 4 tipo + 13 dati + 4 crc
    n = struct.unpack(">I", b[8:12])[0]
    fine_ihdr = 8 + 12 + n
    testo = b"".join(_chunk(b"tEXt", k.encode("latin-1") + b"\0" + v.encode("latin-1")) for k, v in
                     (("Author", AUTORE), ("Copyright", COPYRIGHT), ("License", LICENZA), ("Source", FONTE)))
    return b[:fine_ihdr] + testo + b[fine_ihdr:]


def jpeg(b):
    if b[:2] != b"\xff\xd8":
        raise ValueError("non è un JPEG")
    if SEGNO.encode() in b[:4096]:
        return None
    nota = ("%s. Licenza %s. %s" % (COPYRIGHT, LICENZA, FONTE)).encode("utf-8")
    return b[:2] + b"\xff\xfe" + struct.pack(">H", len(nota) + 2) + nota + b[2:]


def svg(b):
    t = b.decode("utf-8")
    if SEGNO in t:
        return None
    i = t.find("<svg")
    j = t.find(">", i)
    if i < 0 or j < 0:
        raise ValueError("non è un SVG")
    meta = ('<!-- %s. Contenuto con licenza %s. %s -->' % (COPYRIGHT, LICENZA, FONTE) +
            '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cc="http://creativecommons.org/ns#" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/"><cc:Work rdf:about=""><dc:creator>%s</dc:creator><dc:rights>%s</dc:rights>'
            '<cc:license rdf:resource="https://creativecommons.org/licenses/by-nc-sa/4.0/"/></cc:Work></rdf:RDF></metadata>'
            % (AUTORE.replace("'", "&#39;"), COPYRIGHT.replace("'", "&#39;")))
    return (t[:j + 1] + meta + t[j + 1:]).encode("utf-8")


def tratta(percorso, controlla):
    ext = os.path.splitext(percorso)[1].lower()
    with open(percorso, "rb") as f:
        b = f.read()
    nuovo = png(b) if ext == ".png" else jpeg(b) if ext in (".jpg", ".jpeg") else svg(b)
    if nuovo is None:
        return "ok"
    if controlla:
        return "manca"
    with open(percorso, "wb") as f:
        f.write(nuovo)
    return "scritto"


def main(argv):
    controlla = "--controlla" in argv
    voci = [a for a in argv if a != "--controlla"]
    radice = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not voci:
        voci = [os.path.join(radice, c) for c in CARTELLE]
    file = []
    for v in voci:
        if os.path.isdir(v):
            for d, _, nomi in os.walk(v):
                file += [os.path.join(d, n) for n in sorted(nomi) if n.lower().endswith(ESTENSIONI)]
        elif v.lower().endswith(ESTENSIONI):
            file.append(v)
    conti = {"ok": 0, "scritto": 0, "manca": 0}
    mancano = []
    for p in sorted(file):
        r = tratta(p, controlla)
        conti[r] += 1
        if r == "manca":
            mancano.append(os.path.relpath(p, radice))
    if controlla:
        if mancano:
            print("Immagini senza licenza:\n  " + "\n  ".join(mancano))
            return 1
        print("✔ %d immagini con autore e licenza" % conti["ok"])
        return 0
    print("✔ licenza scritta in %d immagini (%d l'avevano già)" % (conti["scritto"], conti["ok"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
