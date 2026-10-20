#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Professore Digitale - NONNI TEACH: interviste registrate, podcast e sito da pubblicare (dalla 3.6).

Nato nel Consulente Digitale (fino alla 1.3.1) e trasferito qui identico: in Nonni Teach conduce Neura.
Ogni intervista è una cartella in <dati>/nonni-teach/<id>/ con:
  episodio.json   titolo, persona intervistata, luogo, contesto, consensi, domande e note
  r01.webm ...    le risposte registrate dal microfono (formato del browser: webm/ogg/mp4/wav)
  d01.wav ...     le domande lette dalla voce di Neura (Piper o espeak-ng), se presente
  podcast.mp3     l'episodio montato con FFmpeg, con i capitoli (ID3) — oppure niente: si ascoltano le risposte
Il sito (index.html + feed.xml RSS + copertina + audio) contiene SOLO le interviste con il consenso alla pubblicazione.

Nessun dato esce dal computer: la pubblicazione la fa l'utente caricando la cartella del sito nel repository
GitHub «nonni-teach» (GitHub Pages). Le interviste fatte con il Consulente Digitale si copiano qui con
importa_consulente() (stesso PC) o importa_backup() (file .cdbackup).
Stesse risposte del server per Windows (windows/src/pd_nonni.c).
Ideato e sviluppato da Danilo D'Auria - Codice MIT, testi CC BY-NC-SA 4.0
"""
import glob
import html
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from email.utils import formatdate

RE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,70}$")
RE_FILE = re.compile(r"^(r|d)\d{2}\.(webm|ogg|oga|mp4|m4a|wav|mp3)$|^(podcast\.mp3|intro\.wav)$")
RE_FILE_EP = re.compile(r"^(r|d)\d{2}\.(webm|ogg|oga|mp4|m4a|wav|mp3)$|^(podcast\.mp3|intro\.wav|episodio\.json|capitoli\.txt)$")
TIPI = {"webm": "audio/webm", "ogg": "audio/ogg", "oga": "audio/ogg", "mp4": "audio/mp4", "m4a": "audio/mp4", "wav": "audio/wav", "mp3": "audio/mpeg"}
MAX_AUDIO = 80 * 1024 * 1024
MAX_BACKUP = 2 * 1024 * 1024 * 1024
SITO_PREDEFINITO = "https://danilodauria.github.io/nonni-teach/"
RE_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$")
NO_WINDOW = 0x08000000 if sys.platform.startswith("win") else 0


def cartella(dati):
    d = os.path.join(dati, "nonni-teach")
    os.makedirs(d, exist_ok=True)
    return d


def _ep_dir(dati, id_):
    if not isinstance(id_, str) or not RE_ID.match(id_):
        raise ValueError("intervista non valida")
    return os.path.join(cartella(dati), id_)


def _leggi(path, predef=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return predef


def _scrivi(path, dati):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def _testo(x, n=400):
    return " ".join(str(x or "").split())[:n]


# ---------------------------------------------------------------- strumenti esterni
def ffmpeg():
    """Percorso di ffmpeg, se installato (sudo apt install ffmpeg)."""
    trovato = shutil.which("ffmpeg")
    if trovato:
        return trovato
    for c in ("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg", "/snap/bin/ffmpeg"):
        if os.path.isfile(c):
            return c
    return None


def _durata(ff, path):
    """Durata in secondi letta da ffmpeg (riga «Duration» o, per i webm senza intestazione, ultimo «time=»)."""
    try:
        r = subprocess.run([ff, "-hide_banner", "-i", path, "-f", "null", "-"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           timeout=180, creationflags=NO_WINDOW)
        out = r.stdout.decode("utf-8", "replace")
    except (OSError, subprocess.SubprocessError):
        return 0.0
    tempi = re.findall(r"time=(\d+):(\d+):(\d+(?:\.\d+)?)", out)
    if tempi:
        h, m, s = tempi[-1]
        return int(h) * 3600 + int(m) * 60 + float(s)
    d = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", out)
    return int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0.0


# ---------------------------------------------------------------- episodi
def elenco(dati):
    out = []
    for d in sorted(glob.glob(os.path.join(cartella(dati), "*", "episodio.json")), reverse=True):
        e = _leggi(d)
        if isinstance(e, dict):
            e["risposte"] = sum(1 for x in e.get("domande", []) if x.get("file"))
            e.pop("domande", None)
            out.append(e)
    out.sort(key=lambda e: e.get("creato", 0), reverse=True)
    return out


def leggi(dati, id_):
    e = _leggi(os.path.join(_ep_dir(dati, id_), "episodio.json"))
    if not isinstance(e, dict):
        raise ValueError("intervista non trovata")
    return e


def salva(dati, ep):
    """Crea o aggiorna i dati di un'intervista (non i file audio)."""
    if not isinstance(ep, dict):
        raise ValueError("dati non validi")
    id_ = ep.get("id") or ""
    if not id_:
        base = re.sub(r"[^a-z0-9]+", "-", _testo(ep.get("intervistato"), 40).lower()).strip("-") or "intervista"
        id_ = time.strftime("%Y%m%d-%H%M") + "-" + base
    d = _ep_dir(dati, id_)
    if not ep.get("consenso_registrare"):
        raise ValueError("serve il consenso della persona intervistata per registrare")
    os.makedirs(d, exist_ok=True)
    vecchio = _leggi(os.path.join(d, "episodio.json"), {}) or {}
    domande = []
    for i, q in enumerate((ep.get("domande") or [])[:60]):
        if not isinstance(q, dict):
            continue
        v = (vecchio.get("domande") or [])[i] if i < len(vecchio.get("domande") or []) else {}
        domande.append({"n": i + 1, "testo": _testo(q.get("testo"), 500), "tema": _testo(q.get("tema"), 40), "nota": _testo(q.get("nota"), 2000),
                        "file": v.get("file", ""), "durata": v.get("durata", 0)})
    e = {"id": id_, "titolo": _testo(ep.get("titolo"), 160) or "Intervista", "intervistato": _testo(ep.get("intervistato"), 80),
         "luogo": _testo(ep.get("luogo"), 80), "contesto": _testo(ep.get("contesto"), 30), "intervistatore": _testo(ep.get("intervistatore"), 120),
         "descrizione": _testo(ep.get("descrizione"), 1500), "consenso_registrare": bool(ep.get("consenso_registrare")),
         "consenso_pubblicare": bool(ep.get("consenso_pubblicare")) and bool(ep.get("consenso_registrare")),
         "licenza": "CC BY-NC-SA 4.0", "creato": vecchio.get("creato") or time.time(), "data": vecchio.get("data") or time.strftime("%Y-%m-%d"),
         "podcast": vecchio.get("podcast", ""), "capitoli": vecchio.get("capitoli", []), "domande": domande}
    if vecchio.get("durata"):
        e["durata"] = vecchio["durata"]
    if vecchio.get("origine"):
        e["origine"] = vecchio["origine"]
    _scrivi(os.path.join(d, "episodio.json"), e)
    return e


