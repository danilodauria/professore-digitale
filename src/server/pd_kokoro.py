#!/usr/bin/env python3
"""Professore Digitale - voce naturale Kokoro (dalla 3.8): Nicola (uomo, la voce del Professore) e Sara (donna).

Il motore e' sherpa-onnx (libreria C, Apache 2.0) con il modello Kokoro (Apache 2.0). La libreria si carica con ctypes
in un PROCESSO SEPARATO che resta acceso: il modello (circa 140 MB) si legge una volta sola, le frasi successive
partono subito, e un eventuale errore del motore non ferma il server. Dopo 15 minuti senza parlare il processo si
chiude e libera la memoria. Solo libreria standard, Python 3.7+.

Protocollo con il processo (una riga per richiesta, UTF-8):
    sid <TAB> velocita <TAB> file.wav <TAB> testo   ->   "OK"  oppure  "ERR messaggio"
All'avvio il processo scrive "PRONTO" (modello caricato) oppure "ERR messaggio".
Uso interno:  python3 pd_kokoro.py --processo CARTELLA_LIBRERIA CARTELLA_MODELLO THREAD
Ideato e sviluppato da Danilo D'Auria - Licenza MIT"""
import ctypes
import os
import platform
import select
import subprocess
import sys
import threading
import time

# id del Professore Digitale -> (nome, genere, numero della voce nel modello Kokoro multilingue v1.0)
VOCI = (("nicola", "Nicola", "m", 36), ("sara", "Sara", "f", 35))
FILE_MODELLO = ("model.int8.onnx", "voices.bin", "tokens.txt", os.path.join("espeak-ng-data", "phontab"))
LIBRERIA = "libsherpa-onnx-c-api.so"
RIPOSO = 900          # secondi senza parlare prima di chiudere il processo
ATTESA_AVVIO = 180    # il primo avvio (disco lento, modello da leggere) puo' essere lungo


