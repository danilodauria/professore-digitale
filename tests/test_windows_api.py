#!/usr/bin/env python3
"""Test delle funzioni proprie della versione Windows (server nativo eseguito con Wine).
Uso: python3 tests/test_windows_api.py <url_base> <cartella_di_lavoro> <cartella_app>
Controlla: sicurezza Host/Origin, configurazione guidata (hardware, piano, catalogo), chiavetta offline
(verifica SHA-256, estrazione zip, file rovinati), motore compatibile in stile OpenAI (streaming),
programma del microfono, chiusura pulita. Autore: Danilo D'Auria - Licenza MIT"""
import hashlib, http.server, io, json, os, socketserver, subprocess, sys, threading, time, urllib.request, urllib.error, zipfile

BASE = sys.argv[1].rstrip("/"); WORK = sys.argv[2]; APP = sys.argv[3]
results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("  OK  " if cond else "  FAIL") + " " + name + ("  -> " + str(detail)[:400] if detail and not cond else ""))

def call(path, body=None, headers=None, raw=False):
    h = {"Content-Type": "application/json"} if body is not None else {}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=h, method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            b = r.read(); return r.status, (b if raw else json.loads(b.decode() or "{}"))
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b.decode())
        except ValueError: return e.code, b

def winpath(p): return "Z:" + p.replace("/", "\\")

def wait_job(timeout=120):
    t0 = time.time()
    while time.time() - t0 < timeout:
        _, p = call("/api/setup/progress")
        if p.get("finito"): return p
        time.sleep(0.5)
    return p

# --- sicurezza ---
st, _ = call("/api/status", headers={"Host": "evil.example:18993"})
check("Host estraneo rifiutato (403)", st == 403, st)
st, _ = call("/api/heartbeat", {}, headers={"Origin": "http://evil.example"})
check("Origin estranea rifiutata (403)", st == 403, st)
st, b = call("/../../../windows/win.ini", raw=True)
check("niente file fuori dall'interfaccia", st == 404, st)

with urllib.request.urlopen(BASE + "/") as r:
    csp = r.headers.get("Content-Security-Policy", "")
check("protezione della pagina (CSP) come su Linux", "default-src 'self'" in csp and "'unsafe-inline'" in csp and "object-src 'none'" in csp, csp)

# --- stato e configurazione guidata ---
st, s = call("/api/status")
check("stato: piattaforma Windows", st == 200 and s.get("platform") == "windows" and s.get("setup") is True, s)
check("stato: hardware riconosciuto", s["system"]["ram_mb"] > 0 and s["system"]["cpus"] > 0 and s["system"]["os"].startswith("Windows"), s["system"])
st, info = call("/api/setup/info")
check("configurazione: piano e catalogo", st == 200 and info["piano"]["motore"] in ("ollama", "compatibile", "nessuno") and info["catalogo"], info.get("piano"))
check("configurazione: modelli elencati con adattabilità", info["piano"]["motore"] == "nessuno" or
      (len(info["piano"]["modelli"]) >= 3 and any(m["consigliato"] for m in info["piano"]["modelli"])), info["piano"]["modelli"][:2])
check("configurazione: consiglio coerente con lo stato", s["ai"]["recommended"] == info["piano"]["modello"], (s["ai"]["recommended"], info["piano"]["modello"]))
st, e = call("/api/setup/start", {"modello": "modello-inventato; rm -rf", "motore": "compatibile"})
check("modello sconosciuto rifiutato", st == 400, e)
st, e = call("/api/setup/start", {})
check("richiesta vuota rifiutata", st == 400, e)

# --- chiavetta: installazione del microfono da un kit preparato qui ---
kit = os.path.join(WORK, "chiavetta", "ProfessoreDigitale-kit"); os.makedirs(kit, exist_ok=True)
zbuf = io.BytesIO()
with zipfile.ZipFile(zbuf, "w") as z:
    z.writestr("vosk-model-prova/am/final.mdl", b"x" * 5000, compress_type=zipfile.ZIP_DEFLATED)
    z.writestr("vosk-model-prova/conf/model.conf", b"--sample-frequency=16000\n", compress_type=zipfile.ZIP_STORED)
    z.writestr("vosk-model-prova/README", "modello finto per i test\n" * 50, compress_type=zipfile.ZIP_DEFLATED)
