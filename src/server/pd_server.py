#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
#  PROFESSORE DIGITALE - Cattedra Digitale Portatile
#  Server locale (solo libreria standard Python 3.7+, nessuna dipendenza pip)
#
#  Autore originario: Danilo D'Auria - Tecnico IT & Divulgatore Digitale per il Sociale
#  Contatti: danilodauria.site@gmail.com
#  Licenza: MIT
# ==============================================================================
"""
Server HTTP locale del Professore Digitale.

Principi di progetto:
  * ascolta SOLO su 127.0.0.1 (mai sulla rete);
  * controlla gli header Host/Origin (protezione da DNS-rebinding e CSRF);
  * non richiede privilegi di root: i dati dell'utente stanno in
    ~/.local/share/professore-digitale;
  * tutte le funzioni "pesanti" (IA, voce) sono opzionali e rilevate
    automaticamente: se mancano, l'applicazione continua a funzionare;
  * si spegne da solo quando nessuna finestra e' aperta da qualche minuto.
"""

from __future__ import print_function

import argparse
import json
import mimetypes
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

try:
    from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
except ImportError:  # Python < 3.7 (non supportato ufficialmente)
    from http.server import HTTPServer as ThreadingHTTPServer, BaseHTTPRequestHandler

VERSION = "2.0.0"
APP_ID = "professore-digitale"

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.normpath(os.environ.get("PD_WEB_DIR") or os.path.join(HERE, "..", "web"))
STT_WORKER = os.path.join(HERE, "pd_stt_worker.py")

XDG_DATA = os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share")
DATA_DIR = os.environ.get("PD_DATA_DIR") or os.path.join(XDG_DATA, APP_ID)
MODELS_DIR = os.path.join(DATA_DIR, "models")
VENV_PY = os.path.join(DATA_DIR, "venv", "bin", "python3")
RUNTIME_DIR = os.environ.get("XDG_RUNTIME_DIR") or tempfile.gettempdir()
RUNTIME_FILE = os.path.join(RUNTIME_DIR, "%s-%d.json" % (APP_ID, os.getuid()))

OLLAMA_HOST = (os.environ.get("OLLAMA_HOST") or "http://127.0.0.1:11434").rstrip("/")
if not OLLAMA_HOST.startswith("http"):
    OLLAMA_HOST = "http://" + OLLAMA_HOST

UPDATE_URL_DEFAULT = "https://raw.githubusercontent.com/danilodauria/professore-digitale/main/version.txt"

DATA_KEYS = ("settings", "progress", "history", "board", "practice")
MAX_BODY = 8 * 1024 * 1024        # 8 MB (audio del microfono)
MAX_JSON = 2 * 1024 * 1024
MAX_TTS_CHARS = 6000

LAST_SEEN = [time.time()]
STATE = {"port": None, "idle_timeout": 240, "stt_probe": None, "stt_probe_time": 0}
LOCK = threading.Lock()


# ------------------------------------------------------------------------------
#  Utilita'
# ------------------------------------------------------------------------------
def log(*args):
    if os.environ.get("PD_DEBUG"):
        sys.stderr.write("[pd] " + " ".join(str(a) for a in args) + "\n")


def ensure_dirs():
    for d in (DATA_DIR, MODELS_DIR):
        try:
            os.makedirs(d, exist_ok=True)
        except OSError:
            pass


def atomic_write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(data)
    os.replace(tmp, path)


def read_json_file(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def mem_total_mb():
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) // 1024
    except (OSError, ValueError):
        pass
    return 0


def recommended_model(ram_mb):
    if ram_mb and ram_mb < 3500:
        return "qwen2.5:0.5b"
    if ram_mb and ram_mb < 6000:
        return "qwen2.5:1.5b"
    if ram_mb and ram_mb < 12000:
        return "llama3.2:3b"
    return "gemma3:4b"


