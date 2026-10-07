"""Test della pagina «È una truffa?» (src/web/js/truffa.js). Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS)."""
import json

# frasi di prova con il livello atteso dal motore a regole
CASI = [
    # truffe tipiche -> alto
    ("Ultimo avviso: la sua utenza Enel verrà sospesa entro 24 ore per mancato pagamento. Paghi subito qui: https://enel-pagamenti.xyz", "alto"),
    ("INPS: le spetta un rimborso di 350 euro. Verifica i tuoi dati al link inps-rimborsi.com", "alto"),
    ("Buongiorno, sono dell'assistenza tecnica, il suo computer ha un virus. Installi TeamViewer così la aiutiamo.", "alto"),
    ("Amore mio, ho bisogno di 2000 euro per pagare la dogana, poi finalmente vengo da te", "alto"),
    ("Gentile cliente, la sua carta è stata sospesa. Ci comunichi il codice che le è arrivato per SMS.", "alto"),
    ("Papà ho il telefono rotto, questo è il mio nuovo numero. Scrivimi qui", "alto"),
    ("Hai vinto un buono da 500€! Clicca qui per riscuoterlo: bit.ly/xx12", "alto"),
    ("Richiami urgentemente il numero 899 123456 per comunicazioni importanti", "alto"),
    ("Sei stato estratto per uno smartphone! Paga solo le spese di spedizione 2,50 €", "alto"),
    ("Mi ha chiamato un avvocato: mio figlio ha avuto un incidente, serve una cauzione. Manda un incaricato a ritirare i contanti.", "alto"),
    ("POSTE: il tuo conto è stato limitato per attività sospetta. Accedi qui per sbloccarlo http://192.168.4.20/login", "alto"),
    ("Guadagni garantiti con il trading online: investi solo 250 euro e raddoppia i tuoi soldi!", "alto"),
    # sospetti -> medio
    ("Mi hanno chiamato da un numero sconosciuto dicendo che ho una multa da pagare", "medio"),
    # messaggi normali -> basso
    ("Ci vediamo domani alle 5 dalla nonna", "basso"),
    ("Il tuo codice di verifica è 482913. Non condividerlo con nessuno.", "basso"),
    ("Ho fatto il bonifico per l'affitto, controlla quando puoi", "basso"),
    ("Il medico ha spostato la visita a giovedì alle 10. Ciao papà!", "basso"),
    ("Il pacco di Amazon arriva domani tra le 9 e le 13.", "basso"),
    ("Tua figlia ha vinto la gara di nuoto!! Che brava", "basso"),
    ("La riunione di condominio è confermata per martedì. Info su www.condominiofiori.it", "basso"),
    ("Ciao mamma, stasera passo a prendere i bambini verso le 7. Ci vediamo dopo, un bacio!", "basso"),
]


def prova(page, ROOT, check, SHOTS):
    page.goto(ROOT + "#/home")
    page.wait_for_selector("#view-home .hero")
    salvato = page.evaluate("JSON.stringify(PD.progress.truffa === undefined ? null : PD.progress.truffa)")
    tema = page.evaluate("PD.settings.theme")
    errori = []
    gestore = lambda e: errori.append(str(e))
    page.on("pageerror", gestore)
    try:
        _prova(page, ROOT, check, SHOTS, errori)
    finally:
        page.remove_listener("pageerror", gestore)
        page.evaluate("""([v, t]) => { if (v === null) delete PD.progress.truffa; else PD.progress.truffa = JSON.parse(v);
            PD.saveProgress(); PD.settings.theme = t; PD.saveSettings(); }""", [salvato, tema])
        page.set_viewport_size({"width": 1366, "height": 800})


