"""Test della pagina «Spiegami questa lettera» (src/web/js/lettera.js).
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS).
Con il server (ROOT http) prova anche la lettura di una foto (OCR con tesseract.js servito da vendor/ocr/)
e controlla che nessuna richiesta esca da 127.0.0.1."""
import io
import json

# esempio -> tipo, totale atteso, prima scadenza (ISO) attesa, termine in giorni atteso
ATTESI = [
    ("Bolletta della luce", "luce", 112.35, "2026-11-16", None),
    ("Multa", "multa", 42.0, None, 60),
    ("TARI", "avviso", 236.0, "2026-12-16", None),
    ("INPS", "inps", None, "2026-11-30", None),
    ("giacenza", "raccomandata", None, "2026-10-23", None),
    ("Falsa bolletta", "luce", 129.9, None, None),
]

# altri testi (anche con errori tipici dell'OCR) -> tipo e totale attesi
CASI = [
    ("AZIENDA SANITARIA LOCALE BORGOPROVA - CUP\nPromemoria di prenotazione n. 2026AB123\nVisita cardiologica il giorno 12/11/2026 alle ore 9:30. "
     "Presentarsi con l'impegnativa. Ticket da pagare: 23,00 €", "sanitario", 23.0),
    ("Agenzia delle Entrate-Riscossione\nCartella di pagamento n. 000 2026 00000000 00 000\nImporto complessivo da pagare 1.245,60 euro "
     "entro 60 giorni dalla notifica.", "cartella", 1245.6),
    ("Acqua del Borgo s.r.l. - Servizio idrico integrato\nSOLLECITO DI PAGAMENTO\nRisulta non pagata la bolletta di € 58,30 scaduta il 15/08/2026.",
     "sollecito", 58.3),
    ("Bolletta Gas - Gas naturale PDR 00000000000000 consumo 120 Smc Totale bolletta Euro 96,10 scadenza 5 dicembre 2026", "gas", 96.1),
    ("Telefonia Borgo: fattura linea fissa e fibra. Totale fattura 29,90 € addebito su conto corrente", "telefono", 29.9),
    ("Banca del Borgo - Filiale di Borgoprova. Modifica delle condizioni del conto corrente: potete recedere entro il 31/12/2026.", "banca", None),
    ("Offerta riservata! Contratto luce e gas con sconto del 20%. Diritto di ripensamento entro 14 giorni dalla sottoscrizione.", "contratto", None),
    ("Energia de1 Borgo S.p.A.\nBo11etta del1a luce - Fornitura di energia e1ettrica\nTota1e da pagare: 87,4O €\nScadcnza: entro il l5/11/2026",
     "luce", 87.4),
]

TESTO_FOTO = ["Comune di Borgoprova - Ufficio Tributi", "Avviso di pagamento", "Totale da pagare 87,40 euro entro il 15/11/2026"]


def immagine_png():
    """Una lettera finta, nitida, generata al momento (PIL + font DejaVu/Noto)."""
    from PIL import Image, ImageDraw, ImageFont
    font = None
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
              "/usr/share/fonts/TTF/DejaVuSans.ttf"):
        try:
            font = ImageFont.truetype(f, 34)
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    img = Image.new("RGB", (1300, 420), (250, 248, 240))
    d = ImageDraw.Draw(img)
    for i, riga in enumerate(TESTO_FOTO):
        d.text((60, 60 + i * 100), riga, fill=(25, 25, 25), font=font)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def prova(page, ROOT, check, SHOTS):
    page.goto(ROOT + "#/home")
    page.wait_for_selector("#view-home .hero")
    salvato = page.evaluate("JSON.stringify(PD.progress.lettera === undefined ? null : PD.progress.lettera)")
    tema = page.evaluate("PD.settings.theme")
    errori = []
    gestore = lambda e: errori.append(str(e))
    page.on("pageerror", gestore)
    try:
        _prova(page, ROOT, check, SHOTS, errori)
    finally:
        page.remove_listener("pageerror", gestore)
        page.evaluate("""([v, t]) => { if (v === null) delete PD.progress.lettera; else PD.progress.lettera = JSON.parse(v);
            PD.saveProgress(); PD.settings.theme = t; PD.saveSettings(); if (PD.applySettings) PD.applySettings(); }""", [salvato, tema])
        page.set_viewport_size({"width": 1366, "height": 800})


