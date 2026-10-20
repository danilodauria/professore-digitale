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
  * l'interfaccia ascolta SOLO su 127.0.0.1; la rete locale si usa solo se l'utente accende
    il quadro dell'aula (pd_aula.py) o la condivisione con i tablet (pd_tablet.py, porta 8768);
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
import urllib.parse
import urllib.request

try:
    from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
except ImportError:  # Python < 3.7 (non supportato ufficialmente)
    from http.server import HTTPServer as ThreadingHTTPServer, BaseHTTPRequestHandler

APP_ID = "professore-digitale"

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pd_packs  # noqa: E402  (pacchetti di contenuti)
import pd_aula   # noqa: E402  (quadro dell'aula in rete locale, stato della connessione)
import pd_tablet  # noqa: E402  (condivisione con i tablet dell'aula, spenta se non la si accende)
import pd_nonni   # noqa: E402  (Nonni Teach: interviste, podcast e sito, dalla 3.6)

SHARE_DIR = os.path.normpath(os.path.join(HERE, ".."))
WEB_DIR = os.path.normpath(os.environ.get("PD_WEB_DIR") or os.path.join(SHARE_DIR, "web"))
STT_WORKER = os.path.join(HERE, "pd_stt_worker.py")


def _leggi_versione():
    """Unica fonte del numero di versione: il file VERSION (installato accanto a server/ e web/)."""
    for p in (os.path.join(SHARE_DIR, "VERSION"), os.path.join(SHARE_DIR, "..", "VERSION")):
        try:
            with open(p) as f:
                v = f.read().strip()
            if re.match(r"^\d+\.\d+\.\d+$", v):
                return v
        except OSError:
            pass
    return "0.0.0"


def _leggi_distribuzione():
    """Impostazioni di chi distribuisce il programma (indirizzo aggiornamenti), scritte da build.sh."""
    for p in (os.path.join(SHARE_DIR, "distribuzione.json"), os.path.join(SHARE_DIR, "..", "distribuzione.json")):
        try:
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            pass
    return {}


VERSION = _leggi_versione()
DISTRIBUZIONE = _leggi_distribuzione()

XDG_DATA = os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share")
DATA_DIR = os.environ.get("PD_DATA_DIR") or os.path.join(XDG_DATA, APP_ID)
MODELS_DIR = os.path.join(DATA_DIR, "models")
SYSTEM_PACKS = os.environ.get("PD_SYSTEM_PACKS") or os.path.join(SHARE_DIR, "contenuti")
USER_PACKS = os.path.join(DATA_DIR, "contenuti")
LOCAL_PACKS = os.environ.get("PD_LOCAL_PACKS") or "/var/lib/professore-digitale/contenuti"   # per tutti gli utenti del PC
VENV_PY = os.path.join(DATA_DIR, "venv", "bin", "python3")
RUNTIME_DIR = os.environ.get("XDG_RUNTIME_DIR") or tempfile.gettempdir()
RUNTIME_FILE = os.path.join(RUNTIME_DIR, "%s-%d.json" % (APP_ID, os.getuid()))

OLLAMA_HOST = (os.environ.get("OLLAMA_HOST") or "http://127.0.0.1:11434").rstrip("/")
if not OLLAMA_HOST.startswith("http"):
    OLLAMA_HOST = "http://" + OLLAMA_HOST

UPDATE_URL_DEFAULT = DISTRIBUZIONE.get("aggiornamenti_url") or \
    "https://raw.githubusercontent.com/danilodauria/professore-digitale/main/aggiornamenti.json"

DATA_KEYS = ("settings", "progress", "history", "board", "practice", "profili", "registro")
MAX_BODY = 8 * 1024 * 1024        # 8 MB (audio del microfono)
COPERTINA_NONNI = os.path.join(WEB_DIR, "img", "nonni-teach", "copertina.jpg")
MAX_JSON = 2 * 1024 * 1024
MAX_TTS_CHARS = 6000

LAST_SEEN = [time.time()]
AULA = [None]
TABLET = [None]
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


_SCRITTURA = threading.Lock()


def atomic_write(path, data):
    # il server risponde a piu' richieste insieme: un salvataggio alla volta e un file temporaneo per ognuno
    with _SCRITTURA:
        tmp = "%s.%d.%d.tmp" % (path, os.getpid(), threading.get_ident())
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


def nome_sistema():
    info = {}
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if "=" in line:
                    k, v = line.rstrip("\n").split("=", 1)
                    info[k] = v.strip('"')
    except OSError:
        pass
    return info.get("PRETTY_NAME") or "Linux"


