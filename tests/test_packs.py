#!/usr/bin/env python3
"""Test del formato dei pacchetti di contenuti: validatore Python e parità con quello del browser."""
import copy, glob, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src", "server"))
import pd_packs
ok = True
def check(nome, cond, det=""):
    global ok
    print(("  OK  " if cond else "  FAIL") + " " + nome + ("" if cond else "  -> %s" % det))
    ok = ok and cond
good = json.load(open(os.path.join(ROOT, "tests", "dati", "pacchetto-prova.json"), encoding="utf-8"))
check("pacchetto di prova valido", pd_packs.valida(good) == [], pd_packs.valida(good))
check("modello valido", pd_packs.valida(pd_packs.MODELLO) == [], pd_packs.valida(pd_packs.MODELLO))
for f in glob.glob(os.path.join(ROOT, "src", "contenuti", "*.json")):
    p = json.load(open(f, encoding="utf-8"))
    check("contenuti inclusi validi: " + os.path.basename(f), pd_packs.valida(p) == [], pd_packs.valida(p)[:5])
cases = []
def mut(desc, fn):
    p = copy.deepcopy(good); fn(p); cases.append((desc, p))
mut("id non valido", lambda p: p.update(id="Con Spazi"))
mut("formato errato", lambda p: p.update(formato="altro"))
mut("versione errata", lambda p: p.update(versione="uno"))
mut("senza contenuti", lambda p: p.update(domande=[], lezioni=[]))
mut("parole chiave vuote", lambda p: p["domande"][0].update(parole_chiave=[]))
mut("risposta mancante", lambda p: p["domande"][0].pop("risposta"))
mut("quiz corretta fuori scala", lambda p: p["lezioni"][0]["quiz"][0].update(corretta=5))
mut("quiz corretta booleana", lambda p: p["lezioni"][0]["quiz"][0].update(corretta=True))
mut("palestra sconosciuta", lambda p: p["lezioni"][0].update(palestra="salto"))
mut("lezione senza passi", lambda p: p["lezioni"][0].update(passi=[]))
mut("richiede versione futura", lambda p: p.update(richiede_app="99.0.0"))
for desc, p in cases:
    err = pd_packs.valida(p, "2.1.0")
    check("rifiutato: " + desc, len(err) > 0)
# parità con il validatore JavaScript del browser
js = """
global.window = {}; window.PD = {version: '2.1.0', api: null};
require(process.argv[1] + '/src/web/js/packs.js');
const cases = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(cases.map(c => window.PD.packs.validate(c).length > 0)));
"""
payload = json.dumps([good, pd_packs.MODELLO] + [p for _, p in cases])
r = subprocess.run(["node", "-e", js, ROOT], input=payload.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
res = json.loads(r.stdout.decode() or "[]")
py = [False, False] + [True] * len(cases)
check("stesso verdetto in Python e JavaScript (%d casi)" % len(py), res == py, (res, r.stderr.decode()[:300]))
print("RISULTATO pacchetti:", "OK" if ok else "ERRORI")
sys.exit(0 if ok else 1)