def salva_audio(dati, id_, n, corpo, ctype):
    e = leggi(dati, id_)
    if not e.get("consenso_registrare"):
        raise ValueError("manca il consenso")
    try:
        n = int(n)
    except ValueError:
        raise ValueError("domanda non valida")
    if not 1 <= n <= len(e["domande"]):
        raise ValueError("domanda non valida")
    if not corpo or len(corpo) > MAX_AUDIO:
        raise ValueError("registrazione vuota o troppo grande")
    est = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3"}.get((ctype or "").split(";")[0].strip(), "webm")
    d = _ep_dir(dati, id_)
    for vecchio in glob.glob(os.path.join(d, "r%02d.*" % n)):
        os.remove(vecchio)
    nome = "r%02d.%s" % (n, est)
    with open(os.path.join(d, nome), "wb") as f:
        f.write(corpo)
    e["domande"][n - 1]["file"] = nome
    ff = ffmpeg()
    e["domande"][n - 1]["durata"] = round(_durata(ff, os.path.join(d, nome)), 1) if ff else 0
    e["podcast"] = ""       # il montaggio va rifatto
    _scrivi(os.path.join(d, "episodio.json"), e)
    return e["domande"][n - 1]


def file_audio(dati, id_, nome):
    if not RE_FILE.match(nome or ""):
        raise ValueError("file non valido")
    p = os.path.join(_ep_dir(dati, id_), nome)
    if not os.path.isfile(p):
        raise ValueError("file non trovato")
    with open(p, "rb") as f:
        return f.read(), TIPI.get(nome.rsplit(".", 1)[1], "application/octet-stream")


def elimina(dati, id_):
    d = _ep_dir(dati, id_)
    if os.path.isdir(d):
        shutil.rmtree(d)
    return {"ok": True}


