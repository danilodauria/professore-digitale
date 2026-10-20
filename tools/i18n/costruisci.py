#!/usr/bin/env python3
"""Professore Digitale — costruisce i dizionari dell'interfaccia src/web/i18n/<lingua>.json (dalla 3.7)
dai lotti tradotti a mano tools/i18n/t*.tsv (riga: indice<TAB>en<TAB>fr<TAB>es<TAB>de<TAB>ro; «=» = uguale all'italiano)
e da tools/i18n/extra.tsv (riga: italiano<TAB>en<TAB>fr<TAB>es<TAB>de<TAB>ro) per i testi aggiunti dopo.
Le chiavi sono i testi italiani normalizzati di lista.json (numeri → #, giorni → @g, mesi → @m), come chiave() in i18n.js.
I testi già tradotti nel Consulente Digitale (stesse frasi) si possono riprendere con --consulente CARTELLA.

© Danilo D'Auria — codice MIT; i dizionari prodotti sono contenuti CC BY-NC-SA 4.0.
Uso: python3 tools/i18n/costruisci.py
"""
import glob
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, QUI)
from chiavi import chiave, segnaposti  # noqa: E402

LINGUE = ["en", "fr", "es", "de", "ro"]
NOMI = {"en": "English", "fr": "Français", "es": "Español", "de": "Deutsch", "ro": "Română"}


def main():
    lista = [k for k, _ in json.load(open(os.path.join(QUI, "lista.json"), encoding="utf-8"))]
    diz = {l: {} for l in LINGUE}
    visti, problemi = set(), 0
    for f in sorted(glob.glob(os.path.join(QUI, "t*.tsv"))):
        for n, riga in enumerate(open(f, encoding="utf-8"), 1):
            riga = riga.rstrip("\n")
            if not riga.strip():
                continue
            parti = riga.split("\t")
            if len(parti) != 6:
                print("%s:%d colonne %d (servono 6)" % (os.path.basename(f), n, len(parti)))
                problemi += 1
                continue
            i = int(parti[0])
            it = lista[i]
            visti.add(i)
            for l, tr in zip(LINGUE, parti[1:]):
                tr = it if tr.strip() == "=" else chiave(tr.strip())
                if segnaposti(tr) != segnaposti(it):
                    print("%s:%d [%s] segnaposti diversi: %r → %r" % (os.path.basename(f), n, l, it, tr))
                    problemi += 1
                diz[l][it] = tr
    extra = os.path.join(QUI, "extra.tsv")
    if os.path.exists(extra):
        for n, riga in enumerate(open(extra, encoding="utf-8"), 1):
            parti = riga.rstrip("\n").split("\t")
            if len(parti) != 6:
                if riga.strip():
                    print("extra.tsv:%d colonne %d (servono 6)" % (n, len(parti)))
                    problemi += 1
                continue
            it = chiave(parti[0])
            for l, tr in zip(LINGUE, parti[1:]):
                tr = it if tr.strip() == "=" else chiave(tr.strip())
                if segnaposti(tr) != segnaposti(it):
                    print("extra.tsv:%d [%s] segnaposti diversi: %r → %r" % (n, l, it, tr))
                    problemi += 1
                diz[l][it] = tr
    mancano = [i for i in range(len(lista)) if i not in visti and lista[i] not in diz["en"]]
    if mancano:
        print("Testi senza traduzione: %d (es. %s)" % (len(mancano), mancano[:15]))
    cartella = os.path.join(RADICE, "src", "web", "i18n")
    os.makedirs(cartella, exist_ok=True)
    for l in LINGUE:
        uscita = {
            "meta": {
                "lingua": l, "nome": NOMI[l], "progetto": "Professore Digitale", "autore": "Danilo D'Auria",
                "licenza": "CC BY-NC-SA 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/",
                "nota": "Traduzione dell'interfaccia dall'italiano. Chiavi: testo italiano normalizzato (# numeri, @g giorni, @m mesi).",
            },
            "t": dict(sorted(diz[l].items())),
        }
        with open(os.path.join(cartella, l + ".json"), "w", encoding="utf-8") as fh:
            json.dump(uscita, fh, ensure_ascii=False, indent=0)
            fh.write("\n")
        print("%s: %d voci" % (l, len(diz[l])))
    return 1 if problemi else 0


if __name__ == "__main__":
    if "--consulente" in sys.argv:
        # riprende le traduzioni del Consulente Digitale per le frasi identiche → t000.tsv
        cd = sys.argv[sys.argv.index("--consulente") + 1]
        d = {l: json.load(open(os.path.join(cd, "src/web/i18n/%s.json" % l), encoding="utf-8"))["t"] for l in LINGUE}
        lista = [k for k, _ in json.load(open(os.path.join(QUI, "lista.json"), encoding="utf-8"))]
        with open(os.path.join(QUI, "t000.tsv"), "w", encoding="utf-8") as f:
            for i, k in enumerate(lista):
                if k in d["en"] and all(k in d[l] for l in LINGUE):
                    f.write("\t".join([str(i)] + [d[l][k] for l in LINGUE]) + "\n")
        sys.exit(0)
    sys.exit(main())
