#!/usr/bin/env python3
"""Prepara la pubblicazione su GitHub partendo da dist/pubblica/.

GitHub non accetta file oltre i 100 MB né nel repository né nel sito (GitHub Pages), e i nostri
installatori pesano più di 200 MB. Per questo:
  - i file grandi (installatore .exe, pacchetto .deb, versione da chiavetta .zip) vanno nella
    «Release» della versione su GitHub (fino a 2 GB per file);
  - tutto il resto (aggiornamenti.json, pagina, app per telefono, contenuti, vademecum) diventa
    sito-X.Y.Z.zip, che si allega alla stessa Release: il workflow .github/workflows/pubblica-sito.yml
    lo pubblica da solo su GitHub Pages.
aggiornamenti.json e la pagina del sito puntano ai file grandi nella Release (indirizzi assoluti),
con le stesse impronte SHA-256: il controllo degli aggiornamenti nel programma funziona come prima.

Uso: prepara-github.py CARTELLA_PUBBLICA PAGINA_PROGETTO BASE_URL USCITA
Crea USCITA/rilascio-X.Y.Z/ (i file da trascinare nella Release, più PUBBLICA-RELEASE.bat che li carica da Windows). Autore: Danilo D'Auria - Licenza MIT"""
import json, os, shutil, sys, zipfile

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
import make_sito  # noqa: E402

LIMITE_SITO = 95 * 1000 * 1000      # margine sotto i 100 MB di GitHub


def scrivi_pubblica_release(rel, progetto):
    """PUBBLICA-RELEASE.bat: da Windows crea la Release e carica i file con GitHub CLI, senza il sito (dalla 3.6.0)."""
    repo = "/".join(progetto.rstrip("/").split("/")[-2:])          # https://github.com/UTENTE/REPO -> UTENTE/REPO
    testo = open(os.path.join(QUI, "github", "PUBBLICA-RELEASE.bat"), encoding="utf-8", newline="").read()
    with open(os.path.join(rel, "PUBBLICA-RELEASE.bat"), "w", encoding="utf-8", newline="") as f:
        f.write(testo.replace("__REPO__", repo))


def prepara(pub, progetto, base_url, uscita):
    info = json.load(open(os.path.join(pub, "aggiornamenti.json"), encoding="utf-8"))
    ver = info["versione"]
    rel_url = progetto.rstrip("/") + "/releases/download/v%s/" % ver
    rel = os.path.join(uscita, "rilascio-%s" % ver)
    sito = os.path.join(uscita, "sito")
    shutil.rmtree(uscita, ignore_errors=True)
    os.makedirs(rel)
    shutil.copytree(pub, sito)
    shutil.rmtree(os.path.join(sito, "apt"), ignore_errors=True)   # il repository APT non entra in GitHub Pages
    grandi = [info["pacchetto"]]
    if "windows" in info:
        grandi += [info["windows"]["pacchetto"], info["windows"]["zip"]]
    if "mac" in info:
        grandi.append(info["mac"]["pacchetto"])
    info["pacchetto"] = rel_url + info["pacchetto"]
    if "windows" in info:
        info["windows"]["pacchetto"] = rel_url + info["windows"]["pacchetto"]
        info["windows"]["zip"] = rel_url + info["windows"]["zip"]
    if "mac" in info:
        info["mac"]["pacchetto"] = rel_url + info["mac"]["pacchetto"]
    json.dump(info, open(os.path.join(sito, "aggiornamenti.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    make_sito.crea_pagina(sito, base_url, progetto)          # i file ci sono ancora: servono per le dimensioni
    for g in grandi:
        shutil.move(os.path.join(sito, g), os.path.join(rel, g))
    open(os.path.join(sito, ".nojekyll"), "w").close()
    troppo = [os.path.relpath(os.path.join(r, f), sito) for r, _, fs in os.walk(sito) for f in fs
              if os.path.getsize(os.path.join(r, f)) > LIMITE_SITO]
    if troppo:
        sys.exit("✘ file troppo grandi per GitHub Pages: " + ", ".join(troppo))
    zp = os.path.join(rel, "sito-%s.zip" % ver)
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for r, _, fs in os.walk(sito):
            for f in sorted(fs):
                p = os.path.join(r, f)
                z.write(p, os.path.relpath(p, sito))
    shutil.copy(os.path.join(pub, "NOTE-%s.md" % ver), os.path.join(rel, "NOTE-%s.md" % ver))
    scrivi_pubblica_release(rel, progetto)
    shutil.rmtree(sito)
    return rel, sorted(os.listdir(rel))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__.split("\n\n")[-1])
    rel, files = prepara(*sys.argv[1:])
    print("✔ Pronto per GitHub:", rel)
    for f in files:
        print("   ", f, "(%.1f MB)" % (os.path.getsize(os.path.join(rel, f)) / 1e6))