open(os.path.join(kit, "vosk.zip"), "wb").write(zbuf.getvalue())
sha = hashlib.sha256(zbuf.getvalue()).hexdigest()
json.dump({"formato": "professore-digitale-kit", "formato_versione": 1, "app": s["version"],
           "elementi": [{"tipo": "vosk", "file": "vosk.zip", "sha256": sha}]}, open(os.path.join(kit, "kit.json"), "w"))
st, r = call("/api/setup/kit-install", {"cartella": winpath(os.path.dirname(kit))})
check("chiavetta: installazione avviata", st == 200, r)
p = wait_job()
check("chiavetta: verifica SHA-256 ed estrazione", p.get("riuscito") is True, p)
check("modello vocale al suo posto", os.path.isfile(os.path.join(WORK, "dati", "locale", "models", "vosk-it", "conf", "model.conf")))
st, s2 = call("/api/status")
check("microfono risulta configurato", s2["stt"]["engine"] == "vosk", s2["stt"])
# kit rovinato: l'impronta non torna
open(os.path.join(kit, "vosk.zip"), "ab").write(b"rovinato")
for _ in range(40):   # se il lavoro precedente sta ancora chiudendo, si riprova
    st, r = call("/api/setup/kit-install", {"cartella": winpath(kit)})
    if st != 409: break
    time.sleep(0.5)
time.sleep(0.5)
p = wait_job()
check("chiavetta rovinata rifiutata", p.get("riuscito") is False and "rovinato" in p.get("errore", ""), p.get("errore"))
st, r = call("/api/setup/kit-install", {"cartella": winpath(WORK)})
p = wait_job()
check("cartella senza kit: spiegazione chiara", p.get("riuscito") is False and "kit.json" in p.get("errore", ""), p.get("errore"))
st, r = call("/api/setup/remove", {"cosa": "microfono"})
st, s3 = call("/api/status")
check("rimozione del microfono", st == 200 and not s3["stt"]["engine"], s3["stt"])

# --- programma del microfono (64 bit) ---
try:
    out = subprocess.run(["wine", os.path.join(APP, "stt", "pd-stt.exe"), "--probe", "--models", winpath(os.path.join(WORK, "vuoto"))],
                         capture_output=True, text=True, timeout=60).stdout.strip()
    check("pd-stt.exe risponde (senza modello)", json.loads(out.splitlines()[-1]).get("engine", "x") is None, out)
except Exception as ex:
    check("pd-stt.exe risponde (senza modello)", False, ex)

# --- motore compatibile (API in stile OpenAI, come KoboldCpp) con un finto server ---
class SSE(http.server.BaseHTTPRequestHandler):
    last = {}
    def log_message(self, *a): pass
    def do_GET(self):
        b = b'{"object":"list","data":[{"id":"koboldcpp/prova"}]}'
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); SSE.last = json.loads(self.rfile.read(n))
        self.send_response(200); self.send_header("Content-Type", "text/event-stream"); self.end_headers()
        for t in ["Il mouse ", "è come ", "una mano ", "sul computer."]:
            self.wfile.write(("data: " + json.dumps({"choices": [{"delta": {"content": t}, "finish_reason": None}]}) + "\n\n").encode()); self.wfile.flush(); time.sleep(0.05)
        self.wfile.write(b"data: [DONE]\n\n")
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 18994), SSE); srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
conf = os.path.join(WORK, "dati", "locale", "ia.json")
json.dump({"motore": "compatibile", "modello": "gemma-3-1b", "titolo": "Gemma 3 · 1 miliardo", "exe": "", "gguf": "", "porta": 18994}, open(conf, "w"))
call("/api/stt-reprobe", {})
st, s4 = call("/api/status")
check("motore compatibile rilevato", s4["ai"]["available"] and s4["ai"]["engine"] == "compatibile" and s4["ai"]["models"] == ["Gemma 3 · 1 miliardo"], s4["ai"])
st, raw = call("/api/chat", {"model": "x", "messages": [{"role": "system", "content": "sii gentile"}, {"role": "user", "content": "cos'è il mouse?"}]}, raw=True)
lines = [json.loads(l) for l in raw.decode().splitlines() if l.strip()] if isinstance(raw, bytes) else []
text = "".join(l.get("t", "") for l in lines)
check("risposta in streaming dal motore compatibile", st == 200 and text == "Il mouse è come una mano sul computer." and lines[-1].get("done"), (st, lines[-3:]))
check("messaggi inoltrati al motore", SSE.last.get("stream") is True and SSE.last["messages"][1]["content"] == "cos'è il mouse?", SSE.last)
os.unlink(conf); call("/api/stt-reprobe", {})
srv.shutdown()
st, s5 = call("/api/status")
check("tornati a Ollama dopo la rimozione", s5["ai"]["engine"] == "ollama", s5["ai"])

