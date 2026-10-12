# -*- coding: utf-8 -*-
# ==============================================================================
#  Professore Digitale - Pacchetti di contenuti (domande e lezioni aggiuntive)
#  Autore: Danilo D'Auria - Licenza MIT
#
#  Un pacchetto di contenuti e' un file JSON (con chiavi in italiano) che
#  aggiunge domande alla guida interna e/o nuove lezioni, SENZA reinstallare
#  il programma. Viene letto da:
#    /usr/share/professore-digitale/contenuti/*.json   (installati col .deb)
#    ~/.local/share/professore-digitale/contenuti/*.json (importati dall'utente)
#  A parita' di "id" vince il pacchetto dell'utente.
# ==============================================================================
import json
import os
import re

FORMATO = "professore-digitale-contenuti"
FORMATO_VERSIONE = 1
MAX_BYTES = 2 * 1024 * 1024
RE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}$")
RE_VER = re.compile(r"^\d+\.\d+(\.\d+)?$")
PALESTRA = ("click", "dblclick", "drag", "typing", "scroll", "rightclick", "copypaste", "select", "keys", "memory", "scam")

MODELLO = {
    "formato": FORMATO,
    "formato_versione": FORMATO_VERSIONE,
    "id": "mie-domande",
    "titolo": "Le mie domande aggiuntive",
    "versione": "1.0.0",
    "autore": "Nome Cognome",
    "licenza": "CC BY-NC-SA 4.0",
    "descrizione": "Domande e lezioni preparate per il nostro gruppo.",
    "richiede_app": "2.1.0",
    "suggerimenti": ["Come stampo un documento?"],
    "domande": [
        {
            "domanda": "Come stampo un documento?",
            "parole_chiave": ["stampare", "stampa", "stampante", "ctrl p"],
            "risposta": "1. Aprite il documento.\n2. Premete **Ctrl + P**.\n3. Scegliete la stampante e premete **Stampa**.",
            "schema": "flowchart LR\n  A[\"Apro il documento\"] --> B[\"Ctrl + P\"] --> C[\"Stampa\"]",
            "lezione": ""
        }
    ],
    "lezioni": [
        {
            "id": "stampare",
            "icona": "🖨️",
            "titolo": "Stampare un documento",
            "livello": "Extra",
            "minuti": 10,
            "obiettivo": "Stampare una lettera o una foto.",
            "palestra": "",
            "passi": [
                {"titolo": "La stampante", "testo": "La **stampante** trasforma il documento in un foglio di carta.",
                 "schema": "", "consiglio": "Controllate che sia accesa e abbia carta."}
            ],
            "quiz": [
                {"domanda": "Quale scorciatoia apre la finestra di stampa?", "opzioni": ["Ctrl + P", "Ctrl + S"],
                 "corretta": 0, "spiegazione": "P come Print, cioè stampa."}
            ]
        }
    ]
}


def versione_tupla(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v))[:3]) + (0,) * (3 - len(re.findall(r"\d+", str(v))[:3]))


class Errori(object):
    def __init__(self):
        self.lista = []

    def add(self, dove, msg):
        if len(self.lista) < 50:
            self.lista.append("%s: %s" % (dove, msg))


def _testo(e, obj, chiave, dove, obbl=True, maxlen=5000):
    v = obj.get(chiave)
    if v is None or v == "":
        if obbl:
            e.add(dove + "." + chiave, "manca")
        return ""
    if not isinstance(v, str):
        e.add(dove + "." + chiave, "deve essere un testo")
        return ""
    if len(v) > maxlen:
        e.add(dove + "." + chiave, "troppo lungo (max %d caratteri)" % maxlen)
    return v