def _prova(page, ROOT, check, SHOTS, errori):
    server = ROOT.startswith("http")
    # --- motore a regole ---
    ris = page.evaluate("""() => PD.lettera.esempi.map(e => { const r = PD.lettera.analizza(e.x, new Date(2026, 9, 8));
        return [e.t, r.tipo, r.totale ? r.totale.valore : null, r.scadenze.length ? r.scadenze[0].data : null,
                r.termini.map(t => t.giorni), r.truffa.livello, r.mittente, r.glossario.length, r.codici.length, r.cosaFare.length]; })""")
    check("lettera: 6 esempi pronti", len(ris) == 6, [r[0] for r in ris])
    for (nome, tipo, tot, scad, term), r in zip(ATTESI, ris):
        ok = nome in r[0] and r[1] == tipo and r[2] == tot and r[3] == scad and (term is None or term in r[4])
        check("lettera: esempio «%s» -> %s, totale %s, scadenza %s" % (nome, tipo, tot, scad or term), ok, r)
    check("lettera: esempi con mittente, glossario e cosa fare", all(r[6] and r[7] >= 1 and r[9] >= 3 for r in ris), ris)
    check("lettera: falsa bolletta = truffa, le altre no", ris[5][5] == "alto" and all(r[5] == "basso" for r in ris[:5]), [r[5] for r in ris])
    sbagliati = page.evaluate("""casi => casi.map(c => { const r = PD.lettera.analizza(c[0]); return [c[1], c[2], r.tipo, r.totale ? r.totale.valore : null, c[0].slice(0, 30)]; })
        .filter(x => x[0] !== x[2] || x[1] !== x[3])""", [list(c) for c in CASI])
    check("lettera: riconoscimento di %d altri documenti (anche con errori di lettura)" % len(CASI), not sbagliati, sbagliati)
    r = page.evaluate("""() => { const r = PD.lettera.analizza('Scadenza: entro il 10/10/2026. Totale da pagare 5,00 €', new Date(2026, 9, 8));
        const s = PD.lettera.analizza('Pagare entro il 01/10/2026 la somma di 5,00 €', new Date(2026, 9, 8));
        return [r.scadenze[0].giorni, r.scadenze[0].testo, s.scadenze[0].giorni, s.scadenze[0].testo]; }""")
    check("lettera: «mancano N giorni» e «già scaduta»", r[0] == 2 and "mancano 2 giorni" in r[1] and r[2] == -7 and "già scaduta da 7 giorni" in r[3], r)
    g = page.evaluate("PD.lettera.glossario.length")
    check("lettera: glossario di 40-60 parole", 40 <= g <= 60, g)
    cod = page.evaluate("PD.lettera.analizza(PD.lettera.esempi[0].x).codici.map(c => c.tipo)")
    check("lettera: codici POD e numero cliente", "Codice POD (luce)" in cod and "Numero cliente" in cod, cod)

    # --- riquadro nella pagina Inizio ---
    check("lettera: riquadro nell'Inizio", page.locator('#view-home .tile[data-go="#/lettera"]').count() == 1)

    # --- pagina ---
    page.evaluate("PD.progress.lettera = { volte: 0, tipi: {} }; PD.saveProgress()")
    page.goto(ROOT + "#/lettera")
    page.wait_for_selector("#lt-testo")
    priv = page.inner_text("#view-lettera .lt-privacy")
    check("lettera: avviso sulla privacy", "non la salva" in priv and "senza Internet" in priv, priv)
    if server:
        check("lettera: con il server si può caricare una foto", page.locator("#lt-file").count() == 1 and page.locator(".lt-no-ocr").count() == 0)
    else:
        nota = page.inner_text("#view-lettera .lt-no-ocr") if page.locator(".lt-no-ocr").count() else ""
        check("lettera: portatile -> niente foto, spiegazione gentile", page.locator("#lt-file").count() == 0 and "portatile" in nota, nota)
    check("lettera: 6 pulsanti di esempio", page.locator("#view-lettera .lt-es").count() == 6)

    page.click("#lt-spiega")
    check("lettera: testo vuoto non spiegato", page.is_hidden("#lt-esito"))

    page.click('#view-lettera .lt-es:has-text("Multa")')
    page.wait_for_selector("#lt-esito:not([hidden]) .lt-tipo")
    tipo = page.inner_text("#lt-esito .lt-tipo")
    box = page.inner_text("#lt-esito .lt-chiave")
    check("lettera: multa riconosciuta con mittente", "Multa" in tipo and "Borgoprova" in tipo, tipo)
    check("lettera: totale e tempo a disposizione", "42,00 €" in box and "60 giorni" in box, box)
    passi = page.inner_text("#lt-esito .lt-passi")
    check("lettera: cosa fare prudente", "ricorso" in passi and "CAF" in passi and "patronato" in passi, passi[:200])
    check("lettera: glossario (solo parole presenti)", page.locator("#lt-esito .lt-glossario dt").count() >= 4 and
          "Prefetto" in page.inner_text("#lt-esito .lt-glossario") and "TARI" not in page.inner_text("#lt-esito .lt-glossario"))
    check("lettera: targa tra i codici", "ZZ 000 ZZ" in page.inner_text("#lt-esito .lt-codici"))
    page.click("#lt-esito .lt-testo-ev summary")
    check("lettera: parti evidenziate nel testo", page.locator("#lt-esito .lt-testo-corpo mark.lt-m-totale").count() == 1 and
          page.locator("#lt-esito .lt-testo-corpo mark.lt-m-codice").count() >= 1)
    page.screenshot(path=SHOTS + "/lettera-1280.png", full_page=True)

    page.click('#view-lettera .lt-es:has-text("TARI")')
    page.wait_for_selector("#lt-esito .lt-box-data")
    d = page.inner_text("#lt-esito .lt-box-data")
    check("lettera: TARI con scadenza e giorni", "16/12/2026" in d and ("mancano" in d or "scaduta" in d or "oggi" in d or "domani" in d), d)

    page.click('#view-lettera .lt-es:has-text("Falsa")')
    page.wait_for_selector("#lt-esito .lt-truffa-alto")
    t = page.inner_text("#lt-esito .lt-truffa-alto")
    check("lettera: falsa bolletta -> avviso rosso", "FALSA" in t and ("buono regalo" in t.lower() or "ricariche" in t), t[:200])
    page.screenshot(path=SHOTS + "/lettera-truffa-1280.png", full_page=True)

    # conteggi senza testo
    l = page.evaluate("PD.progress.lettera")
    check("lettera: salvati solo i conteggi", l.get("volte") == 3 and l.get("tipi", {}).get("multa") == 1 and
          "Borgoprova" not in json.dumps(l) and "129" not in json.dumps(l), l)

    # leggi a voce
    page.evaluate("() => { window.__letto = ''; PD.__speak = PD.speak; PD.speak = function (t) { window.__letto = t; return Promise.resolve(); }; }")
    page.click("#lt-leggi")
    letto = page.evaluate("window.__letto")
    page.evaluate("() => { PD.speak = PD.__speak; }")
    check("lettera: lettura a voce della spiegazione", "Mi sembra" in letto and "Cosa fare" in letto and "falsa" in letto, letto[:150])

    # stampa (senza aprire la finestra di stampa)
    page.evaluate("() => { window.__stampa = null; window.__print = window.print; window.print = function () { window.__stampa = document.getElementById('print-area').innerHTML; }; }")
    page.click("#lt-stampa")
    page.wait_for_function("window.__stampa !== null")
    st = page.evaluate("window.__stampa")
    page.evaluate("() => { document.body.classList.remove('printing'); window.print = window.__print; }")
    check("lettera: stampa della spiegazione", "La spiegazione della lettera" in st and "Cosa fare" in st and "129,90" in st, st[:200])

    # IA locale (solo con server e modello)
    if page.evaluate("!!(PD.server && PD.aiReady())"):
        page.click("#lt-ia")
        page.wait_for_function("document.querySelector('#lt-ia-box .lt-ia-testo') && !/Sto pensando/.test(document.querySelector('#lt-ia-box .lt-ia-testo').textContent) && document.getElementById('lt-ia-stop').hidden", timeout=15000)
        txt = page.inner_text("#lt-ia-box")
        check("lettera: riassunto dell'IA locale", len(txt) > 40 and "IA" in txt, txt[:150])
    else:
        check("lettera: niente pulsante IA senza IA locale", page.locator("#lt-ia").count() == 0)

    # dimentica
    page.click("#lt-dimentica2")
    check("lettera: «Dimentica» cancella testo e spiegazione",
          page.input_value("#lt-testo") == "" and page.is_hidden("#lt-esito") and page.evaluate("document.getElementById('lt-esito').innerHTML") == "")

    # scritto a mano, poi si cambia pagina e si torna: il testo resta solo in memoria
    page.fill("#lt-testo", "Comune di Borgoprova. Bollo auto: importo da pagare 180,00 euro entro il 31/01/2027.")
    page.click("#lt-spiega")
    page.wait_for_selector("#lt-esito:not([hidden]) .lt-tipo")
    check("lettera: testo scritto a mano spiegato", "180,00" in page.inner_text("#lt-esito .lt-chiave") and "tasse" in page.inner_text("#lt-esito .lt-tipo"))
    ls = page.evaluate("(() => { try { return JSON.stringify(localStorage); } catch (e) { return ''; } })()")
    check("lettera: nessun testo nel salvataggio del browser", "180,00" not in ls and "Bollo auto" not in ls)

    # --- OCR vero (solo con il server) ---
    if server:
        _prova_ocr(page, ROOT, check, SHOTS)

    # --- telefono 390 px + tema scuro ---
    page.click('#view-lettera .lt-es:has-text("Bolletta della luce")')
    page.wait_for_selector("#lt-esito:not([hidden]) .lt-tipo")
    page.set_viewport_size({"width": 390, "height": 844})
    page.evaluate("PD.settings.theme = 'dark'; PD.applySettings(); window.scrollTo(0, 0)")
    page.wait_for_timeout(250)
    largo = page.evaluate("document.documentElement.scrollWidth")
    check("lettera: nessuno scorrimento orizzontale a 390 px", largo <= 392, largo)
    page.screenshot(path=SHOTS + "/lettera-390-scuro.png", full_page=True)
    page.click("#lt-dimentica")
    check("lettera: nessun errore JavaScript", not errori, errori)