def _prova(page, ROOT, check, SHOTS, errori):
    # --- motore a regole ---
    sbagliati = page.evaluate("""casi => casi.map(c => [c[0], c[1], PD.truffa.analizza(c[0]).livello])
        .filter(x => x[1] !== x[2]).map(x => x[2] + ' invece di ' + x[1] + ': ' + x[0])""", [list(c) for c in CASI])
    check("truffa: motore a regole su %d frasi" % len(CASI), not sbagliati, sbagliati)
    r = page.evaluate("PD.truffa.analizza('Il suo pacco è in giacenza: paghi 1,99 € qui https://bit.ly/abc', 'sms')")
    forma = r["livello"] in ("alto", "medio", "basso") and isinstance(r["punti"], (int, float)) and \
        all(set(["id", "titolo", "spiegazione", "trovato"]) <= set(s) for s in r["segnali"])
    ids = [s["id"] for s in r["segnali"]]
    check("truffa: forma di PD.truffa.analizza", forma and "pacco" in ids and "linksospetto" in ids, r)
    esempi = page.evaluate("PD.truffa.esempi.map(e => [e.t, PD.truffa.analizza(e.x, e.tipo).livello])")
    check("truffa: %d esempi pronti, con truffe e messaggi normali" % len(esempi),
          len(esempi) >= 8 and sum(1 for e in esempi if e[1] == "alto") >= 6 and sum(1 for e in esempi if e[1] == "basso") >= 2, esempi)

    # --- riquadro nella pagina Inizio ---
    check("truffa: riquadro nell'Inizio", page.locator('#view-home .tile[data-go="#/truffa"]').count() == 1)

    # --- pagina ---
    page.evaluate("PD.progress.truffa = { controlli: [] }; PD.saveProgress()")
    page.goto(ROOT + "#/truffa")
    page.wait_for_selector("#tr-testo")
    check("truffa: pagina con esempi e regole d'oro", page.locator(".tr-es").count() >= 8 and page.locator(".tr-regole li").count() == 10)
    stt = page.evaluate("PD.sttReady()")
    check("truffa: microfono solo se disponibile", (page.locator("#tr-mic").count() == 1) == bool(stt))

    # testo vuoto: nessun esito
    page.click("#tr-controlla")
    check("truffa: testo vuoto non controllato", page.is_hidden("#tr-esito"))

    # esempio «finto carabiniere»
    page.click('.tr-es:has-text("Finto carabiniere")')
    page.wait_for_selector("#tr-esito:not([hidden]) .tr-verdetto")
    v = page.inner_text("#tr-esito .tr-verdetto")
    check("truffa: esempio -> giudizio rosso", "Molto probabilmente è una truffa" in v and "100%" in v, v)
    check("truffa: tipo scelto dall'esempio", page.evaluate("document.querySelector('input[name=tr-tipo]:checked').value") == "telefonata")
    n = page.locator("#tr-esito .tr-segnali li").count()
    passi = page.inner_text("#tr-esito .tr-passi")
    check("truffa: segnali (%d) e cosa fare" % n, n >= 3 and "Riattaccate" in passi and "112" in passi and "retro della carta" in passi, passi[:200])
    gia = page.inner_text("#tr-esito .tr-gia")
    check("truffa: se avete già dato dati o soldi", "commissariatodips.it" in gia and "banca" in gia, gia)
    page.click("#tr-esito .tr-testo summary")
    check("truffa: parti evidenziate", page.locator("#tr-esito .tr-testo mark").count() >= 3)
    page.screenshot(path=SHOTS + "/truffa-1280.png", full_page=True)

    # storico: solo anteprima breve
    c = page.evaluate("PD.progress.truffa.controlli")
    check("truffa: storico salvato senza il testo intero",
          len(c) == 1 and c[0]["livello"] == "alto" and c[0]["tipo"] == "telefonata" and len(c[0]["anteprima"]) <= 80 and c[0]["quando"], c)

    # messaggio scritto a mano, normale
    page.click("#tr-pulisci")
    page.fill("#tr-testo", "Ci vediamo domani alle 5 dalla nonna. Porto le paste!")
    page.click('label.tr-tipo:has-text("SMS")')
    page.click("#tr-controlla")
    page.wait_for_selector("#tr-esito.tr-bordo-basso")
    v = page.inner_text("#tr-esito .tr-verdetto")
    check("truffa: messaggio normale -> verde prudente", "Non vedo segnali tipici" in v and "nel dubbio verificate" in v, v)
    check("truffa: storico con 2 controlli", page.locator(".tr-storico li").count() == 2)

    # numeri lunghi nascosti nell'anteprima
    page.fill("#tr-testo", "Ci comunichi il PIN 123456 e il codice 98765432 entro oggi: la carta è bloccata")
    page.click("#tr-controlla")
    ant = page.evaluate("PD.progress.truffa.controlli[0].anteprima")
    check("truffa: cifre lunghe nascoste nello storico", "123456" not in ant and "98765432" not in ant and "•" in ant, ant)

    # stampa (senza aprire la finestra di stampa)
    page.evaluate("() => { window.__stampa = null; window.print = function () { window.__stampa = document.getElementById('print-area').innerHTML; }; }")
    page.click("#tr-stampa")
    page.wait_for_function("window.__stampa !== null")
    st = page.evaluate("window.__stampa")
    check("truffa: stampa del controllo", "Controllo di un messaggio sospetto" in st and "<mark>" in st and "Cosa fare adesso" in st, st[:200])
    page.evaluate("document.body.classList.remove('printing')")

    # leggi
    page.evaluate("() => { window.__letto = ''; PD.__speak = PD.speak; PD.speak = function (t) { window.__letto = t; return Promise.resolve(); }; }")
    page.click("#tr-leggi")
    letto = page.evaluate("window.__letto")
    page.evaluate("() => { PD.speak = PD.__speak; }")
    check("truffa: lettura a voce del giudizio", "truffa" in letto.lower() and "Cosa fare adesso" in letto, letto[:120])

    # IA locale (solo con server e modello)
    if page.evaluate("!!(PD.server && PD.aiReady())"):
        check("truffa: pulsante Chiedi anche all'IA", page.locator("#tr-ia").count() == 1)
        page.click("#tr-ia")
        page.wait_for_function("document.querySelector('#tr-ia-box .tr-ia-testo') && !/Sto pensando/.test(document.querySelector('#tr-ia-box .tr-ia-testo').textContent) && document.getElementById('tr-ia-stop').hidden", timeout=15000)
        txt = page.inner_text("#tr-ia-box")
        check("truffa: risposta dell'IA sotto quella delle regole", len(txt) > 40 and "IA" in txt and page.locator("#tr-esito .tr-verdetto").count() == 1, txt[:150])
    else:
        check("truffa: niente pulsante IA senza IA locale", page.locator("#tr-ia").count() == 0)

    # cancellazione dello storico
    page.once("dialog", lambda d: d.accept())
    page.click("#tr-cancella-storico")
    check("truffa: storico cancellato", page.evaluate("PD.progress.truffa.controlli.length") == 0 and page.locator(".tr-storico li").count() == 0)

    # telefono 390 px + tema scuro
    page.click('.tr-es:has-text("Pacco")')
    page.wait_for_selector("#tr-esito:not([hidden])")
    page.set_viewport_size({"width": 390, "height": 844})
    page.evaluate("PD.settings.theme = 'dark'; PD.applySettings(); window.scrollTo(0, 0)")
    page.wait_for_timeout(200)
    largo = page.evaluate("document.documentElement.scrollWidth")
    check("truffa: nessuno scorrimento orizzontale a 390 px", largo <= 392, largo)
    page.screenshot(path=SHOTS + "/truffa-390-scuro.png", full_page=True)
    page.evaluate("document.querySelector('.tr-regole').open = true")
    page.locator(".tr-regole").screenshot(path=SHOTS + "/truffa-regole-390-scuro.png")
    check("truffa: nessun errore JavaScript", not errori, errori)