def valida(pack, versione_app=None):
    """Controlla un pacchetto (dict). Restituisce la lista degli errori (vuota = valido)."""
    e = Errori()
    if not isinstance(pack, dict):
        return ["il file non contiene un oggetto JSON"]
    if pack.get("formato") != FORMATO:
        e.add("formato", "deve essere \"%s\"" % FORMATO)
    if pack.get("formato_versione") != FORMATO_VERSIONE:
        e.add("formato_versione", "deve essere %d" % FORMATO_VERSIONE)
    pid = pack.get("id")
    if not isinstance(pid, str) or not RE_ID.match(pid):
        e.add("id", "solo lettere minuscole, cifre e trattini (2-49 caratteri)")
    _testo(e, pack, "titolo", "pacchetto", True, 120)
    ver = pack.get("versione")
    if not isinstance(ver, str) or not RE_VER.match(ver):
        e.add("versione", "formato atteso tipo 1.0.0")
    for k in ("autore", "descrizione"):
        _testo(e, pack, k, "pacchetto", False, 600)
    _testo(e, pack, "licenza", "pacchetto", False, 200)   # dalla 3.5.2, es. "CC BY-NC-SA 4.0"
    req = pack.get("richiede_app")
    if req not in (None, ""):
        if not isinstance(req, str) or not RE_VER.match(req):
            e.add("richiede_app", "formato atteso tipo 2.1.0")
        elif versione_app and versione_tupla(req) > versione_tupla(versione_app):
            e.add("richiede_app", "serve il Professore Digitale %s o successivo (installato: %s)" % (req, versione_app))
    sug = pack.get("suggerimenti", [])
    if not isinstance(sug, list) or len(sug) > 40 or not all(isinstance(s, str) and 0 < len(s) <= 120 for s in sug):
        e.add("suggerimenti", "elenco di testi brevi (max 40)")

    domande = pack.get("domande", [])
    lezioni = pack.get("lezioni", [])
    if not isinstance(domande, list):
        e.add("domande", "deve essere un elenco"); domande = []
    if not isinstance(lezioni, list):
        e.add("lezioni", "deve essere un elenco"); lezioni = []
    prove = pack.get("prove", [])
    if not isinstance(prove, list):
        e.add("prove", "deve essere un elenco"); prove = []
    if not domande and not lezioni and not prove:
        e.add("pacchetto", "serve almeno una domanda, una lezione o una prova")
    if len(prove) > 20:
        e.add("prove", "troppe (max 20)")
    if len(domande) > 2000:
        e.add("domande", "troppe (max 2000)")
    if len(lezioni) > 200:
        e.add("lezioni", "troppe (max 200)")

    for i, d in enumerate(domande[:2000]):
        dove = "domande[%d]" % i
        if not isinstance(d, dict):
            e.add(dove, "deve essere un oggetto"); continue
        _testo(e, d, "domanda", dove, True, 300)
        _testo(e, d, "risposta", dove, True, 5000)
        _testo(e, d, "schema", dove, False, 3000)
        _testo(e, d, "lezione", dove, False, 60)
        pk = d.get("parole_chiave")
        if not isinstance(pk, list) or not pk or not all(isinstance(x, str) and 0 < len(x) <= 60 for x in pk) or len(pk) > 40:
            e.add(dove + ".parole_chiave", "elenco di 1-40 parole o brevi frasi")

    ids = set()
    for i, L in enumerate(lezioni[:200]):
        dove = "lezioni[%d]" % i
        if not isinstance(L, dict):
            e.add(dove, "deve essere un oggetto"); continue
        lid = L.get("id")
        if not isinstance(lid, str) or not RE_ID.match(lid):
            e.add(dove + ".id", "solo lettere minuscole, cifre e trattini")
        elif lid in ids:
            e.add(dove + ".id", "ripetuto")
        ids.add(lid)
        _testo(e, L, "titolo", dove, True, 120)
        _testo(e, L, "obiettivo", dove, False, 400)
        _testo(e, L, "livello", dove, False, 40)
        _testo(e, L, "icona", dove, False, 16)
        m = L.get("minuti", 15)
        if not isinstance(m, int) or not 1 <= m <= 240:
            e.add(dove + ".minuti", "numero intero tra 1 e 240")
        if L.get("palestra") not in (None, "") + PALESTRA:
            e.add(dove + ".palestra", "uno tra: " + ", ".join(PALESTRA))
        passi = L.get("passi")
        if not isinstance(passi, list) or not 1 <= len(passi) <= 30:
            e.add(dove + ".passi", "elenco di 1-30 passi"); passi = []
        for j, p in enumerate(passi):
            dp = "%s.passi[%d]" % (dove, j)
            if not isinstance(p, dict):
                e.add(dp, "deve essere un oggetto"); continue
            _testo(e, p, "titolo", dp, True, 120)
            _testo(e, p, "testo", dp, True, 5000)
            _testo(e, p, "schema", dp, False, 3000)
            _testo(e, p, "consiglio", dp, False, 400)
        quiz = L.get("quiz", [])
        if not isinstance(quiz, list) or len(quiz) > 20:
            e.add(dove + ".quiz", "elenco di al massimo 20 domande"); quiz = []
        for j, q in enumerate(quiz):
            dq = "%s.quiz[%d]" % (dove, j)
            if not isinstance(q, dict):
                e.add(dq, "deve essere un oggetto"); continue
            _testo(e, q, "domanda", dq, True, 300)
            _testo(e, q, "spiegazione", dq, True, 600)
            op = q.get("opzioni")
            if not isinstance(op, list) or not 2 <= len(op) <= 6 or not all(isinstance(x, str) and x for x in op):
                e.add(dq + ".opzioni", "elenco di 2-6 risposte"); op = []
            c = q.get("corretta")
            if not isinstance(c, int) or isinstance(c, bool) or not (0 <= c < max(1, len(op))):
                e.add(dq + ".corretta", "numero della risposta giusta, contando da 0")
    pids = set()
    for i, P in enumerate(prove[:20]):
        dove = "prove[%d]" % i
        if not isinstance(P, dict):
            e.add(dove, "deve essere un oggetto"); continue
        pid_ = P.get("id")
        if not isinstance(pid_, str) or not RE_ID.match(pid_):
            e.add(dove + ".id", "solo lettere minuscole, cifre e trattini")
        elif pid_ in pids:
            e.add(dove + ".id", "ripetuto")
        pids.add(pid_)
        _testo(e, P, "titolo", dove, True, 120)
        _testo(e, P, "icona", dove, False, 16)
        _testo(e, P, "descrizione", dove, False, 600)
        _testo(e, P, "attestato", dove, False, 120)
        n = P.get("domande_per_prova", 20)
        if not isinstance(n, int) or isinstance(n, bool) or not 5 <= n <= 100:
            e.add(dove + ".domande_per_prova", "numero intero tra 5 e 100")
        sg = P.get("soglia", 0.7)
        if not isinstance(sg, (int, float)) or isinstance(sg, bool) or not 0.5 <= sg <= 1:
            e.add(dove + ".soglia", "numero tra 0.5 e 1 (es. 0.7 = 70%)")
        dd = P.get("domande")
        if not isinstance(dd, list) or not 5 <= len(dd) <= 1000:
            e.add(dove + ".domande", "elenco di 5-1000 domande"); dd = []
        for j, q in enumerate(dd):
            dq = "%s.domande[%d]" % (dove, j)
            if not isinstance(q, dict):
                e.add(dq, "deve essere un oggetto"); continue
            _testo(e, q, "domanda", dq, True, 300)
            _testo(e, q, "spiegazione", dq, True, 600)
            _testo(e, q, "categoria", dq, False, 60)
            op = q.get("opzioni")
            if not isinstance(op, list) or not 2 <= len(op) <= 6 or not all(isinstance(x, str) and x for x in op):
                e.add(dq + ".opzioni", "elenco di 2-6 risposte"); op = []
            c = q.get("corretta")
            if not isinstance(c, int) or isinstance(c, bool) or not (0 <= c < max(1, len(op))):
                e.add(dq + ".corretta", "numero della risposta giusta, contando da 0")
    return e.lista


