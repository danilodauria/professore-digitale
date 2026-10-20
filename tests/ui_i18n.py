"""Prove della scelta della lingua (src/web/js/i18n.js, dizionari src/web/i18n/*.json).
Chiamata da tests/test_ui.py: prova(page, ROOT, check, SHOTS). Alla fine rimette l'italiano."""
import json, sys, urllib.request


def prova(page, ROOT, check, SHOTS):
    standalone = ROOT.startswith("file:")
    mock = sys.argv[3] if len(sys.argv) > 3 else None

    def ev(js):
        return page.evaluate(js)

    def nav():
        return page.inner_text("nav.sidebar")

    def ricarica_con(lingua):
        ev("PD.settings.lingua = %s; PD.saveSettings()" % json.dumps(lingua))
        page.wait_for_timeout(800)            # il server salva le impostazioni con un piccolo ritardo
        page.goto(ROOT + "#/home"); page.reload()
        page.wait_for_selector("#view-home h1")
        page.wait_for_function("PD.i18n && PD.i18n.lingua === %s" % json.dumps(lingua), timeout=15000)
        page.wait_for_timeout(500)

    try:
        page.goto(ROOT + "#/home"); page.wait_for_selector("#view-home h1")
        check("lingua: pulsante 🌐 in alto", page.is_visible("#btn-lingua") and "IT" in page.inner_text("#btn-lingua"))
        if standalone:
            check("lingua: dizionari inclusi nella versione portatile",
                  ev("['en','fr','es','de','ro'].every(function (l) { return !!document.getElementById('pd-i18n-' + l) })"))
        page.click("#btn-lingua")
        page.wait_for_selector("#pd-lingua-menu")
        check("lingua: menu con 6 lingue", page.locator("#pd-lingua-menu .pd-lingua").count() == 6)
        page.screenshot(path=SHOTS + "/i18n-01-menu.png")

        # --- inglese scelto dal menu: la pagina si ricarica da sola ---
        with page.expect_navigation(timeout=15000):
            page.click("#pd-lingua-menu [data-lingua=en]")
        page.wait_for_selector("#view-home h1")
        page.wait_for_function("PD.i18n && PD.i18n.lingua === 'en'", timeout=15000)
        page.wait_for_timeout(600)
        n = nav()
        check("lingua: menu laterale in inglese", "Lessons" in n and "Settings" in n and "Lezioni" not in n, n[:200])
        check("lingua: nomi propri non tradotti", "Nonni Teach" in n and "FeniceOS" in n)
        check("lingua: pulsante mostra EN", "EN" in page.inner_text("#btn-lingua"))
        check("lingua: attributo lang della pagina", ev("document.documentElement.lang") == "en")
        page.screenshot(path=SHOTS + "/i18n-02-home-en.png")

        # testi creati dopo (nuova vista) tradotti dall'osservatore
        page.click("nav.sidebar [data-view=settings]")
        page.wait_for_selector("#pd-lingua-card")
        page.wait_for_timeout(500)
        check("lingua: scheda nelle Impostazioni tradotta", "Program language" in page.inner_text("#pd-lingua-card"),
              page.inner_text("#pd-lingua-card")[:120])
        page.click("nav.sidebar [data-view=lessons]")
        page.wait_for_selector("#view-lessons .tile")
        page.wait_for_timeout(500)
        page.screenshot(path=SHOTS + "/i18n-03-lezioni-en.png")

        # IA locale: traduce i testi senza dizionario e risponde nella lingua scelta
        if mock and not standalone and ev("!!(PD.aiReady && PD.aiReady())"):
            page.goto(ROOT + "#/lessons/file/0"); page.wait_for_selector("#lesson-board")
            page.wait_for_timeout(5000)
            trad = json.loads(urllib.request.urlopen(mock + "/trad").read())
            check("lingua: l'IA locale traduce i testi lunghi", len(trad) > 0, trad)
            check("lingua: testo tradotto dall'IA nella pagina", "[EN] " in page.inner_text("body"))
            page.goto(ROOT + "#/ask"); page.wait_for_selector("#question", timeout=10000)
            page.fill("#question", "come si innaffia il cactus digitale")
            page.keyboard.press("Enter")
            page.wait_for_timeout(2500)
            last = json.loads(urllib.request.urlopen(mock + "/last").read())
            sistema = ((last.get("messages") or [{}])[0].get("content") or "")
            check("lingua: all'IA si chiede di rispondere in inglese", "inglese (English)" in sistema, sistema[-200:])

        # --- tedesco, poi di nuovo italiano ---
        ricarica_con("de")
        check("lingua: menu laterale in tedesco", "Lektionen" in nav() and "Einstellungen" in nav(), nav()[:200])
        ricarica_con("it")
        check("lingua: ritorno all'italiano", "Lezioni" in nav() and "Impostazioni" in nav())
    finally:
        ev("PD.settings.lingua = 'it'; PD.saveSettings(); PD.store.save('traduzioni', {})")
        page.wait_for_timeout(800)
        page.goto(ROOT + "#/home"); page.reload(); page.wait_for_selector("#view-home h1")
