# -*- coding: utf-8 -*-
"""Test di «📱 Condividi con i tablet dell'aula» (3.4): chiamato da tests/test_ui.py con prova(page, ROOT, check, SHOTS).
Con il server (Python o Windows in Wine) accende la condivisione dalla pagina #/tablet, verifica codice, indirizzi e QR code
(decodificato con OpenCV), apre un SECONDO browser come tablet (820x1180) sull'ascolto per i tablet (loopback permesso
dalla variabile PD_TABLET_LOOPBACK=1 dei test), prova codice sbagliato e giusto, modalità ospite, progressi salvati solo sul
tablet, lista bianca delle API (403), Host falso, quadro dell'aula con la mano alzata, «Cambia codice» e «Spegni».
Alla fine rimette tutto spento. Autore: Danilo D'Auria - Licenza MIT"""
import json
import os
import socket
import time
import urllib.error
import urllib.request


def _http(url, body=None, headers=None, method=None):
    h = dict(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method or ("POST" if body is not None else "GET"))
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=20) as r:
            raw = r.read()
            return r.status, raw, dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def _json(raw):
    try:
        return json.loads(raw.decode() or "{}")
    except (ValueError, AttributeError):
        return {}


def _porta_chiusa(porta):
    s = socket.socket()
    s.settimeout(2)
    try:
        s.connect(("127.0.0.1", porta))
        return False
    except OSError:
        return True
    finally:
        s.close()


