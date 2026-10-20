#!/usr/bin/env python3
"""Test di src/server/pd_nonni.py (Nonni Teach, dalla 3.6) senza browser:
trasferimento dal Consulente Digitale (cartella dello stesso PC e file .cdbackup), sito con feed RSS per Spotify/Apple
(copertina quadrata ed email), solo interviste con consenso, nomi di file e percorsi sicuri.
Uso: python3 tests/test_nonni.py      Autore: Danilo D'Auria - Licenza MIT"""
import io
import json
import os
import sys
import tempfile
import zipfile
from xml.etree import ElementTree

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(QUI, "..", "src", "server"))
import pd_nonni  # noqa: E402

ERRORI = []


def check(nome, cond, det=""):
    print(("  OK   " if cond else "  FAIL ") + nome + ("" if cond else "  → %s" % (det,)))
    if not cond:
        ERRORI.append(nome)


def dimensioni_jpeg(p):
    """(larghezza, altezza, componenti) dal marcatore SOF del JPEG, senza librerie."""
    with open(p, "rb") as f:
        b = f.read()
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF:
            i += 1
            continue
        m, n = b[i + 1], int.from_bytes(b[i + 2:i + 4], "big")
        if m in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(b[i + 7:i + 9], "big"), int.from_bytes(b[i + 5:i + 7], "big"), b[i + 9]
        i += 2 + n
    return None


def episodio(cartella, id_, pubblica=True, audio=b"RIFF0000WAVEfmt finto"):
    d = os.path.join(cartella, "nonni-teach", id_)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "r01.wav"), "wb") as f:
        f.write(audio)
    e = {"id": id_, "titolo": "I racconti di " + id_, "intervistato": "nonna Maria", "luogo": "Bagnoli", "contesto": "centro",
         "consenso_registrare": True, "consenso_pubblicare": pubblica, "licenza": "CC BY-NC-SA 4.0", "creato": 1767258000, "data": "2026-01-01",
         "podcast": "", "capitoli": [], "domande": [{"n": 1, "testo": "Come ti chiami?", "tema": "apertura", "nota": "Maria & Pippo <3", "file": "r01.wav", "durata": 3}]}
    with open(os.path.join(d, "episodio.json"), "w", encoding="utf-8") as f:
        json.dump(e, f)
    return e