# --- configurazione automatica con Ollama (finto): scarica il modello, prova la risposta, lo segna ---
pfx = os.environ.get("WINEPREFIX", os.path.expanduser("~/.wine"))
oll = os.path.join(pfx, "drive_c", "users", os.environ.get("USER", "root"), "AppData", "Local", "Programs", "Ollama")
os.makedirs(oll, exist_ok=True)
open(os.path.join(oll, "ollama.exe"), "wb").write(b"MZ finto")
st, r = call("/api/setup/start", {"motore": "ollama", "modello": "qwen3.5:4b", "microfono": False})
check("configurazione automatica avviata", st == 200, r)
seen_pct = False; t0 = time.time()
while time.time() - t0 < 120:
    _, pr = call("/api/setup/progress")
    if 0 < pr.get("percento", -1) < 100: seen_pct = True
    if pr.get("finito"): break
    time.sleep(0.05)
check("configurazione automatica riuscita", pr.get("riuscito") is True and pr.get("modello") == "qwen3.5:4b", pr)
check("avanzamento mostrato durante lo scaricamento", seen_pct or any("pronto" in l for l in pr.get("registro", [])), pr.get("registro"))
check("prova in italiano registrata", any("Il modello risponde" in l for l in pr.get("registro", [])), pr.get("registro"))
st, s6 = call("/api/status")
check("nuovo modello disponibile all'IA", "qwen3.5:4b" in s6["ai"]["models"], s6["ai"])
st, r = call("/api/setup/start", {"motore": "ollama", "modello": "qwen3.5:4b"})
_, pr2 = call("/api/setup/progress")
os.unlink(os.path.join(oll, "ollama.exe"))
wait_job()
call("/api/setup/remove", {"cosa": "ia"})

# --- dati: file rovinato trattato come assente, scrittura atomica ---
open(os.path.join(WORK, "dati", "board.json"), "w").write("{rovinato")
st, d = call("/api/data/board")
check("file di dati rovinato non blocca", st == 200 and d["value"] is None, d)
st, _ = call("/api/data/board", {"value": {"tratti": [1, 2, 3]}})
st, d = call("/api/data/board")
check("salvataggio dati", d["value"] == {"tratti": [1, 2, 3]}, d)
st, e = call("/api/data/segreti", {"value": 1})
check("chiave di dati sconosciuta rifiutata", st == 404, e)

# --- 3.0: voci, connessione, aula ---
st, s7 = call("/api/status")
voci = s7["tts"].get("voices", [])
check("voci: elenco con genere (voci naturali incluse)", isinstance(voci, list) and all("genere" in v for v in voci) and
      (not os.path.isdir(os.path.join(APP, "piper")) or {"m", "f"} <= set(v["genere"] for v in voci if v["motore"] == "piper")), voci)
if voci:
    st, wav = call("/api/tts", {"text": "Buongiorno", "voice": voci[-1]["id"]}, raw=True)
    check("sintesi con la voce scelta", st == 200 and wav[:4] == b"RIFF", st)
st, rete = call("/api/rete")
check("stato della connessione", st == 200 and isinstance(rete.get("online"), bool), rete)
st, a0 = call("/api/aula")
check("aula: stato iniziale", st == 200 and a0.get("ruolo") == "" and isinstance(a0.get("ips"), list), a0)
_, sett = call("/api/data/settings")
nuove = dict(sett.get("value") or {}, aulaRuolo="facilitatore", aulaCodice="2468", aulaNome="Aula di prova")
call("/api/data/settings", {"value": nuove})
st, a1 = call("/api/aula/applica", {})
check("aula: facilitatore in ascolto", a1.get("ruolo") == "facilitatore" and a1.get("in_ascolto") is True, a1)
def ciao(codice):
    req = urllib.request.Request("http://127.0.0.1:%d/aula/ciao" % a1.get("porta", 8766), headers={"Content-Type": "application/json"},
        data=json.dumps({"id": "pc-wine-1", "codice": codice, "pc": "PC-3", "utente": "Anna Bianchi", "versione": "3.0.0",
                         "progressi": {"lezioni_fatte": 2, "lezioni_totali": 15, "quiz": [{"titolo": "Quiz", "migliore": 90, "superata": True}]}}).encode())
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=10) as r: return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return e.code, None
    except OSError as e: return 0, str(e)