def recommended_model(ram_mb):
    """Stesse fasce del catalogo della versione Windows (windows/catalogo-ia.json)."""
    if ram_mb and ram_mb < 6000:
        return "qwen3.5:0.8b"
    if ram_mb and ram_mb < 8000:
        return "qwen3.5:2b"
    if ram_mb and ram_mb < 16000:
        return "qwen3.5:4b"
    if ram_mb and ram_mb < 24000:
        return "qwen3.5:9b"
    return "gemma4:12b"


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
#  Sintesi vocale (TTS): voci naturali Piper (incluse nel pacchetto: Giorgio, Serena e Paola),
#  Pico (femminile) ed espeak-ng (varianti maschili e femminili). L'utente sceglie la voce.
# ------------------------------------------------------------------------------
LIB_DIR = os.environ.get("PD_LIB_DIR") or "/usr/lib/professore-digitale"
VOICES_DIR = os.environ.get("PD_VOICES_DIR") or os.path.join(SHARE_DIR, "voci")
PIPER_NOMI = {"paola": ("Paola", "f"), "riccardo": ("Riccardo", "m"), "serena": ("Serena", "f"), "giorgio": ("Giorgio", "m"),
              "leonardo": ("Leonardo", "m"), "ugo": ("Ugo", "m"), "aurora": ("Aurora", "f")}
PIPER_ORDINE = ("giorgio", "serena", "paola")   # il Professore e' un uomo: prima Giorgio, poi le voci femminili
PIPER_PAUSA = "0.25"                           # secondi di pausa tra una frase e l'altra: la voce respira
ESPEAK_VARIANTI = (("m3", "Voce leggera maschile", "m"), ("m1", "Voce leggera maschile, grave", "m"),
                   ("f2", "Voce leggera femminile", "f"), ("f4", "Voce leggera femminile, morbida", "f"))
VOCE_PREDEFINITA = ("piper:it_IT-giorgio-medium", "piper:it_IT-serena-medium", "piper:it_IT-paola-medium",
                    "piper:it_IT-riccardo-x_low", "espeak:m3", "pico")


def pulisci_json_voce(path):
    """Le voci addestrate con Piper 1.5 hanno nella mappa dei fonemi anche coppie di simboli (es. "aɪ") che il motore
    Piper incluso rifiuta: si tolgono (l'italiano non le usa). Restituisce True se il file e' utilizzabile."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        m = d.get("phoneme_id_map") or {}
        brutti = [k for k in m if len(k) != 1]
        if brutti:
            for k in brutti:
                del m[k]
            atomic_write(path, json.dumps(d, ensure_ascii=False, indent=1))
            log("Voce ripulita per Piper:", path)
        return True
    except (OSError, ValueError):
        return False


def _arch_piper():
    import platform
    m = platform.machine().lower()
    return {"x86_64": "x86_64", "amd64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}.get(m, m)


def piper_bin():
    """Primo eseguibile Piper che funziona davvero (alcuni sistemi molto vecchi non lo possono avviare)."""
    with LOCK:
        if STATE.get("piper_t") and time.time() - STATE["piper_t"] < 300:
            return STATE.get("piper_bin")
    trovato = None
    for c in (os.path.join(DATA_DIR, "piper", "piper"), os.path.join(LIB_DIR, "piper", _arch_piper(), "piper"),
              shutil.which("piper")):
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            try:
                p = subprocess.run([c, "--version"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20)
                if p.returncode == 0:
                    trovato = c
                    break
            except (OSError, subprocess.SubprocessError):
                pass
            log("Piper non avviabile:", c)
    with LOCK:
        STATE["piper_bin"], STATE["piper_t"] = trovato, time.time()
    return trovato


def piper_models():
    """{nome_file_senza_estensione: percorso}: le voci scaricate dall'utente prevalgono su quelle incluse."""
    out = {}
    for d in (VOICES_DIR, os.path.join(MODELS_DIR, "piper")):
        try:
            for name in sorted(os.listdir(d)):
                js = os.path.join(d, name + ".json")
                if name.endswith(".onnx") and os.path.isfile(js):
                    if d != VOICES_DIR and os.access(js, os.W_OK) and not pulisci_json_voce(js):
                        continue
                    out[name[:-5]] = os.path.join(d, name)
        except OSError:
            pass
    return out


def piper_model():
    m = piper_models()
    return next(iter(m.values()), None)


def _espeak():
    return shutil.which("espeak-ng") or shutil.which("espeak")


def tts_voices():
    """Elenco delle voci disponibili: [{"id", "nome", "genere": "m"/"f", "motore", "naturale"}]."""
    voci = []
    if piper_bin():
        def posto(b):
            for i, n in enumerate(PIPER_ORDINE):
                if "-%s-" % n in b:
                    return i
            return len(PIPER_ORDINE)
        for base in sorted(piper_models(), key=lambda b: (posto(b), b)):
            parti = base.split("-")
            chi = parti[1] if len(parti) > 1 else base
            nome, genere = PIPER_NOMI.get(chi, (chi.capitalize(), ""))
            descr = {"m": "uomo", "f": "donna"}.get(genere, "voce")
            voci.append({"id": "piper:" + base, "nome": "%s (%s, voce naturale)" % (nome, descr),
                         "genere": genere, "motore": "piper", "naturale": True})
    if shutil.which("pico2wave"):
        voci.append({"id": "pico", "nome": "Pico (donna, voce chiara)", "genere": "f", "motore": "pico", "naturale": False})
    es = _espeak()
    if es:
        eng = os.path.basename(es)
        for var, nome, genere in ESPEAK_VARIANTI:
            voci.append({"id": "espeak:" + var, "nome": nome, "genere": genere, "motore": eng, "naturale": False})
    return voci