def main():
    with tempfile.TemporaryDirectory() as t:
        pd_dati, cd = os.path.join(t, "pd"), os.path.join(t, "cd")
        os.environ["PD_CONSULENTE_DIR"] = cd
        episodio(cd, "20260101-1000-nonna-maria")
        episodio(cd, "20260102-1000-privata", pubblica=False)
        os.makedirs(os.path.join(cd, "nonni-teach", "rotta"))            # cartella senza episodio.json: ignorata
        with open(os.path.join(cd, "nonni.json"), "w") as f:
            json.dump({"url": "https://danilodauria.github.io/nonni-teach/", "autore": "Centro San Lorenzo"}, f)
        st = pd_nonni.stato_consulente(pd_dati)
        check("Consulente: trovate 2 interviste da copiare", st["episodi"] == 2 and st["nuove"] == 2, st)
        r = pd_nonni.importa_consulente(pd_dati)
        check("Consulente: 2 interviste copiate con le preferenze", r["copiate"] == 2 and r["prefs"]["autore"] == "Centro San Lorenzo", r)
        check("Consulente: gli originali restano dove sono", os.path.isfile(os.path.join(cd, "nonni-teach", "20260101-1000-nonna-maria", "r01.wav")))
        check("Consulente: l'origine è annotata", pd_nonni.leggi(pd_dati, "20260101-1000-nonna-maria").get("origine") == "Consulente Digitale")
        r = pd_nonni.importa_consulente(pd_dati)
        check("Consulente: la seconda volta non copia doppioni", r["copiate"] == 0 and r["saltate"] == 2, r)
        check("Consulente: dopo la copia non resta nulla di nuovo", pd_nonni.stato_consulente(pd_dati)["nuove"] == 0)

        # .cdbackup (zip del Consulente) con un file malevolo e una intervista nuova
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("consulente-digitale-backup.json", json.dumps({"formato": "cdbackup", "dati": {"nonni": {"email": "podcast@esempio.it"}}}))
            e = dict(episodio(t, "20260103-1000-nonno-pippo"))
            z.writestr("nonni-teach/20260103-1000-nonno-pippo/episodio.json", json.dumps(e))
            z.writestr("nonni-teach/20260103-1000-nonno-pippo/r01.wav", b"RIFF audio")
            z.writestr("nonni-teach/20260103-1000-nonno-pippo/../../evil.txt", b"no")
            z.writestr("nonni-teach/20260103-1000-nonno-pippo/script.sh", b"no")
            z.writestr("nonni-teach/../evil/episodio.json", b"{}")
        r = pd_nonni.importa_backup(pd_dati, buf.getvalue())
        check(".cdbackup: intervista e preferenze importate", r["copiate"] == 1 and r["prefs"] == {"email": "podcast@esempio.it"}, r)
        d = os.path.join(pd_dati, "nonni-teach", "20260103-1000-nonno-pippo")
        check(".cdbackup: solo i file ammessi", sorted(os.listdir(d)) == ["episodio.json", "r01.wav"], os.listdir(d))
        check(".cdbackup: niente file fuori dalla cartella", not os.path.exists(os.path.join(t, "evil.txt")) and not os.path.exists(os.path.join(pd_dati, "evil")))
        try:
            pd_nonni.importa_backup(pd_dati, b"non sono uno zip")
            check(".cdbackup: file sbagliato rifiutato", False)
        except ValueError as e:
            check(".cdbackup: file sbagliato rifiutato", "cdbackup" in str(e), e)

        # sito: solo le interviste con il consenso, copertina ed email nel feed
        cop = os.path.join(QUI, "..", "src", "web", "img", "nonni-teach", "copertina.jpg")
        r = pd_nonni.crea_sito(pd_dati, None, "Nonni Teach", "Centro San Lorenzo", "podcast@esempio.it", cop)
        check("sito: 2 episodi pubblicabili su 3", r["episodi"] == 2 and not r["avvisi"], r)
        sito = r["cartella"]
        feed = ElementTree.parse(os.path.join(sito, "feed.xml")).getroot()
        ns = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}
        ch = feed.find("channel")
        img = ch.find("itunes:image", ns)
        check("feed: copertina per Spotify e Apple", img is not None and img.get("href") == "https://danilodauria.github.io/nonni-teach/copertina.jpg")
        check("feed: email del proprietario", ch.findtext("itunes:owner/itunes:email", namespaces=ns) == "podcast@esempio.it")
        check("feed: generato dal Professore Digitale", "Professore Digitale" in ch.findtext("generator"))
        check("feed: 2 episodi con enclosure https", len(ch.findall("item")) == 2 and all(i.find("enclosure").get("url").startswith("https://") for i in ch.findall("item")))
        pagina = open(os.path.join(sito, "index.html"), encoding="utf-8").read()
        check("pagina: niente interviste senza consenso", "privata" not in pagina and "nonno-pippo" in pagina)
        check("pagina: testi neutralizzati (& <)", "Maria &amp; Pippo &lt;3" in pagina)
        check("pagina: crediti a Neura e al Professore Digitale", "Neura" in pagina and "Professore Digitale" in pagina and "Consulente" not in pagina)
        check("copertina: quadrata 3000x3000 a colori (requisiti di Apple Podcasts)", dimensioni_jpeg(os.path.join(sito, "copertina.jpg")) == (3000, 3000, 3))
        with zipfile.ZipFile(r["zip"]) as z:
            nomi = z.namelist()
        check("zip: pagina, feed, copertina, LEGGIMI e audio", {"index.html", "feed.xml", "copertina.jpg", "LEGGIMI.txt"} <= set(nomi) and any(n.startswith("audio/") for n in nomi), nomi)
        r = pd_nonni.crea_sito(pd_dati, None, None, None, "", None)
        check("sito: senza email e copertina avvisa", len(r["avvisi"]) == 2, r)
        for cattivo in ("http://esempio.it/", "javascript:alert(1)", "https://a.it/<x>"):
            try:
                pd_nonni.crea_sito(pd_dati, cattivo)
                check("sito: indirizzo non valido rifiutato (%s)" % cattivo, False)
            except ValueError:
                check("sito: indirizzo non valido rifiutato (%s)" % cattivo, True)
        for nome in ("../episodio.json", "r01.exe", "episodio.json"):
            try:
                pd_nonni.file_audio(pd_dati, "20260101-1000-nonna-maria", nome)
                check("file: nome non ammesso rifiutato (%s)" % nome, False)
            except ValueError:
                check("file: nome non ammesso rifiutato (%s)" % nome, True)
        try:
            pd_nonni.leggi(pd_dati, "../pd")
            check("id non valido rifiutato", False)
        except ValueError:
            check("id non valido rifiutato", True)
    print("✔ NONNI TEACH: tutto a posto" if not ERRORI else "✘ NONNI TEACH: %d errori" % len(ERRORI))
    return 1 if ERRORI else 0


if __name__ == "__main__":
    sys.exit(main())
