#!/usr/bin/env python3
"""Rimpicciolisce un PDF stampato da tools/pdf-da-html.py senza perdere qualita' visibile:
- le fotografie (JPEG) piu' larghe di 1400 px vengono ridotte e ricompresse (qualita' 80);
- le immagini identiche ripetute (es. le emoji, anche dentro i caratteri Type3) vengono salvate una sola volta.
Uso: python3 tools/comprimi-pdf.py FILE.pdf   (sovrascrive il file). Richiede pikepdf e Pillow.
Autore: Danilo D'Auria - Licenza MIT"""
import hashlib, io, os, sys
import pikepdf
from PIL import Image

src = sys.argv[1]
prima = os.path.getsize(src)
pdf = pikepdf.open(src, allow_overwriting_input=True)
visti, uguali = {}, {}
for obj in list(pdf.objects):
    if not isinstance(obj, pikepdf.Stream) or obj.get("/Subtype") != "/Image":
        continue
    raw = obj.read_raw_bytes()
    if obj.get("/Filter") == "/DCTDecode" and int(obj.Width) > 1400 and "/SMask" not in obj:
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        h = round(im.height * 1400 / im.width)
        im = im.resize((1400, h), Image.LANCZOS)
        out = io.BytesIO(); im.save(out, "JPEG", quality=80, optimize=True, progressive=True)
        if len(out.getvalue()) < len(raw):
            obj.write(out.getvalue(), filter=pikepdf.Name("/DCTDecode"))
            obj.Width, obj.Height = 1400, h
            raw = obj.read_raw_bytes()
    sm = obj.get("/SMask")
    extra = hashlib.sha256(sm.read_raw_bytes()).hexdigest() if sm is not None else ""
    chiave = hashlib.sha256(raw + repr(sorted((str(k), str(v)) for k, v in obj.items() if k not in ("/Length", "/SMask"))).encode() + extra.encode()).hexdigest()
    if chiave in visti:
        uguali[obj.objgen] = visti[chiave]
    else:
        visti[chiave] = obj

fatti = set()


def sostituisci(risorse):
    """Sostituisce le immagini doppie anche dentro i moduli e i caratteri Type3 (le emoji di Chromium)."""
    if risorse is None:
        return
    xo = risorse.get("/XObject")
    if xo is not None:
        for nome in list(xo.keys()):
            x = xo[nome]
            if x.objgen in uguali:
                xo[nome] = uguali[x.objgen]
            elif x.get("/Subtype") == "/Form" and "/Resources" in x and x.objgen not in fatti:
                fatti.add(x.objgen); sostituisci(x.Resources)
    fo = risorse.get("/Font")
    if fo is not None:
        for nome in list(fo.keys()):
            f = fo[nome]
            if f.get("/Subtype") == "/Type3" and "/Resources" in f and f.objgen not in fatti:
                fatti.add(f.objgen); sostituisci(f.Resources)

for pg in pdf.pages:
    sostituisci(pg.obj.get("/Resources"))
pdf.remove_unreferenced_resources()
pdf.save(src, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate, recompress_flate=True)
print("compresso %s: %.1f MB -> %.1f MB" % (src, prima / 1e6, os.path.getsize(src) / 1e6))
