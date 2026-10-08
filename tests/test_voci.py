#!/usr/bin/env python3
"""Prova le voci naturali incluse (dalla 3.3: Giorgio, Serena, Paola) con il vero motore Piper per Linux:
ogni voce deve parlare, Giorgio deve essere la predefinita e un file .onnx.json «Piper 1.5» deve essere ripulito.
Uso: python3 tests/test_voci.py   (salta se la cache delle voci non c'è: la prepara tools/voci.sh)
Autore: Danilo D'Auria - Licenza MIT"""
import json, os, shutil, subprocess, sys, tarfile, tempfile

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(os.environ.get("PD_CACHE") or os.path.expanduser("~/.cache/professore-digitale"), "voci")
INCLUSE = ("it_IT-giorgio-medium", "it_IT-serena-medium", "it_IT-paola-medium")
esiti = []


def check(nome, ok, det=""):
    esiti.append(bool(ok))
    print(("  OK  " if ok else "  FAIL") + " " + nome + ("" if ok or not det else "  -> " + str(det)[:300]))


if not all(os.path.isfile(os.path.join(CACHE, v + ".onnx")) for v in INCLUSE) or not os.path.isfile(os.path.join(CACHE, "piper_linux_x86_64.tar.gz")):
    print("  (voci non presenti in %s: prova saltata)" % CACHE)
    sys.exit(0)
T = tempfile.mkdtemp(prefix="pd-voci-")
try:
    lib = os.path.join(T, "lib", "piper"); os.makedirs(lib)
    with tarfile.open(os.path.join(CACHE, "piper_linux_x86_64.tar.gz")) as t:
        t.extractall(lib, **({"filter": "data"} if hasattr(tarfile, "data_filter") else {}))
    os.rename(os.path.join(lib, "piper"), os.path.join(lib, "x86_64"))
    voci = os.path.join(T, "voci"); os.makedirs(voci)
    subprocess.run(["bash", "-c", 'source tools/voci.sh && copia_voci "$1"', "_", voci], cwd=RADICE, check=True)
    dati = os.path.join(T, "dati"); mod = os.path.join(dati, "models", "piper"); os.makedirs(mod)
    # una voce «scaricata dall'utente» con il formato Piper 1.5 (simboli doppi nella mappa): va ripulita da sola
    d = json.load(open(os.path.join(RADICE, "packaging/voci/it_IT-serena-medium.onnx.json")))
    d["phoneme_id_map"]["aɪ"] = [161]
    json.dump(d, open(os.path.join(mod, "it_IT-prova-medium.onnx.json"), "w"), ensure_ascii=False)
    shutil.copy(os.path.join(CACHE, "it_IT-serena-medium.onnx"), os.path.join(mod, "it_IT-prova-medium.onnx"))
    os.environ.update(PD_LIB_DIR=os.path.join(T, "lib"), PD_VOICES_DIR=voci, PD_DATA_DIR=dati)
    sys.path.insert(0, os.path.join(RADICE, "src", "server"))
    import pd_server as S
    S.MODELS_DIR = os.path.join(dati, "models")
    elenco = S.tts_voices()
    ids = [v["id"] for v in elenco if v["motore"] == "piper"]
    check("Piper avviabile", bool(S.piper_bin()), S.piper_bin())
    check("voci incluse elencate", all("piper:" + v in ids for v in INCLUSE), ids)
    check("Giorgio per primo (voce predefinita)", ids and ids[0] == "piper:it_IT-giorgio-medium", ids)
    check("Riccardo non c'è più", not any("riccardo" in i for i in ids), ids)
    check("generi giusti", {v["id"]: v["genere"] for v in elenco}.get("piper:it_IT-serena-medium") == "f" and
          {v["id"]: v["genere"] for v in elenco}.get("piper:it_IT-giorgio-medium") == "m")
    for v in INCLUSE + ("it_IT-prova-medium",):
        try:
            wav, eng = S.synthesize("Buongiorno! Oggi impariamo insieme, con calma. Pronti?", 0.95, voice="piper:" + v)
            check("parla: " + v, eng == "piper" and wav[:4] == b"RIFF" and len(wav) > 30000, (eng, len(wav)))
        except Exception as e:
            check("parla: " + v, False, e)
    pul = json.load(open(os.path.join(mod, "it_IT-prova-medium.onnx.json")))
    check("file della voce scaricata ripulito", "aɪ" not in pul["phoneme_id_map"])
    wav, eng = S.synthesize("Prova", 1.0, voice="piper:it_IT-riccardo-x_low")
    check("voce Riccardo salvata nelle impostazioni → Giorgio", eng == "piper" and len(wav) > 1000)
finally:
    shutil.rmtree(T, ignore_errors=True)
print("RISULTATO voci: %d/%d" % (sum(esiti), len(esiti)))
sys.exit(0 if all(esiti) else 1)