# ---------------------------------------------------------------- montaggio del podcast
def monta(dati, id_, sintetizza=None):
    """Unisce: presentazione + (domanda letta da Neura + risposta) per ogni domanda registrata, in un MP3 con i capitoli."""
    e = leggi(dati, id_)
    d = _ep_dir(dati, id_)
    ff = ffmpeg()
    fatte = [q for q in e["domande"] if q.get("file")]
    if not fatte:
        raise ValueError("non ci sono ancora risposte registrate")
    if not ff:
        return {"ok": False, "serve_ffmpeg": True, "messaggio": "Per unire le registrazioni in un unico MP3 serve FFmpeg, un programma libero e gratuito. Intanto le risposte si ascoltano una per una."}
    pezzi, capitoli = [], []

    def voce(testo, nome):
        if not sintetizza:
            return None
        try:
            wav = sintetizza(testo)
        except Exception:      # noqa: BLE001 - la voce del server è facoltativa
            return None
        p = os.path.join(d, nome)
        with open(p, "wb") as f:
            f.write(wav)
        return p

    intro = voce("Nonni Teach. %s. %s%s. Registrato il %s." % (e["titolo"], ("Racconta: " + e["intervistato"] + ". ") if e["intervistato"] else "",
                                                                  ("A " + e["luogo"]) if e["luogo"] else "", e["data"]), "intro.wav")
    if intro:
        pezzi.append(("Presentazione", intro))
    for q in fatte:
        pd = voce(q["testo"], "d%02d.wav" % q["n"])
        titolo = "%d. %s" % (q["n"], q["testo"])
        if pd:
            pezzi.append((titolo, pd))
            titolo = None
        pezzi.append((titolo, os.path.join(d, q["file"])))
    # durate e capitoli (un capitolo = domanda + risposta)
    t = 0.0
    for titolo, p in pezzi:
        dur = _durata(ff, p)
        if titolo:
            capitoli.append({"titolo": titolo, "inizio": round(t, 2)})
        t += dur
    for i, c in enumerate(capitoli):
        c["fine"] = capitoli[i + 1]["inizio"] if i + 1 < len(capitoli) else round(t, 2)
    meta = os.path.join(d, "capitoli.txt")

    def esc(s):
        return re.sub(r"([=;#\\\n])", r"\\\1", s)
    with open(meta, "w", encoding="utf-8") as f:
        f.write(";FFMETADATA1\ntitle=%s\nartist=%s\nalbum=Nonni Teach\ngenre=Podcast\ndate=%s\ncomment=%s\n" % (
            esc(e["titolo"]), esc(e["intervistato"] or "Nonni Teach"), e["data"][:4],
            esc("Registrato con il Professore Digitale di Danilo D'Auria - " + e["licenza"])))
        for c in capitoli:
            f.write("[CHAPTER]\nTIMEBASE=1/1000\nSTART=%d\nEND=%d\ntitle=%s\n" % (c["inizio"] * 1000, c["fine"] * 1000, esc(c["titolo"][:120])))
    cmd = [ff, "-hide_banner", "-y"]
    for _, p in pezzi:
        cmd += ["-i", p]
    cmd += ["-i", meta]
    filtri = "".join("[%d:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,loudnorm=I=-18:TP=-2[a%d];" % (i, i) for i in range(len(pezzi)))
    filtri += "".join("[a%d]" % i for i in range(len(pezzi))) + "concat=n=%d:v=0:a=1[out]" % len(pezzi)
    uscita = os.path.join(d, "podcast.mp3")
    cmd += ["-filter_complex", filtri, "-map", "[out]", "-map_metadata", str(len(pezzi)), "-map_chapters", str(len(pezzi)),
            "-c:a", "libmp3lame", "-q:a", "5", "-id3v2_version", "3", uscita]
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=1800, creationflags=NO_WINDOW)
    if r.returncode != 0 or not os.path.isfile(uscita):
        raise RuntimeError("FFmpeg non è riuscito a montare il podcast: " + r.stdout.decode("utf-8", "replace")[-400:])
    e["podcast"] = "podcast.mp3"
    e["capitoli"] = capitoli
    e["durata"] = round(t, 1)
    _scrivi(os.path.join(d, "episodio.json"), e)
    return {"ok": True, "podcast": "podcast.mp3", "capitoli": capitoli, "durata": e["durata"], "voce_domande": bool(sintetizza and intro)}