def leggi_file(path, versione_app=None):
    """Legge e valida un file. Restituisce (pack, errori)."""
    try:
        if os.path.getsize(path) > MAX_BYTES:
            return None, ["file troppo grande (max 2 MB)"]
        with open(path, "r", encoding="utf-8") as f:
            pack = json.load(f)
    except (OSError, ValueError) as ex:
        return None, ["JSON non leggibile: %s" % ex]
    return pack, valida(pack, versione_app)


def carica_tutti(cartelle, versione_app=None):
    """cartelle = [(origine, percorso), ...] in ordine di priorita' crescente.
    Restituisce (elenco_pacchetti, errori). A parita' di id vince la versione piu' alta;
    a parita' di versione vince l'ultima cartella (l'utente puo' sostituire, non retrocedere)."""
    per_id, ordine, errori = {}, [], []
    for origine, cartella in cartelle:
        try:
            nomi = sorted(n for n in os.listdir(cartella) if n.endswith(".json"))
        except OSError:
            continue
        for n in nomi:
            path = os.path.join(cartella, n)
            pack, err = leggi_file(path, versione_app)
            if err:
                errori.append({"file": path, "errori": err[:10]})
                continue
            prec = per_id.get(pack["id"])
            if prec is None:
                ordine.append(pack["id"])
            elif versione_tupla(pack["versione"]) < versione_tupla(prec["pacchetto"]["versione"]):
                continue
            per_id[pack["id"]] = {"origine": origine, "file": path, "pacchetto": pack}
    return [per_id[i] for i in ordine], errori


def salva(pack, cartella):
    os.makedirs(cartella, exist_ok=True)
    path = os.path.join(cartella, pack["id"] + ".json")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
    return path