# ------------------------------------------------------------------------------
#  Intelligenza artificiale locale (Ollama) - opzionale
# ------------------------------------------------------------------------------
def ollama_models(timeout=1.5):
    try:
        with urllib.request.urlopen(OLLAMA_HOST + "/api/tags", timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
        return True, [m.get("name") for m in data.get("models", []) if m.get("name")]
    except Exception:
        return False, []


# ------------------------------------------------------------------------------
#  Sintesi vocale (TTS) - piper > pico2wave > espeak-ng
# ------------------------------------------------------------------------------
def piper_model():
    d = os.path.join(MODELS_DIR, "piper")
    try:
        for name in sorted(os.listdir(d)):
            if name.endswith(".onnx"):
                return os.path.join(d, name)
    except OSError:
        pass
    return None


def piper_bin():
    for c in (os.path.join(DATA_DIR, "piper", "piper"), shutil.which("piper")):
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return None


def tts_engines():
    engines = []
    if piper_bin() and piper_model():
        engines.append("piper")
    if shutil.which("pico2wave"):
        engines.append("pico")
    if shutil.which("espeak-ng"):
        engines.append("espeak-ng")
    elif shutil.which("espeak"):
        engines.append("espeak")
    return engines


def clean_for_speech(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"\[DIAGRAMMA\].*?(\[/DIAGRAMMA\]|$)", " ", text, flags=re.S)
    text = re.sub(r"[*_#`>|~]+", " ", text)
    text = re.sub(r"https?://\S+", " indirizzo web ", text)
    # rimuove emoji e simboli non pronunciabili
    text = re.sub(u"[\U0001F000-\U0001FAFF☀-➿️‍]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_TTS_CHARS]


def synthesize(text, rate=1.0, engine=None):
    """Restituisce (bytes_wav, nome_motore) oppure solleva RuntimeError."""
    text = clean_for_speech(text)
    if not text:
        raise RuntimeError("testo vuoto")
    rate = max(0.5, min(1.6, float(rate or 1.0)))
    available = tts_engines()
    if not available:
        raise RuntimeError("nessun motore vocale installato (installare espeak-ng)")
    order = [engine] + available if engine in available else available
    last_err = None
    for eng in order:
        try:
            with tempfile.TemporaryDirectory(prefix="pd-tts-") as tmp:
                out = os.path.join(tmp, "voce.wav")
                if eng == "piper":
                    subprocess.run([piper_bin(), "--model", piper_model(), "--output_file", out,
                                    "--length_scale", "%.2f" % (1.0 / rate)],
                                   input=text.encode("utf-8"), stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=120, check=True)
                elif eng == "pico":
                    level = int(max(50, min(160, rate * 90)))
                    safe = text.replace("<", " ").replace(">", " ")
                    subprocess.run(["pico2wave", "-l", "it-IT", "-w", out,
                                    '<speed level="%d">%s</speed>' % (level, safe)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   timeout=120, check=True)
                else:  # espeak-ng / espeak
                    wpm = int(150 * rate)
                    subprocess.run([shutil.which(eng), "-v", "it", "-s", str(wpm), "-w", out, "--stdin"],
                                   input=text.encode("utf-8"), stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=120, check=True)
                with open(out, "rb") as f:
                    data = f.read()
                if len(data) > 44:
                    return data, eng
        except Exception as e:  # prova il motore successivo
            last_err = e
            log("TTS", eng, "fallito:", e)
    raise RuntimeError("sintesi vocale non riuscita: %s" % last_err)


# ------------------------------------------------------------------------------
#  Riconoscimento vocale (STT) - vosk / faster-whisper tramite worker esterno
# ------------------------------------------------------------------------------
def stt_pythons():
    pys = []
    if os.path.isfile(VENV_PY):
        pys.append(VENV_PY)
    pys.append(sys.executable or "python3")
    return pys


def stt_probe(force=False):
    with LOCK:
        if not force and STATE["stt_probe"] is not None and time.time() - STATE["stt_probe_time"] < 60:
            return STATE["stt_probe"]
    result = {"engine": None}
    for py in stt_pythons():
        try:
            p = subprocess.run([py, "-B", STT_WORKER, "--probe", "--models", MODELS_DIR],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=30)
            info = json.loads(p.stdout.decode("utf-8") or "{}")
            if info.get("engine"):
                info["python"] = py
                result = info
                break
        except Exception as e:
            log("probe STT", py, e)
    with LOCK:
        STATE["stt_probe"] = result
        STATE["stt_probe_time"] = time.time()
    return result


def transcribe(wav_bytes):
    info = stt_probe()
    if info.get("engine") and not os.path.isfile(info.get("python", "")):
        info = stt_probe(force=True)  # i componenti sono stati rimossi nel frattempo
    if not info.get("engine"):
        raise RuntimeError("riconoscimento vocale non installato")
    with tempfile.NamedTemporaryFile(prefix="pd-stt-", suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        path = f.name
    try:
        try:
            p = subprocess.run([info["python"], "-B", STT_WORKER, "--models", MODELS_DIR, path],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300)
            out = json.loads(p.stdout.decode("utf-8") or "{}")
        except (OSError, ValueError, subprocess.TimeoutExpired) as e:
            with LOCK:
                STATE["stt_probe"] = None
            raise RuntimeError("riconoscimento vocale non riuscito: %s" % e)
        if "error" in out:
            raise RuntimeError("riconoscimento vocale non riuscito: %s" % out["error"])
        return out.get("text", "").strip(), info["engine"]
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


# ------------------------------------------------------------------------------
#  Aggiornamenti: SOLO su richiesta esplicita dell'utente (protocollo etico)
# ------------------------------------------------------------------------------
def parse_version(v):
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3])


def check_update(url):
    if not re.match(r"^https://", url or ""):
        raise RuntimeError("indirizzo di aggiornamento non valido (serve https)")
    req = urllib.request.Request(url, headers={"User-Agent": "professore-digitale/" + VERSION})
    with urllib.request.urlopen(req, timeout=8) as r:
        online = r.read(64).decode("utf-8", "replace").strip()
    if not re.match(r"^\d+(\.\d+){0,2}$", online):
        raise RuntimeError("risposta non valida dal server degli aggiornamenti")
    return {"current": VERSION, "online": online,
            "newer": parse_version(online) > parse_version(VERSION)}


# ------------------------------------------------------------------------------
#  Gestore HTTP
# ------------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "ProfessoreDigitale/" + VERSION
    protocol_version = "HTTP/1.1"

    # --- log silenzioso (niente rumore nel terminale) ---
    def log_message(self, fmt, *args):
        log(self.address_string(), fmt % args)

    # --- sicurezza ---
    def _host_ok(self):
        host = (self.headers.get("Host") or "").lower()
        port = STATE["port"]
        allowed = {"127.0.0.1:%s" % port, "localhost:%s" % port}
        return host in allowed

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        if origin is None:
            return True  # richieste non-browser (curl) o same-origin GET
        port = STATE["port"]
        return origin in ("http://127.0.0.1:%s" % port, "http://localhost:%s" % port)

    def _security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")

    # --- risposte ---
    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self._security_headers()
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _error(self, code, msg):
        self._send(code, {"ok": False, "error": msg})

    def _read_body(self, limit):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n < 0 or n > limit:
            raise ValueError("richiesta troppo grande")
        return self.rfile.read(n) if n else b""

    def _read_json(self):
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip()
        if ctype != "application/json":
            raise ValueError("Content-Type deve essere application/json")
        raw = self._read_body(MAX_JSON)
        return json.loads(raw.decode("utf-8") or "{}")

    # --- routing ---
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self._host_ok():
            return self._error(403, "host non consentito")
        LAST_SEEN[0] = time.time()
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/"):
            return self._api_get(path)
        return self._static(path)

    def do_POST(self):
        if not self._host_ok() or not self._origin_ok():
            return self._error(403, "origine non consentita")
        LAST_SEEN[0] = time.time()
        path = self.path.split("?", 1)[0]
        try:
            return self._api_post(path)
        except ValueError as e:
            return self._error(400, str(e))
        except (BrokenPipeError, ConnectionResetError):
            return None
        except Exception as e:  # pragma: no cover - rete di sicurezza
            log("errore interno", repr(e))
            return self._error(500, "errore interno: %s" % e)

    # --- file statici ---
    def _static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        rel = os.path.normpath(path.lstrip("/"))
        if rel.startswith("..") or os.path.isabs(rel):
            return self._error(404, "non trovato")
        full = os.path.join(WEB_DIR, rel)
        if not os.path.isfile(full):
            return self._error(404, "non trovato")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
        extra = {"Content-Security-Policy":
                 "default-src 'self'; script-src 'self' 'unsafe-eval' blob:; "
                 "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
                 "media-src 'self' blob: data:; connect-src 'self'; font-src 'self' data:; "
                 "object-src 'none'; base-uri 'none'; frame-ancestors 'none'"} if rel == "index.html" else None
        self._send(200, data, ctype, extra)

    # --- API GET ---
    def _api_get(self, path):
        if path == "/api/status":
            ok, models = ollama_models()
            ram = mem_total_mb()
            settings = read_json_file(os.path.join(DATA_DIR, "settings.json"), {}) or {}
            stt = stt_probe()
            return self._send(200, {
                "ok": True, "version": VERSION, "mode": "server",
                "ai": {"available": ok, "host": OLLAMA_HOST, "models": models,
                       "recommended": recommended_model(ram)},
                "tts": {"engines": tts_engines()},
                "stt": {"engine": stt.get("engine"), "detail": stt.get("model")},
                "system": {"ram_mb": ram, "python": sys.version.split()[0],
                           "data_dir": DATA_DIR, "cpus": os.cpu_count()},
                "update_url": settings.get("updateUrl") or UPDATE_URL_DEFAULT,
            })
        m = re.match(r"^/api/data/([a-z]+)$", path)
        if m:
            key = m.group(1)
            if key not in DATA_KEYS:
                return self._error(404, "chiave sconosciuta")
            return self._send(200, {"ok": True, "value": read_json_file(os.path.join(DATA_DIR, key + ".json"))})
        return self._error(404, "API sconosciuta")

    # --- API POST ---
    def _api_post(self, path):
        if path == "/api/heartbeat":
            self._read_body(1024)
            return self._send(200, {"ok": True})

        if path == "/api/chat":
            return self._chat(self._read_json())

        if path == "/api/tts":
            req = self._read_json()
            try:
                wav, eng = synthesize(str(req.get("text", "")), req.get("rate", 1.0), req.get("engine"))
            except RuntimeError as e:
                return self._error(503, str(e))
            return self._send(200, wav, "audio/wav", {"X-TTS-Engine": eng})

        if path == "/api/stt":
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip()
            if ctype not in ("audio/wav", "audio/x-wav"):
                return self._error(400, "serve audio/wav")
            wav = self._read_body(MAX_BODY)
            if len(wav) < 1000 or wav[:4] != b"RIFF":
                return self._error(400, "audio non valido")
            try:
                text, eng = transcribe(wav)
            except RuntimeError as e:
                return self._error(503, str(e))
            return self._send(200, {"ok": True, "text": text, "engine": eng})

        m = re.match(r"^/api/data/([a-z]+)$", path)
        if m:
            key = m.group(1)
            if key not in DATA_KEYS:
                return self._error(404, "chiave sconosciuta")
            req = self._read_json()
            ensure_dirs()
            atomic_write(os.path.join(DATA_DIR, key + ".json"),
                         json.dumps(req.get("value"), ensure_ascii=False, indent=1))
            return self._send(200, {"ok": True})

        if path == "/api/update-check":
            req = self._read_json()
            try:
                res = check_update(req.get("url") or UPDATE_URL_DEFAULT)
            except Exception as e:
                return self._error(502, "controllo non riuscito: %s" % e)
            res["ok"] = True
            return self._send(200, res)

        if path == "/api/stt-reprobe":
            self._read_body(1024)
            return self._send(200, {"ok": True, "stt": stt_probe(force=True)})

        if path == "/api/shutdown":
            self._read_body(1024)
            self._send(200, {"ok": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return None

        return self._error(404, "API sconosciuta")

    # --- chat in streaming verso Ollama ---
    def _chat(self, req):
        model = str(req.get("model") or "").strip()
        messages = req.get("messages") or []
        if not isinstance(messages, list) or not messages:
            raise ValueError("nessun messaggio")
        clean = []
        for msg in messages[-24:]:
            role = msg.get("role")
            if role in ("system", "user", "assistant"):
                clean.append({"role": role, "content": str(msg.get("content", ""))[:12000]})
        if not model:
            ok, models = ollama_models()
            if not ok or not models:
                return self._error(503, "IA locale non disponibile")
            model = models[0]
        payload = json.dumps({
            "model": model, "messages": clean, "stream": True,
            "options": {"temperature": float(req.get("temperature", 0.4)),
                        "num_ctx": int(req.get("num_ctx", 2048))},
            "keep_alive": "15m",
        }).encode("utf-8")
        upstream = urllib.request.Request(OLLAMA_HOST + "/api/chat", data=payload,
                                          headers={"Content-Type": "application/json"})
        try:
            resp = urllib.request.urlopen(upstream, timeout=600)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            return self._error(502, "Ollama ha risposto %s: %s" % (e.code, detail))
        except Exception as e:
            return self._error(503, "IA locale non raggiungibile: %s" % e)

        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Connection", "close")
        self._security_headers()
        self.end_headers()
        self.close_connection = True
        try:
            with resp:
                for line in resp:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line.decode("utf-8"))
                    except ValueError:
                        continue
                    out = {"t": (obj.get("message") or {}).get("content", "")}
                    if obj.get("done"):
                        out["done"] = True
                    if obj.get("error"):
                        out["error"] = obj["error"]
                    self.wfile.write((json.dumps(out, ensure_ascii=False) + "\n").encode("utf-8"))
                    self.wfile.flush()
                    LAST_SEEN[0] = time.time()
        except (BrokenPipeError, ConnectionResetError):
            log("client disconnesso durante lo streaming")
        return None


# ------------------------------------------------------------------------------
#  Avvio
# ------------------------------------------------------------------------------
def idle_watchdog(server):
    while True:
        time.sleep(10)
        if STATE["idle_timeout"] > 0 and time.time() - LAST_SEEN[0] > STATE["idle_timeout"]:
            log("inattivo: spegnimento automatico")
            server.shutdown()
            return


def write_runtime(port):
    try:
        atomic_write(RUNTIME_FILE, json.dumps({"port": port, "pid": os.getpid(), "version": VERSION}))
        os.chmod(RUNTIME_FILE, 0o600)
    except OSError:
        pass


def remove_runtime():
    try:
        info = read_json_file(RUNTIME_FILE, {}) or {}
        if info.get("pid") == os.getpid():
            os.unlink(RUNTIME_FILE)
    except OSError:
        pass


def main(argv=None):
    ap = argparse.ArgumentParser(description="Server locale del Professore Digitale")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PD_PORT", "8765")))
    ap.add_argument("--idle-timeout", type=int, default=240,
                    help="secondi di inattivita' prima dello spegnimento (0 = mai)")
    args = ap.parse_args(argv)

    ensure_dirs()
    STATE["idle_timeout"] = args.idle_timeout
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("image/svg+xml", ".svg")

    server = None
    for port in range(args.port, args.port + 30):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    if server is None:
        sys.stderr.write("Nessuna porta libera trovata.\n")
        return 2
    server.daemon_threads = True
    port = server.server_address[1]
    STATE["port"] = port
    write_runtime(port)
    signal.signal(signal.SIGTERM, lambda *a: threading.Thread(target=server.shutdown, daemon=True).start())
    threading.Thread(target=idle_watchdog, args=(server,), daemon=True).start()
    threading.Thread(target=stt_probe, daemon=True).start()  # pre-riscaldamento
    print("Professore Digitale %s in ascolto su http://127.0.0.1:%d/" % (VERSION, port), flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        remove_runtime()
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
