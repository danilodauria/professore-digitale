#!/usr/bin/env python3
"""Test delle funzioni proprie della versione Windows (server nativo eseguito con Wine).
Uso: python3 tests/test_windows_api.py <url_base> <cartella_di_lavoro> <cartella_app>
Controlla: sicurezza Host/Origin, configurazione guidata (hardware, piano, catalogo), chiavetta offline
(verifica SHA-256, estrazione zip, file rovinati), motore compatibile in stile OpenAI (streaming),
programma del microfono, chiusura pulita. Autore: Danilo D'Auria - Licenza MIT"""
import hashlib, http.server, io, json, os, socketserver, subprocess, sys, threading, time, urllib.request, zipfile

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
st, r = call("/api/setup/kit-install", {"cartella": winpath(kit)})
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

# --- dati: file rovinato trattato come assente, scrittura atomica ---
open(os.path.join(WORK, "dati", "board.json"), "w").write("{rovinato")
st, d = call("/api/data/board")
check("file di dati rovinato non blocca", st == 200 and d["value"] is None, d)
st, _ = call("/api/data/board", {"value": {"tratti": [1, 2, 3]}})
st, d = call("/api/data/board")
check("salvataggio dati", d["value"] == {"tratti": [1, 2, 3]}, d)
st, e = call("/api/data/segreti", {"value": 1})
check("chiave di dati sconosciuta rifiutata", st == 404, e)

# --- chiusura ---
rt = os.path.join(WORK, "dati", "locale", "runtime.json")
check("file di esecuzione presente", os.path.isfile(rt))
call("/api/shutdown", {})
time.sleep(2.5)
check("chiusura pulita (file di esecuzione rimosso)", not os.path.exists(rt))

fails = [r for r in results if not r[1]]
print("\nRISULTATO Windows: %d/%d test superati" % (len(results) - len(fails), len(results)))
sys.exit(1 if fails else 0)
