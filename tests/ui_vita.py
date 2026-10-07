"""Test della «Palestra della vita digitale» (src/web/js/vita.js).
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS).
Completa per intero il simulatore «identita» cliccando come farebbe un utente (trappole comprese)
e rimette a posto progressi e impostazioni che cambia. Autore: Danilo D'Auria - Licenza MIT"""



def _attendi_telefono(page, box, tel):
    """Aspetta l'SMS sul telefono finto; se il clic su «Entra» si è perso (capita di rado), lo ripete con i dati giusti."""
    for _ in range(3):
        try:
            page.wait_for_selector(tel + " .vita-tel-btn", timeout=8000)
            return
        except Exception:
            if page.locator("#vs-utente").count():
                page.fill("#vs-utente", "mario.provetti"); page.fill("#vs-pwd", "Girasole48")
                page.click(box + " >> text=Entra")
    page.wait_for_selector(tel + " .vita-tel-btn", timeout=8000)

def prova(page, ROOT, check, SHOTS):
    errori = []
    gestore = lambda e: errori.append(str(e))
    page.on("pageerror", gestore)
    salvato = page.evaluate("""() => ({ vita: JSON.stringify((PD.progress || {}).vita || null), voce: PD.settings.voice, tema: PD.settings.theme })""")
    # la voce resterebbe accesa per ogni passo: nei test la spegniamo e poi la rimettiamo com'era
    page.evaluate("() => { PD.settings.voice = false; PD.stopSpeech(); }")
    try:
        _prova(page, ROOT, check, SHOTS)
    finally:
        page.evaluate("""(s) => {
            var v = JSON.parse(s.vita);
            if (v) PD.progress.vita = v; else delete PD.progress.vita;
            PD.saveProgress();
            PD.settings.voice = s.voce; PD.settings.theme = s.tema; PD.saveSettings();
        }""", salvato)
        page.set_viewport_size({"width": 1366, "height": 800})
        page.remove_listener("pageerror", gestore)
    check("vita: nessun errore JavaScript", not errori, "; ".join(errori[:3]))


