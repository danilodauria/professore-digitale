"""Professore Digitale - chiavi dei dizionari (uguali a chiave() di src/web/js/i18n.js) e testi di CONTENUTO
(lezioni, guida, pacchetti, quiz, domande di Nonni Teach) che non si traducono a mano. © Danilo D'Auria — codice MIT"""
import glob
import json
import os
import re
import subprocess

GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"]
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
RE_NUM = re.compile(r"\d+(?:[.,]\d+)?")
RE_GM = re.compile(r"\b(" + "|".join(GIORNI + MESI) + r")(?![A-Za-zÀ-ÿ])", re.I)


def chiave(t):
    t = RE_NUM.sub("#", " ".join(t.split()))
    return RE_GM.sub(lambda m: "@g" if m.group(1).lower() in GIORNI else "@m", t)


def segnaposti(s):
    return (s.count("#"), s.count("@g"), s.count("@m"))


def _stringhe(v, out):
    if isinstance(v, str):
        for pezzo in re.split(r"<[^>]*>|\n+|\*\*|\s\*|\*\s", v):
            pezzo = " ".join(pezzo.split()).strip(" -")
            if pezzo:
                out.add(pezzo)
        out.add(" ".join(v.split()))
    elif isinstance(v, dict):
        for x in v.values():
            _stringhe(x, out)
    elif isinstance(v, list):
        for x in v:
            _stringhe(x, out)


def contenuti(radice, piu=()):
    """Testi dei contenuti: pacchetti JSON e file data-lessons.js, data-kb.js, data-nonni.js (letti con Node)."""
    out = set()
    for f in glob.glob(os.path.join(radice, "src/contenuti/*.json")) + glob.glob(os.path.join(radice, "windows/contenuti/*.json")):
        _stringhe(json.load(open(f, encoding="utf-8")), out)
    script = ("global.window=global;global.PD={hooks:{}};global.document={addEventListener(){}};"
              "for(const f of process.argv.slice(1)){try{require(f)}catch(e){}}"
              "const o={};for(const k of Object.keys(global))if(/^PD_|^PD$/.test(k))o[k]=global[k];"
              "console.log(JSON.stringify(o,(k,v)=>typeof v==='function'?undefined:v))")
    files = [os.path.join(radice, "src/web/js", n) for n in ("data-lessons.js", "data-kb.js", "data-nonni.js") + tuple(piu)]
    try:
        r = subprocess.run(["node", "-e", script] + files, capture_output=True, text=True, timeout=60)
        _stringhe(json.loads(r.stdout or "{}"), out)
    except (OSError, ValueError):
        pass
    return out
