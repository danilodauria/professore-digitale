"""Prove dell'interfaccia: competenze DigComp 2.2, «Le mie competenze», pagina per enti e «Incontri pronti».
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS). Rimette a posto ciò che cambia."""


def prova(page, ROOT, check, SHOTS):
    errori = []
    def su_errore(e):
        errori.append(str(e))
    page.on("pageerror", su_errore)
    page.add_init_script("try { sessionStorage.setItem('pd.salutato', '1') } catch (e) {}")
    try:
        _prova(page, ROOT, check, SHOTS)
    finally:
        try:
            page.evaluate("() => { if (window.PD && PD.incontri) PD.incontri.termina(); }")
            page.set_viewport_size({"width": 1366, "height": 800})
        except Exception:
            pass
        page.remove_listener("pageerror", su_errore)
    check("enti: nessun errore JavaScript", not errori, errori[:3])


def _prova(page, ROOT, check, SHOTS):
    # aspetta la fine del caricamento (pacchetti compresi): #app-version si riempie solo alla fine
    page.wait_for_function("() => { const v = document.getElementById('app-version'); return v && v.textContent.trim().length > 0; }")
    page.evaluate("() => PD.go('#/home')")
    page.wait_for_selector("#view-home .hero")
    page.evaluate("() => { window.__printOrig = window.print; window.print = function () { window.__stampato = (window.__stampato || 0) + 1; }; }")

    # --- il quadro DigComp 2.2 ---
    q = page.evaluate("""() => ({ aree: PD_DIGCOMP.aree.length, comp: PD.digcomp.codici.length,
        codici: PD.digcomp.codici.join(','), area45: PD.digcomp.areaDi('4.2').n })""")
    check("digcomp: 5 aree e 21 competenze", q["aree"] == 5 and q["comp"] == 21, q)
    check("digcomp: areaDi", q["area45"] == 4, q)

    # ogni lezione del corso (esclusi i pacchetti importati dall'utente) ha almeno una competenza
    senza = page.evaluate("""() => {
        const utente = (PD.packs && PD.packs.list || []).filter(x => x.origine === 'utente').map(x => x.pacchetto.id);
        return PD.lessonsOf('corso').filter(L => utente.indexOf(L.pack) < 0 && !PD.digcomp.competenzeLezione(L.id).length).map(L => L.id); }""")
    check("digcomp: tutte le lezioni del corso hanno una competenza", not senza, senza)
    nonvalide = page.evaluate("""() => { const ok = PD.digcomp.codici; const bad = [];
        const m = Object.assign({}, PD_DIGCOMP.lezioni, PD_DIGCOMP.vita, PD_DIGCOMP.palestra);
        Object.keys(m).forEach(k => m[k].forEach(c => { if (ok.indexOf(c) < 0) bad.push(k + ':' + c); })); return bad; }""")
    check("digcomp: la mappa usa solo codici esistenti", not nonvalide, nonvalide)

    # --- incontri pronti: minuti e destinazioni ---
    inc = page.evaluate("""() => PD_INCONTRI.map(I => ({ id: I.id, somma: I.scaletta.reduce((s, p) => s + p.min, 0),
        bad: I.scaletta.filter(p => p.vai && !PD.incontri.vaiInfo(p.vai).ok).map(p => p.vai),
        comp: I.digcomp.filter(c => PD.digcomp.codici.indexOf(c) < 0) }))""")
    check("incontri: tra 10 e 12", 10 <= len(inc) <= 12, len(inc))
    check("incontri: ogni scaletta dura 120 minuti", all(i["somma"] == 120 for i in inc), [(i["id"], i["somma"]) for i in inc if i["somma"] != 120])
    check("incontri: ogni «Apri» porta a qualcosa che esiste", all(not i["bad"] for i in inc), [(i["id"], i["bad"]) for i in inc if i["bad"]])
    check("incontri: competenze valide", all(not i["comp"] for i in inc), [i for i in inc if i["comp"]])
    # ogni destinazione si apre davvero (le viste di moduli non ancora presenti vengono solo segnalate)
    vai = page.evaluate("() => Array.from(new Set([].concat.apply([], PD_INCONTRI.map(I => I.scaletta.map(p => p.vai).filter(Boolean)))))")
    mancano, assenti = [], []
    for v in vai:
        nome = v[2:].split("/")[0]
        if not page.evaluate("n => !!PD.views[n]", nome):
            assenti.append(v)
            continue
        page.evaluate("h => PD.go(h)", v)
        page.wait_for_timeout(120)
        vis = page.evaluate("n => { const s = document.getElementById('view-' + n); return !!s && !s.hidden && s.innerHTML.trim().length > 50; }", nome)
        if not vis:
            mancano.append(v)
    check("incontri: le destinazioni si aprono", not mancano, mancano)
    if assenti:
        print("  NOTA enti: viste non ancora presenti in questa copia (modulo in arrivo): " + ", ".join(assenti))
    page.evaluate("() => PD.go('#/home')")

    # --- le mie competenze: completare la lezione «password» fa raggiungere 4.x ---
    orig = page.evaluate("() => JSON.stringify(PD.progress.lessons.password || null)")
    try:
        page.evaluate("() => { PD.progress.lessons.password = { seen: [0,1,2,3], done: true, quiz: { score: 2, total: 3 }, when: new Date().toISOString() }; }")
        page.evaluate("() => PD.go('#/competenze')")
        page.wait_for_selector("#view-competenze .dc-area")
        badge41 = page.inner_text('#view-competenze .dc-comp[data-c="4.1"] .badge')
        badge42 = page.inner_text('#view-competenze .dc-comp[data-c="4.2"] .badge')
        check("competenze: 4.1 e 4.2 raggiunte dopo la lezione password", ("Raggiunta" in badge41 or "Consolidata" in badge41) and ("Raggiunta" in badge42 or "Consolidata" in badge42), [badge41, badge42])
        st = page.evaluate("() => PD.digcomp.stato(PD.progress)['4.1']")
        check("competenze: stato con lezioni, fatte e livello", st["fatte"] >= 1 and st["raggiunta"] and st["livello"] >= 2, st)
        check("competenze: 5 aree e 21 competenze in pagina", page.locator("#view-competenze .dc-area").count() == 5 and page.locator("#view-competenze .dc-comp").count() == 21)
        check("competenze: pulsante per aprire la lezione", page.locator('#view-competenze .dc-comp[data-c="4.1"] [data-go="#/lessons/password"]').count() == 1)
        page.set_viewport_size({"width": 1280, "height": 900})
        page.screenshot(path=SHOTS + "/enti-01-competenze.png")
        page.click("#dc-stampa")
        page.wait_for_timeout(400)
        testo = page.evaluate("() => (document.getElementById('print-area') || {}).textContent || ''")
        check("competenze: stampa con il quadro", "Le mie competenze digitali" in testo and "4.1" in testo, testo[:120])
        page.evaluate("() => window.dispatchEvent(new Event('afterprint'))"); page.wait_for_timeout(400)
        # riquadro nell'Inizio
        page.evaluate("() => PD.go('#/home')")
        page.wait_for_selector("#view-home .dc-tile")
        check("competenze: riquadro nell'Inizio", "di 21 competenze europee" in page.inner_text("#view-home .dc-tile"))
    finally:
        page.evaluate("o => { const v = JSON.parse(o); if (v) PD.progress.lessons.password = v; else delete PD.progress.lessons.password; PD.saveProgress(); }", orig)

    # --- pagina enti ---
    page.evaluate("() => PD.go('#/enti')")
    page.wait_for_selector("#view-enti .inc-tile")
    check("enti: 4 schede", page.locator("#view-enti .enti-scheda").count() == 4)
    check("enti: incontri predefiniti", page.locator("#view-enti .inc-tile").count() == len(inc))
    check("enti: privacy spiegata", "solo su questo computer" in page.inner_text("#view-enti .enti-intro"))
    page.screenshot(path=SHOTS + "/enti-02-incontri.png")
    page.click("#view-enti .inc-tile >> nth=1")
    page.wait_for_selector("#view-enti #inc-avvia")
    check("enti: scaletta dell'incontro", page.locator("#view-enti .inc-scaletta > li").count() >= 5)
    check("enti: pulsanti «Apri»", page.locator("#view-enti .inc-apri").count() >= 3)
    page.screenshot(path=SHOTS + "/enti-03-incontro.png", full_page=True)
    for bid, frase in (("#inc-stampa", "Scheda per il facilitatore"), ("#inc-stampa-all", "Il compito per casa")):
        page.click(bid)
        page.wait_for_timeout(350)
        testo = page.evaluate("() => (document.getElementById('print-area') || {}).textContent || ''")
        check("enti: stampa " + bid, frase in testo, testo[:100])
        page.evaluate("() => window.dispatchEvent(new Event('afterprint'))"); page.wait_for_timeout(400)
    # guida a tempo
    page.click("#inc-avvia")
    page.wait_for_selector("#view-enti .inc-guida-passo")
    t1 = page.inner_text("#view-enti .inc-crono-t")
    page.wait_for_timeout(1300)
    t2 = page.inner_text("#view-enti .inc-crono-t")
    check("guida: il cronometro avanza", t1 != t2, [t1, t2])
    page.evaluate("() => PD.incontri.avanzaTempo(11 * 60000)")
    page.wait_for_timeout(200)
    check("guida: segnale gentile a tempo finito", "scaduto" in (page.get_attribute("#view-enti .inc-guida-passo", "class") or ""))
    page.screenshot(path=SHOTS + "/enti-04-guida.png")
    page.click("#g-avanti")
    page.wait_for_timeout(200)
    check("guida: passo successivo", page.evaluate("() => PD.incontri.guida().passo") == 1 and "Passo 2" in page.inner_text("#view-enti .inc-guida-passo"))
    page.click("#view-enti .inc-guida-cmd [data-go]")
    page.wait_for_timeout(300)
    check("guida: la barra resta visibile fuori dalla guida", page.is_visible("#enti-guida-bar"))
    page.screenshot(path=SHOTS + "/enti-05-barra-guida.png")
    page.click("#enti-guida-bar [data-gb=guida]")
    page.wait_for_selector("#view-enti .inc-guida-passo")
    check("guida: si torna alla guida", not page.is_visible("#enti-guida-bar"))
    page.evaluate("() => PD.incontri.termina()")

    # --- altre schede ---
    for tab in ("registro", "resoconto"):
        page.evaluate("t => PD.go('#/enti/' + t)", tab)
        page.wait_for_timeout(200)
        check("enti: scheda " + tab, page.evaluate("() => document.getElementById('enti-box').innerHTML.trim().length > 20"))
    page.evaluate("() => PD.go('#/enti/digcomp')")
    page.wait_for_selector("#view-enti .dc-riga")
    check("enti: tabella DigComp con 21 righe", page.locator("#view-enti .dc-riga").count() == 21)

    # --- telefono e tema scuro ---
    tema = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
    try:
        page.evaluate("() => document.documentElement.setAttribute('data-theme', 'dark')")
        page.screenshot(path=SHOTS + "/enti-06-digcomp-scuro.png")
        page.set_viewport_size({"width": 390, "height": 844})
        for h, nome in (("#/competenze", "07-competenze-390"), ("#/enti/incontri/password", "08-incontro-390"), ("#/enti/digcomp", "09-digcomp-390")):
            page.evaluate("h => PD.go(h)", h)
            page.wait_for_timeout(250)
            larg = page.evaluate("() => document.documentElement.scrollWidth")
            check("enti: niente scorrimento orizzontale a 390 px " + h, larg <= 392, larg)
            page.screenshot(path=SHOTS + "/enti-" + nome + ".png", full_page=(nome != "07-competenze-390"))
        page.evaluate("() => PD.go('#/enti/incontri/password')")
        page.wait_for_selector("#view-enti #inc-avvia")
        page.click("#inc-avvia")
        page.wait_for_selector("#view-enti .inc-guida-passo")
        larg = page.evaluate("() => document.documentElement.scrollWidth")
        check("enti: guida a 390 px", larg <= 392, larg)
        page.screenshot(path=SHOTS + "/enti-10-guida-390-scuro.png")
        page.evaluate("() => PD.incontri.termina()")
    finally:
        page.evaluate("t => document.documentElement.setAttribute('data-theme', t || 'light')", tema)
        page.set_viewport_size({"width": 1366, "height": 800})
        page.evaluate("() => { if (window.__printOrig) window.print = window.__printOrig; PD.go('#/home'); }")