def arch():
    m = platform.machine().lower()
    return {"x86_64": "x86_64", "amd64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}.get(m, m)


def trova(cartelle_lib, cartelle_modello):
    """(cartella della libreria, cartella del modello) se Kokoro c'e' per questo computer, altrimenti None."""
    lib = next((d for d in cartelle_lib if d and os.path.isfile(os.path.join(d, LIBRERIA))), None)
    mod = next((d for d in cartelle_modello if d and all(os.path.isfile(os.path.join(d, f)) for f in FILE_MODELLO)), None)
    return (lib, mod) if lib and mod else None


def thread_consigliati():
    n = os.cpu_count() or 2
    return max(1, min(4, n))


# ------------------------------------------------------------------ strutture della C API di sherpa-onnx 1.13
# (stesso ordine dei campi di sherpa-onnx/c-api/c-api.h: tests/test_voci.py lo confronta con il vero file .h)
_p, _f, _i = ctypes.c_char_p, ctypes.c_float, ctypes.c_int32


class Vits(ctypes.Structure):
    _fields_ = [("model", _p), ("lexicon", _p), ("tokens", _p), ("data_dir", _p), ("noise_scale", _f),
                ("noise_scale_w", _f), ("length_scale", _f), ("dict_dir", _p)]


class Matcha(ctypes.Structure):
    _fields_ = [("acoustic_model", _p), ("vocoder", _p), ("lexicon", _p), ("tokens", _p), ("data_dir", _p),
                ("noise_scale", _f), ("length_scale", _f), ("dict_dir", _p)]


class Kokoro(ctypes.Structure):
    _fields_ = [("model", _p), ("voices", _p), ("tokens", _p), ("data_dir", _p), ("length_scale", _f),
                ("dict_dir", _p), ("lexicon", _p), ("lang", _p)]


class Kitten(ctypes.Structure):
    _fields_ = [("model", _p), ("voices", _p), ("tokens", _p), ("data_dir", _p), ("length_scale", _f)]


class Zipvoice(ctypes.Structure):
    _fields_ = [("tokens", _p), ("encoder", _p), ("decoder", _p), ("vocoder", _p), ("data_dir", _p), ("lexicon", _p),
                ("feat_scale", _f), ("t_shift", _f), ("target_rms", _f), ("guidance_scale", _f)]


class Pocket(ctypes.Structure):
    _fields_ = [("lm_flow", _p), ("lm_main", _p), ("encoder", _p), ("decoder", _p), ("text_conditioner", _p),
                ("vocab_json", _p), ("token_scores_json", _p), ("voice_embedding_cache_capacity", _i)]


class Supertonic(ctypes.Structure):
    _fields_ = [("duration_predictor", _p), ("text_encoder", _p), ("vector_estimator", _p), ("vocoder", _p),
                ("tts_json", _p), ("unicode_indexer", _p), ("voice_style", _p)]


class ModelConfig(ctypes.Structure):
    _fields_ = [("vits", Vits), ("num_threads", _i), ("debug", _i), ("provider", _p), ("matcha", Matcha),
                ("kokoro", Kokoro), ("kitten", Kitten), ("zipvoice", Zipvoice), ("pocket", Pocket),
                ("supertonic", Supertonic)]


class TtsConfig(ctypes.Structure):
    _fields_ = [("model", ModelConfig), ("rule_fsts", _p), ("max_num_sentences", _i), ("rule_fars", _p),
                ("silence_scale", _f)]


class Audio(ctypes.Structure):
    _fields_ = [("samples", ctypes.POINTER(ctypes.c_float)), ("n", _i), ("sample_rate", _i)]


# ------------------------------------------------------------------ il processo separato
def processo(cartella_lib, cartella_modello, thread):
    out = sys.stdout

    def scrivi(riga):
        out.write(riga + "\n")
        out.flush()

    try:
        lib = ctypes.CDLL(os.path.join(cartella_lib, LIBRERIA))
        lib.SherpaOnnxCreateOfflineTts.restype = ctypes.c_void_p
        lib.SherpaOnnxCreateOfflineTts.argtypes = [ctypes.POINTER(TtsConfig)]
        lib.SherpaOnnxOfflineTtsGenerate.restype = ctypes.POINTER(Audio)
        lib.SherpaOnnxOfflineTtsGenerate.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int32, ctypes.c_float]
        lib.SherpaOnnxDestroyOfflineTtsGeneratedAudio.argtypes = [ctypes.POINTER(Audio)]
        lib.SherpaOnnxWriteWave.restype = ctypes.c_int32
        lib.SherpaOnnxWriteWave.argtypes = [ctypes.POINTER(ctypes.c_float), ctypes.c_int32, ctypes.c_int32, ctypes.c_char_p]
        lib.SherpaOnnxOfflineTtsNumSpeakers.restype = ctypes.c_int32
        lib.SherpaOnnxOfflineTtsNumSpeakers.argtypes = [ctypes.c_void_p]
        conf = TtsConfig()          # tutto a zero, come memset nella C API
        k = conf.model.kokoro
        p = lambda nome: os.path.join(cartella_modello, nome).encode("utf-8")   # noqa: E731
        k.model, k.voices, k.tokens, k.data_dir = p("model.int8.onnx"), p("voices.bin"), p("tokens.txt"), p("espeak-ng-data")
        k.length_scale, k.lang, k.dict_dir, k.lexicon = 1.0, b"it", b"", b""
        conf.model.num_threads, conf.model.debug, conf.model.provider = int(thread), 0, b"cpu"
        conf.max_num_sentences, conf.silence_scale = 1, 0.2
        tts = lib.SherpaOnnxCreateOfflineTts(ctypes.byref(conf))
        if not tts:
            scrivi("ERR modello Kokoro non caricato")
            return 1
        voci = lib.SherpaOnnxOfflineTtsNumSpeakers(tts)
    except Exception as e:      # libreria mancante o non compatibile con questo sistema
        scrivi("ERR %s" % str(e).replace("\n", " ")[:300])
        return 1
    scrivi("PRONTO")
    for riga in sys.stdin.buffer:
        try:
            sid, vel, dest, testo = riga.decode("utf-8", "replace").rstrip("\r\n").split("\t", 3)
            sid, vel = int(sid), max(0.5, min(2.0, float(vel)))
            if not 0 <= sid < voci:
                raise ValueError("voce %d inesistente" % sid)
            a = lib.SherpaOnnxOfflineTtsGenerate(tts, testo.encode("utf-8"), sid, vel)
            if not a:
                raise RuntimeError("sintesi non riuscita")
            try:
                if a.contents.n <= 0 or not lib.SherpaOnnxWriteWave(a.contents.samples, a.contents.n, a.contents.sample_rate,
                                                                     dest.encode("utf-8")):
                    raise RuntimeError("audio vuoto")
            finally:
                lib.SherpaOnnxDestroyOfflineTtsGeneratedAudio(a)
            scrivi("OK")
        except Exception as e:
            scrivi("ERR %s" % str(e).replace("\n", " ")[:300])
    return 0