# ---------------------------------------------------------------- sito da pubblicare (repository «nonni-teach», GitHub Pages)
def _hms(s):
    s = int(s or 0)
    return "%d:%02d:%02d" % (s // 3600, s % 3600 // 60, s % 60) if s >= 3600 else "%d:%02d" % (s // 60, s % 60)


def crea_sito(dati, url_base=None, titolo_sito=None, autore=None, email=None, copertina=None):
    """Prepara <dati>/nonni-teach-sito/ e lo zip da caricare nel repository «nonni-teach». Solo interviste con consenso a pubblicare.
    copertina = percorso dell'immagine quadrata (JPEG, 3000x3000) che Spotify e Apple Podcasts mostrano."""
    url = (url_base or SITO_PREDEFINITO).strip()
    if not re.match(r"^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/-]*)?$", url):
        raise ValueError("indirizzo del sito non valido (deve iniziare con https://)")
    if not url.endswith("/"):
        url += "/"
    tit = _testo(titolo_sito, 120) or "Nonni Teach"
    aut = _testo(autore, 120) or "Nonni Teach"
    email = _testo(email, 200)
    if email and not RE_EMAIL.match(email):
        raise ValueError("indirizzo email non valido")
    sito = os.path.join(dati, "nonni-teach-sito")
    if os.path.isdir(sito):
        shutil.rmtree(sito)
    os.makedirs(os.path.join(sito, "audio"))
    con_copertina = bool(copertina and os.path.isfile(copertina))
    if con_copertina:
        shutil.copyfile(copertina, os.path.join(sito, "copertina.jpg"))
    episodi = []
    for e in elenco(dati):
        if not e.get("consenso_pubblicare"):
            continue
        e = leggi(dati, e["id"])
        d = _ep_dir(dati, e["id"])
        file_ep = []
        if e.get("podcast") and os.path.isfile(os.path.join(d, e["podcast"])):
            nome = e["id"] + ".mp3"
            shutil.copyfile(os.path.join(d, e["podcast"]), os.path.join(sito, "audio", nome))
            file_ep.append({"file": nome, "titolo": e["titolo"], "tipo": "audio/mpeg"})
        else:
            for q in e["domande"]:
                if q.get("file") and os.path.isfile(os.path.join(d, q["file"])):
                    nome = "%s-%s" % (e["id"], q["file"])
                    shutil.copyfile(os.path.join(d, q["file"]), os.path.join(sito, "audio", nome))
                    file_ep.append({"file": nome, "titolo": q["testo"], "tipo": TIPI.get(q["file"].rsplit(".", 1)[1])})
        if file_ep:
            e["file_sito"] = file_ep
            episodi.append(e)
    # pagina
    h = html.escape
    blocchi = []
    for e in episodi:
        cap = ""
        if e.get("capitoli") and len(e["file_sito"]) == 1:
            cap = "<ol class=\"cap\">" + "".join("<li><a href=\"#\" data-t=\"%s\">%s</a> %s</li>" % (c["inizio"], _hms(c["inizio"]), h(c["titolo"])) for c in e["capitoli"]) + "</ol>"
        audio = "".join("<figure><figcaption>%s</figcaption><audio controls preload=\"none\" src=\"audio/%s\"></audio></figure>" % (h(f["titolo"]), h(f["file"])) for f in e["file_sito"])
        note = "".join("<li><b>%s</b> %s</li>" % (h(q["testo"]), h(q["nota"])) for q in e["domande"] if q.get("nota"))
        blocchi.append("<article id=\"%s\"><h2>%s</h2><p class=\"meta\">%s%s · %s</p>%s%s%s%s</article>" % (
            h(e["id"]), h(e["titolo"]), h(e["intervistato"]), (" · " + h(e["luogo"])) if e["luogo"] else "", h(e["data"]),
            ("<p>" + h(e["descrizione"]) + "</p>") if e.get("descrizione") else "", audio, cap, ("<details><summary>Appunti</summary><ul>" + note + "</ul></details>") if note else ""))
    testa = ('<img class="copertina" src="copertina.jpg" alt="Copertina del podcast %s" width="180" height="180">' % h(tit)) if con_copertina else '<div style="font-size:3rem">🎙️</div>'
    pagina = """<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%(tit)s</title><meta name="description" content="Podcast di Nonni Teach: i nonni insegnano, raccontano e ricordano.">
<link rel="alternate" type="application/rss+xml" title="%(tit)s" href="feed.xml">%(og)s
<style>
:root{--f:#060b1a;--p:#0f1a33;--t:#e6f1ff;--t2:#9fb3cf;--n:#38bdf8;--n2:#a78bfa}
@media (prefers-color-scheme: light){:root{--f:#f4f7fc;--p:#fff;--t:#0f1d36;--t2:#4a5b78;--n:#0369a1;--n2:#6d28d9}}
body{margin:0;background:var(--f);color:var(--t);font:18px/1.55 "Segoe UI",system-ui,sans-serif}
header{padding:2.5rem 1rem 1.5rem;text-align:center;background:radial-gradient(circle at 50%% 0,rgba(56,189,248,.25),transparent 60%%)}
.copertina{width:180px;height:180px;border-radius:22px;box-shadow:0 8px 30px rgba(56,189,248,.35)}
h1{margin:.2rem 0;font-size:2.2rem;letter-spacing:.04em}header p{color:var(--t2);margin:.3rem auto;max-width:42rem}
main{max-width:52rem;margin:0 auto;padding:0 16px 3rem}
article{background:var(--p);border:1px solid rgba(125,211,252,.25);border-radius:18px;padding:1rem 1.2rem;margin:1rem 0}
h2{margin:.2rem 0;color:var(--n)}.meta{color:var(--t2);margin:.2rem 0 .6rem}audio{width:100%%}figure{margin:.5rem 0}figcaption{font-size:.9rem;color:var(--t2)}
.cap{font-size:.92rem}.cap a{color:var(--n2);font-variant-numeric:tabular-nums}footer{text-align:center;color:var(--t2);font-size:.85rem;padding:2rem 16px}
a{color:var(--n)}
</style></head><body>
<header>%(testa)s<h1>%(tit)s</h1><p>I nonni insegnano: ricordi, mestieri, ricette, parole e consigli raccontati dalla loro voce.</p>
<p><a href="feed.xml">Feed RSS del podcast</a> · %(n)d episodi</p></header>
<main>%(blocchi)s</main>
<footer>Registrazioni pubblicate con il consenso delle persone intervistate · Contenuti %(lic)s · Curato da %(aut)s<br>
Interviste condotte da Neura e realizzate con il <b>Professore Digitale</b> ideato e sviluppato da <b>Danilo D'Auria</b> (codice MIT, contenuti CC BY-NC-SA 4.0).</footer>
<script>document.addEventListener("click",function(e){var a=e.target.closest("a[data-t]");if(!a)return;e.preventDefault();
var au=a.closest("article").querySelector("audio");au.currentTime=+a.getAttribute("data-t");au.play();});</script>
</body></html>""" % {"tit": h(tit), "n": len(episodi), "blocchi": "".join(blocchi) or "<p>Ancora nessun episodio pubblicato.</p>", "lic": "CC BY-NC-SA 4.0",
                     "aut": h(aut), "testa": testa,
                     "og": ('\n<meta property="og:title" content="%s"><meta property="og:image" content="%scopertina.jpg">' % (h(tit), h(url))) if con_copertina else ""}
    with open(os.path.join(sito, "index.html"), "w", encoding="utf-8") as f:
        f.write(pagina)
    # feed RSS (compatibile con le app dei podcast: Spotify e Apple vogliono copertina quadrata ed email del proprietario)
    voci = []
    for e in episodi:
        for f_ in e["file_sito"]:
            p = os.path.join(sito, "audio", f_["file"])
            voci.append("<item><title>%s</title><description>%s</description><guid isPermaLink=\"false\">%s</guid><pubDate>%s</pubDate>"
                        "<enclosure url=\"%saudio/%s\" length=\"%d\" type=\"%s\"/><itunes:author>%s</itunes:author>%s</item>" % (
                            h(e["titolo"] if len(e["file_sito"]) == 1 else e["titolo"] + " — " + f_["titolo"]), h(e.get("descrizione") or e["intervistato"]),
                            h(e["id"] + "/" + f_["file"]), formatdate(e.get("creato") or time.time()), h(url), h(f_["file"]), os.path.getsize(p), f_["tipo"],
                            h(e["intervistato"] or aut), ("<itunes:duration>%d</itunes:duration>" % int(e["durata"])) if e.get("durata") and len(e["file_sito"]) == 1 else ""))
    immagine = ("<itunes:image href=\"%scopertina.jpg\"/><image><url>%scopertina.jpg</url><title>%s</title><link>%s</link></image>" % (h(url), h(url), h(tit), h(url))) if con_copertina else ""
    proprietario = ("<itunes:owner><itunes:name>%s</itunes:name><itunes:email>%s</itunes:email></itunes:owner>" % (h(aut), h(email))) if email else ""
    feed = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\" xmlns:itunes=\"http://www.itunes.com/dtds/podcast-1.0.dtd\"><channel>"
            "<title>%s</title><link>%s</link><language>it</language><description>I nonni insegnano: ricordi e saperi raccontati dalla loro voce. Contenuti CC BY-NC-SA 4.0.</description>"
            "<itunes:author>%s</itunes:author>%s%s<itunes:explicit>false</itunes:explicit><itunes:type>episodic</itunes:type><itunes:category text=\"Society &amp; Culture\"/>"
            "<copyright>CC BY-NC-SA 4.0 - %s</copyright><generator>Professore Digitale di Danilo D'Auria</generator>%s</channel></rss>\n") % (
        h(tit), h(url), h(aut), immagine, proprietario, h(aut), "".join(voci))
    with open(os.path.join(sito, "feed.xml"), "w", encoding="utf-8") as f:
        f.write(feed)
    with open(os.path.join(sito, "LEGGIMI.txt"), "w", encoding="utf-8") as f:
        f.write("NONNI TEACH - sito del podcast\n\nCaricate TUTTO il contenuto di questa cartella nel repository GitHub «nonni-teach»\n"
                "con GitHub Desktop: copia dei file (sostituendo quelli vecchi), Commit, Push.\n"
                "Solo la prima volta: su GitHub, Settings > Pages > Deploy from a branch > main.\n"
                "Indirizzo previsto: %s\nFeed per Spotify e Apple Podcasts: %sfeed.xml\n\n"
                "Contengono solo le interviste con il consenso alla pubblicazione.\n"
                "Interviste condotte da Neura con il Professore Digitale di Danilo D'Auria - codice MIT, contenuti CC BY-NC-SA 4.0.\n" % (url, url))
    zp = os.path.join(dati, "nonni-teach-sito.zip")
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for radice, _, files in os.walk(sito):
            for fn in files:
                p = os.path.join(radice, fn)
                z.write(p, os.path.relpath(p, sito).replace(os.sep, "/"))
    avvisi = []
    if not email:
        avvisi.append("Senza email di contatto Spotify e Apple Podcasts non accettano il feed.")
    if not con_copertina:
        avvisi.append("Manca la copertina del podcast.")
    return {"ok": True, "cartella": sito, "zip": zp, "episodi": len(episodi), "url": url, "avvisi": avvisi}