check("aula: codice sbagliato rifiutato", ciao("1111")[0] == 403)
code, risp = ciao("2468")
check("aula: allievo ricevuto", code == 200 and risp.get("nome") == "Aula di prova", (code, risp))
st, a2 = call("/api/aula")
cl = a2.get("clienti") or []
check("aula: allievo nel quadro", len(cl) == 1 and cl[0]["utente"] == "Anna Bianchi" and cl[0]["online"] and cl[0]["progressi"]["lezioni_fatte"] == 2, a2)
st, ann = call("/api/aula/annuncio", {"testo": "Pausa caffè"})
check("aula: messaggio a tutti", ann.get("annuncio", {}).get("testo") == "Pausa caffè", ann)
code, risp = ciao("2468")
check("aula: l'allievo riceve il messaggio", risp and risp.get("annuncio", {}).get("testo") == "Pausa caffè", risp)
# --- 3.3: mano alzata (stesse risposte di pd_aula.py) ---
def ciao_mano(cid, mano, utente="Anna Bianchi"):
    corpo = {"id": cid, "codice": "2468", "pc": "PC-3", "utente": utente, "versione": "3.3.0", "attivita": {"titolo": "Lezione: Il mouse (passo 3)"}}
    if mano is not None: corpo["mano"] = mano
    req = urllib.request.Request("http://127.0.0.1:%d/aula/ciao" % a1.get("porta", 8766), headers={"Content-Type": "application/json"}, data=json.dumps(corpo).encode())
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=10) as r: return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return e.code, None
def mano_di(cid):
    return ([c for c in (call("/api/aula")[1].get("clienti") or []) if c["id"] == cid] or [{}])[0].get("mano")
da = int(time.time()) - 60
code, risp = ciao_mano("pc-wine-1", {"alzata": True, "da": da, "messaggio": "non trovo\u0007 il pulsante " + "x" * 200})
m = mano_di("pc-wine-1")
check("mano: il facilitatore vede la mano alzata", code == 200 and "mano" not in risp and m["alzata"] is True and m["da"] == da and m["stato"] == "" and m["attesa_s"] >= 0, m)
check("mano: messaggio ripulito e accorciato a 120 caratteri", m["messaggio"].startswith("non trovo il pulsante x") and len(m["messaggio"]) == 120, m["messaggio"])
code, risp = ciao_mano("pc-wine-2", None, "Carlo")
check("mano: presenza senza mano (allievo 3.2) accettata", code == 200 and mano_di("pc-wine-2")["alzata"] is False, mano_di("pc-wine-2"))
for corpo, atteso in (({"id": "pc wine", "stato": "arrivo"}, 400), ({"id": "pc-wine-1", "stato": "boh"}, 400), ({"id": "pc-wine-9", "stato": "arrivo"}, 404),
                      ({"id": "pc-wine-2", "stato": "arrivo"}, 409), ({"id": 5, "stato": "arrivo"}, 400), ([1, 2], 400)):
    st, e = call("/api/aula/rispondi", corpo)
    check("mano: rispondi %s → %d" % (json.dumps(corpo), atteso), st == atteso and e.get("ok") is False and e.get("error"), (st, e))
