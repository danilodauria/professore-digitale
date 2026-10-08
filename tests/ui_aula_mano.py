# -*- coding: utf-8 -*-
"""Test di «✋ Mano alzata» in aula (3.3). Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS).

1. Facilitatore: il server della pagina fa il facilitatore; gli allievi sono simulati con richieste dirette a
   /aula/ciao (come «Giuseppe Verdi» in test_ui.py). Avviso con suono → «Arrivo!» → la risposta mirata arriva
   all'allievo nella risposta a /aula/ciao → ordine del quadro → «Risolto».
2. Allievo: si avvia un SECONDO server Python (porta della pagina + 5, aula + 105/+106) che fa il facilitatore;
   il server della pagina diventa l'allievo collegato a 127.0.0.1 (l'aula accetta il loopback come rete locale).
   Funziona anche quando la pagina è servita dal programma Windows in Wine.
   PD_TEST_PD_SERVER (facoltativo, solo per le prove) = percorso di un altro pd_server.py per il secondo server.
Nella versione portatile (file://) controlla solo che il pulsante non compaia. Rimette a posto le impostazioni.
"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error

QUI = os.path.dirname(os.path.abspath(__file__))
CSS = os.path.join(QUI, "..", "src", "web", "css", "aula-mano.css")
APRI = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def _http(url, corpo=None, timeout=8):
    data = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"} if data else {})
    try:
        with APRI.open(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except ValueError:
            return e.code, None
    except OSError as e:
        return 0, str(e)


def _css(page):
    # finché aula-mano.css non è collegato in index.html lo si aggiunge qui
    if not page.evaluate("!!document.querySelector('link[href*=\"aula-mano\"]')"):
        page.add_style_tag(path=CSS)


def _ricarica(page, ROOT, hash_):
    page.evaluate("try { sessionStorage.setItem('pd.profiloScelto', '1'); sessionStorage.setItem('pd.salutato', '1') } catch (e) {}")
    page.goto(ROOT + hash_)
    page.reload()
    page.wait_for_selector("#main .view:not([hidden]) h1", timeout=20000)
    page.wait_for_function("window.PD && PD.settings && PD.aulaMano", timeout=20000)
    _css(page)


def _aspetta(cond, secondi):
    fine = time.time() + secondi
    while time.time() < fine:
        v = cond()
        if v:
            return v
        time.sleep(0.4)
    return cond()


def prova(page, ROOT, check, SHOTS):
    if ROOT.startswith("file:"):
        check("mano alzata: nessun pulsante nella versione portatile", page.evaluate("!document.getElementById('pd-mano')"))
        return
    base = ROOT.rstrip("/")
    porta_pagina = int(base.rsplit(":", 1)[1])
    originali = page.evaluate("JSON.parse(JSON.stringify(PD.settings))")

    def imposta(**kw):
        return page.evaluate("""async (kw) => { Object.assign(PD.settings, kw); await PD.api('/api/data/settings', {value: PD.settings});
            return await PD.api('/api/aula/applica', {}); }""", kw)

    try:
        _facilitatore(page, ROOT, check, SHOTS, imposta)
        _allievo(page, ROOT, check, SHOTS, imposta, porta_pagina)
    finally:
        page.set_viewport_size({"width": 1366, "height": 800})
        page.evaluate("""async (s) => { PD.settings = s; await PD.api('/api/data/settings', {value: s});
            try { await PD.api('/api/aula/rimuovi', {id: '*'}); } catch (e) {} return PD.api('/api/aula/applica', {}); }""", originali)
        _ricarica(page, ROOT, "#/home")


def _facilitatore(page, ROOT, check, SHOTS, imposta):
    st = imposta(aulaRuolo="facilitatore", aulaCodice="5151", aulaNome="Aula della mano")
    check("mano alzata: PC del facilitatore in ascolto", st.get("ruolo") == "facilitatore" and st.get("in_ascolto"), st)
    porta = st.get("porta")
    page.evaluate("PD.api('/api/aula/rimuovi', {id: '*'})")

    def ciao(cid, utente, pc, titolo, mano=None):
        corpo = {"id": cid, "codice": "5151", "pc": pc, "utente": utente, "versione": "3.3.0",
                 "attivita": {"vista": "lessons", "titolo": titolo}, "progressi": {"lezioni_fatte": 1, "lezioni_totali": 15}}
        if mano is not None:
            corpo["mano"] = mano
        return _http("http://127.0.0.1:%d/aula/ciao" % porta, corpo)

    da_m, da_b = int(time.time()) - 5, int(time.time()) - 2
    mano_m = {"alzata": True, "da": da_m, "messaggio": "non trovo il pulsante"}
    ciao("pc-anna", "Anna Neri", "PC-1", "Inizio")                         # senza mano (come un PC 3.2)
    c, r = ciao("pc-maria", "Maria", "PC-3", "Lezione: Usare il mouse (passo 3)", mano_m)
    check("mano alzata: il facilitatore riceve la presenza con la mano", c == 200 and "mano" not in r, (c, r))
    _ricarica(page, ROOT, "#/home")
    page.wait_for_selector("#pd-mani:not([hidden])", timeout=15000)
    testo = page.inner_text("#pd-mani")
    check("mano alzata: avviso in alto anche fuori dalla pagina Aula",
          all(t in testo for t in ("Maria", "PC-3", "Lezione: Usare il mouse (passo 3)", "non trovo il pulsante", "chiede aiuto")), testo)
    page.wait_for_timeout(300)
    check("mano alzata: suono gentile all'arrivo della richiesta", page.evaluate("PD.aulaMano.stato().suonati") >= 1)
    check("mano alzata: titolo della finestra con la mano", page.title().startswith("✋"), page.title())
    box = page.locator("#pd-mani").bounding_box()
    tb = page.locator(".topbar").bounding_box()
    check("mano alzata: il riquadro non copre la barra in alto", box and tb and box["y"] >= tb["y"] + tb["height"] - 1, (box, tb))
    page.screenshot(path=SHOTS + "/mano-01-avviso-facilitatore.png")

    # suono disattivabile
    page.click("#pd-mani-suono")
    check("mano alzata: suono disattivato", page.evaluate("PD.settings.aulaManoSuono === false"))
    page.click("#pd-mani-suono")
    check("mano alzata: suono riattivato", page.evaluate("PD.settings.aulaManoSuono === true"))

    # «Arrivo!» → la risposta mirata arriva all'allievo con la sua prossima presenza
    page.click("#pd-mani [data-mano-rispondi='arrivo'][data-mano-id='pc-maria']")
    page.wait_for_selector("#pd-mani [data-mano-id='pc-maria'][data-mano-rispondi='arrivo'][disabled]", timeout=10000)
    c, r = ciao("pc-maria", "Maria", "PC-3", "Lezione: Usare il mouse (passo 3)", mano_m)
    check("mano alzata: l'allievo riceve «arrivo»", c == 200 and r.get("mano") == {"da": da_m, "stato": "arrivo"}, r)
    c, r = ciao("pc-altro", "Altro", "PC-9", "Inizio")
    check("mano alzata: la risposta è solo per quell'allievo", c == 200 and "mano" not in r, r)
    _http("http://127.0.0.1:%d/aula/ciao" % porta, None)   # niente corpo: non deve rompere nulla
    page.evaluate("PD.api('/api/aula/rimuovi', {id: 'pc-altro'})")

    # seconda richiesta (più recente) → ordine nel quadro: prima chi aspetta da più tempo
    time.sleep(1.2)
    ciao("pc-bruno", "Bruno", "PC-5", "Palestra: click", {"alzata": True, "da": da_b, "messaggio": ""})
    page.goto(ROOT + "#/aula")
    page.wait_for_selector(".tab-aula tr.pd-mano-riga", timeout=15000)
    page.wait_for_function("document.querySelectorAll('.tab-aula tr.pd-mano-riga').length === 2", timeout=15000)
    nomi = page.eval_on_selector_all(".tab-aula tbody tr", "rr => rr.map(r => r.querySelector('td:nth-child(2) b').textContent)")
    check("mano alzata: nel quadro prima chi aspetta da più tempo", nomi[:3] == ["Maria", "Bruno", "Anna Neri"], nomi)
    check("mano alzata: righe in evidenza", page.locator(".tab-aula tr.pd-mano-riga").count() == 2)
    check("mano alzata: conteggio delle richieste", "chiedono aiuto" in page.inner_text("#view-aula .numeri"))
    page.screenshot(path=SHOTS + "/mano-02-quadro.png", full_page=True)

    # «Risolto» dal quadro
    page.click(".tab-aula [data-mano-rispondi='risolto'][data-mano-id='pc-maria']")
    page.wait_for_function("document.querySelectorAll('.tab-aula tr.pd-mano-riga').length === 1", timeout=15000)
    c, r = ciao("pc-maria", "Maria", "PC-3", "Lezione: Usare il mouse (passo 3)", mano_m)
    check("mano alzata: l'allievo riceve «risolto»", r.get("mano") == {"da": da_m, "stato": "risolto"}, r)
    st = page.evaluate("PD.api('/api/aula')")
    m = [x for x in st["clienti"] if x["id"] == "pc-maria"][0]["mano"]
    check("mano alzata: mano di Maria abbassata dal facilitatore", m["alzata"] is False, m)
    # una nuova richiesta di Maria ricomincia da capo
    c, r = ciao("pc-maria", "Maria", "PC-3", "Inizio", {"alzata": True, "da": da_m + 100, "messaggio": "x" * 300})
    st = page.evaluate("PD.api('/api/aula')")
    m = [x for x in st["clienti"] if x["id"] == "pc-maria"][0]["mano"]
    check("mano alzata: nuova richiesta (messaggio accorciato a 120)", m["alzata"] and m["stato"] == "" and len(m["messaggio"]) == 120 and "mano" not in r, m)
    # la mano abbassata dall'allievo sparisce
    ciao("pc-maria", "Maria", "PC-3", "Inizio", {"alzata": False, "da": da_m + 100})
    # «Risolto» dal riquadro in alto (per Bruno)
    page.goto(ROOT + "#/home")
    page.wait_for_selector("#pd-mani [data-mano-id='pc-bruno']", timeout=15000)
    page.click("#pd-mani [data-mano-rispondi='risolto'][data-mano-id='pc-bruno']")
    page.wait_for_selector("#pd-mani", state="hidden", timeout=15000)
    check("mano alzata: nessuna richiesta → riquadro nascosto", not page.is_visible("#pd-mani"))
    check("mano alzata: titolo della finestra ripristinato", not page.title().startswith("✋"), page.title())
    rr = _http(ROOT + "api/aula/rispondi", {"id": "pc-bruno", "stato": "arrivo"})   # da Python: niente errori 4xx nella console
    check("mano alzata: risposta a una mano già abbassata rifiutata (409)", rr[0] == 409, rr)
    page.evaluate("PD.api('/api/aula/rimuovi', {id: '*'})")


def _allievo(page, ROOT, check, SHOTS, imposta, porta_pagina):
    p2, a2 = porta_pagina + 5, porta_pagina + 105
    server_py = os.environ.get("PD_TEST_PD_SERVER") or os.path.join(QUI, "..", "src", "server", "pd_server.py")
    dati = tempfile.mkdtemp(prefix="pd-mano-")
    with open(os.path.join(dati, "settings.json"), "w", encoding="utf-8") as f:
        json.dump({"aulaRuolo": "facilitatore", "aulaCodice": "7373", "aulaNome": "Aula di Bianca"}, f)
    env = dict(os.environ, PD_DATA_DIR=dati, PD_AULA_PORT=str(a2), PD_AULA_UDP=str(a2 + 1))
    proc = subprocess.Popen([sys.executable, "-B", server_py, "--port", str(p2), "--idle-timeout", "0"], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    fac = "http://127.0.0.1:%d" % p2
    try:
        ok = _aspetta(lambda: _http(fac + "/api/aula")[1] if _http(fac + "/api/aula")[0] == 200 else None, 15)
        check("mano alzata: secondo PC (facilitatore) avviato", ok and ok.get("ruolo") == "facilitatore" and ok.get("in_ascolto"), ok)
        if not ok:
            return

        def mano_fac():
            c, st = _http(fac + "/api/aula")
            cl = [x for x in (st or {}).get("clienti", []) if x.get("utente") == "Maria Prova"]
            return cl[0] if cl else None

        imposta(aulaRuolo="allievo", aulaCodice="7373", studentName="Maria Prova", aulaServer="127.0.0.1:%d" % a2)
        _ricarica(page, ROOT, "#/lessons")
        page.wait_for_selector("#pd-mano-alza", timeout=15000)
        check("mano alzata: pulsante «Ho bisogno di aiuto» sul PC dell'allievo", "Ho bisogno di aiuto" in page.inner_text("#pd-mano"))
        b, sb = page.locator("#pd-mano").bounding_box(), page.locator(".sidebar").bounding_box()
        check("mano alzata: il pulsante non copre il menu", b["x"] >= sb["x"] + sb["width"], (b, sb))
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        check("mano alzata: spazio in fondo alla pagina per il pulsante",
              page.evaluate("parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom) >= 100"))
        page.screenshot(path=SHOTS + "/mano-03-allievo-pulsante.png")

        t0 = time.time()
        page.click("#pd-mano-alza")
        page.wait_for_selector("#pd-mano.pd-mano-su", timeout=10000)
        check("mano alzata: «Mano alzata – il facilitatore arriva»", "Mano alzata – il facilitatore arriva" in page.inner_text("#pd-mano"))
        x = _aspetta(lambda: (mano_fac() or {}).get("mano", {}).get("alzata") and mano_fac(), 10)
        check("mano alzata: il facilitatore la vede subito (senza aspettare 20 s)", x and time.time() - t0 < 10, (time.time() - t0, x and x.get("mano")))
        page.fill("#pd-mano-msg", "non trovo il pulsante")
        page.click("#pd-mano-invia")
        x = _aspetta(lambda: (mano_fac() or {}).get("mano", {}).get("messaggio") == "non trovo il pulsante" and mano_fac(), 10)
        check("mano alzata: messaggio facoltativo arrivato", bool(x), x and x.get("mano"))
        page.screenshot(path=SHOTS + "/mano-04-allievo-alzata.png")

        c, r = _http(fac + "/api/aula/rispondi", {"id": x["id"] if x else "", "stato": "arrivo"})
        check("mano alzata: «Arrivo!» dal facilitatore", c == 200 and r["mano"]["stato"] == "arrivo", r)
        page.wait_for_selector("#pd-mano.arriva", timeout=20000)
        check("mano alzata: l'allievo vede «Il facilitatore sta arrivando 🙂»", "Il facilitatore sta arrivando 🙂" in page.inner_text("#pd-mano"))
        page.screenshot(path=SHOTS + "/mano-05-allievo-arriva.png")

        # telefono: sopra la barra in basso, niente scorrimento orizzontale
        page.set_viewport_size({"width": 390, "height": 800})
        page.wait_for_timeout(500)
        b, sb = page.locator("#pd-mano").bounding_box(), page.locator(".sidebar").bounding_box()
        check("mano alzata: su telefono sopra la barra", b["y"] + b["height"] <= sb["y"] + 1, (b, sb))
        check("mano alzata: su telefono niente scorrimento orizzontale", not page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
        page.screenshot(path=SHOTS + "/mano-06-telefono.png")
        page.set_viewport_size({"width": 1366, "height": 800})

        c, r = _http(fac + "/api/aula/rispondi", {"id": x["id"] if x else "", "stato": "risolto"})
        check("mano alzata: «Risolto» dal facilitatore", c == 200 and r["mano"]["alzata"] is False, r)
        page.wait_for_selector("#pd-mano-alza", timeout=20000)
        check("mano alzata: dopo «Risolto» torna il pulsante", "Ho bisogno di aiuto" in page.inner_text("#pd-mano"))

        # l'allievo alza e poi abbassa la mano da solo
        page.click("#pd-mano-alza")
        page.wait_for_selector("#pd-mano-giu", timeout=10000)
        _aspetta(lambda: (mano_fac() or {}).get("mano", {}).get("alzata"), 10)
        page.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
        page.screenshot(path=SHOTS + "/mano-07-allievo-scuro.png")
        page.click("#pd-mano-giu")
        page.wait_for_selector("#pd-mano-alza", timeout=10000)
        y = _aspetta(lambda: mano_fac() if not (mano_fac() or {}).get("mano", {}).get("alzata") else None, 10)
        check("mano alzata: abbassata dall'allievo", y is not None, y and y.get("mano"))
        page.evaluate("PD.applySettings()")
        # validazione stretta dell'API locale (da Python: niente errori 4xx nella console della pagina)
        rr = [_http(ROOT + "api/aula/mano", b)[0] for b in ({"alzata": "sì"}, {"alzata": True, "messaggio": "x" * 121},
                                                             {"alzata": True, "messaggio": "a\u0007b"}, {"alzata": False})]
        check("mano alzata: validazione dell'API locale", rr == [400, 400, 400, 200], rr)
    finally:
        try:
            _http(fac + "/api/shutdown", {})
        except Exception:
            pass
        try:
            proc.wait(5)
        except Exception:
            proc.kill()
        shutil.rmtree(dati, ignore_errors=True)