# ---------------------------------------------------------------- trasferimento dal Consulente Digitale
def cartella_consulente():
    """Cartella dei dati del Consulente Digitale su questo PC (dove registrava Nonni Teach fino alla 1.3.1)."""
    if os.environ.get("PD_CONSULENTE_DIR"):
        return os.environ["PD_CONSULENTE_DIR"]
    if sys.platform.startswith("win"):
        return os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "ConsulenteDigitale")
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/ConsulenteDigitale")
    return os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"), "consulente-digitale")


def _ep_valido(e):
    return isinstance(e, dict) and RE_ID.match(str(e.get("id") or "")) and isinstance(e.get("domande"), list)


def stato_consulente(dati):
    """Quante interviste del Consulente ci sono su questo PC e quante non sono ancora state copiate qui."""
    base = os.path.join(cartella_consulente(), "nonni-teach")
    tot, nuove = 0, 0
    for f in glob.glob(os.path.join(base, "*", "episodio.json")):
        e = _leggi(f)
        if not _ep_valido(e) or os.path.basename(os.path.dirname(f)) != e["id"]:
            continue
        tot += 1
        if not os.path.isfile(os.path.join(cartella(dati), e["id"], "episodio.json")):
            nuove += 1
    return {"cartella": base, "episodi": tot, "nuove": nuove}


