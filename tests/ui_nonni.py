"""Test di NONNI TEACH e del cambio di conduttore Professore ⇄ Neura (src/web/js/nonni.js, neura.js; dalla 3.6).
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS). Vale per il server Python e per quello di Windows (Wine).
Con il server: API /api/nonni… (intervista, audio WAV generato qui, montaggio con o senza FFmpeg, sito con feed,
copertina ed email, zip, eliminazione, sicurezza dei percorsi), pagine Nuova/Archivio/Pubblica/Liberatoria.
Nella versione portatile: solo «Ascolta i podcast» e la liberatoria. Rimette a posto ciò che cambia.
Autore: Danilo D'Auria - Licenza MIT"""
import json
import urllib.error
import urllib.request

V = "#view-nonni"


def http(ROOT, path, corpo=None, tipo="application/json"):
    """Richieste che devono fallire: si fanno da qui (non dal browser), così la console della pagina resta pulita."""
    base = ROOT.split("#")[0].split("?")[0].rstrip("/")
    dati = corpo if isinstance(corpo, bytes) or corpo is None else json.dumps(corpo).encode()
    req = urllib.request.Request(base + path, data=dati, method="GET" if corpo is None else "POST",
                                 headers={"Content-Type": tipo, "Origin": base} if corpo is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except ValueError:
            return e.code, {}

WAV_JS = """() => {   // 1,2 secondi di La (440 Hz), WAV PCM 16 bit mono 8 kHz
  const sr = 8000, n = Math.round(sr * 1.2), b = new ArrayBuffer(44 + n * 2), d = new DataView(b);
  const s = (o, t) => { for (let i = 0; i < t.length; i++) d.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true);
  d.setUint16(22, 1, true); d.setUint32(24, sr, true); d.setUint32(28, sr * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
  s(36, 'data'); d.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 9000), true);
  return b;
}"""


def prova(page, ROOT, check, SHOTS):
    errori = []
    gestore = lambda e: errori.append(str(e))
    page.on("pageerror", gestore)
    salvato = page.evaluate("() => JSON.stringify({ voce: PD.settings.voice, u: PD.settings.nonniUrl, t: PD.settings.nonniTitolo, a: PD.settings.nonniAutore, e: PD.settings.nonniEmail })")
    page.evaluate("() => { PD.settings.voice = false; PD.stopSpeech(); try { sessionStorage.setItem('pd.neuraSalutata', '1'); } catch (e) {} }")
    try:
        _prova(page, ROOT, check, SHOTS)
    finally:
        page.evaluate("""(s) => { s = JSON.parse(s); PD.settings.voice = s.voce; PD.settings.nonniUrl = s.u; PD.settings.nonniTitolo = s.t;
            PD.settings.nonniAutore = s.a; PD.settings.nonniEmail = s.e; PD.saveSettings(); document.body.classList.remove('printing'); }""", salvato)
        page.set_viewport_size({"width": 1366, "height": 800})
        page.evaluate("() => PD.go('#/home')")
        page.remove_listener("pageerror", gestore)
    check("nonni: nessun errore JavaScript", not errori, "; ".join(errori[:3]))


def vai(page, h, sel):
    page.evaluate("(h) => PD.go(h)", h)
    page.wait_for_selector(sel, timeout=10000)


def _prova(page, ROOT, check, SHOTS):
    standalone = ROOT.startswith("file:")
    vai(page, "#/home", "#view-home h1")
    check("nonni: riquadro nella pagina Inizio", page.locator("#view-home [data-go='#/nonni']").count() >= 1)
    check("nonni: voce nel menu", page.locator(".nav-btn[data-view='nonni']").count() == 1)
    check("nonni: in partenza conduce il Professore", page.evaluate("() => !PD.neura.attiva() && !document.documentElement.hasAttribute('data-conduttore') && PD.voceSpeciale === null"))

    # --- entra Neura
    vai(page, "#/nonni", V + " .nt-hero canvas.neura-canvas")
    st = page.evaluate("""() => ({ attiva: PD.neura.attiva(), attr: document.documentElement.getAttribute('data-conduttore'),
        marchio: document.querySelector('.topbar .brand').innerText, mini: !!document.querySelector('.topbar .brand canvas.neura-mini'),
        voce: PD.voceSpeciale, vf: (PD.status && PD.status.tts && PD.status.tts.voices || []).filter(v => v.genere === 'f').map(v => v.id),
        domande: PD.NONNI.totale(), temi: Object.keys(PD.NONNI.temi).length, contesti: Object.keys(PD.NONNI.contesti).length })""")
    check("nonni: aprendo Nonni Teach conduce Neura", st["attiva"] and st["attr"] == "neura" and st["mini"] and "Neura" in st["marchio"], st)
    check("nonni: Neura parla con una voce femminile", st["voce"] and st["voce"]["femminile"] and (not st["vf"] or st["voce"]["server"] in st["vf"]), st)
    check("nonni: banca delle domande identica al Consulente (216 domande, 24 temi, 7 contesti)", st["domande"] == 216 and st["temi"] == 24 and st["contesti"] == 7, st)
    page.evaluate("() => PD.neura.stato('ascolto')")
    check("nonni: lo stato di Neura si vede", "ascolto" in page.inner_text(V + " .neura-stato"))
    page.evaluate("() => PD.neura.stato('riposo')")
    # mentre parla Neura il cervello diventa «parla»
    page.evaluate("() => PD.onSpeaking(true)")
    check("nonni: quando parla Neura il cervello si illumina", page.evaluate("() => PD.neura.stato() === 'parla'"))
    page.evaluate("() => PD.onSpeaking(false)")

    if standalone:
        schede = page.evaluate("() => [...document.querySelectorAll('#view-nonni [data-tab]')].map(b => b.getAttribute('data-tab'))")
        check("nonni (portatile): solo ascolto dei podcast e liberatoria", schede == ["ascolta", "liberatoria"], schede)
        check("nonni (portatile): i podcast si caricano solo dopo un clic (niente Internet da solo)", page.locator("#nt-carica").count() == 1 and page.locator("#nt-online audio, #nt-online p").count() == 0)
        vai(page, "#/nonni/liberatoria", "#nt-l-stampa")
        page.evaluate("() => { window.__st = 0; window.print = () => { window.__st++; }; }")
        page.fill("#nt-l-nome", "nonna Rosa"); page.click("#nt-l-stampa"); page.wait_for_timeout(500)
        check("nonni (portatile): la liberatoria si stampa con il nome", "nonna Rosa" in page.inner_text("#print-area") and "CC BY-NC-SA" in page.inner_text("#print-area"))
        page.evaluate("() => document.body.classList.remove('printing')")
    else:
        _server(page, ROOT, check, SHOTS)

    # --- esce Neura, torna il Professore
    vai(page, "#/lessons", "#view-lessons h1")
    st = page.evaluate("""() => ({ attiva: PD.neura.attiva(), attr: document.documentElement.hasAttribute('data-conduttore'),
        prof: !!document.querySelector('.topbar .brand svg use[href="#prof-svg"]'), marchio: document.querySelector('.topbar .brand').innerText, voce: PD.voceSpeciale })""")
    check("nonni: uscendo torna il Professore (in alto, nella voce)", not st["attiva"] and not st["attr"] and st["prof"] and "Professore Digitale" in st["marchio"] and st["voce"] is None, st)
    page.screenshot(path=SHOTS + "/nonni-4-torna-il-professore.png")

    # --- telefono: niente scorrimento orizzontale
    page.set_viewport_size({"width": 390, "height": 800})
    vai(page, "#/nonni/liberatoria", "#nt-l-stampa")
    check("nonni: leggibile su telefono", not page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
    page.screenshot(path=SHOTS + "/nonni-5-telefono.png")
    page.set_viewport_size({"width": 1366, "height": 800})


def _server(page, ROOT, check, SHOTS):
    schede = page.evaluate("() => [...document.querySelectorAll('#view-nonni [data-tab]')].map(b => b.getAttribute('data-tab'))")
    check("nonni: quattro schede (nuova, archivio, pubblica, liberatoria)", schede == ["nuova", "archivio", "pubblica", "liberatoria"], schede)
    info = page.evaluate("() => PD.api('/api/nonni')")
    check("nonni: /api/nonni risponde (elenco, ffmpeg, Consulente)", isinstance(info.get("episodi"), list) and "ffmpeg" in info and "consulente" in info
          and info.get("url_predefinito") == "https://danilodauria.github.io/nonni-teach/", info)
    for e in info["episodi"]:
        if e.get("intervistato") == "nonno Prova":
            page.evaluate("(id) => PD.api('/api/nonni/' + id + '/elimina', {})", e["id"])

    # preparazione dall'interfaccia
    vai(page, "#/nonni/nuova", "#nt-prepara")
    page.click("[data-ctx='scuola']")
    page.fill("#nt-nome", "nonno Prova"); page.fill("#nt-luogo", "Bagnoli"); page.select_option("#nt-quante", "6")
    page.click("#nt-prepara")
    page.wait_for_selector("#nt-elenco .nt-domande li")
    n = page.locator("#nt-elenco .nt-domande li").count()
    testi = page.evaluate("() => [...document.querySelectorAll('#nt-elenco [data-q]')].map(s => s.textContent)")
    check("nonni: Neura prepara 6 domande con il nome", n == 6 and "nonno Prova" in testi[0] and not any("{nome}" in t or "{luogo}" in t for t in testi), testi)
    page.screenshot(path=SHOTS + "/nonni-1-domande.png", full_page=True)
    page.click("#nt-via")
    page.wait_for_timeout(500)
    check("nonni: senza consenso a registrare non si parte", page.locator("#nt-q").count() == 0)
    page.check("#nt-c1"); page.check("#nt-c2")
    page.click("#nt-via")
    page.wait_for_selector("#nt-q", timeout=8000)
    check("nonni: intervista avviata (domanda grande, puntini, registra)", page.locator(".nt-puntini button").count() == 6 and page.locator("#nt-rec").count() == 1)
    page.screenshot(path=SHOTS + "/nonni-2-intervista.png", full_page=True)

    ep = [e for e in page.evaluate("() => PD.api('/api/nonni')")["episodi"] if e.get("intervistato") == "nonno Prova"]
    check("nonni: intervista salvata sul computer", len(ep) == 1 and ep[0]["consenso_pubblicare"] and ep[0]["contesto"] == "scuola", ep)
    if not ep:
        return
    eid = ep[0]["id"]
    # una risposta registrata (WAV generato qui)
    r = page.evaluate("""async (a) => { const buf = (""" + WAV_JS + """)();
        const r = await fetch('/api/nonni/' + a + '/audio/2', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: buf });
        const j = await r.json(); const f = await fetch('/api/nonni/' + a + '/file/' + (j.file || 'x'));
        return { s: r.status, j: j, f: f.status, ct: f.headers.get('Content-Type'), len: (await f.arrayBuffer()).byteLength }; }""", eid)
    r["trav"] = http(ROOT, "/api/nonni/%s/file/..%%2Fepisodio.json" % eid)[0]
    r["fuori"] = http(ROOT, "/api/nonni/%s/audio/99" % eid, b"RIFF" + b"\0" * 3000, "audio/wav")[0]
    check("nonni: risposta salvata (r02.wav) e riascoltabile", r["s"] == 200 and r["j"].get("file") == "r02.wav" and r["f"] == 200 and r["ct"].startswith("audio/wav") and r["len"] == 44 + 9600 * 2, r)
    check("nonni: percorsi e domande fuori elenco rifiutati", r["trav"] in (400, 404) and r["fuori"] == 400, r)
    e = page.evaluate("(a) => PD.api('/api/nonni/' + a)", eid)
    check("nonni: l'intervista ricorda il file della risposta", e["domande"][1]["file"] == "r02.wav" and not e["domande"][0]["file"], e["domande"][:2])

    # montaggio: con FFmpeg crea il podcast con i capitoli, senza chiede di installarlo
    m = page.evaluate("(a) => PD.api('/api/nonni/' + a + '/monta', {})", eid)
    if info["ffmpeg"]:
        check("nonni: podcast montato con i capitoli", m.get("ok") and m.get("podcast") == "podcast.mp3" and len(m.get("capitoli", [])) >= 1 and m.get("durata", 0) > 1, m)
    else:
        check("nonni: senza FFmpeg si spiega come installarlo", m.get("serve_ffmpeg") is True and "FFmpeg" in m.get("messaggio", ""), m)

    # archivio
    vai(page, "#/nonni/archivio", ".nt-ep[data-ep='%s']" % eid)
    box = ".nt-ep[data-ep='%s']" % eid
    check("nonni: l'intervista è nell'archivio (pubblicabile)", "pubblicabile" in page.inner_text(box) and "1 risposte" in page.inner_text(box))
    if not info["ffmpeg"]:
        check("nonni: istruzioni per FFmpeg con il comando da copiare", page.locator(".nt-ffmpeg code.nt-cmd").count() == 1)
    page.click(box + " [data-ascolta]")
    page.wait_for_selector(box + " .nt-ascolto-box audio", timeout=8000)
    check("nonni: «Ascolta» mostra il lettore", page.locator(box + " .nt-ascolto-box audio").count() >= 1)
    check("nonni: si possono importare le interviste del Consulente (file .cdbackup)", page.locator("#nt-imp-file").count() == 1)
    page.screenshot(path=SHOTS + "/nonni-3-archivio.png", full_page=True)
    # trasferimento dal Consulente di questo PC (nei test non ce n'è: nulla da copiare, nessun errore)
    t = page.evaluate("() => PD.api('/api/nonni/importa', {})")
    check("nonni: copia dal Consulente senza interviste = nessun errore", t.get("ok") and t.get("copiate") == 0, t)
    st, j = http(ROOT, "/api/nonni/importa-backup", b"\x01\x02\x03\x04", "application/zip")
    check("nonni: un file che non è un .cdbackup viene rifiutato con garbo", st == 400 and "cdbackup" in j.get("error", ""), (st, j))

    # sito del podcast (repository nonni-teach)
    vai(page, "#/nonni/pubblica", "#nt-crea")
    page.fill("#nt-aut", "Scuola di prova"); page.fill("#nt-email", "non-una-email")
    page.click("#nt-crea")
    page.wait_for_selector("#nt-esito .nt-avviso", timeout=15000)
    check("nonni: email sbagliata segnalata", "email" in page.inner_text("#nt-esito"))
    page.fill("#nt-email", "podcast@esempio.it")
    page.click("#nt-crea")
    page.wait_for_selector("#nt-esito .nt-ok", timeout=30000)
    check("nonni: sito pronto con 1 episodio", "1" in page.inner_text("#nt-esito .nt-ok b"))
    check("nonni: preferenze del sito ricordate", page.evaluate("() => PD.settings.nonniEmail === 'podcast@esempio.it' && PD.settings.nonniAutore === 'Scuola di prova'"))
    z = page.evaluate("""async () => { const r = await fetch('/api/nonni/sito.zip'); const b = new Uint8Array(await r.arrayBuffer());
        const txt = new TextDecoder('latin1').decode(b);
        return { s: r.status, ct: r.headers.get('Content-Type'), pk: b[0] === 0x50 && b[1] === 0x4b, n: b.length,
                 file: ['index.html', 'feed.xml', 'copertina.jpg', 'LEGGIMI.txt', 'audio/'].filter(x => txt.indexOf(x) >= 0) }; }""")
    check("nonni: zip del sito scaricabile (pagina, feed, copertina, audio)", z["s"] == 200 and z["pk"] and "zip" in z["ct"] and len(z["file"]) == 5, z)
    page.screenshot(path=SHOTS + "/nonni-6-pubblica.png", full_page=True)

    # liberatoria
    vai(page, "#/nonni/liberatoria", "#nt-l-stampa")
    page.evaluate("() => { window.__st = 0; window.print = () => { window.__st++; }; }")
    page.fill("#nt-l-nome", "nonna Rosa"); page.click("#nt-l-stampa"); page.wait_for_timeout(500)
    pa = page.inner_text("#print-area")
    check("nonni: liberatoria stampabile (consensi, GDPR, minorenni, licenza)", "nonna Rosa" in pa and "GDPR" in pa and "minorenni" in pa and "CC BY-NC-SA" in pa, pa[:200])
    page.evaluate("() => document.body.classList.remove('printing')")

    # consenso obbligatorio anche per il server
    c, j = http(ROOT, "/api/nonni/salva", {"episodio": {"intervistato": "senza consenso", "domande": [{"testo": "ciao"}]}})
    st2, j2 = http(ROOT, "/api/nonni/sito", {"email": "non-una-email"})
    check("nonni: senza consenso il server non salva; email sbagliata rifiutata anche dal server", c == 400 and st2 == 400 and "email" in j2.get("error", ""), (c, j, st2, j2))
    # eliminazione
    page.evaluate("(a) => PD.api('/api/nonni/' + a + '/elimina', {})", eid)
    rest = [e for e in page.evaluate("() => PD.api('/api/nonni')")["episodi"] if e["id"] == eid]
    check("nonni: intervista eliminata", not rest)