def prova(page, ROOT, check, SHOTS):
    if not ROOT.startswith("http"):
        page.goto(ROOT + "#/tablet")
        page.wait_for_selector("#view-tablet .notice")
        check("tablet: nella versione portatile la condivisione non c'è", "versione portatile" in page.inner_text("#view-tablet"))
        check("tablet: nessun riquadro nelle Impostazioni della portatile", page.evaluate("PD.tablet.cartaHTML() === ''"))
        return
    base = ROOT.rstrip("/")
    api = lambda p, b=None: _json(_http(base + p, b)[1])
    st0 = api("/api/tablet")
    check("tablet: spenta per impostazione predefinita", st0.get("attivo") is False and st0.get("codice") == "", st0)
    porta = st0.get("porta")
    check("tablet: porta dei tablet chiusa da spenta", porta and _porta_chiusa(porta), porta)

    # ---------------------------------------------------------------- PC: accensione dalla pagina
    page.goto(ROOT + "#/tablet")
    page.wait_for_selector("#tablet-accendi")
    page.click("#tablet-accendi")
    page.wait_for_selector("#tablet-codice", timeout=10000)
    codice = page.inner_text("#tablet-codice").replace(" ", "").strip()
    st = api("/api/tablet")
    check("tablet: accesa con un codice di 6 cifre", st.get("attivo") and len(codice) == 6 and codice.isdigit() and codice == st.get("codice"), (codice, st))
    check("tablet: impostazione tabletCondividi salvata", page.evaluate("PD.settings.tabletCondividi === true"))
    url_attesi = st.get("indirizzi") or []
    scritti = [t.strip() for t in page.locator(".tablet-url").all_inner_texts()]
    check("tablet: indirizzi scritti grandi (con la porta dei tablet)", scritti and all((":%d/" % porta) in u for u in scritti) and
          "http://127.0.0.1:%d/" % porta in scritti, scritti)
    qr_ok = False
    try:
        import cv2
        qr_png = os.path.join(SHOTS, "tablet-qr.png")
        page.locator("#tablet-qr").screenshot(path=qr_png)
        val, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(qr_png))
        qr_ok = val == url_attesi[0]
    except Exception as e:  # noqa: BLE001
        val = repr(e)
    check("tablet: il QR code contiene l'indirizzo con il codice (letto con OpenCV)", qr_ok, (val, url_attesi[:1]))
    page.screenshot(path=SHOTS + "/40-tablet-pc.png", full_page=True)

    # ---------------------------------------------------------------- tablet: accesso con il codice
    TB = "http://127.0.0.1:%d/" % porta
    browser = page.context.browser
    tctx = browser.new_context(viewport={"width": 820, "height": 1180}, has_touch=True)
    tctx.add_init_script("try { sessionStorage.setItem('pd.salutato', '1'); sessionStorage.setItem('pd.profiloScelto', '1') } catch (e) {}")
    tp = tctx.new_page()
    errori = []
    tp.on("pageerror", lambda e: errori.append("pageerror: " + str(e)))
    tp.on("console", lambda m: errori.append("console: " + m.text) if m.type == "error" and "403" not in m.text and "503" not in m.text and "special-words" not in m.text else None)
    tp.goto(TB)
    check("tablet: senza codice compare la pagina del codice", "Inserite il codice che vedete sullo schermo del facilitatore" in tp.inner_text("body"))
    sbagliato = "%06d" % ((int(codice) + 1) % 1000000)
    tp.goto(TB + "?c=" + sbagliato)
    check("tablet: codice sbagliato rifiutato", "non è giusto" in tp.inner_text("body") and not tctx.cookies())
    tp.fill("input[name=c]", codice)
    tp.click("button[type=submit]")
    tp.wait_for_selector("#view-home h1", timeout=20000)
    cookie = [c for c in tctx.cookies() if c["name"] == "pd_tablet"]
    check("tablet: cookie di sessione HttpOnly e SameSite=Strict", cookie and cookie[0]["httpOnly"] and cookie[0]["sameSite"] == "Strict" and
          len(cookie[0]["value"]) == 32, cookie)
    tok = cookie[0]["value"] if cookie else ""
    check("tablet: modalità ospite", tp.evaluate("PD.ospite === true && PD.server === true"))
    check("tablet: etichetta «Collegato al PC dell'aula» visibile", tp.is_visible(".pd-ospite-chip") and "Collegato al PC dell'aula" in tp.inner_text(".pd-ospite-chip"))
    check("tablet: stato ridotto (niente cartelle del PC)", tp.evaluate("!('data_dir' in PD.status.system) && !PD.status.update_url && PD.status.ospite === true"))
    tp.screenshot(path=SHOTS + "/41-tablet-ospite.png")

    # impostazioni e microfono nascosti
    tp.goto(TB + "#/settings")
    tp.wait_for_selector("#view-settings h1")
    testo = tp.inner_text("#view-settings")
    check("tablet: impostazioni di sistema nascoste (aggiornamenti, import, microfono, condivisione)",
          tp.locator("#check-upd").count() == 0 and tp.locator("#pack-import").count() == 0 and "🎤 Microfono" not in testo and
          "Condividi con i tablet" not in testo and tp.locator("#reprobe").count() == 0, testo[:300])
    check("tablet: i progressi restano sul tablet (spiegato)", "su questo tablet" in testo)
    tp.screenshot(path=SHOTS + "/42-tablet-impostazioni.png", full_page=True)
    tp.goto(TB + "#/ask")
    tp.wait_for_selector("#question")
    check("tablet: microfono nascosto", not tp.is_visible("#mic"))
    tp.goto(TB + "#/editor")
    tp.wait_for_selector("#view-editor h1")
    check("tablet: nell'editor solo «Scarica il file»", tp.locator('#view-editor [data-act="salva"]').count() == 0 and
          tp.locator('#view-editor [data-act="scarica"]').count() > 0)
    tp.goto(TB + "#/tablet")
    tp.wait_for_selector("#view-tablet .notice")
    check("tablet: la condivisione non si gestisce dal tablet", "PC del facilitatore" in tp.inner_text("#view-tablet"))

    # progressi: salvati sul tablet, progress.json del PC invariato
    prima = api("/api/data/progress").get("value")
    tp.goto(TB + "#/lessons/computer/quiz")
    tp.wait_for_selector("#view-lessons .quiz-q")
    risposte = tp.evaluate("PD_LESSONS[0].quiz.map(function (q) { return q.a; })")
    for qi, a in enumerate(risposte):
        tp.click('#view-lessons .quiz-q[data-q="%d"] .quiz-opt[data-o="%d"]' % (qi, a))
    tp.wait_for_selector("#quiz-end .notice.ok")
    tp.wait_for_timeout(1200)
    locale = tp.evaluate("JSON.parse(localStorage.getItem('pd.progress') || 'null')")
    check("tablet: progressi salvati nel browser del tablet", locale and locale["lessons"]["computer"]["done"] is True, locale and locale.get("lessons"))
    dopo = api("/api/data/progress").get("value")
    check("tablet: progress.json del PC invariato", prima == dopo)

    # voce del PC e lista bianca
    if tp.evaluate("PD.status.tts.engines.length > 0"):
        tp.evaluate("PD.stopSpeech()")
        for _ in range(20):   # 503 = il PC sta già parlando per altri tablet (Piper lento in Wine): si riprova
            code = tp.evaluate("""() => fetch('/api/tts', {method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({text: 'Buongiorno dal tablet'})}).then(r => r.status)""")
            if code != 503:
                break
            tp.wait_for_timeout(1500)
        check("tablet: voce del PC (/api/tts) disponibile", code == 200, code)
    vietate = tp.evaluate("""async () => {
      const prove = [['GET', '/api/data/progress'], ['POST', '/api/data/progress', {value: {}}], ['POST', '/api/packs/import', {pack: {}}],
        ['POST', '/api/packs/remove', {id: 'x'}], ['POST', '/api/update-check', {}], ['POST', '/api/update-download', {}],
        ['POST', '/api/shutdown', {}], ['POST', '/api/heartbeat', {}], ['GET', '/api/aula'], ['POST', '/api/aula/applica', {}],
        ['GET', '/api/tablet'], ['POST', '/api/tablet', {azione: 'spegni'}], ['POST', '/api/stt-reprobe', {}], ['GET', '/api/setup/info'],
        ['POST', '/api/packs/download', {}]];
      const out = {};
      for (const p of prove) {
        const r = await fetch(p[1], p[0] === 'GET' ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(p[2])});
        out[p[0] + ' ' + p[1]] = r.status;
      }
      const stt = await fetch('/api/stt', {method: 'POST', headers: {'Content-Type': 'audio/wav'}, body: new Uint8Array(2000)});
      out['POST /api/stt'] = stt.status;
      return out;
    }""")
    check("tablet: dati, pacchetti, aggiornamenti, spegnimento, aula, microfono → 403", all(v == 403 for v in vietate.values()), vietate)
    ok_api = tp.evaluate("""async () => [(await fetch('/api/packs')).status, (await fetch('/api/rete')).status]""")
    check("tablet: contenuti e stato della rete permessi", ok_api == [200, 200], ok_api)
    packs = tp.evaluate("fetch('/api/packs').then(r => r.json())")
    check("tablet: elenco dei pacchetti senza percorsi del disco", all("/" not in (e.get("file") or "") and "\\" not in (e.get("file") or "") for e in packs.get("packs", [])),
          [e.get("file") for e in packs.get("packs", [])][:3])
    st_h, _, _ = _http(TB + "api/status", headers={"Cookie": "pd_tablet=" + tok, "Host": "evil.example:%d" % porta})
    check("tablet: Host falso rifiutato", st_h == 403, st_h)
    st_o, _, _ = _http(TB + "api/tts", {"text": "ciao"}, headers={"Cookie": "pd_tablet=" + tok, "Origin": "http://evil.example"})
    check("tablet: Origin estranea rifiutata", st_o == 403, st_o)
    st_n, _, _ = _http(TB + "api/status")
    check("tablet: senza cookie le API rispondono 403", st_n == 403, st_n)
    st_j, _, _ = _http(TB + "js/app.js")
    check("tablet: senza cookie niente file dell'interfaccia", st_j == 403, st_j)
    st_v, _, _ = _http(TB + "vendor/ocr/tesseract.min.js", headers={"Cookie": "pd_tablet=" + tok})
    check("tablet: i file dell'OCR (vendor/ocr) si possono scaricare", st_v == 200, st_v)

    # ---------------------------------------------------------------- «Spiegami questa lettera»: OCR nel browser del tablet
    try:
        import importlib.util
        _s = importlib.util.spec_from_file_location("ui_lettera", os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui_lettera.py"))
        _l = importlib.util.module_from_spec(_s)
        _s.loader.exec_module(_l)
        tp.goto(TB + "#/lettera")
        tp.wait_for_selector("#lt-file", state="attached", timeout=15000)
        tp.set_input_files("#lt-file", files=[{"name": "lettera.png", "mimeType": "image/png", "buffer": _l.immagine_png()}])
        tp.wait_for_selector(".lt-ocr.lt-ocr-ok, .lt-ocr.lt-ocr-male", timeout=180000)
        letto = tp.input_value("#lt-testo")
        check("tablet: la lettera si legge con l'OCR nel browser del tablet (file serviti dal PC)", "87" in letto, letto[:200])
    except Exception as e:  # noqa: BLE001
        check("tablet: la lettera si legge con l'OCR nel browser del tablet (file serviti dal PC)", False, repr(e)[:300])

    # ---------------------------------------------------------------- telefono (390 px)
    mctx = browser.new_context(viewport={"width": 390, "height": 800}, has_touch=True, is_mobile=True)
    mctx.add_init_script("try { sessionStorage.setItem('pd.salutato', '1'); sessionStorage.setItem('pd.profiloScelto', '1') } catch (e) {}")
    mp = mctx.new_page()
    mp.on("pageerror", lambda e: errori.append("telefono pageerror: " + str(e)))
    mp.goto(TB)
    mp.screenshot(path=SHOTS + "/43-telefono-codice.png")
    mp.goto(TB + "?c=" + codice)
    mp.wait_for_selector("#view-home h1", timeout=20000)
    check("telefono: etichetta dell'ospite visibile", mp.is_visible(".pd-ospite-chip"))
    check("telefono: modalità ospite senza scorrimento orizzontale", mp.evaluate("PD.ospite && document.documentElement.scrollWidth <= window.innerWidth + 1"))
    mp.screenshot(path=SHOTS + "/44-telefono-ospite.png")
    mctx.close()

    # ---------------------------------------------------------------- quadro dell'aula (PC facilitatore)
    page.evaluate("""async () => { PD.settings.aulaRuolo = 'facilitatore'; PD.settings.aulaCodice = '5555';
        await PD.api('/api/data/settings', {value: PD.settings}); return await PD.api('/api/aula/applica', {}); }""")
    tp.goto(TB + "#/aula")
    tp.wait_for_selector("#ao-nome")
    tp.fill("#ao-nome", "Lucia sul tablet")
    tp.click("#ao-salva")
    tp.wait_for_selector("#ao-stato .notice.ok", timeout=10000)
    cl = [c for c in (api("/api/aula").get("clienti") or []) if c.get("utente") == "Lucia sul tablet"]
    check("aula: il tablet compare nel quadro come allievo", len(cl) == 1 and cl[0]["id"].startswith("tablet-") and cl[0]["progressi"]["lezioni_fatte"] >= 1 and
          cl[0]["attivita"]["vista"] == "aula", cl)
    tp.wait_for_selector("#pd-mano-alza", timeout=10000)
    tp.click("#pd-mano-alza")
    tp.wait_for_selector(".pd-mano-su", timeout=10000)
    cl = [c for c in (api("/api/aula").get("clienti") or []) if c.get("utente") == "Lucia sul tablet"]
    check("aula: mano alzata dal tablet", cl and cl[0]["mano"]["alzata"] is True, cl and cl[0].get("mano"))
    page.goto(ROOT + "#/aula")
    page.wait_for_selector(".tab-aula td", timeout=15000)
    check("aula: il tablet è nel quadro del PC con la mano alzata", "Lucia sul tablet" in page.inner_text(".tab-aula") and page.locator(".pd-mano-riga").count() >= 1)
    page.screenshot(path=SHOTS + "/45-tablet-nel-quadro.png", full_page=True)
    tp.screenshot(path=SHOTS + "/46-tablet-mano.png")
    r = api("/api/aula/rispondi", {"id": cl[0]["id"], "stato": "arrivo"}) if cl else {}
    check("aula: il facilitatore risponde «Arrivo!»", r.get("ok"), r)
    try:
        tp.wait_for_selector(".pd-mano-su.arriva", timeout=15000)
        arriva = True
    except Exception:  # noqa: BLE001
        arriva = False
    check("aula: il tablet vede «il facilitatore sta arrivando»", arriva)
    api("/api/aula/rispondi", {"id": cl[0]["id"], "stato": "risolto"}) if cl else None
    try:
        tp.wait_for_selector("#pd-mano-alza", timeout=15000)
        giu = True
    except Exception:  # noqa: BLE001
        giu = False
    check("aula: «Risolto» abbassa la mano sul tablet", giu)

    # elenco dei dispositivi sul PC
    page.goto(ROOT + "#/tablet")
    page.wait_for_selector("#tablet-dispositivi td", timeout=10000)
    check("tablet: il PC vede il tablet collegato (nome e indirizzo)", "Lucia sul tablet" in page.inner_text("#tablet-dispositivi") and
          "127.0.0.1" in page.inner_text("#tablet-dispositivi"))

    # ---------------------------------------------------------------- «Cambia codice» e «Spegni»
    page.click("#tablet-cambia")
    page.wait_for_function("document.querySelector('#tablet-codice') && document.querySelector('#tablet-codice').textContent.replace(/ /g, '') !== '%s'" % codice)
    nuovo = page.inner_text("#tablet-codice").replace(" ", "").strip()
    st_c = tp.evaluate("fetch('/api/status').then(r => r.status)")
    check("tablet: «Cambia codice» chiude le sessioni", nuovo != codice and st_c == 403, (nuovo, st_c))
    tp.goto(TB)
    check("tablet: dopo il cambio torna la pagina del codice", "Inserite il codice" in tp.inner_text("body"))
    tp.goto(TB + "?c=" + codice)
    check("tablet: il codice vecchio non vale più", "non è giusto" in tp.inner_text("body"))
    tp.goto(TB + "?c=" + nuovo)
    tp.wait_for_selector("#view-home h1", timeout=20000)
    check("tablet: si rientra con il codice nuovo", tp.evaluate("PD.ospite === true"))
    # limite dei tentativi (10 al minuto per indirizzo)
    esiti = [_http(TB + "?c=" + sbagliato)[0] for _ in range(11)]
    check("tablet: troppi tentativi → 429", esiti[-1] == 429, esiti)
    page.click("#tablet-spegni")
    page.click("#tablet-spegni")
    page.wait_for_selector("#tablet-accendi", timeout=10000)
    st = api("/api/tablet")
    chiusa = False
    for _ in range(10):      # in Wine la chiusura dell'ascolto può arrivare con un attimo di ritardo
        chiusa = _porta_chiusa(porta)
        if chiusa:
            break
        time.sleep(0.5)
    check("tablet: «Spegni» chiude la porta", st.get("attivo") is False and chiusa, st)
    check("tablet: impostazione tabletCondividi tornata spenta", page.evaluate("PD.settings.tabletCondividi === false"))
    check("tablet: nessun errore JavaScript sul tablet", not errori, errori)
    tctx.close()

    # ---------------------------------------------------------------- pulizia: tutto spento
    page.evaluate("""async () => { PD.settings.aulaRuolo = ''; PD.settings.aulaCodice = ''; PD.settings.tabletCondividi = false;
        await PD.api('/api/data/settings', {value: PD.settings}); await PD.api('/api/aula/rimuovi', {id: '*'}); return PD.api('/api/aula/applica', {}); }""")
    time.sleep(0.3)
