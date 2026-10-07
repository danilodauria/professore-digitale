"""Test della Palestra della vita digitale: simulatori Banca, Messaggi e Posta (src/web/js/vita-sim2.js).
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS). Completa per intero «posta» come un utente
e controlla che gli altri due partano. Rimette a posto PD.progress.vita e il tema."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = os.path.join(HERE, "..", "src", "web", "css", "vita2.css")


def _css(page):
    # finche' vita2.css non e' collegato in index.html, lo si inietta solo per i test
    page.evaluate("""css => { if (!document.querySelector('link[href*="vita2.css"]') && !document.getElementById('v2-css-test')) {
        var s = document.createElement('style'); s.id = 'v2-css-test'; s.textContent = css; document.head.appendChild(s); } }""",
                  open(CSS, encoding="utf-8").read())


def _apri(page, ROOT, sim):
    page.goto(ROOT + "#/vita")  # passando dall'indice la prova riparte anche se era appena finita
    page.wait_for_selector("#view-vita .vita-griglia", timeout=10000)
    page.goto(ROOT + "#/vita/" + sim)
    page.wait_for_selector("#view-vita .vita-pagina .v2-scena", timeout=10000)
    _css(page)


def _ok(page):
    return page.inner_text("#view-vita .vita-esito")


def prova(page, ROOT, check, SHOTS):
    page.goto(ROOT + "#/vita")
    page.wait_for_selector("#view-vita .vita-griglia", timeout=10000)
    ids = page.evaluate("PD.vita ? PD.vita.elenco().map(function (s) { return s.id; }) : []")
    for s in ("banca", "messaggi", "posta"):
        check("vita2: simulatore «%s» registrato" % s, s in ids, ids)
    ordini = page.evaluate("PD.vita.elenco().filter(function (s) { return /^(banca|messaggi|posta)$/.test(s.id); }).map(function (s) { return s.ordine; })")
    check("vita2: ordine 4-5-6", ordini == [4, 5, 6], ordini)
    prima = page.evaluate("JSON.stringify((PD.progress.vita) || null)")
    tema = page.evaluate("document.documentElement.getAttribute('data-theme')")
    page.evaluate("if (PD.progress.vita) delete PD.progress.vita.posta")

    # --- la banca e i messaggi partono ---
    _apri(page, ROOT, "banca")
    check("vita2: banca avviata", page.is_visible("#v2-codice") and "Accedi" in page.inner_text(".vita-testo"))
    page.fill("#v2-codice", "12345678"); page.click("#v2-accesso button[type=submit]")
    page.fill("#v2-codice", "1"); page.click("#v2-accesso button[type=submit]")
    check("vita2: «Compila per me» dopo 2 errori", page.is_visible("#view-vita .v2-compila"))
    page.click("#view-vita .v2-compila")
    check("vita2: compilato dal Professore", page.input_value("#v2-codice") == "4827 1593")
    _apri(page, ROOT, "messaggi")
    check("vita2: messaggi avviato", page.is_visible("[data-chat=anna]"))

    # --- la posta, per intero ---
    _apri(page, ROOT, "posta")
    check("vita2: posta con 6 email", page.locator("#view-vita .v2-mail").count() == 6)
    page.screenshot(path=SHOTS + "/vita2-posta-1280.png", full_page=False)
    verdetti = {"giulia": "sicura", "pacco": "truffa", "farmacia": "sicura", "rimborso": "truffa", "comune": "sicura", "premio": "truffa"}
    for mail, ver in verdetti.items():
        page.click("[data-mail=%s]" % mail)
        if mail == "pacco":
            page.click("#view-vita .v2-link")  # trappola: il pulsante dell'email truffa
            check("vita2: clic sul link truffa = errore", "non si preme" in _ok(page))
        page.click("[data-ver=%s]" % ver)
        if mail == "rimborso":
            check("vita2: segnali evidenziati", page.locator("#view-vita .v2-svela .v2-segno").count() >= 2)
            page.screenshot(path=SHOTS + "/vita2-posta-truffa.png")
        page.click("[data-v2=torna]")
    check("vita2: 6 bollini", page.locator("#view-vita .v2-badge").count() == 6)
    check("vita2: passo «rispondi»", "Giulia" in page.inner_text(".vita-testo"))
    page.click("[data-mail=giulia]"); page.click("[data-v2=rispondi]")
    page.fill("#v2-corpo", "Ciao Giulia, ecco la foto del lago!")
    page.click("#v2-risposta button[type=submit]")
    check("vita2: manca l'allegato", "allegato" in _ok(page))
    page.click("[data-v2=allega]")
    page.click("[data-file=documento]")
    check("vita2: niente foto del documento", "identità" in _ok(page))
    page.click("[data-file=lago]")
    page.click("#v2-risposta button[type=submit]")
    check("vita2: email inviata", "inviata a Giulia" in page.inner_text("#v2-vista"))
    page.click("[data-cart=arrivo]")
    page.click("[data-mail=farmacia]"); page.click("[data-v2=elimina]")
    check("vita2: email vera non si cancella", "vera" in _ok(page))
    page.click("[data-v2=indietro]")
    page.click("[data-mail=premio]"); page.click("[data-v2=elimina]")
    page.click("[data-cart=cestino]")
    page.click("[data-v2=svuota]"); page.click("[data-v2=si-svuota]")
    page.wait_for_selector("#view-vita .vita-fine:not([hidden])", timeout=8000)
    fatto = page.evaluate("!!(PD.progress.vita && PD.progress.vita.posta && PD.progress.vita.posta.fatto)")
    check("vita2: posta completata (PD.progress.vita.posta.fatto)", fatto)
    errori = page.evaluate("PD.progress.vita.posta.errori")
    check("vita2: errori contati", errori == 4, errori)
    page.screenshot(path=SHOTS + "/vita2-posta-fine.png")

    # --- telefono 390 px e tema scuro ---
    vp = page.viewport_size
    page.set_viewport_size({"width": 390, "height": 844})
    _apri(page, ROOT, "posta")
    page.click("[data-mail=pacco]")
    largo = page.evaluate("document.documentElement.scrollWidth")
    check("vita2: niente scorrimento orizzontale a 390 px (posta)", largo <= 392, largo)
    page.screenshot(path=SHOTS + "/vita2-posta-390.png", full_page=True)
    _apri(page, ROOT, "messaggi")
    page.click("[data-chat=anna]")
    largo = page.evaluate("document.documentElement.scrollWidth")
    check("vita2: niente scorrimento orizzontale a 390 px (messaggi)", largo <= 392, largo)
    page.screenshot(path=SHOTS + "/vita2-messaggi-390.png", full_page=True)
    page.set_viewport_size(vp)
    page.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
    _apri(page, ROOT, "banca")
    page.screenshot(path=SHOTS + "/vita2-banca-scuro.png")

    # --- rimettere a posto ---
    page.evaluate("t => document.documentElement.setAttribute('data-theme', t || 'light')", tema)
    page.evaluate("p => { var v = JSON.parse(p); if (v) PD.progress.vita = v; else delete PD.progress.vita; PD.saveProgress(); }", prima)
    page.goto(ROOT + "#/vita")
