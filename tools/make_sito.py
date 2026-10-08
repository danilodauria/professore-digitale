#!/usr/bin/env python3
"""Crea la pagina principale del sito (dist/pubblica/index.html) dal modello tools/sito/pagina.html:
cos'è il Professore, app per telefono e tablet (app/, con QR code), download per Windows e Linux.
Uso: make_sito.py CARTELLA_PUBBLICA BASE_URL [PAGINA_PROGETTO]
Legge aggiornamenti.json nella cartella; il QR code si crea solo se c'è la libreria «segno»
(pip install segno), altrimenti la pagina esce senza QR. Autore: Danilo D'Auria - Licenza MIT"""
import html as H
import json, os, re, sys

QUI = os.path.dirname(os.path.abspath(__file__))


def mb(p):
    return "%.1f MB" % (os.path.getsize(p) / 1e6) if os.path.isfile(p) else ""


def qr_svg(url):
    try:
        import segno
    except ImportError:
        return ""
    svg = segno.make(url, error="m").svg_inline(scale=6, border=2, dark="#1f2a37", light="#ffffff",
                                               title="QR code: " + url)
    return ('<div class="qr"><div class="riquadro">' + svg + "</div>"
            "<p>Inquadrate il codice con la fotocamera del telefono per aprire il Professore.</p></div>")


def scheda(ico, titolo, testo, link, etichetta, extra=""):
    return ('<div class="card"><span class="ico" aria-hidden="true">%s</span><h3>%s</h3><p>%s</p>'
            '<div><a class="btn" href="%s">%s</a>%s</div></div>' % (ico, titolo, testo, H.escape(link, True), etichetta, extra))


def crea_pagina(pub, base_url, progetto=""):
    info = json.load(open(os.path.join(pub, "aggiornamenti.json"), encoding="utf-8"))
    ver = info["versione"]
    pezzi = []
    w = info.get("windows")
    if w and os.path.isfile(os.path.join(pub, w["pacchetto"])):
        extra = ""
        if w.get("zip") and os.path.isfile(os.path.join(pub, w["zip"])):
            extra = '<p class="piccolo" style="margin:.6rem 0 0">Senza installare, da chiavetta: <a href="%s">versione .zip</a> (%s)</p>' % (
                H.escape(w["zip"], True), mb(os.path.join(pub, w["zip"])))
        pezzi.append(scheda("🪟", "Windows", "Da Windows XP a Windows 11. Scaricate e fate doppio clic sul file (%s)." % mb(os.path.join(pub, w["pacchetto"])),
                            w["pacchetto"], "⬇️ Scarica per Windows", extra))
    deb = info.get("pacchetto")
    if deb and os.path.isfile(os.path.join(pub, deb)):
        pezzi.append(scheda("🐧", "Linux", "Debian, Ubuntu, Mint, FeniceOS (%s). Doppio clic sul file, oppure nel terminale: <code>sudo apt install ./%s</code>" % (
            mb(os.path.join(pub, deb)), H.escape(deb)), deb, "⬇️ Scarica per Linux"))
    port = info.get("portatile")
    if port and os.path.isfile(os.path.join(pub, port)):
        pezzi.append(scheda("📄", "Versione portatile", "Un solo file da aprire con il browser, su qualunque computer, anche da chiavetta. Senza voce naturale e senza IA (%s)." % mb(os.path.join(pub, port)),
                            port, "⬇️ Scarica il file"))
    altri = []
    for f, t in (("Vademecum_Professore_Digitale.pdf", "📘 Vademecum (Linux)"), ("Vademecum_Professore_Digitale_Windows.pdf", "📘 Vademecum (Windows)"),
                 ("NOTE-%s.md" % ver, "📝 Novità della versione %s" % ver)):
        if os.path.isfile(os.path.join(pub, f)):
            altri.append('<a href="%s">%s</a>' % (H.escape(f, True), t))
    icona = open(os.path.join(QUI, "..", "src", "web", "img", "icon.svg"), encoding="utf-8").read()
    icona = icona.replace("<svg ", '<svg role="img" aria-label="Il Professore" ', 1)
    valori = {
        "ICONA": icona,
        "QR": qr_svg(base_url.rstrip("/") + "/app/"),
        "VERSIONE": H.escape(ver),
        "DATA": H.escape(".".join(reversed(info.get("data", "").split("-"))) if info.get("data") else ""),
        "SCARICA": "\n".join(pezzi),
        "ALTRI": " ".join(altri),
        "PROGETTO": (' Sorgenti e segnalazioni: <a href="%s">%s</a>.' % (H.escape(progetto, True), H.escape(re.sub(r"^https?://", "", progetto)))) if progetto else "",
    }
    modello = open(os.path.join(QUI, "sito", "pagina.html"), encoding="utf-8").read()
    pagina = re.sub(r"\{\{([A-Z]+)\}\}", lambda m: valori[m.group(1)], modello)
    out = os.path.join(pub, "index.html")
    open(out, "w", encoding="utf-8").write(pagina)
    return out, bool(valori["QR"])


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("Uso: make_sito.py CARTELLA_PUBBLICA BASE_URL [PAGINA_PROGETTO]")
    out, qr = crea_pagina(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    print("creata la pagina del sito", out, "(con QR code)" if qr else "(senza QR code: manca la libreria segno)")
