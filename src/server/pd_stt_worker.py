#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Professore Digitale - worker di riconoscimento vocale (STT) offline.
# Autore: Danilo D'Auria - Licenza MIT
#
# Viene eseguito come processo separato (con il Python del venv utente, se
# presente) cosi' il server principale resta leggero e privo di dipendenze.
#
#   pd_stt_worker.py --probe --models DIR   -> {"engine": "vosk"|"faster-whisper"|null}
#   pd_stt_worker.py --models DIR file.wav  -> {"text": "..."} oppure {"error": "..."}
#
# Motori supportati (in ordine di preferenza, per hardware datato):
#   1. Vosk            modello in  DIR/vosk-it/            (~50 MB, velocissimo)
#   2. faster-whisper  modello in  DIR/whisper/<nome>/     (tiny/base, INT8 su CPU)
import json
import os
import sys
import wave


def find_vosk(models):
    d = os.path.join(models, "vosk-it")
    if os.path.isdir(d) and (os.path.exists(os.path.join(d, "am")) or os.path.exists(os.path.join(d, "conf"))):
        try:
            import vosk  # noqa: F401
            return d
        except Exception:
            return None
    return None


def find_whisper(models):
    base = os.path.join(models, "whisper")
    if not os.path.isdir(base):
        return None
    try:
        import faster_whisper  # noqa: F401
    except Exception:
        return None
    for name in ("base", "small", "tiny"):
        d = os.path.join(base, name)
        if os.path.isfile(os.path.join(d, "model.bin")):
            return d
    return None


def probe(models):
    v = find_vosk(models)
    if v:
        return {"engine": "vosk", "model": v}
    w = find_whisper(models)
    if w:
        return {"engine": "faster-whisper", "model": w}
    return {"engine": None}


def run_vosk(model_dir, path):
    import vosk
    vosk.SetLogLevel(-1)
    wf = wave.open(path, "rb")
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
        raise RuntimeError("serve audio WAV mono 16 bit")
    model = vosk.Model(model_dir)
    rec = vosk.KaldiRecognizer(model, wf.getframerate())
    parts = []
    while True:
        data = wf.readframes(4000)
        if not data:
            break
        if rec.AcceptWaveform(data):
            parts.append(json.loads(rec.Result()).get("text", ""))
    parts.append(json.loads(rec.FinalResult()).get("text", ""))
    return " ".join(p for p in parts if p).strip()


def run_whisper(model_dir, path):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_dir, device="cpu", compute_type="int8",
                         cpu_threads=max(1, (os.cpu_count() or 2)))
    segments, _info = model.transcribe(path, language="it", beam_size=1, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip()


def main():
    args = sys.argv[1:]
    models = os.path.expanduser("~/.local/share/professore-digitale/models")
    if "--models" in args:
        i = args.index("--models")
        models = args[i + 1]
        del args[i:i + 2]
    if "--probe" in args:
        print(json.dumps(probe(models)))
        return 0
    if not args:
        print(json.dumps({"error": "manca il file audio"}))
        return 1
    info = probe(models)
    try:
        if info["engine"] == "vosk":
            text = run_vosk(info["model"], args[0])
        elif info["engine"] == "faster-whisper":
            text = run_whisper(info["model"], args[0])
        else:
            print(json.dumps({"error": "nessun motore di riconoscimento vocale installato"}))
            return 1
        print(json.dumps({"text": text}, ensure_ascii=False))
        return 0
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