def tts_engines():
    engines = []
    if piper_bin() and piper_models():
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


def _ordine_voci(voice, engine):
    voci = tts_voices()
    ids = [v["id"] for v in voci]
    ordine = []
    if voice and voice in ids:
        ordine.append(voice)
    elif engine:      # compatibilita' con le versioni precedenti: si chiedeva un motore
        ordine += [v["id"] for v in voci if v["motore"] == engine or (engine == "espeak-ng" and v["id"].startswith("espeak:"))][:1]
    ordine += [v for v in VOCE_PREDEFINITA if v in ids and v not in ordine]
    ordine += [v for v in ids if v not in ordine]
    return ordine


def synthesize(text, rate=1.0, engine=None, voice=None):
    """Restituisce (bytes_wav, nome_motore) oppure solleva RuntimeError."""
    text = clean_for_speech(text)
    if not text:
        raise RuntimeError("testo vuoto")
    rate = max(0.5, min(1.6, float(rate or 1.0)))
    ordine = _ordine_voci(voice, engine)
    if not ordine:
        raise RuntimeError("nessun motore vocale installato (installare espeak-ng)")
    last_err = None
    for vid in ordine[:3]:
        try:
            with tempfile.TemporaryDirectory(prefix="pd-tts-") as tmp:
                out = os.path.join(tmp, "voce.wav")
                if vid.startswith("piper:"):
                    eng = "piper"
                    model = piper_models().get(vid[6:])
                    subprocess.run([piper_bin(), "--model", model, "--output_file", out,
                                    "--length_scale", "%.2f" % (1.0 / rate), "--sentence_silence", PIPER_PAUSA],
                                   input=text.encode("utf-8"), stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=120, check=True)
                elif vid == "pico":
                    eng = "pico"
                    level = int(max(50, min(160, rate * 90)))
                    safe = text.replace("<", " ").replace(">", " ")
                    subprocess.run(["pico2wave", "-l", "it-IT", "-w", out,
                                    '<speed level="%d">%s</speed>' % (level, safe)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   timeout=120, check=True)
                else:  # espeak-ng / espeak con variante maschile o femminile
                    es = _espeak()
                    eng = os.path.basename(es)
                    var = vid.split(":", 1)[1] if ":" in vid else "m3"
                    wpm = int(150 * rate)
                    subprocess.run([es, "-v", "it+" + var, "-s", str(wpm), "-w", out, "--stdin"],
                                   input=text.encode("utf-8"), stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=120, check=True)
                with open(out, "rb") as f:
                    data = f.read()
                if len(data) > 44:
                    return data, eng
        except Exception as e:  # prova la voce successiva
            last_err = e
            log("TTS", vid, "fallito:", e)
    raise RuntimeError("sintesi vocale non riuscita: %s" % last_err)


def voce_neura():
    """Neura (Nonni Teach) ha una voce femminile: prima Serena o Paola (Piper), poi Pico o espeak-ng femminile."""
    voci = tts_voices()
    for cond in (lambda v: v["genere"] == "f" and v["naturale"], lambda v: v["genere"] == "f"):
        for v in voci:
            if cond(v):
                return v["id"]
    return None


def sintetizza_neura(testo):
    return synthesize(testo, 0.95, None, voce_neura())[0]


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
    return pd_packs.versione_tupla(v)


RE_SHA = re.compile(r"^[0-9a-f]{64}$")


def indirizzo_locale(host):
    """True se l'host e' nella rete locale: IP privati (10.x, 172.16-31.x, 192.168.x), questo computer,
    oppure nomi .local / .lan / .home.arpa. Serve per gli aggiornamenti senza Internet (server in aula)."""
    import ipaddress
    host = (host or "").strip("[]").lower()
    if host == "localhost" or host.endswith((".local", ".lan", ".home.arpa")):
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_private or ip.is_loopback


def url_consentito(url):
    """https ovunque; http solo verso la rete locale (le impronte SHA-256 restano obbligatorie per i pacchetti)."""
    if re.match(r"^https://[^\s]+$", url or ""):
        return True
    m = re.match(r"^http://(\[[0-9a-fA-F:]+\]|[^/:\s]+)(:\d+)?(/[^\s]*)?$", url or "")
    return bool(m and indirizzo_locale(m.group(1)))


def scarica(url, limite):
    """Scarica al massimo `limite` byte da un indirizzo https (solo su richiesta dell'utente)."""
    if not url_consentito(url):
        raise RuntimeError("indirizzo non valido (serve https, oppure http verso un computer della rete locale)")
    req = urllib.request.Request(url, headers={"User-Agent": "professore-digitale/" + VERSION})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read(limite + 1)
    if len(data) > limite:
        raise RuntimeError("file troppo grande")
    return data


def pacchetti_installati():
    return pd_packs.carica_tutti([("sistema", SYSTEM_PACKS), ("computer", LOCAL_PACKS), ("utente", USER_PACKS)], VERSION)


def check_update(url):
    """Legge aggiornamenti.json (oppure il vecchio version.txt) e confronta le versioni."""
    testo = scarica(url, 256 * 1024).decode("utf-8", "replace").strip()
    res = {"current": VERSION, "online": None, "newer": False, "note": [], "data": "",
           "pacchetto": None, "sha256": None, "pagina": None, "contenuti": []}
    if testo.startswith("{"):
        try:
            info = json.loads(testo)
        except ValueError:
            raise RuntimeError("file degli aggiornamenti non valido")
        online = str(info.get("versione", ""))
        res["data"] = str(info.get("data", ""))[:20]
        res["note"] = [str(n)[:300] for n in (info.get("note") or [])[:30]]
        for chiave in ("pacchetto", "pagina"):
            u = info.get(chiave)
            if isinstance(u, str) and u:
                u = urllib.parse.urljoin(url, u)
                if url_consentito(u):
                    res[chiave] = u
        sha = str(info.get("sha256", "")).lower()
        res["sha256"] = sha if RE_SHA.match(sha) else None
        installati = {p["pacchetto"]["id"]: p["pacchetto"]["versione"] for p in pacchetti_installati()[0]}
        for c in (info.get("contenuti") or [])[:50]:
            if not isinstance(c, dict):
                continue
            cid, cver, curl = str(c.get("id", "")), str(c.get("versione", "")), c.get("url")
            if not pd_packs.RE_ID.match(cid) or not pd_packs.RE_VER.match(cver) or not isinstance(curl, str):
                continue
            curl = urllib.parse.urljoin(url, curl)
            if not url_consentito(curl):
                continue
            have = installati.get(cid)
            stato = "nuovo" if have is None else ("aggiornamento" if parse_version(cver) > parse_version(have) else "installato")
            csha = str(c.get("sha256", "")).lower()
            res["contenuti"].append({"id": cid, "versione": cver, "titolo": str(c.get("titolo", cid))[:120],
                                     "descrizione": str(c.get("descrizione", ""))[:300], "url": curl,
                                     "sha256": csha if RE_SHA.match(csha) else None,
                                     "installata": have, "stato": stato})
    else:
        online = testo.splitlines()[0].strip() if testo else ""
    if not re.match(r"^\d+(\.\d+){0,2}$", online):
        raise RuntimeError("risposta non valida dal server degli aggiornamenti")
    res["online"] = online
    res["newer"] = parse_version(online) > parse_version(VERSION)
    return res


def cartella_download():
    try:
        p = subprocess.run(["xdg-user-dir", "DOWNLOAD"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5)
        d = p.stdout.decode().strip()
        if d and os.path.isdir(d) and d != os.path.expanduser("~"):
            return d
    except (OSError, subprocess.SubprocessError):
        pass
    for nome in ("Scaricati", "Downloads"):
        d = os.path.join(os.path.expanduser("~"), nome)
        if os.path.isdir(d):
            return d
    return os.path.expanduser("~")


def scarica_pacchetto_deb(url, sha256):
    """Scarica il nuovo .deb in Scaricati verificandone l'impronta SHA-256. Non installa nulla."""
    import hashlib
    nome = url.rsplit("/", 1)[-1]
    if not re.match(r"^professore-digitale_\d+\.\d+\.\d+_all\.deb$", nome):
        raise RuntimeError("nome del pacchetto non valido")
    if not RE_SHA.match(sha256 or ""):
        raise RuntimeError("manca l'impronta SHA-256: download rifiutato per sicurezza")
    # a pezzi direttamente su disco: il pacchetto supera i 200 MB (le voci naturali sono incluse)
    if not url_consentito(url):
        raise RuntimeError("indirizzo non valido (serve https, oppure http verso un computer della rete locale)")
    limite, h, n = 900 * 1024 * 1024, hashlib.sha256(), 0
    dest = os.path.join(cartella_download(), nome)
    req = urllib.request.Request(url, headers={"User-Agent": "professore-digitale/" + VERSION})
    try:
        with urllib.request.urlopen(req, timeout=30) as r, open(dest + ".part", "wb") as f:
            while True:
                pezzo = r.read(1024 * 1024)
                if not pezzo:
                    break
                n += len(pezzo)
                if n > limite:
                    raise RuntimeError("file troppo grande")
                h.update(pezzo)
                f.write(pezzo)
        if h.hexdigest() != sha256:
            raise RuntimeError("impronta SHA-256 non corrispondente: file scartato")
    except BaseException:
        try:
            os.remove(dest + ".part")
        except OSError:
            pass
        raise
    os.replace(dest + ".part", dest)
    return dest


def importa_pacchetto(pack):
    err = pd_packs.valida(pack, VERSION)
    if err:
        raise ValueError("pacchetto non valido: " + "; ".join(err[:5]))
    return pd_packs.salva(pack, USER_PACKS)


# ------------------------------------------------------------------------------
#  Gestore HTTP
# ------------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "ProfessoreDigitale/" + VERSION
    protocol_version = "HTTP/1.1"
    ospite = False          # True per le richieste dei tablet (TabletHandler)

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
        return self._post_protetto(self.path.split("?", 1)[0])

    def _post_protetto(self, path):
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
        if path == "/api/status" and self.ospite:
            # tablet dell'aula: solo cio' che serve all'interfaccia, niente percorsi di disco o dati del PC
            ok, models = ollama_models()
            return self._send(200, {
                "ok": True, "version": VERSION, "mode": "server", "ospite": True,
                "ai": {"available": ok, "models": models},
                "tts": {"engines": tts_engines(), "voices": tts_voices()},
                "stt": {"engine": None, "detail": None}, "system": {},
            })
        if path == "/api/status":
            ok, models = ollama_models()
            ram = mem_total_mb()
            settings = read_json_file(os.path.join(DATA_DIR, "settings.json"), {}) or {}
            stt = stt_probe()
            return self._send(200, {
                "ok": True, "version": VERSION, "mode": "server",
                "ai": {"available": ok, "host": OLLAMA_HOST, "models": models,
                       "recommended": recommended_model(ram)},
                "tts": {"engines": tts_engines(), "voices": tts_voices()},
                "stt": {"engine": stt.get("engine"), "detail": stt.get("model")},
                "system": {"ram_mb": ram, "python": sys.version.split()[0],
                           "data_dir": DATA_DIR, "cpus": os.cpu_count(), "os": nome_sistema(),
                           "pc": pd_aula.nome_pc()},
                "update_url": settings.get("updateUrl") or UPDATE_URL_DEFAULT,
            })
        if path == "/api/rete":
            forza = "forza=1" in (self.path.split("?", 1) + [""])[1]
            r = pd_aula.stato_rete(forza)
            return self._send(200, {"ok": True, "online": r["online"], "via": r["via"], "eta_s": int(time.time() - r["t"])})
        if path == "/api/aula":
            return self._send(200, AULA[0].stato() if AULA[0] else {"ok": True, "ruolo": ""})
        if path == "/api/packs":
            packs, errori = pacchetti_installati()
            if self.ospite:     # ai tablet si mostra solo il nome del file, mai il percorso sul disco
                packs = [dict(p, file=os.path.basename(p.get("file") or "")) for p in packs]
                errori = [dict(e, file=os.path.basename(e.get("file") or "")) for e in errori]
            return self._send(200, {"ok": True, "packs": packs, "errori": errori})
        if path == "/api/tablet" and TABLET[0]:
            return self._send(200, TABLET[0].stato())
        m = re.match(r"^/api/data/([a-z]+)$", path)
        if m:
            key = m.group(1)
            if key not in DATA_KEYS:
                return self._error(404, "chiave sconosciuta")
            return self._send(200, {"ok": True, "value": read_json_file(os.path.join(DATA_DIR, key + ".json"))})
        if path.startswith("/api/nonni"):
            return self._nonni_get(path)
        return self._error(404, "API sconosciuta")

    # --- Nonni Teach (3.6): solo da questo PC, mai dai tablet ---
    def _nonni_get(self, path):
        try:
            if path == "/api/nonni":
                return self._send(200, {"ok": True, "episodi": pd_nonni.elenco(DATA_DIR), "ffmpeg": bool(pd_nonni.ffmpeg()),
                                        "voce_neura": voce_neura(), "sito": os.path.join(DATA_DIR, "nonni-teach-sito"),
                                        "url_predefinito": pd_nonni.SITO_PREDEFINITO, "consulente": pd_nonni.stato_consulente(DATA_DIR),
                                        "sistema": "linux"})
            if path == "/api/nonni/sito.zip":
                zp = os.path.join(DATA_DIR, "nonni-teach-sito.zip")
                if not os.path.isfile(zp):
                    return self._error(404, "prima create il sito")
                with open(zp, "rb") as f:
                    return self._send(200, f.read(), "application/zip", {"Content-Disposition": 'attachment; filename="nonni-teach-sito.zip"'})
            parti = path.split("/")
            if len(parti) == 4:
                return self._send(200, dict(pd_nonni.leggi(DATA_DIR, parti[3]), ok=True))
            if len(parti) == 6 and parti[4] == "file":
                dati, ctype = pd_nonni.file_audio(DATA_DIR, parti[3], urllib.parse.unquote(parti[5]))
                return self._send(200, dati, ctype)
        except ValueError as e:
            return self._error(404, str(e))
        return self._error(404, "API sconosciuta")

    # --- API POST ---
    def _api_post(self, path):
        if path.startswith("/api/nonni/"):
            return self._nonni_post(path)
        if path == "/api/heartbeat":
            self._read_body(1024)
            return self._send(200, {"ok": True})

        if path == "/api/chat":
            return self._chat(self._read_json())

        if path == "/api/tts":
            req = self._read_json()
            try:
                wav, eng = synthesize(str(req.get("text", "")), req.get("rate", 1.0), req.get("engine"),
                                      str(req.get("voice") or "") or None)
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
                return self._error(502, str(e))
            res["ok"] = True
            return self._send(200, res)

        if path == "/api/packs/import":
            req = self._read_json()
            dest = importa_pacchetto(req.get("pack"))
            return self._send(200, {"ok": True, "file": dest})

        if path == "/api/packs/remove":
            req = self._read_json()
            pid = str(req.get("id", ""))
            if not pd_packs.RE_ID.match(pid):
                raise ValueError("id non valido")
            f = os.path.join(USER_PACKS, pid + ".json")
            if not os.path.isfile(f):
                return self._error(404, "pacchetto non presente tra quelli importati")
            os.unlink(f)
            return self._send(200, {"ok": True})

        if path == "/api/packs/download":
            req = self._read_json()
            try:
                data = scarica(str(req.get("url", "")), pd_packs.MAX_BYTES)
                sha = str(req.get("sha256") or "")
                if sha:
                    import hashlib
                    if hashlib.sha256(data).hexdigest() != sha:
                        raise RuntimeError("impronta SHA-256 non corrispondente")
                pack = json.loads(data.decode("utf-8"))
            except (RuntimeError, ValueError, OSError) as e:
                return self._error(502, "download non riuscito: %s" % e)
            dest = importa_pacchetto(pack)
            return self._send(200, {"ok": True, "file": dest, "id": pack["id"], "versione": pack["versione"]})

        if path == "/api/update-download":
            req = self._read_json()
            try:
                dest = scarica_pacchetto_deb(str(req.get("url", "")), str(req.get("sha256") or ""))
            except (RuntimeError, OSError) as e:
                return self._error(502, str(e))
            return self._send(200, {"ok": True, "file": dest})

        if path.startswith("/api/aula/") and AULA[0]:
            req = self._read_json()
            aula = AULA[0]
            azione = path[len("/api/aula/"):]
            if azione == "presenza":
                aula.aggiorna_presenza(req)
                st = aula.stato()
                return self._send(200, {"ok": True, "ruolo": st["ruolo"], "annuncio": st.get("annuncio"),
                                        "invio": st.get("invio"), "server": st.get("server")})
            if azione == "applica":
                aula.applica()
                return self._send(200, aula.stato())
            if azione == "cerca":
                trovati = aula.cerca(2.0)
                agg = None
                url = (read_json_file(os.path.join(DATA_DIR, "settings.json"), {}) or {}).get("updateUrl") or ""
                m = re.match(r"^http://([^/:]+)", url)
                if m and indirizzo_locale(m.group(1)):
                    try:
                        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                        with opener.open(url, timeout=3) as r:
                            r.read(1024)
                        agg = {"url": url, "raggiungibile": True}
                    except Exception:
                        agg = {"url": url, "raggiungibile": False}
                return self._send(200, {"ok": True, "trovati": trovati, "aggiornamenti": agg,
                                        "ips": pd_aula.indirizzi_locali(), "pc": pd_aula.nome_pc()})
            if azione == "annuncio":
                return self._send(200, {"ok": True, "annuncio": aula.imposta_annuncio(req.get("testo", ""))})
            if azione == "rimuovi":
                aula.rimuovi(str(req.get("id", "")))
                return self._send(200, {"ok": True})
            r = aula.api_locale(azione, req)   # mano alzata (3.3): /api/aula/mano, /api/aula/rispondi
            if r:
                return self._send(*r)
            return self._error(404, "API sconosciuta")

        if path == "/api/tablet" and TABLET[0]:
            # condivisione con i tablet: si accende, si spegne e si gestisce SOLO da questo PC (127.0.0.1)
            req = self._read_json()
            tab, azione = TABLET[0], req.get("azione")
            if azione == "accendi":
                if not tab.accendi():
                    return self._send(409, dict(tab.stato(), ok=False, error=tab.errore))
            elif azione == "spegni":
                tab.spegni()
            elif azione == "codice":
                tab.cambia_codice()
            elif azione == "togli":
                tab.togli(str(req.get("id", "")))
            else:
                raise ValueError("azione non valida (accendi, spegni, codice, togli)")
            return self._send(200, tab.stato())

        if path == "/api/stt-reprobe":
            self._read_body(1024)
            return self._send(200, {"ok": True, "stt": stt_probe(force=True)})

        if path == "/api/shutdown":
            self._read_body(1024)
            self._send(200, {"ok": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return None

        return self._error(404, "API sconosciuta")

    def _nonni_post(self, path):
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip()
        m = re.match(r"^/api/nonni/([a-z0-9-]+)/audio/(\d{1,2})$", path)
        if m:
            if not ctype.startswith("audio/"):
                raise ValueError("serve un file audio")
            corpo = self._read_body(pd_nonni.MAX_AUDIO)
            return self._send(200, dict(pd_nonni.salva_audio(DATA_DIR, m.group(1), m.group(2), corpo, ctype), ok=True))
        if path == "/api/nonni/importa-backup":
            corpo = self._read_body(pd_nonni.MAX_BACKUP)
            return self._send(200, pd_nonni.importa_backup(DATA_DIR, corpo))
        req = self._read_json()
        if path == "/api/nonni/salva":
            return self._send(200, dict(pd_nonni.salva(DATA_DIR, req.get("episodio")), ok=True))
        if path == "/api/nonni/sito":
            return self._send(200, pd_nonni.crea_sito(DATA_DIR, req.get("url"), req.get("titolo"), req.get("autore"), req.get("email"), COPERTINA_NONNI))
        if path == "/api/nonni/importa":
            return self._send(200, pd_nonni.importa_consulente(DATA_DIR))
        m = re.match(r"^/api/nonni/([a-z0-9-]+)/(monta|elimina)$", path)
        if m:
            if m.group(2) == "elimina":
                return self._send(200, pd_nonni.elimina(DATA_DIR, m.group(1)))
            try:
                return self._send(200, pd_nonni.monta(DATA_DIR, m.group(1), sintetizza_neura if tts_engines() else None))
            except RuntimeError as e:
                return self._error(500, str(e))
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
        resp = None
        for think in (False, None):
            body = {
                "model": model, "messages": clean, "stream": True,
                "options": {"temperature": float(req.get("temperature", 0.4)),
                            "num_ctx": int(req.get("num_ctx", 2048))},
                "keep_alive": "15m",
            }
            if think is not None:
                body["think"] = think   # i modelli che "ragionano" (es. qwen3.5) rispondono prima senza ragionamento esteso
            upstream = urllib.request.Request(OLLAMA_HOST + "/api/chat", data=json.dumps(body).encode("utf-8"),
                                              headers={"Content-Type": "application/json"})
            try:
                resp = urllib.request.urlopen(upstream, timeout=600)
                break
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:300]
                if think is not None and "think" in detail:
                    continue    # modello o versione di Ollama che non accetta "think": si riprova senza
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
#  Tablet dell'aula (pd_tablet.py): secondo ascolto, solo rete locale, codice e lista bianca
# ------------------------------------------------------------------------------
class TabletHandler(Handler):
    ospite = True

    def _ip(self):
        return self.client_address[0]

    def _host_ok(self):
        # l'unico Host valido e' l'indirizzo di questo PC su cui e' arrivata la connessione (niente nomi: DNS rebinding)
        try:
            loc = self.connection.getsockname()[0]
        except OSError:
            return False
        return (self.headers.get("Host") or "").lower() == "%s:%d" % (loc, TABLET[0].porta)

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        return origin is None or origin == "http://" + (self.headers.get("Host") or "").lower()

    def _error(self, code, msg):
        # un rifiuto puo' lasciare non letto il corpo della richiesta: si chiude la connessione (niente avanzi)
        self.close_connection = True
        self._send(code, {"ok": False, "error": msg}, extra={"Connection": "close"})

    def _vietato(self, msg="non consentito dai tablet"):
        return self._error(403, msg)

    def _token(self):
        return pd_tablet.token_da_cookie(self.headers.get("Cookie"))

    def _pagina_codice(self, errore="", code=200):
        self._send(code, pd_tablet.pagina_codice(errore), "text/html; charset=utf-8",
                   {"Content-Security-Policy": pd_tablet.CSP_CODICE})

    def do_GET(self):
        tab = TABLET[0]
        if not pd_tablet.ip_privato(self._ip()):
            return self._vietato("solo dalla rete locale")
        if not self._host_ok():
            return self._error(403, "host non consentito")
        LAST_SEEN[0] = time.time()
        path, _, query = self.path.partition("?")
        q = urllib.parse.parse_qs(query)
        if path == "/" and "c" in q:
            esito, token = tab.prova_codice(self._ip(), q["c"][0].strip())
            if esito == "ok":
                return self._send(303, b"", "text/plain; charset=utf-8", {
                    "Location": "/", "Set-Cookie": "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Strict" %
                    (pd_tablet.COOKIE, token, pd_tablet.SESSIONE_S)})
            return self._pagina_codice(esito, 429 if esito == "troppi" else 403)
        token = self._token()
        sess = tab.sessione(token, self._ip())
        if not sess:
            if path.startswith("/api/"):
                return self._vietato("serve il codice del facilitatore")
            if path in ("/", "/index.html"):
                return self._pagina_codice("scaduto" if token else "")
            return self._vietato("serve il codice del facilitatore")
        if path.startswith("/api/"):
            if path not in pd_tablet.OSPITE_GET:
                return self._vietato()
            return self._api_get(path)
        return self._static(path)

    def do_POST(self):
        tab = TABLET[0]
        if not pd_tablet.ip_privato(self._ip()):
            return self._vietato("solo dalla rete locale")
        if not self._host_ok() or not self._origin_ok():
            return self._error(403, "origine non consentita")
        path = self.path.split("?", 1)[0]
        token = self._token()
        sess = tab.sessione(token, self._ip())
        if not sess:
            return self._vietato("serve il codice del facilitatore")
        if path not in pd_tablet.OSPITE_POST:
            return self._vietato()
        LAST_SEEN[0] = time.time()
        if path == "/api/ospite/presenza":
            return self._post_ospite(self._presenza, token, sess)
        sem = tab.chat if path == "/api/chat" else tab.tts
        if not sem.acquire(False):
            return self._error(503, "il PC dell'aula sta già rispondendo ad altri tablet: riprovate tra poco")
        try:
            return self._post_protetto(path)
        finally:
            sem.release()

    def _post_ospite(self, fn, *a):
        try:
            return fn(*a)
        except ValueError as e:
            return self._error(400, str(e))

    def _presenza(self, token, sess):
        """Il tablet compare nel quadro dell'aula come un allievo (stessa validazione di /aula/ciao)."""
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > pd_tablet.MAX_PRESENZA:
            raise ValueError("richiesta non valida")
        d = self._read_json()
        if not isinstance(d, dict):
            raise ValueError("oggetto atteso")
        att = d.get("attivita") if isinstance(d.get("attivita"), dict) else {}
        nome = pd_aula.testo_pulito(d.get("nome"), 60)
        TABLET[0].aggiorna(token, nome, pd_aula.testo_pulito(att.get("titolo"), 120))
        aula = AULA[0]
        if not aula or aula.ruolo != "facilitatore":
            return self._send(200, {"ok": True, "aula": False})
        corpo = {"id": "tablet-" + sess["id"], "codice": aula.cfg.get("codice", ""), "pc": "Tablet o telefono",
                 "utente": nome, "versione": VERSION, "sistema": {"os": "Tablet o telefono (ospite)"},
                 "componenti": {"ia": "IA del PC dell'aula", "voce": "PC dell'aula", "microfono": ""},
                 "attivita": att, "progressi": d.get("progressi"), "mano": d.get("mano")}
        codice, risp = aula.ricevi(corpo, self._ip())
        if codice == 200:
            risp["aula"] = True
        return self._send(codice, risp)


def crea_server_tablet(porta):
    srv = Server(("0.0.0.0", porta), TabletHandler)
    srv.daemon_threads = True
    return srv


# ------------------------------------------------------------------------------
#  Avvio
# ------------------------------------------------------------------------------
class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # le finestre chiuse a meta' richiesta non sono errori: niente rumore nel registro
        if isinstance(sys.exc_info()[1], (ConnectionResetError, BrokenPipeError, TimeoutError)):
            return
        ThreadingHTTPServer.handle_error(self, request, client_address)


def idle_watchdog(server):
    while True:
        time.sleep(10)
        facilitatore = AULA[0] is not None and AULA[0].ruolo == "facilitatore"
        if STATE["idle_timeout"] > 0 and not facilitatore and time.time() - LAST_SEEN[0] > STATE["idle_timeout"]:
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
            server = Server(("127.0.0.1", port), Handler)
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
    threading.Thread(target=piper_bin, daemon=True).start()
    try:
        aula = pd_aula.Aula(DATA_DIR, VERSION, lambda: read_json_file(os.path.join(DATA_DIR, "settings.json"), {}), log)
        aula.sistema = {"os": nome_sistema(), "ram_mb": mem_total_mb(), "cpus": os.cpu_count() or 0,
                        "arch": os.uname().machine}
        aula.avvia()
        AULA[0] = aula
    except Exception as e:   # l'aula e' facoltativa: il Professore funziona comunque
        log("aula non disponibile:", repr(e))
    tab = pd_tablet.Condivisione(log, pd_aula.indirizzi_locali)
    tab.fabbrica = crea_server_tablet
    TABLET[0] = tab
    if (read_json_file(os.path.join(DATA_DIR, "settings.json"), {}) or {}).get("tabletCondividi") is True:
        tab.accendi()      # scelta fatta dall'utente su questo PC (Aula -> Tablet): si riaccende con un codice nuovo
    print("Professore Digitale %s in ascolto su http://127.0.0.1:%d/" % (VERSION, port), flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        remove_runtime()
        if TABLET[0]:
            TABLET[0].spegni()
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
