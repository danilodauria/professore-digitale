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
# indirizzi consentiti per gli aggiornamenti (https ovunque, http solo in rete locale)
import pd_server
casi = {"https://x.github.io/a.json": True, "http://192.168.1.10:8080/aggiornamenti.json": True, "http://10.0.0.5/x": True,
        "http://172.20.1.1/x": True, "http://aula.local:8080/x": True, "http://127.0.0.1:8/x": True,
        "http://172.40.1.1/x": False, "http://8.8.8.8/x": False, "http://example.com/x": False,
        "http://192.168.1.1.evil.com/x": False, "ftp://192.168.1.1/x": False, "file:///etc/passwd": False}
sbagliati = {u: v for u, v in casi.items() if bool(pd_server.url_consentito(u)) != v}
check("indirizzi di aggiornamento consentiti (%d casi)" % len(casi), not sbagliati, sbagliati)
# precedenza tra pacchetti con lo stesso id: vince la versione piu' alta
import tempfile
with tempfile.TemporaryDirectory() as t:
    a, b = os.path.join(t, "a"), os.path.join(t, "b"); os.makedirs(a); os.makedirs(b)
    p1 = copy.deepcopy(good); p1["versione"] = "1.2.0"; json.dump(p1, open(os.path.join(a, "p.json"), "w"))
    p2 = copy.deepcopy(good); p2["versione"] = "1.0.0"; json.dump(p2, open(os.path.join(b, "p.json"), "w"))
    lst, _ = pd_packs.carica_tutti([("sistema", a), ("utente", b)])
    check("pacchetto più vecchio dell'utente non sostituisce quello nuovo", lst[0]["pacchetto"]["versione"] == "1.2.0")
    p2["versione"] = "1.3.0"; json.dump(p2, open(os.path.join(b, "p.json"), "w"))
    lst, _ = pd_packs.carica_tutti([("sistema", a), ("utente", b)])
    check("pacchetto più nuovo dell'utente sostituisce quello incluso", lst[0]["pacchetto"]["versione"] == "1.3.0" and lst[0]["origine"] == "utente")
print("RISULTATO pacchetti:", "OK" if ok else "ERRORI")
sys.exit(0 if ok else 1)