def _prova_ocr(page, ROOT, check, SHOTS):
    richieste, inviati = [], []

    def su_richiesta(req):
        richieste.append(req.url)
        try:
            # la voce del Professore (/api/tts) resta sul PC: non conta come invio
            if req.post_data and "87,40" in req.post_data and "/api/tts" not in req.url:
                inviati.append(req.url)
        except Exception:
            pass
    page.on("request", su_richiesta)
    try:
        page.goto(ROOT + "#/lettera")
        page.wait_for_selector("#lt-file", state="attached")
        check("lettera: tesseract.js non caricato finché non serve", page.evaluate("typeof window.Tesseract") == "undefined" and
              not any("vendor/ocr" in u for u in richieste))
        page.set_input_files("#lt-file", files=[{"name": "lettera.png", "mimeType": "image/png", "buffer": immagine_png()}])
        page.wait_for_selector("#lt-img-box:not([hidden]) canvas")
        page.wait_for_selector("#lt-ocr:not([hidden])")
        msg = page.inner_text("#lt-ocr")
        check("lettera: messaggio gentile durante la lettura", "occhiali" in msg or "Sto leggendo" in msg or "italiano" in msg, msg)
        page.wait_for_selector(".lt-ocr.lt-ocr-ok, .lt-ocr.lt-ocr-male", timeout=150000)
        esito = page.inner_text("#lt-ocr")
        letto = page.input_value("#lt-testo")
        check("lettera: OCR sul PC -> testo letto e modificabile", "lt-ocr-ok" in page.get_attribute("#lt-ocr", "class") and "87" in letto, [esito, letto])
        tot = page.evaluate("PD.lettera.analizza(document.getElementById('lt-testo').value).totale")
        box = page.inner_text("#lt-esito .lt-chiave") if page.locator("#lt-esito .lt-chiave").count() else ""
        check("lettera: OCR -> importo 87,40 € riconosciuto", tot and abs(tot["valore"] - 87.4) < 0.001 and "87,40" in box, [tot, box])
        check("lettera: OCR -> scadenza 15/11/2026", "15/11/2026" in box, box)
        fuori = [u for u in richieste if not (u.startswith("http://127.0.0.1") or u.startswith("http://localhost") or
                                              u.startswith("data:") or u.startswith("blob:"))]
        check("lettera: nessuna richiesta fuori da 127.0.0.1 durante l'OCR", not fuori, fuori)
        usati = [u.split("/vendor/ocr/")[1] for u in richieste if "/vendor/ocr/" in u]
        check("lettera: file OCR serviti in locale da vendor/ocr", "tesseract.min.js" in usati and "worker.min.js" in usati and
              "lang/ita.traineddata.gz" in usati and any(u.startswith("tesseract-core") for u in usati), usati)
        check("lettera: il testo della lettera non viene inviato a nessuno", not inviati, inviati)
        page.screenshot(path=SHOTS + "/lettera-ocr-1280.png", full_page=True)
        # rotazione: l'anteprima gira di 90 gradi
        prima = page.evaluate("[document.getElementById('lt-canvas').width, document.getElementById('lt-canvas').height]")
        page.click("#lt-ruota-d")
        dopo = page.evaluate("[document.getElementById('lt-canvas').width, document.getElementById('lt-canvas').height]")
        check("lettera: pulsante ↻ ruota la foto", prima[0] == dopo[1] and prima[1] == dopo[0], [prima, dopo])
        page.click("#lt-ocr-stop") if page.is_visible("#lt-ocr-stop") else None
        # webcam (Chromium dei test ha una webcam finta): si accende solo con un clic
        if page.locator("#lt-cam").count():
            check("lettera: webcam spenta finché non si clicca", page.is_hidden("#lt-cam-box"))
            page.click("#lt-cam")
            try:
                page.wait_for_function("document.getElementById('lt-video').videoWidth > 0", timeout=8000)
                page.click("#lt-scatta")
                page.wait_for_selector("#lt-img-box:not([hidden])")
                spenta = page.evaluate("!document.getElementById('lt-video').srcObject")
                check("lettera: foto dalla webcam, poi webcam spenta", spenta and page.is_hidden("#lt-cam-box"))
                if page.is_visible("#lt-ocr-stop"):
                    page.click("#lt-ocr-stop")
            except Exception as e:  # nessuna webcam (nemmeno finta) in questo browser
                check("lettera: webcam assente gestita", page.is_visible("#lt-testo"), str(e)[:100])
        page.click("#lt-dimentica")
        # il motore di lettura si spegne appena finisce il lavoro in corso (fermarlo a metà manda in errore tesseract.js)
        try:
            page.wait_for_function("!PD.lettera._ocr.worker", timeout=90000)
        except Exception:
            pass
        check("lettera: «Dimentica» toglie anche la foto", page.is_hidden("#lt-img-box") and page.input_value("#lt-testo") == "" and
              page.evaluate("!PD.lettera._ocr.worker"))
    finally:
        page.remove_listener("request", su_richiesta)
