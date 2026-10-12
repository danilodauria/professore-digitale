#!/usr/bin/env python3
"""Genera src/web/js/data-sostieni.js (dati per «Sostieni il progetto» e codici QR in SVG, gia' pronti:
l'app non genera nulla e non si collega a Internet) e docs/sorgenti/img-sostieni/*.svg per i vademecum.
Uso: python3 tools/genera-sostieni.py   (serve `pip install segno`, solo per chi sviluppa)
Per cambiare IBAN o PayPal modificare i dati qui sotto e rilanciare.
Autore: Danilo D'Auria - Licenza MIT"""
import io, json, os, re
import segno

INTESTATARIO = "Danilo D'Auria"
IBAN = "IT82F3608105138265704265952"
CONTO = "PostePay Evolution"
PAYPAL = "https://www.paypal.me/DDauria"
CAUSALE = "Contributo volontario Professore Digitale"
EMAIL = "danilodauria.site@gmail.com"


def iban_valido(iban):
    r = iban[4:] + iban[:4]
    return int("".join(str(int(c, 36)) for c in r)) % 97 == 1


assert iban_valido(IBAN), "IBAN non valido"

# QR SEPA (standard EPC069-12): letto da molte app bancarie, che compilano da sole il bonifico.
epc = "\n".join(["BCD", "002", "1", "SCT", "", INTESTATARIO, IBAN, "", "", "", CAUSALE])


def svg(dati):
    q = segno.make(dati, error="m", micro=False)
    out = io.BytesIO()
    q.save(out, kind="svg", scale=1, border=2, dark="#000", light="#fff", xmldecl=False, svgns=True, nl=False)
    s = out.getvalue().decode()
    s = re.sub(r'<svg ', '<svg role="img" preserveAspectRatio="xMidYMid meet" ', s, count=1)
    s = re.sub(r' width="\d+" height="\d+"', lambda m: ' viewBox="0 0 %s %s"' % tuple(re.findall(r"\d+", m.group(0))), s, count=1)
    return s


qr_paypal, qr_iban = svg(PAYPAL), svg(epc)
radice = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dati = {"intestatario": INTESTATARIO, "iban": IBAN, "conto": CONTO, "paypal": PAYPAL,
        "causale": CAUSALE, "email": EMAIL, "qrPaypal": qr_paypal, "qrIban": qr_iban}
with open(os.path.join(radice, "src/web/js/data-sostieni.js"), "w", encoding="utf-8") as f:
    f.write("/* Generato da tools/genera-sostieni.py: non modificare a mano. */\n")
    f.write("window.PD_SOSTIENI = " + json.dumps(dati, ensure_ascii=False, indent=1) + ";\n")
img = os.path.join(radice, "docs/sorgenti/img-sostieni")
os.makedirs(img, exist_ok=True)
for nome, s in (("qr-paypal.svg", qr_paypal), ("qr-bonifico.svg", qr_iban)):
    with open(os.path.join(img, nome), "w", encoding="utf-8") as f:
        f.write(s.replace('<svg ', '<svg width="400" height="400" ', 1))
print("ok: data-sostieni.js e img-sostieni/")