def _prefs_consulente(raw):
    try:
        p = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
    except ValueError:
        return None
    if isinstance(p, dict) and isinstance(p.get("value"), dict):
        p = p["value"]
    if not isinstance(p, dict):
        return None
    out = {k: _testo(p.get(k), 200) for k in ("url", "titolo", "autore", "email") if p.get(k)}
    return out or None


def importa_consulente(dati):
    """Copia (senza spostare né cancellare nulla) le interviste del Consulente Digitale di questo PC.
    Quelle già presenti qui (stesso id) restano come sono."""
    sorg = cartella_consulente()
    base = os.path.join(sorg, "nonni-teach")
    copiate, saltate = [], []
    for f in sorted(glob.glob(os.path.join(base, "*", "episodio.json"))):
        e = _leggi(f)
        id_ = os.path.basename(os.path.dirname(f))
        if not _ep_valido(e) or id_ != e["id"]:
            continue
        dest = os.path.join(cartella(dati), id_)
        if os.path.exists(dest):
            saltate.append(id_)
            continue
        tmp = dest + ".importo"
        shutil.rmtree(tmp, ignore_errors=True)
        os.makedirs(tmp)
        for fn in os.listdir(os.path.dirname(f)):
            if RE_FILE_EP.match(fn) and os.path.isfile(os.path.join(os.path.dirname(f), fn)):
                shutil.copyfile(os.path.join(os.path.dirname(f), fn), os.path.join(tmp, fn))
        e2 = _leggi(os.path.join(tmp, "episodio.json"))
        e2["origine"] = "Consulente Digitale"
        _scrivi(os.path.join(tmp, "episodio.json"), e2)
        os.replace(tmp, dest)
        copiate.append(id_)
    prefs = None
    try:
        with open(os.path.join(sorg, "nonni.json"), encoding="utf-8") as fp:
            prefs = _prefs_consulente(fp.read())
    except OSError:
        pass
    return {"ok": True, "copiate": len(copiate), "saltate": len(saltate), "id": copiate, "prefs": prefs, "cartella": base}