st, e = call("/api/aula/mano", {"alzata": True})
check("mano: sul facilitatore /api/aula/mano → 409", st == 409, (st, e))
st, r = call("/api/aula/rispondi", {"id": "pc-wine-1", "stato": "arrivo"})
check("mano: «Arrivo!»", st == 200 and r["id"] == "pc-wine-1" and r["mano"]["alzata"] is True and r["mano"]["stato"] == "arrivo", r)
code, risp = ciao_mano("pc-wine-1", {"alzata": True, "da": da, "messaggio": "ok"})
check("mano: risposta mirata all'allievo", risp.get("mano") == {"da": da, "stato": "arrivo"} and mano_di("pc-wine-1")["stato"] == "arrivo", risp)
code, risp = ciao_mano("pc-wine-2", None, "Carlo")
check("mano: gli altri allievi non ricevono la risposta", "mano" not in risp, risp)
st, r = call("/api/aula/rispondi", {"id": "pc-wine-1", "stato": "risolto"})
check("mano: «Risolto» abbassa la mano", st == 200 and r["mano"]["alzata"] is False, r)
code, risp = ciao_mano("pc-wine-1", {"alzata": True, "da": da, "messaggio": "ok"})
check("mano: l'allievo riceve «risolto»", risp.get("mano") == {"da": da, "stato": "risolto"} and mano_di("pc-wine-1")["alzata"] is False, risp)
st, e = call("/api/aula/rispondi", {"id": "pc-wine-1", "stato": "risolto"})
check("mano: già abbassata → 409", st == 409, (st, e))
code, risp = ciao_mano("pc-wine-1", {"alzata": True, "da": da + 30, "messaggio": ""})
m = mano_di("pc-wine-1")
check("mano: nuova richiesta riparte da capo", "mano" not in risp and m["alzata"] and m["stato"] == "" and m["da"] == da + 30, m)
call("/api/aula/rimuovi", {"id": "*"})

# --- 3.3: mano alzata sul PC dell'allievo (un finto facilitatore registra le presenze) ---
ricevuti, risposta_mano = [], {}
class FintoFacilitatore(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        d = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)).decode())
        ricevuti.append((time.time(), d))
        out = {"ok": True, "nome": "Finta aula", "annuncio": {"id": 0, "testo": ""}}
        if risposta_mano: out["mano"] = dict(risposta_mano)
        b = json.dumps(out).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
finto = socketserver.ThreadingTCPServer(("127.0.0.1", 0), FintoFacilitatore); finto.daemon_threads = True   # porta libera qualsiasi
threading.Thread(target=finto.serve_forever, daemon=True).start()
def aspetta(f, sec):
    fine = time.time() + sec
    while time.time() < fine:
        v = f()
        if v: return v
        time.sleep(0.3)
    return f()
call("/api/data/settings", {"value": dict(nuove, aulaRuolo="allievo", studentName="Maria", aulaServer="127.0.0.1:%d" % finto.server_address[1])})
st, a3 = call("/api/aula/applica", {})
check("mano: allievo con la mano abbassata", a3.get("mano", {}).get("alzata") is False and a3["mano"].get("risposta") == "", a3.get("mano"))
check("mano: prima presenza al finto facilitatore", aspetta(lambda: len(ricevuti), 12), ricevuti)
time.sleep(1); n0 = len(ricevuti); t0 = time.time()
st, r = call("/api/aula/mano", {"alzata": True})
check("mano: alzata (API locale)", st == 200 and r["mano"]["alzata"] is True and r["mano"]["da"] > 0 and r["mano"]["messaggio"] == "", r)
da = r["mano"]["da"]
x = aspetta(lambda: [d for t, d in ricevuti[n0:] if (d.get("mano") or {}).get("alzata")], 4)
check("mano: presenza inviata subito (meno di 4 s)", x and x[0]["mano"]["da"] == da, (time.time() - t0, ricevuti[n0:]))
st, r = call("/api/aula/mano", {"alzata": True, "messaggio": "  non trovo il pulsante  "})
check("mano: messaggio (spazi tolti)", st == 200 and r["mano"]["messaggio"] == "non trovo il pulsante" and r["mano"]["da"] == da, r)
for corpo in ({"alzata": "sì"}, {"alzata": 1}, {"alzata": True, "messaggio": "x" * 121}, {"alzata": True, "messaggio": "a\u0007b"}, {"alzata": True, "messaggio": 5}, [True]):
    st, e = call("/api/aula/mano", corpo)
    check("mano: validazione %s → 400" % json.dumps(corpo)[:40], st == 400 and e.get("ok") is False, (st, e))
