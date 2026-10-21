#!/usr/bin/env python3
"""Prova le voci naturali incluse con i veri motori per Linux:
- Kokoro (dalla 3.8, sherpa-onnx): strutture ctypes uguali al file c-api.h, Nicola e Sara parlano (anche con accenti),
  Nicola predefinito sui PC con almeno 4 processori, processo che resta acceso e si riaccende se si chiude;
- Piper (dalla 3.3: Giorgio, Serena, Paola): ogni voce parla e un file .onnx.json «Piper 1.5» viene ripulito.
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
    # ---- Kokoro (Nicola e Sara) ----
    KC = os.path.join(CACHE, "kokoro"); KL = os.path.join(CACHE, "sherpa", "linux-x86_64"); KH = os.path.join(CACHE, "sherpa", "include", "c-api.h")
    if not os.path.isfile(os.path.join(KL, "libsherpa-onnx-c-api.so")):
        print("  (Kokoro non presente in %s: prova saltata)" % CACHE)
    else:
        import pd_kokoro as K, ctypes, wave
        if shutil.which("gcc") and os.path.isfile(KH):
            src = os.path.join(T, "l.c")
            open(src, "w").write('#include <stdio.h>\n#include <stddef.h>\n#include "c-api.h"\n#define O(x) offsetof(SherpaOnnxOfflineTtsConfig, x)\n'
                                 'int main(void){printf("%zu %zu %zu %zu %zu %zu %zu %zu\\n", sizeof(SherpaOnnxOfflineTtsConfig), O(model.num_threads),'
                                 'O(model.provider), O(model.kokoro), O(model.kokoro.lang), O(model.kokoro.length_scale), O(max_num_sentences), O(silence_scale));'
                                 'printf("%zu\\n", sizeof(SherpaOnnxGeneratedAudio)); return 0;}')
            subprocess.run(["gcc", "-I", os.path.dirname(KH), src, "-o", src + ".x"], check=True)
            c = subprocess.run([src + ".x"], stdout=subprocess.PIPE).stdout.decode().split()
            TC, MC = K.TtsConfig, K.ModelConfig
            py = [ctypes.sizeof(TC), MC.num_threads.offset, MC.provider.offset, MC.kokoro.offset, MC.kokoro.offset + K.Kokoro.lang.offset,
                  MC.kokoro.offset + K.Kokoro.length_scale.offset, TC.max_num_sentences.offset, TC.silence_scale.offset, ctypes.sizeof(K.Audio)]
            check("Kokoro: strutture ctypes = c-api.h", [int(x) for x in c] == py, (c, py))
        os.environ.update(PD_KOKORO_LIB=KL, PD_KOKORO_DIR=KC)
        S.STATE.pop("kokoro", None)
        ids = [v["id"] for v in S.tts_voices()]
        check("Kokoro: Nicola e Sara elencate", "kokoro:nicola" in ids and "kokoro:sara" in ids, ids)
        check("Kokoro: motore tra i motori", "kokoro" in S.tts_engines())
        os.environ["PD_KOKORO_PRIMA"] = "1"
        check("Kokoro: Nicola predefinito (PC con 4 processori)", S._ordine_voci(None, None)[0] == "kokoro:nicola", S._ordine_voci(None, None)[:3])
        check("Kokoro: Neura con Sara", S.voce_neura() == "kokoro:sara", S.voce_neura())
        os.environ["PD_KOKORO_PRIMA"] = "0"
        if (os.cpu_count() or 1) < 4:
            check("Kokoro: PC lento → prima Giorgio", S._ordine_voci(None, None)[0] == "piper:it_IT-giorgio-medium", S._ordine_voci(None, None)[:3])
        for vid in ("kokoro:nicola", "kokoro:sara"):
            try:
                wav, eng = S.synthesize("Perché è così? Città, più, però: va bene!", 1.0, voice=vid)
                w = wave.open(__import__("io").BytesIO(wav))
                check("Kokoro parla: " + vid, eng == "kokoro" and w.getframerate() == 24000 and w.getnframes() > 24000, (eng, len(wav)))
            except Exception as e:
                check("Kokoro parla: " + vid, False, e)
        m = S.kokoro()
        vecchio = m.proc.pid if m.proc else None
        wav, eng = S.synthesize("Ancora una frase.", 1.2, voice="kokoro:nicola")
        check("Kokoro: lo stesso processo per piu' frasi", m.proc and m.proc.pid == vecchio and eng == "kokoro")
        m.proc.kill(); m.proc.wait()
        wav, eng = S.synthesize("Mi riaccendo da solo.", 1.0, voice="kokoro:nicola")
        check("Kokoro: si riaccende se il processo si chiude", eng == "kokoro" and len(wav) > 10000)
        m._chiudi()
        S.STATE.pop("kokoro", None)
        os.environ["PD_KOKORO_DIR"] = os.path.join(T, "manca")
        check("Kokoro senza modello: non elencato", not any(v["motore"] == "kokoro" for v in S.tts_voices()))
        S.STATE.pop("kokoro", None)
        ko = os.path.join(T, "kokoro-rotto"); shutil.copytree(KC, ko); open(os.path.join(ko, "model.int8.onnx"), "wb").write(b"rotto")
        os.environ["PD_KOKORO_DIR"] = ko
        wav, eng = S.synthesize("Prova", 1.0, voice="kokoro:nicola")
        check("Kokoro guasto → un'altra voce", eng != "kokoro" and len(wav) > 1000, eng)
        check("Kokoro guasto → tolto dall'elenco", not any(v["motore"] == "kokoro" for v in S.tts_voices()))
finally:
    shutil.rmtree(T, ignore_errors=True)
print("RISULTATO voci: %d/%d" % (sum(esiti), len(esiti)))
sys.exit(0 if all(esiti) else 1)