def _prova(page, ROOT, check, SHOTS):
    page.evaluate("() => { if (PD.progress.vita) delete PD.progress.vita.identita; }")
    # riquadro nella pagina Inizio
    page.goto(ROOT + "#/home")
    page.wait_for_selector("#view-home .hero")
    check("vita: riquadro nella pagina Inizio", page.locator("#view-home [data-go='#/vita']").count() >= 1)

    # contratto
    c = page.evaluate("""() => ({
        reg: typeof PD.vita.registra, el: typeof PD.vita.elenco, st: typeof PD.vita.stato,
        ids: PD.vita.elenco().map(function (s) { return s.id; }), ord: PD.vita.elenco().map(function (s) { return s.ordine; }),
        nullo: PD.vita.stato('inesistente') })""")
    check("vita: contratto PD.vita", c["reg"] == c["el"] == c["st"] == "function" and c["nullo"] is None, c)
    check("vita: i tre simulatori registrati", all(i in c["ids"] for i in ("identita", "visita", "pagamento")), c["ids"])
    check("vita: elenco ordinato", c["ord"] == sorted(c["ord"]), c["ord"])

    # indice
    page.goto(ROOT + "#/vita")
    page.wait_for_selector("#view-vita .vita-tile")
    n = page.locator("#view-vita .vita-tile").count()
    check("vita: indice con almeno 3 riquadri", n >= 3, n)
    page.screenshot(path=SHOTS + "/vita-01-indice.png", full_page=True)

    # avvio di «identita» dal riquadro
    page.click("#view-vita .vita-tile[data-sim='identita']")
    page.wait_for_selector("#view-vita .vita-prova")
    check("vita: fascia PROVA visibile", "PROVA" in page.inner_text("#view-vita .vita-prova"))
    check("vita: fumetto con il primo passo", "certificato di residenza" in page.inner_text("#view-vita .vita-testo"))
    box = "#view-vita .vita-pagina"
    tel = "#view-vita .vita-tel"

    # 1. risultati di ricerca: prima la trappola (annuncio falso), poi il sito vero
    page.click(box + " >> text=senza identità digitale")
    check("vita: annuncio falso segnalato", "borgoprova-servizi.top" in page.inner_text("#view-vita .vita-esito"))
    check("vita: errore contato", "1" in page.inner_text("#view-vita .vita-conta"))
    page.screenshot(path=SHOTS + "/vita-02-trappola-ricerca.png")
    page.click(box + " >> text=Comune di Borgoprova — Servizi online")
    check("vita: indirizzo del Comune", "comune.borgoprova.it" in page.inner_text("#view-vita .vita-url"))
    # 2-4. menu, servizio, accesso
    page.click(box + " >> text=Servizi online")
    page.click(box + " >> text=Certificati anagrafici")
    page.click(box + " >> text=Entra con identità digitale")
    # 5. gestore (il foglietto compare accanto)
    check("vita: foglietto visibile", page.is_visible("#view-vita .vita-foglio .vf-postit"))
    page.click(box + " >> text=Identità Prova")
    # 6. dati: un errore, poi un secondo, poi «Compila per me» e la password scritta con maiuscole e spazi
    page.fill("#vs-utente", "mario rossi")
    page.click(box + " >> text=Entra")
    page.click(box + " >> text=Entra")
    check("vita: «Compila per me» dopo 2 errori", page.is_visible(box + " .vita-compila"))
    page.screenshot(path=SHOTS + "/vita-03-login.png")
    page.click(box + " .vita-compila")
    check("vita: campo compilato", page.input_value("#vs-utente") == "mario.provetti")
    page.fill("#vs-pwd", " GIRASOLE48 ")
    page.click(box + " >> text=Entra")
    # 7. trappola: SMS che chiede il codice per telefono → rifiutato
    _attendi_telefono(page, box, tel)
    check("vita: SMS trappola sul telefono", "operatore" in page.inner_text(tel))
    page.screenshot(path=SHOTS + "/vita-04-sms-trappola.png")
    page.click(tel + " >> text=Non rispondo e lo elimino")
    # 8. notifica vera: codice uguale, autorizza
    check("vita: notifica con numero di controllo", "47" in page.inner_text(tel) and "Autorizzi" in page.inner_text(tel))
    page.click(tel + " >> text=Autorizza")
    # 9-10. area personale, scarica, salva, esci
    page.click(box + " li:has-text('residenza') >> text=Scarica")
    check("vita: certificato finto mostrato", "CERTIFICATO DI RESIDENZA" in page.inner_text(box))
    page.click(box + " >> text=Salva sul computer")
    page.click(box + " .vs-esci")
    page.wait_for_selector("#view-vita .vita-fine-card")
    page.screenshot(path=SHOTS + "/vita-05-fine.png", full_page=True)
    st = page.evaluate("() => PD.vita.stato('identita')")
    check("vita: identita completata e salvata", bool(st and st["fatto"] and st["volte"] >= 1 and st["errori"] >= 3), st)
    check("vita: schermata finale con consigli", page.locator("#view-vita .vita-consigli li").count() >= 3)

    # «Rifai» riparte da capo; «Torna» porta all'indice con ✅
    page.click("#view-vita .vita-rifai")
    page.wait_for_selector(box + " .vs-cerca-testa")
    check("vita: Rifai riparte", page.is_hidden("#view-vita .vita-fine"))
    page.click("#view-vita .vita-esci")
    page.wait_for_selector("#view-vita .vita-tile")
    check("vita: ✅ sul riquadro fatto", page.locator("#view-vita .vita-tile[data-sim='identita'] .vita-fatto").count() == 1)

    # gli altri due simulatori partono senza errori
    for sid, testo in (("visita", "Prenota una visita"), ("pagamento", "Posta Prova")):
        page.goto(ROOT + "#/vita/" + sid)
        page.wait_for_selector(box + " .vs-sito")
        check("vita: avvio di " + sid, testo in page.inner_text(box))

    # telefono (390 px) e tema scuro
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(ROOT + "#/vita")
    page.wait_for_selector("#view-vita .vita-tile")
    sw = page.evaluate("() => document.documentElement.scrollWidth")
    check("vita: indice a 390 px senza scorrimento orizzontale", sw <= 392, sw)
    page.screenshot(path=SHOTS + "/vita-06-indice-390.png", full_page=True)
    page.goto(ROOT + "#/vita/identita")
    page.wait_for_selector(box + " .vs-cerca-testa")
    page.click(box + " >> text=Comune di Borgoprova — Servizi online")
    page.click(box + " >> text=Servizi online")
    page.click(box + " >> text=Certificati anagrafici")
    page.click(box + " >> text=Entra con identità digitale")
    sw = page.evaluate("() => document.documentElement.scrollWidth")
    check("vita: simulazione a 390 px senza scorrimento orizzontale", sw <= 392, sw)
    page.screenshot(path=SHOTS + "/vita-07-sim-390.png", full_page=True)
    page.evaluate("() => { PD.settings.theme = 'dark'; PD.applySettings(); }")
    page.set_viewport_size({"width": 1280, "height": 860})
    page.click(box + " >> text=Identità Prova")
    page.fill("#vs-utente", "mario.provetti")
    page.fill("#vs-pwd", "Girasole48")
    page.click(box + " >> text=Entra")
    _attendi_telefono(page, box, tel)
    page.screenshot(path=SHOTS + "/vita-08-scuro.png")
    page.goto(ROOT + "#/vita")