def importa_backup(dati, corpo):
    """Interviste di Nonni Teach da un file .cdbackup del Consulente Digitale (zip: nonni-teach/<id>/... e nonni.json)."""
    if not corpo or len(corpo) > MAX_BACKUP:
        raise ValueError("file vuoto o troppo grande")
    try:
        z = zipfile.ZipFile(io.BytesIO(corpo))
    except zipfile.BadZipFile:
        raise ValueError("non è un file di copia del Consulente Digitale (.cdbackup)")
    voci = {}
    prefs = None
    re_voce = re.compile(r"^nonni-teach/([a-z0-9][a-z0-9-]{2,70})/([^/]+)$")
    with z:
        for info in z.infolist():
            if info.filename in ("nonni.json", "dati/nonni.json"):
                prefs = _prefs_consulente(z.read(info).decode("utf-8", "replace"))
                continue
            m = re_voce.match(info.filename)
            if m and RE_FILE_EP.match(m.group(2)) and info.file_size <= MAX_AUDIO:
                voci.setdefault(m.group(1), []).append((m.group(2), info))
        if prefs is None:
            for nome in ("consulente-digitale-backup.json",):
                try:
                    tutto = json.loads(z.read(nome).decode("utf-8"))
                except (KeyError, ValueError):
                    continue
                cand = tutto.get("dati", tutto) if isinstance(tutto, dict) else None
                if isinstance(cand, dict) and "nonni" in cand:
                    prefs = _prefs_consulente(cand["nonni"])
                    break
        copiate, saltate = [], []
        for id_, files in sorted(voci.items()):
            nomi = dict(files)
            if "episodio.json" not in nomi:
                continue
            try:
                e = json.loads(z.read(nomi["episodio.json"]).decode("utf-8"))
            except ValueError:
                continue
            if not _ep_valido(e) or e["id"] != id_:
                continue
            dest = os.path.join(cartella(dati), id_)
            if os.path.exists(dest):
                saltate.append(id_)
                continue
            tmp = dest + ".importo"
            shutil.rmtree(tmp, ignore_errors=True)
            os.makedirs(tmp)
            for fn, info in files:
                with open(os.path.join(tmp, fn), "wb") as f:
                    f.write(z.read(info))
            e["origine"] = "Consulente Digitale"
            _scrivi(os.path.join(tmp, "episodio.json"), e)
            os.replace(tmp, dest)
            copiate.append(id_)
    if not copiate and not saltate and prefs is None:
        raise ValueError("nel file non ci sono interviste di Nonni Teach (nel Consulente: Impostazioni, «💾 Crea un backup» spuntando «con le registrazioni»)")
    return {"ok": True, "copiate": len(copiate), "saltate": len(saltate), "id": copiate, "prefs": prefs}