# ------------------------------------------------------------------ dal lato del server
class Motore(object):
    """Un processo Kokoro alla volta, acceso al primo uso (o in anticipo con prepara()) e spento dopo RIPOSO secondi."""

    def __init__(self, cartella_lib, cartella_modello, log=None, python=None):
        self.lib, self.modello = cartella_lib, cartella_modello
        self.log = log or (lambda *a: None)
        self.python = python or sys.executable or "python3"
        self.proc = None
        self.lock = threading.Lock()
        self.ultimo = 0.0
        self.guasto = 0.0        # ultimo avvio fallito: si riprova dopo 5 minuti
        self.errore = ""
        self.timer = None

    def _leggi(self, scadenza):
        p = self.proc
        riga = b""
        while not riga.endswith(b"\n"):
            resto = scadenza - time.time()
            if resto <= 0:
                raise RuntimeError("Kokoro non risponde")
            r, _, _ = select.select([p.stdout], [], [], resto)
            if not r:
                continue
            c = os.read(p.stdout.fileno(), 1)
            if not c:
                raise RuntimeError("Kokoro si e' chiuso")
            riga += c
        return riga.decode("utf-8", "replace").strip()

    def _chiudi(self):
        p, self.proc = self.proc, None
        if p:
            try:
                p.stdin.close()
            except OSError:
                pass
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()

    def _avvia(self):
        if self.proc and self.proc.poll() is None:
            return
        self._chiudi()
        if self.guasto and time.time() - self.guasto < 300:
            raise RuntimeError(self.errore or "Kokoro non disponibile")
        env = dict(os.environ, OMP_NUM_THREADS=str(thread_consigliati()))
        self.proc = subprocess.Popen([self.python, os.path.abspath(__file__), "--processo", self.lib, self.modello,
                                      str(thread_consigliati())], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.DEVNULL, env=env, close_fds=True)
        try:
            r = self._leggi(time.time() + ATTESA_AVVIO)
        except RuntimeError as e:
            r = "ERR %s" % e
        if r != "PRONTO":
            self.errore = r[4:] if r.startswith("ERR ") else r
            self.guasto = time.time()
            self.log("Kokoro non avviabile:", self.errore)
            self._chiudi()
            raise RuntimeError(self.errore)
        self.guasto, self.errore = 0.0, ""

    def _programma_riposo(self):
        if self.timer:
            self.timer.cancel()
        self.timer = threading.Timer(RIPOSO + 1, self._riposo)
        self.timer.daemon = True
        self.timer.start()

    def _riposo(self):
        with self.lock:
            if self.proc and time.time() - self.ultimo >= RIPOSO:
                self._chiudi()

    def prepara(self):
        """Accende il processo in anticipo (all'avvio del server), cosi' il saluto parte subito."""
        try:
            with self.lock:
                self._avvia()
                self.ultimo = time.time()
            self._programma_riposo()
            return True
        except RuntimeError:
            return False

    def disponibile(self):
        return not (self.guasto and time.time() - self.guasto < 300)

    def sintetizza(self, testo, sid, velocita, dest, timeout=120):
        testo = " ".join(testo.replace("\t", " ").split())
        with self.lock:
            for prova in (1, 2):         # se il processo si era chiuso, si riaccende una volta
                self._avvia()
                try:
                    self.proc.stdin.write(("%d\t%.2f\t%s\t%s\n" % (sid, velocita, dest, testo)).encode("utf-8"))
                    self.proc.stdin.flush()
                    r = self._leggi(time.time() + timeout)
                    break
                except (OSError, RuntimeError) as e:
                    self._chiudi()
                    if prova == 2:       # si chiude ancora: su questo computer Kokoro non va, per 5 minuti si usano le altre voci
                        self.guasto, self.errore = time.time(), "Kokoro si chiude da solo: %s" % e
                        self.log(self.errore)
                        raise RuntimeError(self.errore)
            self.ultimo = time.time()
        self._programma_riposo()
        if r != "OK":
            raise RuntimeError(r[4:] if r.startswith("ERR ") else r)


if __name__ == "__main__":
    if len(sys.argv) == 5 and sys.argv[1] == "--processo":
        sys.exit(processo(sys.argv[2], sys.argv[3], sys.argv[4]))
    print(__doc__)