st, e = call("/api/aula/mano", {"alzata": True, "messaggio": "è" * 120})
check("mano: 120 caratteri accentati ammessi", st == 200, (st, e))
st, e = call("/api/aula/rispondi", {"id": "abc", "stato": "arrivo"})
check("mano: sull'allievo /api/aula/rispondi → 409", st == 409, (st, e))
risposta_mano.update({"da": da - 1, "stato": "arrivo"})
time.sleep(7)
check("mano: risposta a una richiesta vecchia ignorata", call("/api/aula")[1]["mano"]["risposta"] == "", call("/api/aula")[1]["mano"])
risposta_mano.update({"da": da, "stato": "arrivo"})
m = aspetta(lambda: call("/api/aula")[1]["mano"]["risposta"] == "arrivo" and call("/api/aula")[1]["mano"], 12)
check("mano: l'allievo riceve «arrivo»", m and m["alzata"] is True, m)
risposta_mano.update({"da": da, "stato": "risolto"})
m = aspetta(lambda: call("/api/aula")[1]["mano"]["risposta"] == "risolto" and call("/api/aula")[1]["mano"], 12)
check("mano: l'allievo riceve «risolto» e la mano si abbassa", m and m["alzata"] is False, m)
risposta_mano.clear()
st, r = call("/api/aula/mano", {"alzata": True})
check("mano: rialzata con un nuovo identificativo", st == 200 and r["mano"]["da"] > da and r["mano"]["risposta"] == "", r)
n0 = len(ricevuti)
st, r = call("/api/aula/mano", {"alzata": False})
check("mano: abbassata dall'allievo", st == 200 and r["mano"]["alzata"] is False, r)
x = aspetta(lambda: [d for t, d in ricevuti[n0:] if (d.get("mano") or {}).get("alzata") is False], 4)
check("mano: il facilitatore lo sa subito", bool(x), ricevuti[n0:])
finto.shutdown(); finto.server_close()
call("/api/aula/rimuovi", {"id": "*"})
call("/api/data/settings", {"value": dict(nuove, aulaRuolo="")}); call("/api/aula/applica", {})

# --- 3.4: condivisione con i tablet dell'aula (stesse risposte di pd_server.py / pd_tablet.py) ---
import http.client, socket
def porta_chiusa(p):
    s = socket.socket(); s.settimeout(2)
    try: s.connect(("127.0.0.1", p)); return False
    except OSError: return True
    finally: s.close()
