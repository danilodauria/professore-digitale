"""Test della «Ginnastica per la mente» (src/web/js/mente.js).
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS).
Gioca per intero «coppie» (facile) e «resto» (medio) cliccando, controlla diario, serie dei giorni (con date forzate),
gioco del giorno, stampa, e avvia i 7 giochi a ogni livello (anche su telefono e tema scuro).
Rimette a posto progressi e impostazioni che cambia. Autore: Danilo D'Auria - Licenza MIT"""

GIOCHI = ["coppie", "sequenza", "spesa", "differenze", "intruso", "resto", "orologio"]
V = "#view-mente"


def prova(page, ROOT, check, SHOTS):
    errori = []
    gestore = lambda e: errori.append(str(e))
    page.on("pageerror", gestore)
    salvato = page.evaluate("""() => ({ mente: JSON.stringify((PD.progress || {}).mente || null), voce: PD.settings.voice, tema: PD.settings.theme })""")
    page.evaluate("() => { PD.settings.voice = false; PD.stopSpeech(); }")
    try:
        _prova(page, ROOT, check, SHOTS)
    finally:
        page.evaluate("""(s) => {
            delete PD.mente.dataProva;
            var v = JSON.parse(s.mente);
            if (v) PD.progress.mente = v; else delete PD.progress.mente;
            PD.saveProgress();
            PD.settings.voice = s.voce; PD.settings.theme = s.tema; PD.saveSettings(); PD.applySettings();
            document.body.classList.remove('printing');
        }""", salvato)
        page.set_viewport_size({"width": 1366, "height": 800})
        page.evaluate("() => PD.go('#/home')")
        page.remove_listener("pageerror", gestore)
    check("mente: nessun errore JavaScript", not errori, "; ".join(errori[:3]))


def vai(page, h, sel):
    page.evaluate("(h) => PD.go(h)", h)
    page.wait_for_selector(sel, timeout=8000)


def _prova(page, ROOT, check, SHOTS):
    # partenza pulita, con una data finta (mercoledì 8 ottobre 2026)
    page.evaluate("() => { delete PD.progress.mente; PD.mente.dataProva = '2026-10-08'; }")

    # riquadro nella pagina Inizio
    vai(page, "#/home", "#view-home .hero")
    t = page.locator("#view-home [data-go='#/mente']")
    check("mente: riquadro nella pagina Inizio", t.count() >= 1)
    check("mente: il riquadro indica il gioco di oggi", t.count() and "Il gioco di oggi" in t.first.inner_text(), t.first.inner_text() if t.count() else "")

    # contratto
    c = page.evaluate("""() => ({
        f: [typeof PD.mente.registra, typeof PD.mente.elenco, typeof PD.mente.stato],
        ids: PD.mente.elenco().map(function (g) { return g.id; }),
        ord: PD.mente.elenco().map(function (g) { return g.ordine || 99; }),
        nullo: PD.mente.stato('inesistente'),
        cat: PD.mente.elenco().every(function (g) { return ['memoria','attenzione','parole','calcolo','logica'].indexOf(g.categoria) >= 0; }) })""")
    check("mente: contratto PD.mente", c["f"] == ["function"] * 3 and c["nullo"] is None, c)
    check("mente: i 7 giochi registrati", all(i in c["ids"] for i in GIOCHI), c["ids"])
    check("mente: elenco ordinato e categorie valide", c["ord"] == sorted(c["ord"]) and c["cat"], c)

    # gioco del giorno: stabile nella giornata, cambia il giorno dopo
    gg = page.evaluate("""() => { var r = [];
        ['2026-10-08', '2026-10-08', '2026-10-09', '2026-10-10'].forEach(function (d) { PD.mente.dataProva = d; r.push(PD.mente.delGiorno().id); });
        PD.mente.dataProva = '2026-10-08'; return r; }""")
    check("mente: gioco del giorno stabile e diverso il giorno dopo", gg[0] == gg[1] and gg[1] != gg[2] and gg[2] != gg[3], gg)

    # indice
    vai(page, "#/mente", V + " .mente-giorno")
    tit = page.inner_text(V + " .mente-giorno h2")
    atteso = page.evaluate("() => PD.mente.delGiorno().titolo")
    check("mente: indice con il gioco del giorno", tit == atteso, (tit, atteso))
    check("mente: riquadri dei giochi", page.locator(V + " .mente-tile").count() >= 7)
    check("mente: categorie", page.locator(V + " .mente-cat").count() >= 4)
    check("mente: diario presente (vuoto)", page.inner_text(V + " .mente-serie") == "0")
    page.screenshot(path=SHOTS + "/mente-01-indice.png", full_page=True)

    # coppie, livello facile, giocata per intero
    vai(page, "#/mente/coppie", V + " .mente-livello")
    check("mente: scelta del livello (3 livelli)", page.locator(V + " .mente-livello").count() == 3)
    check("mente: livello consigliato all'inizio = facile", page.get_attribute(V + " .mente-livello.consigliato", "data-l") == "1")
    page.click(V + " .mente-livello[data-l='1']")
    page.wait_for_selector(V + " .mj-carta")
    carte = page.eval_on_selector_all(V + " .mj-carta", "bs => bs.map(function (b) { return b.getAttribute('data-coppia'); })")
    check("mente: coppie facile = 6 carte", len(carte) == 6, len(carte))
    check("mente: consegna mostrata", len(page.inner_text(V + " .mente-istr")) > 20)
    # un tentativo sbagliato: le carte si ricoprono
    a = 0
    b = next(i for i in range(len(carte)) if carte[i] != carte[0])
    page.click(V + " .mj-carta[data-i='%d']" % a)
    page.click(V + " .mj-carta[data-i='%d']" % b)
    check("mente: due carte girate", page.locator(V + " .mj-carta.su").count() == 2)
    page.screenshot(path=SHOTS + "/mente-02-coppie.png")
    page.wait_for_timeout(1900)
    check("mente: carte diverse si ricoprono", page.locator(V + " .mj-carta.su").count() == 0)
    # aiutino
    page.click(V + " .mente-aiuto")
    check("mente: aiutino mostra un messaggio", "secondi" in page.inner_text(V + " .mente-esito"))
    page.wait_for_timeout(2200)
    for v in sorted(set(carte)):
        idx = [i for i, x in enumerate(carte) if x == v]
        for i in idx:
            page.click(V + " .mj-carta[data-i='%d']" % i)
    page.wait_for_selector(V + " .mente-fine-card", timeout=5000)
    fine = page.inner_text(V + " .mente-fine-card")
    check("mente: schermata finale con punti", "Punti: 3 su 3" in fine, fine[:200])
    check("mente: tre stelle", page.get_attribute(V + " .mente-fine-card .mente-stelle", "aria-label") == "3 stelle su 3")
    check("mente: pulsanti Rigioca e Altro gioco", page.locator(V + " .mente-rigioca").count() == 1 and "Altro gioco" in fine)
    page.screenshot(path=SHOTS + "/mente-03-coppie-fine.png")
    st = page.evaluate("() => ({ g: PD.progress.mente.giochi.coppie, d: PD.progress.mente.giorni['2026-10-08'], s: PD.progress.mente.storia.slice(-1)[0], cons: PD.mente.livelloConsigliato('coppie') })")
    check("mente: progressi salvati in PD.progress.mente", st["g"]["volte"] == 1 and st["g"]["migliore"] == 3 and st["g"]["ultimo"] == "2026-10-08" and st["g"]["livello"] == 1, st)
    check("mente: giorno registrato nel diario", st["d"] and st["d"]["partite"] == 1 and st["d"]["minuti"] >= 1, st["d"])
    check("mente: misura per i miglioramenti", st["s"].get("x") == 3 and st["s"].get("u") == "coppie", st["s"])
    check("mente: dopo tre stelle si consiglia il livello medio", st["cons"] == 2, st["cons"])

    # il resto giusto, livello medio, tutte le risposte giuste
    vai(page, "#/mente/resto/2", V + " .mj-vassoio")
    for turno in range(5):
        page.wait_for_selector(V + " .mj-vassoio[data-giusto]")
        giusto = int(page.get_attribute(V + " .mj-vassoio", "data-giusto"))
        tagli = sorted([int(x) for x in page.eval_on_selector_all(V + " .mj-cassetto .mj-soldo", "bs => bs.map(function (b) { return b.getAttribute('data-c'); })")], reverse=True)
        resto = giusto
        for tg in tagli:
            while resto >= tg:
                page.click(V + " .mj-cassetto .mj-soldo[data-c='%d']" % tg)
                resto -= tg
        if turno == 0:
            check("mente: resto composto (somma mostrata con la virgola)", "," in page.inner_text(V + " .mj-somma") and resto == 0, page.inner_text(V + " .mj-somma"))
            page.screenshot(path=SHOTS + "/mente-04-resto.png")
        page.click(V + " .mj-ecco")
        check("mente: resto %d giusto" % (turno + 1), "Giusto" in page.inner_text(V + " .mente-esito"), page.inner_text(V + " .mente-esito"))
        page.click(V + " .mj-avanti")
    page.wait_for_selector(V + " .mente-fine-card", timeout=5000)
    check("mente: resto 5 su 5", "Punti: 5 su 5" in page.inner_text(V + " .mente-fine-card"))
    check("mente: resto salvato", page.evaluate("() => PD.mente.stato('resto').volte === 1 && PD.mente.stato('resto').livello === 2"))

    # diario: serie di giorni con date forzate e miglioramenti
    page.evaluate("""() => { var m = PD.progress.mente;
        m.giorni['2026-10-06'] = { minuti: 7, partite: 2 }; m.giorni['2026-10-07'] = { minuti: 5, partite: 1 };
        m.giorni['2026-10-03'] = { minuti: 4, partite: 1 };
        m.giorni['2026-09-24'] = { minuti: 5, partite: 1 };
        m.storia.unshift({ g: 'coppie', d: '2026-09-24', l: 1, p: 3, m: 3, s: 3, x: 3, u: 'coppie' });
        m.storia.push({ g: 'coppie', d: '2026-10-08', l: 2, p: 6, m: 6, s: 3, x: 6, u: 'coppie' }); }""")
    di = page.evaluate("() => PD.mente.diario()")
    check("mente: serie di 3 giorni di fila", di["serie"] == 3, di["serie"])
    check("mente: minuti della settimana", di["minutiSettimana"] >= 12 + 2, di["minutiSettimana"])
    check("mente: miglioramento calcolato", any("Memoria: da 3 a 6 coppie in 2 settimane" == x["testo"] for x in di["miglioramenti"]), di["miglioramenti"])
    check("mente: giochi preferiti", len(di["preferiti"]) >= 2, di["preferiti"])
    serie = page.evaluate("""() => { var r = [];
        ['2026-10-09', '2026-10-10'].forEach(function (d) { PD.mente.dataProva = d; r.push(PD.mente.diario().serie); });
        PD.mente.dataProva = '2026-10-08'; return r; }""")
    check("mente: la serie vale ancora il giorno dopo e si azzera dopo due", serie == [3, 0], serie)
    vai(page, "#/mente", V + " .mente-diario")
    check("mente: diario mostra la serie", page.inner_text(V + " .mente-serie") == "3")
    check("mente: calendario con i pallini", page.locator(V + " .mente-cal td.fatto .pallino").count() == 4, page.locator(V + " .mente-cal td.fatto").count())
    check("mente: miglioramenti nel diario", "da 3 a 6 coppie" in page.inner_text(V + " .mente-migl"))
    check("mente: gioco del giorno con stelle nel riquadro", page.locator(V + " .mente-tile[data-gioco='coppie'] .mente-stelle").count() == 1)
    page.click(V + " .mente-mese[data-d='-1']")
    check("mente: calendario del mese prima", "Settembre" in page.inner_text(V + " .mente-cal caption") and page.locator(V + " .mente-cal td.fatto").count() == 1)
    page.click(V + " .mente-mese[data-d='1']")
    page.locator(V + " .mente-diario").scroll_into_view_if_needed()
    page.screenshot(path=SHOTS + "/mente-05-diario.png", full_page=True)
    # stampa (senza aprire la finestra di stampa)
    page.evaluate("() => { window._print = window.print; window.print = function () { window._stampato = true; }; }")
    page.click(V + " .mente-stampa")
    page.wait_for_timeout(500)
    pa = page.evaluate("() => ({ s: !!window._stampato, t: (document.getElementById('print-area') || {}).innerText || '' })")
    check("mente: stampa del diario", pa["s"] and "diario" in pa["t"] and "Giorni di fila" in pa["t"], pa["t"][:120])
    page.evaluate("() => { window.print = window._print; document.body.classList.remove('printing'); var a = document.getElementById('print-area'); if (a) a.innerHTML = ''; }")

    # tutti i giochi si avviano a ogni livello, con l'aiutino
    falliti = []
    for g in GIOCHI:
        for l in (1, 2, 3):
            vai(page, "#/mente/%s/%d" % (g, l), V + " .mente-istr > *")
            page.wait_for_timeout(120)
            testo = page.inner_text(V + " .mente-box")
            if "errore interno" in testo or not page.inner_text(V + " .mente-istr").strip():
                falliti.append("%s/%d" % (g, l))
                continue
            page.click(V + " .mente-aiuto")
            if not page.inner_text(V + " .mente-esito").strip():
                falliti.append("%s/%d (aiutino)" % (g, l))
            if l == 3:
                page.screenshot(path=SHOTS + "/mente-10-%s-difficile.png" % g)
    check("mente: i 7 giochi partono a ogni livello", not falliti, falliti)

    # sequenza: un giro giusto da tastiera
    vai(page, "#/mente/sequenza/1", V + " .mj-via")
    page.click(V + " .mj-via")
    page.wait_for_function("() => /Ora tocca/.test(document.querySelector('#view-mente .mj-stato').textContent)", timeout=8000)
    check("mente: sequenza mostrata", True)
    # intruso: risposta giusta e spiegazione
    vai(page, "#/mente/intruso/2", V + " .mj-voce")
    page.click(V + " .mj-voce[data-intruso]")
    check("mente: intruso con spiegazione", "gli altri" in page.inner_text(V + " .mj-spiega"))
    # orologio: risposta giusta
    vai(page, "#/mente/orologio/2", V + " .mj-opz")
    page.click(V + " .mj-opz[data-giusta]")
    check("mente: orologio con spiegazione", ":" in page.inner_text(V + " .explain"))
    # tempo visibile solo a richiesta
    check("mente: tempo nascosto di serie", page.locator(V + " .mente-tempo").is_hidden())
    page.click(V + " .mente-tempo-btn")
    check("mente: tempo mostrato a richiesta", page.locator(V + " .mente-tempo").is_visible())
    page.click(V + " .mente-tempo-btn")
    # esci
    page.click(V + " .mente-esci")
    page.wait_for_selector(V + " .mente-giorno")
    check("mente: Esci torna all'elenco", page.evaluate("() => location.hash") == "#/mente")

    # telefono (390 px) e tema scuro
    page.set_viewport_size({"width": 390, "height": 800})
    larghi = []
    for h, sel in (("#/mente", ".mente-diario"), ("#/mente/coppie", ".mente-livello"), ("#/mente/coppie/3", ".mj-carta"), ("#/mente/sequenza/1", ".mj-seq-t"),
                   ("#/mente/spesa/3", ".mj-foglio"), ("#/mente/differenze/3", ".mj-cella"), ("#/mente/intruso/3", ".mj-voce"),
                   ("#/mente/resto/3", ".mj-soldo"), ("#/mente/orologio/3", ".mj-opz")):
        vai(page, h, V + " " + sel)
        page.wait_for_timeout(100)
        if page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"):
            larghi.append(h)
        if h in ("#/mente", "#/mente/resto/3", "#/mente/differenze/3"):
            page.screenshot(path=SHOTS + "/mente-20-telefono-%s.png" % h.replace("#/mente", "indice").replace("/", "-"), full_page=True)
    check("mente: nessuno scorrimento orizzontale su telefono", not larghi, larghi)
    page.set_viewport_size({"width": 1280, "height": 800})
    page.evaluate("() => { PD.settings.theme = 'dark'; PD.applySettings(); }")
    vai(page, "#/mente", V + " .mente-diario")
    page.screenshot(path=SHOTS + "/mente-30-scuro-indice.png", full_page=True)
    vai(page, "#/mente/orologio/1", V + " .mj-orologio")
    page.screenshot(path=SHOTS + "/mente-31-scuro-orologio.png")
    vai(page, "#/mente/resto/1", V + " .mj-soldo")
    page.screenshot(path=SHOTS + "/mente-32-scuro-resto.png")