def tab(metodo, path, body=None, cookie=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", TP, timeout=60)
    h = {"Host": "127.0.0.1:%d" % TP}
    if cookie: h["Cookie"] = "pd_tablet=" + cookie
    if body is not None: h["Content-Type"] = "application/json"
    h.update(headers or {})
    c.request(metodo, path, body=json.dumps(body).encode() if body is not None else None, headers=h)
    r = c.getresponse(); b = r.read(); hd = dict(r.getheaders()); c.close()
    try: j = json.loads(b.decode())
    except ValueError: j = None
    return r.status, b, hd, j
st, t0 = call("/api/tablet")
TP = t0.get("porta")
check("tablet: spenta per impostazione predefinita", st == 200 and t0["attivo"] is False and t0["codice"] == "" and t0["indirizzi"] == [], t0)
check("tablet: porta dei tablet chiusa", TP and porta_chiusa(TP), TP)
st, e = call("/api/tablet", {"azione": "boh"})
check("tablet: azione sconosciuta → 400", st == 400, (st, e))
st, t1 = call("/api/tablet", {"azione": "accendi"})
cod = t1.get("codice", "")
check("tablet: accesa con codice di 6 cifre", st == 200 and t1["attivo"] and len(cod) == 6 and cod.isdigit(), t1)
check("tablet: indirizzi con porta e codice (loopback per i test)", "http://127.0.0.1:%d/?c=%s" % (TP, cod) in t1["indirizzi"] and "127.0.0.1" in t1["ips"], t1)
st, b, hd, _ = tab("GET", "/")
check("tablet: pagina del codice senza sessione", st == 200 and "Inserite il codice che vedete sullo schermo del facilitatore" in b.decode() and
      "default-src 'none'" in hd.get("Content-Security-Policy", ""), (st, hd))
st, b, hd, j = tab("GET", "/api/status")
check("tablet: API senza sessione → 403", st == 403 and j and j["error"] == "serve il codice del facilitatore", (st, j))
st, b, hd, j = tab("GET", "/js/app.js")
check("tablet: file senza sessione → 403", st == 403, st)
sbagliato = "%06d" % ((int(cod) + 1) % 1000000)
st, b, hd, _ = tab("GET", "/?c=" + sbagliato)
check("tablet: codice sbagliato → 403 e messaggio", st == 403 and "non è giusto" in b.decode() and "Set-Cookie" not in hd, st)
st, b, hd, _ = tab("GET", "/?c=" + cod)
ck = hd.get("Set-Cookie", "")
tok = ck.split("pd_tablet=", 1)[-1].split(";", 1)[0]
check("tablet: codice giusto → 303 verso / con cookie HttpOnly, SameSite=Strict, 12 ore", st == 303 and hd.get("Location") == "/" and len(tok) == 32 and
      "HttpOnly" in ck and "SameSite=Strict" in ck and "Max-Age=43200" in ck and "Path=/" in ck, (st, hd))
st, b, hd, j = tab("GET", "/api/status", cookie=tok)
check("tablet: stato ridotto con ospite: true", st == 200 and j["ospite"] is True and j["system"] == {} and "update_url" not in j and "platform" not in j and
      set(j["ai"]) == {"available", "models"} and j["stt"] == {"engine": None, "detail": None}, j)
st, b, hd, _ = tab("GET", "/", cookie=tok)
check("tablet: con la sessione arriva l'interfaccia", st == 200 and b"js/app.js" in b and "default-src 'self'" in hd.get("Content-Security-Policy", ""), st)
st, b, hd, j = tab("GET", "/api/packs", cookie=tok)
check("tablet: pacchetti senza percorsi del disco", st == 200 and j["packs"] and all("\\" not in p["file"] and "/" not in p["file"] for p in j["packs"]), [p["file"] for p in (j or {}).get("packs", [])][:3])
st, b, hd, j = tab("GET", "/api/rete", cookie=tok)
check("tablet: stato della rete permesso", st == 200 and isinstance(j.get("online"), bool), j)
if j and voci:
    st, b, hd, _ = tab("POST", "/api/tts", {"text": "Buongiorno dal tablet"}, cookie=tok)
    check("tablet: voce del PC", st == 200 and b[:4] == b"RIFF", st)
vietate = {}
for m, p, corpo in (("GET", "/api/data/progress", None), ("POST", "/api/data/progress", {"value": 1}), ("POST", "/api/packs/import", {"pack": {}}),
                    ("POST", "/api/packs/remove", {"id": "x"}), ("POST", "/api/packs/download", {}), ("POST", "/api/update-check", {}),
                    ("POST", "/api/update-download", {}), ("POST", "/api/update-install", {}), ("POST", "/api/shutdown", {}), ("POST", "/api/heartbeat", {}),
                    ("GET", "/api/aula", None), ("POST", "/api/aula/applica", {}), ("GET", "/api/tablet", None), ("POST", "/api/tablet", {"azione": "spegni"}),
                    ("GET", "/api/setup/info", None), ("POST", "/api/setup/start", {}), ("POST", "/api/stt-reprobe", {}), ("POST", "/api/open", {}),
                    ("POST", "/api/stt", None)):
    vietate[m + " " + p] = tab(m, p, corpo, cookie=tok)[0]
check("tablet: tutto il resto → 403 (dati, pacchetti, aggiornamenti, setup, spegnimento, aula, microfono)", all(v == 403 for v in vietate.values()), vietate)
st, b, hd, j = tab("GET", "/api/status", cookie=tok, headers={"Host": "evil.example:%d" % TP})
check("tablet: Host falso → 403", st == 403, st)
st, b, hd, j = tab("POST", "/api/tts", {"text": "x"}, cookie=tok, headers={"Origin": "http://evil.example"})
check("tablet: Origin estranea → 403", st == 403, st)
st, b, hd, j = tab("POST", "/api/ospite/presenza", {"nome": "Lucia\u0007 Tablet", "attivita": {"vista": "home", "titolo": "Inizio"}}, cookie=tok)
check("tablet: presenza senza aula → aula: false", st == 200 and j == {"ok": True, "aula": False}, (st, j))
st, e = call("/api/ospite/presenza", {"nome": "x"})
check("tablet: /api/ospite/presenza non esiste per il PC", st == 404, (st, e))
_, sett = call("/api/data/settings")
call("/api/data/settings", {"value": dict(sett.get("value") or {}, aulaRuolo="facilitatore", aulaCodice="2468")}); call("/api/aula/applica", {})
da = int(time.time())
st, b, hd, j = tab("POST", "/api/ospite/presenza", {"nome": "Lucia\u0007 Tablet", "attivita": {"vista": "lessons", "titolo": "Lezione: Il mouse"},
                   "progressi": {"lezioni_fatte": 3, "lezioni_totali": 15}, "mano": {"alzata": True, "da": da, "messaggio": "aiuto"}}, cookie=tok)
check("tablet: presenza nel quadro (facilitatore)", st == 200 and j["ok"] and j["aula"] is True and j["annuncio"]["id"] >= 0 and "mano" not in j, (st, j))
cl = [c for c in (call("/api/aula")[1].get("clienti") or []) if c["id"].startswith("tablet-")]
check("tablet: il quadro lo mostra come allievo (nome ripulito, mano alzata)", len(cl) == 1 and cl[0]["utente"] == "Lucia Tablet" and cl[0]["ip"] == "127.0.0.1" and
      cl[0]["progressi"]["lezioni_fatte"] == 3 and cl[0]["mano"]["alzata"] is True and cl[0]["mano"]["messaggio"] == "aiuto" and cl[0]["pc"] == "Tablet o telefono", cl)
st, r = call("/api/aula/rispondi", {"id": cl[0]["id"] if cl else "x", "stato": "arrivo"})
st, b, hd, j = tab("POST", "/api/ospite/presenza", {"nome": "Lucia Tablet", "mano": {"alzata": True, "da": da, "messaggio": "aiuto"}}, cookie=tok)
check("tablet: risposta mirata «arrivo» al tablet", j and j.get("mano") == {"da": da, "stato": "arrivo"}, j)
st, b, hd, j = tab("POST", "/api/ospite/presenza", [1, 2], cookie=tok)
check("tablet: presenza non valida → 400", st == 400, (st, j))
st, t2 = call("/api/tablet")
d = [x for x in t2["dispositivi"] if x["nome"] == "Lucia Tablet"]
check("tablet: elenco dei dispositivi (nome, IP, pagina, ultimo accesso)", d and d[0]["ip"] == "127.0.0.1" and d[0]["fa_s"] >= 0 and len(d[0]["id"]) == 8, t2)
call("/api/aula/rimuovi", {"id": "*"}); call("/api/data/settings", {"value": dict(sett.get("value") or {}, aulaRuolo="")}); call("/api/aula/applica", {})
st, t3 = call("/api/tablet", {"azione": "codice"})
check("tablet: «Cambia codice» → codice nuovo e sessioni chiuse", t3["codice"] != cod and t3["dispositivi"] == [] and tab("GET", "/api/status", cookie=tok)[0] == 403, t3)
st, b, hd, _ = tab("GET", "/", cookie=tok)
check("tablet: sessione scaduta → pagina del codice con spiegazione", st == 200 and "è scaduto" in b.decode(), st)
st, b, hd, _ = tab("GET", "/?c=" + t3["codice"])
tok2 = hd.get("Set-Cookie", "").split("pd_tablet=", 1)[-1].split(";", 1)[0]
st, t4 = call("/api/tablet", {"azione": "togli", "id": call("/api/tablet")[1]["dispositivi"][0]["id"]})
check("tablet: «togli» scollega un tablet", t4["dispositivi"] == [] and tab("GET", "/api/status", cookie=tok2)[0] == 403, t4)
esiti = [tab("GET", "/?c=" + sbagliato)[0] for _ in range(11)]
check("tablet: troppi tentativi → 429", esiti[-1] == 429 and 403 in esiti, esiti)
st, t5 = call("/api/tablet", {"azione": "spegni"})
time.sleep(0.5)
check("tablet: «Spegni» chiude la porta", t5["attivo"] is False and t5["codice"] == "" and porta_chiusa(TP), t5)

# --- chiusura ---
rt = os.path.join(WORK, "dati", "locale", "runtime.json")
check("file di esecuzione presente", os.path.isfile(rt))
call("/api/shutdown", {})
time.sleep(2.5)
check("chiusura pulita (file di esecuzione rimosso)", not os.path.exists(rt))

fails = [r for r in results if not r[1]]
print("\nRISULTATO Windows: %d/%d test superati" % (len(results) - len(fails), len(results)))
sys.exit(1 if fails else 0)
